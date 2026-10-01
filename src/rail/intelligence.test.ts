// @vitest-environment node
import { expect, it } from "vitest";
import { parse } from "protobufjs";
import { decideAlert, journeyImpact, simulateDelay } from "./intelligence";
import { decodeRealtime } from "./realtime";
import { findStations, resolveStation } from "./stationCatalog";
import type { Journey, NationalStation, RealtimeSnapshot } from "./model";
const journey: Journey = {
  id: "j",
  arrival: 5000000,
  departure: 1000000,
  changes: 0,
  evidence: "schedule",
  scope: "available-data",
  legs: [
    {
      packageId: "p",
      tripId: "t",
      serviceDate: "20261001",
      route: "r",
      from: { id: "A", name: "A", lat: 0, lon: 0 },
      to: { id: "B", name: "B", lat: 0, lon: 0 },
      departure: 1000000,
      arrival: 5000000,
      evidence: "schedule",
    },
  ],
};
const rt: RealtimeSnapshot = {
  source: "official",
  fetchedAt: 0,
  timestamp: 0,
  expiresAt: 10000,
  trips: [{ tripId: "t", startDate: "20261001", canceled: true, stops: [] }],
};
it("does not assign an ambiguous stop-id-only update to a repeated stop visit", () => {
  const sequenced = {
    ...journey,
    legs: journey.legs.map((l) => ({ ...l, toSequence: 20 })),
  };
  const update = {
    ...rt,
    trips: [
      {
        tripId: "t",
        startDate: "20261001",
        canceled: false,
        stops: [{ stopId: "B", arrival: 5400 }],
      },
    ],
  };
  expect(journeyImpact(sequenced, update, 1).kind).toBe("unknown");
});
it("distinguishes official cancellation and missing/stale information", () => {
  expect(journeyImpact(journey, rt, 1).kind).toBe("canceled");
  expect(journeyImpact(journey, rt, 10001).kind).toBe("unknown");
  expect(journeyImpact(journey, undefined, 1).confidence).toBe("unknown");
});
it("does not alert for small improvements, suppresses duplicate and cooldown", () => {
  const alt = { ...journey, id: "alt", arrival: journey.arrival - 60000 };
  const impact = journeyImpact(journey, undefined);
  expect(
    decideAlert(journey, alt, impact, { lastAt: 0, fingerprints: [] }, 1000000),
  ).toBeUndefined();
  alt.arrival = journey.arrival - 600000;
  const a = decideAlert(
    journey,
    alt,
    impact,
    { lastAt: 0, fingerprints: [] },
    1000000,
  )!;
  expect(a).toBeDefined();
  expect(
    decideAlert(
      journey,
      alt,
      impact,
      { lastAt: 0, fingerprints: [a.fingerprint] },
      1000000,
    ),
  ).toBeUndefined();
  expect(
    decideAlert(
      journey,
      alt,
      impact,
      { lastAt: 999999, fingerprints: [] },
      1000000,
    ),
  ).toBeUndefined();
});
it("explicit simulation never becomes official information or a factual alert", () => {
  const sim = simulateDelay(journey, 300);
  expect(sim.evidence).toBe("simulation");
  expect(sim.arrival).toBe(journey.arrival + 300000);
  expect(() => simulateDelay(journey, -1)).toThrow();
});
it("rejects stale and malformed realtime bytes", () => {
  expect(() => decodeRealtime(new Uint8Array(), Date.now())).toThrow();
  expect(() => decodeRealtime(new Uint8Array([255]), Date.now())).toThrow();
});
it("requires disambiguation for same-name stations and normalizes spelling", () => {
  const a = {
    id: "a",
    name: "霞ケ関",
    operators: ["A"],
    lines: ["A"],
    lat: 0,
    lon: 0,
  };
  const b = { ...a, id: "b", operators: ["B"] };
  const rows = [a, b] as NationalStation[];
  expect(findStations(rows, "霞ヶ関駅")).toHaveLength(2);
  expect(resolveStation(rows, "霞ヶ関")).toBeUndefined();
  expect(resolveStation(rows, "霞ヶ関", "b")?.id).toBe("b");
});
it("detects an officially predicted missed transfer only with a confirmed transfer time", () => {
  const multi = {
    ...journey,
    changes: 1,
    legs: [
      journey.legs[0],
      {
        ...journey.legs[0],
        tripId: "next",
        from: journey.legs[0].to,
        to: { id: "C", name: "C", lat: 0, lon: 0 },
        departure: 5200000,
        arrival: 6000000,
      },
    ],
  };
  const update: RealtimeSnapshot = {
    ...rt,
    trips: [
      {
        tripId: "t",
        startDate: "20261001",
        canceled: false,
        stops: [{ stopId: "B", arrival: 5400 }],
      },
      {
        tripId: "next",
        startDate: "20261001",
        canceled: false,
        stops: [{ stopId: "B", departure: 5200 }],
      },
    ],
  };
  expect(journeyImpact(multi, update, 1, [120]).kind).toBe("missed-transfer");
  expect(journeyImpact(multi, update, 1).kind).toBe("unknown");
  update.trips[0].stops[0].skipped = true;
  expect(journeyImpact(multi, update, 1, [120]).kind).toBe("skipped-stop");
});
it("decodes actual GTFS protobuf field numbers without inventing a service date", () => {
  const root = parse(
    `syntax="proto2"; message FeedMessage {optional FeedHeader header=1;repeated FeedEntity entity=2;} message FeedHeader {optional string gtfs_realtime_version=1;optional uint64 timestamp=3;} message FeedEntity {optional string id=1;optional TripUpdate trip_update=3;} message TripUpdate {optional TripDescriptor trip=1;repeated StopTimeUpdate stop_time_update=2;} message TripDescriptor {optional string trip_id=1;optional string start_date=3;} message StopTimeUpdate {optional uint32 stop_sequence=1;optional Event arrival=2;optional string stop_id=4;} message Event {optional int32 delay=1;}`,
  ).root;
  const type = root.lookupType("FeedMessage"),
    now = Date.parse("2026-10-01T08:00:00+09:00");
  const bytes = type
    .encode(
      type.create({
        header: { gtfsRealtimeVersion: "2.0", timestamp: now / 1000 },
        entity: [
          {
            id: "1",
            tripUpdate: {
              trip: { tripId: "t", startDate: "20261001" },
              stopTimeUpdate: [
                { stopSequence: 2, stopId: "B", arrival: { delay: 60 } },
              ],
            },
          },
        ],
      }),
    )
    .finish();
  const result = decodeRealtime(bytes, now);
  expect(result.trips[0].startDate).toBe("20261001");
  expect(result.trips[0].stops[0].arrivalDelay).toBe(60);
  expect(result.trips[0].stops[0].sequence).toBe(2);
  expect(result.expiresAt).toBe(now + 120000);
});
it("applies a fresh delay only once when the selected route already included an earlier prediction", () => {
  const delayed = {
    ...journey,
    arrival: journey.arrival + 600000,
    legs: journey.legs.map((l) => ({
      ...l,
      scheduledArrival: l.arrival,
      scheduledDeparture: l.departure,
      arrival: l.arrival + 600000,
      evidence: "official-prediction" as const,
    })),
  };
  const update: RealtimeSnapshot = {
    ...rt,
    trips: [
      {
        tripId: "t",
        startDate: "20261001",
        canceled: false,
        stops: [{ stopId: "B", arrivalDelay: 300 }],
      },
    ],
  };
  expect(journeyImpact(delayed, update, 1).arrival).toBe(
    journey.arrival + 300000,
  );
});
