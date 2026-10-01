import { parse } from "protobufjs";
import type { RealtimeSnapshot, RealtimeTrip } from "./model";
// Field numbers follow the official GTFS Realtime protobuf reference. Unknown fields are skipped.
const schema = `syntax="proto2";
message Feed { optional Header header=1; repeated Entity entity=2; }
message Header { optional string version=1; optional int32 incrementality=2; optional uint64 timestamp=3; }
message Entity { optional string id=1; optional bool deleted=2; optional Update tripUpdate=3; }
message Update { optional Descriptor trip=1; repeated StopUpdate stopTimeUpdate=2; optional uint64 timestamp=4; optional int32 delay=5; }
message Descriptor { optional string tripId=1; optional string startTime=2; optional string startDate=3; optional int32 relationship=4; optional string routeId=5; }
message StopUpdate { optional uint32 sequence=1; optional Event arrival=2; optional Event departure=3; optional string stopId=4; optional int32 relationship=5; }
message Event { optional int32 delay=1; optional int64 time=2; optional int32 uncertainty=3; }`;
const Feed = parse(schema).root.lookupType("Feed");
export const REALTIME_URL =
  "https://api-public.odpt.org/api/v4/gtfs/realtime/toei_odpt_train_trip_update";
interface RawFeed {
  header?: { timestamp?: number; incrementality?: number };
  entity?: {
    deleted?: boolean;
    tripUpdate?: {
      timestamp?: number;
      trip?: { tripId?: string; startDate?: string; relationship?: number };
      stopTimeUpdate?: {
        stopId?: string;
        sequence?: number;
        relationship?: number;
        arrival?: { time?: number; delay?: number };
        departure?: { time?: number; delay?: number };
      }[];
    };
  }[];
}
export function decodeRealtime(
  bytes: Uint8Array,
  now = Date.now(),
): RealtimeSnapshot {
  const f = Feed.toObject(Feed.decode(bytes), {
    longs: Number,
    defaults: false,
  }) as RawFeed;
  const timestamp = (f.header?.timestamp ?? 0) * 1000;
  if (
    !Number.isSafeInteger(timestamp) ||
    timestamp < now - 120000 ||
    timestamp > now + 60000 ||
    f.header?.incrementality === 1
  )
    throw Error("Stale or unsupported realtime feed");
  const trips: RealtimeTrip[] = [];
  for (const e of f.entity ?? []) {
    const u = e.tripUpdate,
      t = u?.trip;
    if (e.deleted || !t?.tripId || !t.startDate || !/^\d{8}$/.test(t.startDate))
      continue;
    if (
      u?.timestamp !== undefined &&
      (!Number.isSafeInteger(u.timestamp) ||
        u.timestamp * 1000 < now - 120000 ||
        u.timestamp * 1000 > now + 60000)
    )
      continue;
    // Added/duplicated trips need a complete official timetable; unavailable here.
    if (
      t.relationship !== undefined &&
      t.relationship !== 0 &&
      t.relationship !== 3
    )
      continue;
    const stops = (u?.stopTimeUpdate ?? []).map((s) => ({
      stopId: s.stopId,
      sequence: s.sequence,
      arrival: s.arrival?.time,
      departure: s.departure?.time,
      arrivalDelay: s.arrival?.delay,
      departureDelay: s.departure?.delay,
      skipped: s.relationship === 1,
      noData: s.relationship === 2,
    }));
    if (
      stops.some((s) =>
        [s.arrival, s.departure, s.arrivalDelay, s.departureDelay].some(
          (v) => v !== undefined && !Number.isSafeInteger(v),
        ),
      )
    )
      continue;
    trips.push({
      tripId: t.tripId,
      startDate: t.startDate,
      canceled: t.relationship === 3,
      stops,
    });
  }
  return {
    source: REALTIME_URL,
    fetchedAt: now,
    timestamp,
    expiresAt: timestamp + 120000,
    trips,
  };
}
let last: RealtimeSnapshot | undefined;
let inflight: Promise<RealtimeSnapshot> | undefined;
let attempted = 0;
export async function getRealtime(
  now = Date.now(),
): Promise<RealtimeSnapshot | undefined> {
  if (now - attempted < 60000)
    return last && last.expiresAt > now ? last : undefined;
  if (inflight) return inflight;
  attempted = now;
  inflight = (async () => {
    const r = await fetch(REALTIME_URL, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!r.ok) throw Error("Realtime unavailable");
    const raw = new Uint8Array(await r.arrayBuffer());
    if (raw.byteLength > 5 * 1024 * 1024) throw Error("Oversized realtime");
    last = decodeRealtime(raw, Date.now());
    return last;
  })().finally(() => {
    inflight = undefined;
  });
  try {
    return await inflight;
  } catch {
    return undefined;
  }
}
