// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { plan, runsOn } from "./router";
import { validatePackage } from "./offline";
import type {
  NationalStation,
  RailPackage,
  RealtimeSnapshot,
  Trip,
} from "./model";
// Explicit test fixtures. They are never shipped under public/data or selected by the application.
const stop = (id: string) => ({ id, name: id, lat: 35, lon: 139 });
const station = (name: string): NationalStation => ({
  id: name,
  name,
  lat: 35,
  lon: 139,
  operators: ["test"],
  lines: ["test"],
});
const trip = (id: string, times: [string, number, number][]): Trip => ({
  id,
  route: "r",
  service: "s",
  headsign: "C",
  times: times.map((s, i) => [...s, i, true, true]),
});
function fixture(trips: Trip[]): RailPackage {
  return {
    schema: 1,
    id: "fixture",
    version: "1",
    validFrom: "20260101",
    validTo: "20261231",
    source: "test-only",
    license: "CC0-1.0",
    operator: "test",
    routes: [{ id: "r", name: "test" }],
    stops: ["A", "B", "C", "D"].map(stop),
    trips,
    transfers: [],
    calendars: [
      {
        id: "s",
        start: "20260101",
        end: "20261231",
        days: [1, 1, 1, 1, 1, 1, 1],
      },
    ],
    exceptions: [],
    completeTransfers: true,
    synthetic: false,
  };
}
const midnight = Date.parse("2026-10-01T00:00:00+09:00");
const t = (hour: number) => hour * 3600;
const search = (
  p: RailPackage,
  departure = midnight + t(8) * 1000,
  realtime?: RealtimeSnapshot,
) =>
  plan({
    packages: [p],
    from: station("A"),
    to: station("C"),
    departure,
    realtime,
  });
it("earliest arrival beats first departure, retains next train and same-arrival comparison", () => {
  const p = fixture([
    trip("slow", [
      ["A", t(9), t(9)],
      ["C", t(11), t(11)],
    ]),
    trip("fast", [
      ["A", t(10), t(10)],
      ["C", t(10.5), t(10.5)],
    ]),
    trip("later", [
      ["A", t(10.1), t(10.1)],
      ["C", t(10.5), t(10.5)],
    ]),
  ]);
  const r = search(p);
  expect(r.journeys[0].legs[0].tripId).toBe("fast");
  expect(r.nextTrainSameArrival).toBe(true);
});
it("does not fabricate a transfer at the same station", () => {
  const p = fixture([
    trip("a", [
      ["A", t(9), t(9)],
      ["B", t(10), t(10)],
    ]),
    trip("b", [
      ["B", t(10.1), t(10.1)],
      ["C", t(11), t(11)],
    ]),
  ]);
  expect(search(p).journeys).toHaveLength(0);
  p.transfers = [{ from: "B", to: "B", seconds: 300, source: "test" }];
  expect(search(p).journeys[0].changes).toBe(1);
  p.transfers[0].seconds = 400;
  expect(
    search(p).journeys.every((j) => j.legs[1].serviceDate !== "20261001"),
  ).toBe(true);
});
it("stays on the same trip without a transfer", () => {
  const p = fixture([
    trip("through", [
      ["A", t(9), t(9)],
      ["B", t(10), t(10)],
      ["C", t(11), t(11)],
    ]),
  ]);
  expect(search(p).journeys[0].changes).toBe(0);
  expect(search(p).journeys[0].legs[0].to.name).toBe("C");
});
it("handles previous service day after midnight and last train", () => {
  const p = fixture([
    trip("night", [
      ["A", t(24.1), t(24.1)],
      ["C", t(25), t(25)],
    ]),
  ]);
  const r = search(p, Date.parse("2026-10-02T00:00:00+09:00"));
  expect(r.journeys[0].legs[0].serviceDate).toBe("20261001");
  expect(r.journeys[0].arrival).toBe(Date.parse("2026-10-02T01:00:00+09:00"));
});
it("applies service exception before weekly calendar", () => {
  const p = fixture([]);
  p.exceptions = [{ service: "s", date: "20261001", added: false }];
  expect(runsOn(p, "s", "20261001")).toBe(false);
  expect(runsOn(p, "s", "20261002")).toBe(true);
  p.calendars[0].days = [0, 0, 0, 0, 0, 0, 0];
  p.exceptions[0].added = true;
  expect(runsOn(p, "s", "20261001")).toBe(true);
});
it("rejects mismatched operator, expiry and production synthetic data", () => {
  const p = fixture([
    trip("a", [
      ["A", t(9), t(9)],
      ["C", t(10), t(10)],
    ]),
  ]);
  p.operator = "other";
  expect(search(p).journeys).toHaveLength(0);
  p.operator = "test";
  p.validTo = "20260930";
  expect(search(p).journeys).toHaveLength(0);
  p.validTo = "20261231";
  p.synthetic = true;
  expect(search(p).journeys).toHaveLength(0);
});
it("honors pickup and dropoff restrictions", () => {
  const p = fixture([
    trip("a", [
      ["A", t(9), t(9)],
      ["C", t(10), t(10)],
    ]),
  ]);
  p.trips[0].times[0][4] = false;
  expect(search(p).journeys).toHaveLength(0);
  p.trips[0].times[0][4] = true;
  p.trips[0].times[1][5] = false;
  expect(search(p).journeys).toHaveLength(0);
});
it("applies only fresh dated official predictions and cancellation", () => {
  const p = fixture([
    trip("a", [
      ["A", t(9), t(9)],
      ["C", t(10), t(10)],
    ]),
  ]);
  const departure = midnight + t(8) * 1000;
  const rt: RealtimeSnapshot = {
    source: "test",
    timestamp: departure,
    fetchedAt: departure,
    expiresAt: departure + 120000,
    trips: [
      {
        tripId: "a",
        startDate: "20261001",
        canceled: false,
        stops: [{ stopId: "C", arrivalDelay: 600 }],
      },
    ],
  };
  expect(search(p, departure, rt).journeys[0].arrival).toBe(
    midnight + t(10) * 1000 + 600000,
  );
  expect(search(p, departure + 180000, rt).journeys[0].evidence).toBe(
    "schedule",
  );
  rt.trips[0].canceled = true;
  expect(
    search(p, departure, rt).journeys.every(
      (j) => j.legs[0].serviceDate !== "20261001",
    ),
  ).toBe(true);
});
it("validates real Toei package and compares a known trip against source times", () => {
  const m = JSON.parse(readFileSync("public/data/manifest.json", "utf8"));
  const p = JSON.parse(
    readFileSync("public/" + m.packages[0].url, "utf8"),
  ) as RailPackage;
  validatePackage(p);
  const tr = p.trips.find((t) => runsOn(p, t.service, "20261001"))!,
    first = tr.times[0],
    last = tr.times.at(-1)!;
  const ns = (id: string): NationalStation => ({
    ...p.stops.find((s) => s.id === id)!,
    operators: ["東京都"],
    lines: ["浅草線"],
  });
  const r = plan({
    packages: [p],
    from: ns(first[0]),
    to: ns(last[0]),
    departure: midnight + first[2] * 1000,
  });
  const exact = r.journeys.find(
    (j) => j.legs[0].tripId === tr.id && j.legs[0].serviceDate === "20261001",
  );
  expect(exact?.arrival).toBe(midnight + last[1] * 1000);
  for (const meta of m.packages)
    validatePackage(JSON.parse(readFileSync("public/" + meta.url, "utf8")));
});
it("keeps the first arrival at a repeated station in real Oedo timetables", () => {
  const m = JSON.parse(readFileSync("public/data/manifest.json", "utf8"));
  const meta = m.packages.find((p: { id: string }) => p.id === "toei-4");
  const p = JSON.parse(
    readFileSync("public/" + meta.url, "utf8"),
  ) as RailPackage;
  const trip = p.trips.find(
    (t) =>
      runsOn(p, t.service, "20261001") &&
      t.times.some(
        (s, i) =>
          i > 0 && t.times.slice(i + 1).some((next) => next[0] === s[0]),
      ),
  )!;
  const first = trip.times[0],
    duplicate = trip.times.find(
      (s, i) =>
        i > 0 && trip.times.slice(i + 1).some((next) => next[0] === s[0]),
    )!;
  const ns = (id: string): NationalStation => ({
    ...p.stops.find((s) => s.id === id)!,
    operators: ["東京都"],
    lines: ["大江戸線"],
  });
  const r = plan({
    packages: [{ ...p, trips: [trip] }],
    from: ns(first[0]),
    to: ns(duplicate[0]),
    departure: midnight + first[2] * 1000,
  });
  expect(r.journeys[0].arrival).toBe(midnight + duplicate[1] * 1000);
  expect(r.journeys[0].legs[0].toSequence).toBe(duplicate[3]);
  expect(r.journeys.length).toBeGreaterThan(1);
});
