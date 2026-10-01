// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { restoreJourney } from "./journeyState";
import type { RailPackage, ActiveJourney } from "./model";
it("rebases expired predictions to static timetable and rejects corrupt/restored removed trips", () => {
  const m = JSON.parse(readFileSync("public/data/manifest.json", "utf8"));
  const p = JSON.parse(
    readFileSync("public/" + m.packages[0].url, "utf8"),
  ) as RailPackage;
  const t = p.trips[0],
    a = t.times[0],
    b = t.times.at(-1)!,
    midnight = Date.parse("2026-10-01T00:00:00+09:00");
  const state: ActiveJourney = {
    startedAt: midnight,
    status: "active",
    lastEvaluated: midnight,
    journey: {
      id: "test",
      arrival: midnight + b[1] * 1000 + 600000,
      departure: midnight + a[2] * 1000 + 600000,
      changes: 0,
      evidence: "official-prediction",
      scope: "available-data",
      legs: [
        {
          packageId: p.id,
          tripId: t.id,
          serviceDate: "20261001",
          from: p.stops.find((s) => s.id === a[0])!,
          to: p.stops.find((s) => s.id === b[0])!,
          departure: midnight + a[2] * 1000 + 600000,
          arrival: midnight + b[1] * 1000 + 600000,
          evidence: "official-prediction",
          route: "test",
        },
      ],
    },
  };
  const r = restoreJourney(state, [p], midnight);
  expect(r?.journey.evidence).toBe("schedule");
  expect(r?.journey.arrival).toBe(midnight + b[1] * 1000);
  expect(r?.status).toBe("paused");
  expect(
    restoreJourney({ journey: { legs: [{}] } }, [p], midnight),
  ).toBeUndefined();
  expect(restoreJourney(state, [], midnight)).toBeUndefined();
});
