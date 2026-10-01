import { runsOn } from "./calendar";
export { runsOn } from "./calendar";
import type {
  Journey,
  Leg,
  NationalStation,
  RailPackage,
  RealtimeSnapshot,
  RoutingResult,
  Stop,
  Trip,
} from "./model";
import { normalizeName } from "./stationCatalog";
import { tokyoDate, validOn } from "./offline";
export interface PlanRequest {
  packages: RailPackage[];
  from: NationalStation;
  to: NationalStation;
  departure: number;
  realtime?: RealtimeSnapshot;
  excludedTrips?: string[];
}
interface Connection {
  fromSequence: number;
  toSequence: number;
  scheduledDeparture: number;
  scheduledArrival: number;
  p: RailPackage;
  trip: Trip;
  date: string;
  key: string;
  from: Stop;
  to: Stop;
  departure: number;
  arrival: number;
  pickup: boolean;
  dropoff: boolean;
  evidence: Leg["evidence"];
}
interface Label {
  ready: number;
  legs: Leg[];
}
function distance(a: Stop, b: NationalStation) {
  const dy = (a.lat - b.lat) * 111000,
    dx = (a.lon - b.lon) * 111000 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dx, dy);
}
export function matchingStops(p: RailPackage, s: NationalStation): Stop[] {
  const officialOperator =
    p.operator === "東京都交通局" ? "東京都" : p.operator;
  if (!s.operators.includes(officialOperator)) return [];
  return p.stops.filter(
    (t) =>
      normalizeName(t.name) === normalizeName(s.name) && distance(t, s) < 500,
  );
}
export function connections(request: PlanRequest): Connection[] {
  const result: Connection[] = [];
  const fresh =
    request.realtime &&
    request.realtime.expiresAt > request.departure &&
    request.realtime.timestamp <= request.departure + 60000
      ? request.realtime
      : undefined;
  for (let offset = -1; offset <= 1; offset++) {
    const date = tokyoDate(request.departure + offset * 86400000);
    const midnight = Date.parse(
      `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00+09:00`,
    );
    for (const p of request.packages) {
      if (date < p.validFrom || date > p.validTo) continue;
      const stops = new Map(p.stops.map((s) => [s.id, s]));
      for (const t of p.trips) {
        if (
          !runsOn(p, t.service, date) ||
          request.excludedTrips?.includes(`${p.id}:${t.id}`)
        )
          continue;
        const rt = fresh?.trips.find(
          (u) => u.tripId === t.id && u.startDate === date,
        );
        if (rt?.canceled) continue;
        let delay = 0;
        const adjusted = t.times.map((s) => {
          const update = rt?.stops.find((u) =>
            u.sequence !== undefined
              ? u.sequence === s[3] && (!u.stopId || u.stopId === s[0])
              : u.stopId === s[0] &&
                t.times.filter((time) => time[0] === s[0]).length === 1,
          );
          if (update?.noData) delay = 0;
          const u = update?.noData ? undefined : update;
          const arrival =
            u?.arrival !== undefined
              ? u.arrival * 1000
              : midnight + (s[1] + (u?.arrivalDelay ?? delay)) * 1000;
          if (u?.departureDelay !== undefined) delay = u.departureDelay;
          else if (u?.arrivalDelay !== undefined) delay = u.arrivalDelay;
          const departure =
            u?.departure !== undefined
              ? u.departure * 1000
              : midnight + (s[2] + delay) * 1000;
          return {
            s,
            arrival,
            departure,
            skip: !!u?.skipped,
            evidence:
              rt &&
              (u?.arrival !== undefined ||
                u?.departure !== undefined ||
                u?.arrivalDelay !== undefined ||
                u?.departureDelay !== undefined ||
                delay !== 0)
                ? ("official-prediction" as const)
                : ("schedule" as const),
          };
        });
        // Contradictory official updates are discarded; no fabricated chronology.
        if (
          adjusted.some(
            (a, i) =>
              a.departure < a.arrival ||
              (i > 0 && a.arrival < adjusted[i - 1].departure),
          )
        )
          continue;
        for (let i = 0; i < adjusted.length - 1; i++) {
          const a = adjusted[i],
            b = adjusted[i + 1];
          if (
            a.departure < request.departure ||
            a.departure > request.departure + 36 * 3600000
          )
            continue;
          result.push({
            fromSequence: a.s[3],
            toSequence: b.s[3],
            scheduledDeparture: midnight + a.s[2] * 1000,
            scheduledArrival: midnight + b.s[1] * 1000,
            p,
            trip: t,
            date,
            key: `${p.id}:${t.id}:${date}`,
            from: stops.get(a.s[0])!,
            to: stops.get(b.s[0])!,
            departure: a.departure,
            arrival: b.arrival,
            pickup: a.s[4] && !a.skip,
            dropoff: b.s[5] && !b.skip,
            evidence:
              a.evidence === "official-prediction" ||
              b.evidence === "official-prediction"
                ? "official-prediction"
                : "schedule",
          });
        }
      }
    }
  }
  return result.sort(
    (a, b) => a.departure - b.departure || a.arrival - b.arrival,
  );
}
function extend(label: Label, c: Connection, continuing: boolean): Label {
  const legs = label.legs.map((l) => ({ ...l }));
  if (continuing) {
    const last = legs[legs.length - 1];
    last.to = c.to;
    last.arrival = c.arrival;
    last.scheduledArrival = c.scheduledArrival;
    last.toSequence = c.toSequence;
    if (c.evidence === "official-prediction") last.evidence = c.evidence;
  } else
    legs.push({
      fromSequence: c.fromSequence,
      toSequence: c.toSequence,
      scheduledDeparture: c.scheduledDeparture,
      scheduledArrival: c.scheduledArrival,
      packageId: c.p.id,
      tripId: c.trip.id,
      serviceDate: c.date,
      route: c.p.routes.find((r) => r.id === c.trip.route)!.name,
      from: c.from,
      to: c.to,
      departure: c.departure,
      arrival: c.arrival,
      evidence: c.evidence,
    });
  return { ready: c.arrival, legs };
}
export function plan(request: PlanRequest): RoutingResult {
  const started = performance.now();
  const { packages, from, to, departure } = request;
  const result = (journeys: Journey[], reason?: string): RoutingResult => ({
    journeys,
    reason,
    nextTrainSameArrival:
      journeys.length > 1 &&
      journeys.some(
        (j) =>
          j.departure > journeys[0].departure &&
          j.arrival === journeys[0].arrival,
      ),
    elapsedMs: performance.now() - started,
  });
  if (from.id === to.id) return result([], "同じ駅です。");
  if (!packages.length) return result([], "有効な保存済み時刻表がありません。");
  if (packages.some((p) => p.synthetic))
    return result([], "テスト用データでは検索できません。");
  const labels = new Map<string, Label[]>(),
    destinations = new Set<string>();
  for (const p of packages) {
    if (!validOn(p, departure)) continue;
    for (const s of matchingStops(p, from))
      labels.set(`${p.id}:${s.id}`, [{ ready: departure, legs: [] }]);
    for (const s of matchingStops(p, to)) destinations.add(`${p.id}:${s.id}`);
  }
  if (!labels.size || !destinations.size)
    return result([], "駅を対応時刻表に一意に照合できません。");
  const onboard = new Map<string, Label[]>(),
    found: Label[] = [];
  const addLabel = (key: string, label: Label) => {
    const existing = labels.get(key) ?? [];
    const first = label.legs[0];
    if (
      existing.some(
        (l) =>
          l.ready <= label.ready &&
          l.legs.length <= label.legs.length &&
          l.legs[0]?.tripId === first?.tripId &&
          l.legs[0]?.serviceDate === first?.serviceDate,
      )
    )
      return;
    labels.set(
      key,
      [
        ...existing.filter(
          (l) =>
            !(
              label.ready <= l.ready &&
              label.legs.length <= l.legs.length &&
              l.legs[0]?.tripId === first?.tripId
            ),
        ),
        label,
      ]
        .sort((a, b) => a.ready - b.ready)
        .slice(0, 64),
    );
  };
  // Cross-package transfers are not in this schema yet: unrelated packages cannot improve the query.
  const relevant = packages.filter(
    (p) => matchingStops(p, from).length && matchingStops(p, to).length,
  );
  for (const c of connections({ ...request, packages: relevant })) {
    const continuing = onboard.get(c.key) ?? [];
    const ready = c.pickup
      ? (labels.get(`${c.p.id}:${c.from.id}`) ?? []).filter(
          (l) => l.ready <= c.departure,
        )
      : [];
    const paths = [
      ...continuing.map((l) => extend(l, c, true)),
      ...ready.map((l) => extend(l, c, false)),
    ];
    if (!paths.length) continue;
    onboard.set(c.key, paths);
    if (c.dropoff)
      for (const path of paths) {
        if (destinations.has(`${c.p.id}:${c.to.id}`)) found.push(path);
        // Only explicitly sourced transfers may board a different train, including at the same stop.
        for (const t of c.p.transfers.filter((t) => t.from === c.to.id))
          addLabel(`${c.p.id}:${t.to}`, {
            ...path,
            ready: c.arrival + t.seconds * 1000,
          });
      }
  }
  const unique = new Map<string, Journey>();
  for (const f of found) {
    const id = f.legs
      .map(
        (l) =>
          `${l.packageId}:${l.tripId}:${l.serviceDate}:${l.from.id}:${l.to.id}:${l.fromSequence}:${l.toSequence}:${l.departure}:${l.arrival}`,
      )
      .join("|");
    unique.set(id, {
      ...(f.legs.some((l) => l.evidence === "official-prediction")
        ? {
            realtimeExpiresAt: request.realtime?.expiresAt,
            realtimeSource: request.realtime?.source,
            realtimeFetchedAt: request.realtime?.fetchedAt,
          }
        : {}),
      id,
      legs: f.legs,
      arrival: f.ready,
      departure: f.legs[0].departure,
      changes: f.legs.length - 1,
      evidence: f.legs.some((l) => l.evidence === "official-prediction")
        ? "official-prediction"
        : "schedule",
      scope: "available-data",
    });
  }
  const sorted = [...unique.values()].sort(
    (a, b) =>
      a.arrival - b.arrival ||
      a.changes - b.changes ||
      a.departure - b.departure,
  );
  return result(
    sorted.slice(0, 8),
    sorted.length
      ? "保存済みデータ内の候補です。未収録路線を含む全国最速は保証しません。"
      : "必要な列車・乗換情報が不足しているか、検索範囲内に乗車可能な列車がありません。",
  );
}
