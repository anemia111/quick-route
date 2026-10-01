import type { NationalStation } from "./model";
export const normalizeName = (name: string) =>
  name
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/駅$/, "")
    .replace(/ヶ/g, "ケ")
    .replace(/[\s・]/g, "");
const indexes = new WeakMap<
  NationalStation[],
  { station: NationalStation; name: string; terms: string[] }[]
>();
export function findStations(
  stations: NationalStation[],
  query: string,
  limit = 8,
): NationalStation[] {
  const q = normalizeName(query);
  if (!q) return [];
  let index = indexes.get(stations);
  if (!index) {
    index = [...stations]
      .sort((a, b) => a.name.localeCompare(b.name, "ja"))
      .map((station) => ({
        station,
        name: normalizeName(station.name),
        terms: [station.name, ...station.lines, ...station.operators].map(
          normalizeName,
        ),
      }));
    indexes.set(stations, index);
  }
  const exact: NationalStation[] = [],
    other: NationalStation[] = [];
  for (const row of index) {
    if (row.name === q) exact.push(row.station);
    else if (other.length < limit && row.terms.some((t) => t.includes(q)))
      other.push(row.station);
  }
  return [...exact, ...other].slice(0, limit);
}
export function resolveStation(
  stations: NationalStation[],
  name: string,
  id?: string,
): NationalStation | undefined {
  if (id)
    return stations.find(
      (s) => s.id === id && normalizeName(s.name) === normalizeName(name),
    );
  const matches = stations.filter(
    (s) => normalizeName(s.name) === normalizeName(name),
  );
  // Names alone cannot resolve different stations bearing the same name.
  return matches.length === 1 ? matches[0] : undefined;
}
