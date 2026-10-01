import { runsOn } from "./calendar";
import type { ActiveJourney, Leg, RailPackage } from "./model";
export function restoreJourney(
  value: unknown,
  packages: RailPackage[],
  now = Date.now(),
): ActiveJourney | undefined {
  const state = value as ActiveJourney | null;
  if (
    !state?.journey ||
    !Array.isArray(state.journey.legs) ||
    !state.journey.legs.length ||
    state.journey.legs.length > 16 ||
    !Number.isFinite(state.startedAt) ||
    state.startedAt > now + 60000
  )
    return;
  const legs: Leg[] = [];
  for (const leg of state.journey.legs) {
    if (!leg?.from?.id || !leg?.to?.id || !/^\d{8}$/.test(leg.serviceDate))
      return;
    const p = packages.find((p) => p.id === leg.packageId),
      trip = p?.trips.find((t) => t.id === leg.tripId);
    if (
      !p ||
      !trip ||
      leg.serviceDate < p.validFrom ||
      leg.serviceDate > p.validTo
    )
      return;
    if (!runsOn(p, trip.service, leg.serviceDate)) return;
    if (
      (leg.fromSequence === undefined &&
        trip.times.filter((t) => t[0] === leg.from.id).length > 1) ||
      (leg.toSequence === undefined &&
        trip.times.filter((t) => t[0] === leg.to.id).length > 1)
    )
      return;
    const from = trip.times.find(
        (t) =>
          t[0] === leg.from.id &&
          (leg.fromSequence === undefined || t[3] === leg.fromSequence),
      ),
      to = trip.times.find(
        (t) =>
          t[0] === leg.to.id &&
          t[3] > (from?.[3] ?? Infinity) &&
          (leg.toSequence === undefined || t[3] === leg.toSequence),
      );
    if (!from || !to) return;
    const date = leg.serviceDate,
      midnight = Date.parse(
        `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00+09:00`,
      );
    legs.push({
      ...leg,
      fromSequence: from[3],
      toSequence: to[3],
      from: p.stops.find((s) => s.id === from[0])!,
      to: p.stops.find((s) => s.id === to[0])!,
      route: p.routes.find((r) => r.id === trip.route)!.name,
      departure: midnight + from[2] * 1000,
      arrival: midnight + to[1] * 1000,
      scheduledDeparture: midnight + from[2] * 1000,
      scheduledArrival: midnight + to[1] * 1000,
      evidence: "schedule",
    });
  }
  const arrival = legs.at(-1)!.arrival;
  if (arrival < now - 6 * 3600000) return;
  // Saved official predictions expire across suspension: restore actual static times, then fetch again.
  return {
    ...state,
    status: "paused",
    anchor: undefined,
    journey: {
      ...state.journey,
      legs,
      evidence: "schedule",
      departure: legs[0].departure,
      arrival,
    },
  };
}
