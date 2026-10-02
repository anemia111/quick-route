// @vitest-environment node
import { expect, it } from "vitest";
import { nearbyStations } from "./nearbyStations";
import type { NationalStation } from "./model";
const station = (
  id: string,
  name: string,
  lat: number,
  lon = 139,
): NationalStation => ({
  id,
  name,
  lat,
  lon,
  operators: ["test"],
  lines: ["test"],
});
it("ranks real geographic distance, caps candidates, and combines colocated station records", () => {
  const rows = [
    station("far", "遠い駅", 35.03),
    station("a", "東京", 35),
    station("duplicate", "東京", 35.0001),
    station("b", "新宿", 35.01),
    station("c", "別駅", 35.02),
  ];
  const nearby = nearbyStations(rows, 35, 139, 20);
  expect(nearby.map((s) => s.station.id)).toEqual(["a", "b", "c"]);
  expect(nearby[1].metres).toBeCloseTo(1111.95, 0);
});
it("does not call a distant station nearby or accept unreliable coordinates", () => {
  expect(nearbyStations([station("far", "東京", 36)], 35, 139, 20)).toEqual([]);
  for (const args of [
    [NaN, 139, 20],
    [91, 139, 20],
    [35, 181, 20],
    [35, 139, 500],
    [35, 139, -1],
  ])
    expect(() => nearbyStations([], args[0], args[1], args[2])).toThrow();
});
