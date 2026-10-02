import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import ReturnHome from "./ReturnHome";
import { loadCatalog } from "./rail/offline";
vi.mock("./rail/offline", () => ({ loadCatalog: vi.fn() }));
const rows = [
  {
    id: "shinjuku",
    name: "新宿",
    lat: 35,
    lon: 139,
    operators: ["test"],
    lines: ["test"],
  },
];
const position = (accuracy = 20, timestamp = Date.now()) =>
  ({
    coords: { latitude: 35, longitude: 139, accuracy },
    timestamp,
  }) as GeolocationPosition;
let success: PositionCallback;
let failure: PositionErrorCallback | null;
const getCurrentPosition = vi.fn(
  (ok: PositionCallback, bad?: PositionErrorCallback | null) => {
    success = ok;
    failure = bad ?? null;
    return 7;
  },
);
beforeEach(() => {
  vi.mocked(loadCatalog).mockReset().mockResolvedValue(rows);
  getCurrentPosition.mockClear();
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { watchPosition: getCurrentPosition, clearWatch: vi.fn() },
  });
});
it("automatically searches once from the closest station after one tap without changing settings", async () => {
  const onStation = vi.fn();
  localStorage.setItem(
    "quick-route.stations.v1",
    '{"nearby":"東京","destination":"新宿"}',
  );
  render(<ReturnHome home="東京" disabled={false} onStation={onStation} />);
  expect(getCurrentPosition).not.toHaveBeenCalled();
  await userEvent.click(screen.getByText("現在地から帰る"));
  await act(async () => success(position()));
  expect(onStation).toHaveBeenCalledWith(rows[0]);
  await act(async () => success(position()));
  expect(onStation).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByRole("button", { name: /新宿から帰る/ }),
  ).not.toBeInTheDocument();
  expect(localStorage.getItem("quick-route.stations.v1")).toBe(
    '{"nearby":"東京","destination":"新宿"}',
  );
});
it("does not auto-search if location becomes stale while the catalog is loading", async () => {
  const onStation = vi.fn();
  let complete!: (value: typeof rows) => void;
  vi.mocked(loadCatalog).mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  render(<ReturnHome home="東京" disabled={false} onStation={onStation} />);
  await userEvent.click(screen.getByText("現在地から帰る"));
  await act(async () => success(position()));
  const time = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 120000);
  try {
    await act(async () => complete(rows));
    expect(onStation).not.toHaveBeenCalled();
    expect(screen.getByText(/位置情報が古い/)).toBeVisible();
  } finally {
    time.mockRestore();
  }
});
it("handles denied permission without downloading the catalog", async () => {
  render(<ReturnHome home="東京" disabled={false} onStation={vi.fn()} />);
  await userEvent.click(screen.getByText("現在地から帰る"));
  await act(async () => failure!({ code: 1 } as GeolocationPositionError));
  expect(screen.getByText(/位置情報が許可されていません/)).toBeVisible();
  expect(loadCatalog).not.toHaveBeenCalled();
});
it("does not overwrite another search with a delayed station download", async () => {
  const onStation = vi.fn();
  let complete!: (value: typeof rows) => void;
  vi.mocked(loadCatalog).mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  const view = render(
    <ReturnHome home="東京" disabled={false} onStation={onStation} />,
  );
  await userEvent.click(screen.getByText("現在地から帰る"));
  await act(async () => success(position()));
  view.rerender(
    <ReturnHome home="東京" disabled={true} onStation={onStation} />,
  );
  view.rerender(
    <ReturnHome home="東京" disabled={false} onStation={onStation} />,
  );
  await act(async () => complete(rows));
  expect(onStation).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: /現在地から帰る/ })).toBeEnabled();
});
it("rejects poor GPS and stale fixes", async () => {
  render(<ReturnHome home="東京" disabled={false} onStation={vi.fn()} />);
  await userEvent.click(screen.getByText("現在地から帰る"));
  await act(async () => success(position(500)));
  await act(async () => failure!({ code: 3 } as GeolocationPositionError));
  expect(screen.getByText(/精度が不足/)).toBeVisible();
  await userEvent.click(screen.getByText("現在地から帰る"));
  await act(async () => success(position(20, Date.now() - 120000)));
  await act(async () => failure!({ code: 3 } as GeolocationPositionError));
  expect(screen.getByText(/位置情報が古い/)).toBeVisible();
  expect(loadCatalog).not.toHaveBeenCalled();
});
it("ignores a canceled request and allows retrying", async () => {
  const onStation = vi.fn();
  render(<ReturnHome home="東京" disabled={false} onStation={onStation} />);
  await userEvent.click(screen.getByText("現在地から帰る"));
  const old = success;
  await userEvent.click(screen.getByText("駅の検出をキャンセル"));
  await act(async () => old(position()));
  expect(loadCatalog).not.toHaveBeenCalled();
  await userEvent.click(screen.getByText("現在地から帰る"));
  await act(async () => success(position()));
  expect(onStation).toHaveBeenCalledTimes(1);
  expect(onStation).toHaveBeenCalledWith(rows[0]);
});
it("handles unavailable station data without claiming a station was detected", async () => {
  vi.mocked(loadCatalog).mockRejectedValueOnce(Error("offline"));
  render(<ReturnHome home="東京" disabled={false} onStation={vi.fn()} />);
  await userEvent.click(screen.getByText("現在地から帰る"));
  await act(async () => success(position()));
  await waitFor(() =>
    expect(screen.getByText(/駅データを取得できません/)).toBeVisible(),
  );
  expect(screen.queryByText("新宿から帰る")).not.toBeInTheDocument();
});
