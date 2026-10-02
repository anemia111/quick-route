import type { NationalStation } from "./model";

export interface NearbyStation {
  station: NationalStation;
  metres: number;
}

// Straight-line distance to the dataset point, not a walking route or entrance.
export function nearbyStations(
  stations: NationalStation[],
  latitude: number,
  longitude: number,
  accuracy: number,
): NearbyStation[] {
  if (
    !Number.isFinite(latitude) ||
    Math.abs(latitude) > 90 ||
    !Number.isFinite(longitude) ||
    Math.abs(longitude) > 180 ||
    !Number.isFinite(accuracy) ||
    accuracy < 0 ||
    accuracy > 200
  )
    throw Error(
      "位置情報の精度が不足しています。場所を変えて再試行するか、通常の検索を利用してください。",
    );
  const radians = (n: number) => (n * Math.PI) / 180;
  const ranked = stations
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon))
    .map((station) => {
      const a =
        Math.sin(radians(station.lat - latitude) / 2) ** 2 +
        Math.cos(radians(latitude)) *
          Math.cos(radians(station.lat)) *
          Math.sin(radians(station.lon - longitude) / 2) ** 2;
      return {
        station,
        metres: 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a)))),
      };
    })
    .filter((s) => s.metres <= 5000)
    .sort((a, b) => a.metres - b.metres);
  const result: NearbyStation[] = [];
  for (const candidate of ranked) {
    // Combine nearby records for the same station name; keep its exact ID for routing.
    if (
      result.some(
        (s) =>
          s.station.name === candidate.station.name &&
          Math.hypot(
            s.station.lat - candidate.station.lat,
            s.station.lon - candidate.station.lon,
          ) *
            111000 <
            500,
      )
    )
      continue;
    result.push(candidate);
    if (result.length === 3) break;
  }
  return result;
}
