import type { Journey, RealtimeSnapshot } from "./model";
export interface Impact {
  kind: "canceled" | "skipped-stop" | "missed-transfer" | "changed" | "unknown";
  message: string;
  arrival?: number;
  confidence: "official" | "unknown";
}
export function journeyImpact(
  journey: Journey,
  rt: RealtimeSnapshot | undefined,
  now = Date.now(),
  transferSeconds?: number[],
): Impact {
  if (!rt || rt.expiresAt <= now)
    return {
      kind: "unknown",
      message: "最新の運行情報を取得できていません。",
      confidence: "unknown",
    };
  let arrival: number | undefined, previousArrival: number | undefined;
  for (let i = 0; i < journey.legs.length; i++) {
    const leg = journey.legs[i],
      u = rt.trips.find(
        (t) => t.tripId === leg.tripId && t.startDate === leg.serviceDate,
      );
    if (u?.canceled)
      return {
        kind: "canceled",
        message: `${leg.route}の予定列車は公式情報で運休です。`,
        confidence: "official",
      };
    const at = (id: string, sequence?: number) =>
      u?.stops.find((s) =>
        sequence !== undefined
          ? s.sequence === sequence && (!s.stopId || s.stopId === id)
          : s.stopId === id &&
            u?.stops.filter((t) => t.stopId === id).length === 1,
      );
    const end = at(leg.to.id, leg.toSequence),
      start = at(leg.from.id, leg.fromSequence);
    if (end?.skipped || start?.skipped)
      return {
        kind: "skipped-stop",
        message: "公式情報では、予定の乗降駅に停車しません。",
        confidence: "official",
      };
    const predictedArrival =
      !end?.noData && end?.arrival !== undefined
        ? end.arrival * 1000
        : !end?.noData && end?.arrivalDelay !== undefined
          ? (leg.scheduledArrival ?? leg.arrival) + end.arrivalDelay * 1000
          : undefined;
    const predictedDeparture =
      !start?.noData && start?.departure !== undefined
        ? start.departure * 1000
        : !start?.noData && start?.departureDelay !== undefined
          ? (leg.scheduledDeparture ?? leg.departure) +
            start.departureDelay * 1000
          : undefined;
    if (
      i > 0 &&
      previousArrival !== undefined &&
      predictedDeparture !== undefined &&
      transferSeconds?.[i - 1] !== undefined &&
      previousArrival + transferSeconds[i - 1] * 1000 > predictedDeparture
    )
      return {
        kind: "missed-transfer",
        message:
          "公式発着予測と確認済み乗換時間では、予定の乗換に間に合わない見込みです。",
        confidence: "official",
      };
    previousArrival = predictedArrival;
    arrival = predictedArrival;
  }
  return arrival !== undefined
    ? {
        kind: "changed",
        message: "公式の発着予測を取得しました。",
        arrival,
        confidence: "official",
      }
    : {
        kind: "unknown",
        message: "この列車の発着予測は未取得です。",
        confidence: "unknown",
      };
}
export function simulateDelay(journey: Journey, seconds: number): Journey {
  if (!Number.isFinite(seconds) || seconds < 0) throw Error("Invalid scenario");
  // Explicit what-if input only. No probabilities and no invented future delay.
  return {
    ...journey,
    id: journey.id + ":scenario:" + seconds,
    arrival: journey.arrival + seconds * 1000,
    evidence: "simulation",
    legs: journey.legs.map((l) => ({
      ...l,
      departure: l.departure + seconds * 1000,
      arrival: l.arrival + seconds * 1000,
      evidence: "simulation",
    })),
  };
}
export interface AlertState {
  lastAt: number;
  fingerprints: string[];
}
export function decideAlert(
  current: Journey,
  alternative: Journey | undefined,
  impact: Impact,
  state: AlertState,
  now = Date.now(),
): { fingerprint: string; message: string } | undefined {
  const improvement = alternative
    ? ((impact.arrival ?? current.arrival) - alternative.arrival) / 60000
    : 0;
  const urgent =
    impact.confidence === "official" &&
    (impact.kind === "canceled" ||
      impact.kind === "missed-transfer" ||
      impact.kind === "skipped-stop");
  if (
    !urgent &&
    (improvement < 5 || !alternative || alternative.evidence === "simulation")
  )
    return;
  const fingerprint = urgent
    ? `${current.id}:${impact.kind}`
    : `${current.id}:${impact.kind}:${alternative?.id ?? ""}:${Math.floor((impact.arrival ?? current.arrival) / 300000)}`;
  if (
    state.fingerprints.includes(fingerprint) ||
    (!urgent && now - state.lastAt < 300000)
  )
    return;
  return {
    fingerprint,
    message: urgent
      ? impact.message
      : `確認した駅からの候補では、約${Math.floor(improvement)}分早く到着できます。`,
  };
}
