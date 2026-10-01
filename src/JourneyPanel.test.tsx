import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import JourneyPanel from "./JourneyPanel";
import type { Journey, NationalStation, RailPackage } from "./rail/model";
vi.mock("./rail/storage", () => ({
  saveMeta: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./rail/realtime", () => ({
  getRealtime: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./rail/planner", () => ({
  calculate: vi.fn().mockResolvedValue({ journeys: [] }),
}));
const journey: Journey = {
  id: "j",
  arrival: Date.parse("2026-10-01T11:00:00+09:00"),
  departure: Date.parse("2026-10-01T10:00:00+09:00"),
  changes: 0,
  evidence: "schedule",
  scope: "available-data",
  legs: [
    {
      packageId: "p",
      tripId: "t",
      serviceDate: "20261001",
      route: "路線",
      from: { id: "A", name: "A", lat: 0, lon: 0 },
      to: { id: "B", name: "B", lat: 0, lon: 0 },
      departure: Date.parse("2026-10-01T10:00:00+09:00"),
      arrival: Date.parse("2026-10-01T11:00:00+09:00"),
      evidence: "schedule",
    },
  ],
};
const catalog: NationalStation[] = [
  {
    id: "A",
    name: "A",
    lat: 0,
    lon: 0,
    operators: ["東京都"],
    lines: ["test"],
  },
  {
    id: "B",
    name: "B",
    lat: 0,
    lon: 0,
    operators: ["東京都"],
    lines: ["test"],
  },
];
const packages = [
  {
    id: "p",
    stops: journey.legs.flatMap((l) => [l.from, l.to]),
    transfers: [],
  },
] as unknown as RailPackage[];
const props = {
  result: { journeys: [journey], elapsedMs: 0, nextTrainSameArrival: false },
  catalog,
  packages,
  onClose: vi.fn(),
  onExternal: vi.fn(),
};
it("expires a prediction label even while tracking is not running", async () => {
  const predicted = {
    ...journey,
    evidence: "official-prediction" as const,
    realtimeExpiresAt: Date.now() + 200,
  };
  render(
    <JourneyPanel
      {...props}
      result={{ ...props.result, journeys: [predicted] }}
    />,
  );
  expect(screen.getByText(/公式発着予測を含む/)).toBeVisible();
  await waitFor(() =>
    expect(screen.getByText(/以前の公式発着予測（最新未確認）/)).toBeVisible(),
  );
});
it("starts only by explicit action, handles denied location and ends tracking", async () => {
  const u = userEvent.setup();
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      watchPosition: (_s: PositionCallback, e: PositionErrorCallback) => {
        e({ code: 1, message: "denied" } as GeolocationPositionError);
        return 1;
      },
      clearWatch: vi.fn(),
    } as unknown as Geolocation,
  });
  render(<JourneyPanel {...props} />);
  expect(screen.queryByText("追跡を終了")).not.toBeInTheDocument();
  await u.click(screen.getByText("この経路で移動を開始"));
  await u.click(screen.getByText("位置情報で近くの駅を確認"));
  expect(screen.getByText(/位置情報を取得できません/)).toBeVisible();
  await u.click(screen.getByText("追跡を終了"));
  expect(screen.getByText("追跡を終了しました。")).toBeVisible();
});
it("restores a paused journey honestly and allows ending without position", async () => {
  render(
    <JourneyPanel
      {...props}
      restored={{ journey, status: "paused", startedAt: 1, lastEvaluated: 1 }}
    />,
  );
  expect(screen.getByText(/非表示中の追跡は行っていません/)).toBeVisible();
  await userEvent.click(screen.getByText("追跡を終了"));
  expect(screen.getByText("この経路で移動を開始")).toBeVisible();
});
it("rejects poor GPS and stops location watching when hidden, then requires confirmation on return", async () => {
  let report: PositionCallback | undefined;
  const clearWatch = vi.fn();
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      watchPosition: vi.fn((callback: PositionCallback) => {
        report = callback;
        return 7;
      }),
      clearWatch,
    },
  });
  const original = Object.getOwnPropertyDescriptor(document, "visibilityState");
  render(<JourneyPanel {...props} />);
  const u = userEvent.setup();
  await u.click(screen.getByText("この経路で移動を開始"));
  await u.click(screen.getByText("位置情報で近くの駅を確認"));
  act(() =>
    report!({
      coords: { accuracy: 500, latitude: 0, longitude: 0 },
    } as GeolocationPosition),
  );
  expect(screen.getByText(/GPSの精度が不足/)).toBeVisible();
  expect(screen.queryByText(/駅にいると確認する/)).not.toBeInTheDocument();
  try {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(clearWatch).toHaveBeenCalledWith(7);
    expect(screen.getByText(/追跡を一時停止/)).toBeVisible();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByText(/アプリ復帰後の情報を更新/)).toBeVisible();
    expect(screen.getByRole("combobox")).toHaveValue("");
  } finally {
    if (original) Object.defineProperty(document, "visibilityState", original);
    else Reflect.deleteProperty(document, "visibilityState");
  }
});
it("does not switch route until the user approves a meaningful alternative", async () => {
  const alt = {
    ...journey,
    id: "alt",
    arrival: journey.arrival - 600000,
    legs: journey.legs.map((l) => ({
      ...l,
      tripId: "alternative",
      route: "代替路線",
      arrival: l.arrival - 600000,
    })),
  };
  const { calculate } = await import("./rail/planner");
  vi.mocked(calculate).mockResolvedValueOnce({
    journeys: [alt],
    nextTrainSameArrival: false,
    elapsedMs: 0,
  });
  render(<JourneyPanel {...props} />);
  const u = userEvent.setup();
  await u.click(screen.getByText("この経路で移動を開始"));
  await u.selectOptions(screen.getByRole("combobox"), "A");
  await waitFor(() =>
    expect(screen.getByText("この変更を承認する")).toBeVisible(),
  );
  expect(screen.queryByText("代替路線")).not.toBeInTheDocument();
  await u.click(screen.getByText("この変更を承認する"));
  expect(screen.getByText("代替路線")).toBeVisible();
});
