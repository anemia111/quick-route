import type {
  Manifest,
  NationalStation,
  PackageMeta,
  RailPackage,
  SearchUsage,
  StoredPackage,
} from "./model";
import {
  db,
  deletePackage,
  putPackage,
  readMeta,
  saveMeta,
  savedPackages,
  searchHistory,
} from "./storage";
import { normalizeName } from "./stationCatalog";
export const tokyoDate = (time = Date.now()) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(time)
    .replaceAll("-", "");
export const validOn = (
  p: { validFrom: string; validTo: string },
  time = Date.now(),
) => p.validFrom <= tokyoDate(time) && p.validTo >= tokyoDate(time);
const licenses = new Set(["CC-BY-4.0", "CC0-1.0"]);
export function validatePackage(value: unknown): asserts value is RailPackage {
  const p = value as RailPackage;
  if (
    !p ||
    p.schema !== 1 ||
    p.synthetic !== false ||
    !licenses.has(p.license) ||
    !p.id ||
    !p.version ||
    !/^\d{8}$/.test(p.validFrom) ||
    !/^\d{8}$/.test(p.validTo) ||
    p.validFrom > p.validTo ||
    !Array.isArray(p.stops) ||
    !Array.isArray(p.trips) ||
    !Array.isArray(p.transfers) ||
    !Array.isArray(p.calendars) ||
    !Array.isArray(p.exceptions) ||
    !Array.isArray(p.routes)
  )
    throw Error("Invalid rail package");
  const stops = new Set(p.stops.map((s) => s.id)),
    services = new Set([
      ...p.calendars.map((c) => c.id),
      ...p.exceptions.map((e) => e.service),
    ]),
    routes = new Set(p.routes.map((r) => r.id));
  if (
    stops.size !== p.stops.length ||
    p.stops.some(
      (s) => !s.name || !Number.isFinite(s.lat) || !Number.isFinite(s.lon),
    )
  )
    throw Error("Invalid stops");
  for (const c of p.calendars)
    if (c.days.length !== 7 || c.days.some((d) => d !== 0 && d !== 1))
      throw Error("Invalid calendar");
  for (const t of p.trips) {
    if (
      !t.id ||
      !services.has(t.service) ||
      !routes.has(t.route) ||
      !Array.isArray(t.times) ||
      t.times.length < 2
    )
      throw Error("Invalid trip");
    let previous = -1,
      seq = -1;
    for (const s of t.times) {
      if (
        !stops.has(s[0]) ||
        !Number.isSafeInteger(s[1]) ||
        !Number.isSafeInteger(s[2]) ||
        s[1] < previous ||
        s[2] < s[1] ||
        s[3] <= seq ||
        typeof s[4] !== "boolean" ||
        typeof s[5] !== "boolean"
      )
        throw Error("Invalid stop times");
      previous = s[2];
      seq = s[3];
    }
  }
  for (const t of p.transfers)
    if (
      !stops.has(t.from) ||
      !stops.has(t.to) ||
      !Number.isFinite(t.seconds) ||
      t.seconds < 0 ||
      !t.source
    )
      throw Error("Invalid transfer");
}
export async function fetchBytes(
  url: string,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const response = await fetch(url, {
    signal: signal ?? AbortSignal.timeout(20000),
    cache: "no-cache",
  });
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}
export async function verifiedJson<T>(
  url: string,
  expected: { sha256: string; bytes: number },
): Promise<T> {
  const raw = await fetchBytes(url);
  if (raw.length !== expected.bytes) throw Error("Incomplete download");
  const hash = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", raw as Uint8Array<ArrayBuffer>),
    ),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hash !== expected.sha256) throw Error("Checksum mismatch");
  return JSON.parse(new TextDecoder().decode(raw)) as T;
}
function checkManifest(m: Manifest) {
  const validResource = (p: {
    license: string;
    url: string;
    bytes: number;
    sha256: string;
  }) =>
    licenses.has(p.license) &&
    /^data\/[a-zA-Z0-9._-]+\.json$/.test(p.url) &&
    Number.isSafeInteger(p.bytes) &&
    p.bytes > 0 &&
    /^[a-f0-9]{64}$/.test(p.sha256);
  if (
    m?.schema !== 1 ||
    !m.stations ||
    !validResource(m.stations) ||
    !Array.isArray(m.packages) ||
    m.packages.some(
      (p) =>
        !validResource(p) ||
        !Array.isArray(p.stopNames) ||
        !Array.isArray(p.alternatives),
    )
  )
    throw Error("Invalid manifest");
}
let manifestPromise: Promise<Manifest> | undefined;
export async function loadManifest(refresh = false): Promise<Manifest> {
  if (manifestPromise && !refresh) return manifestPromise;
  manifestPromise = (async () => {
    try {
      const raw = await fetchBytes(
        import.meta.env.BASE_URL + "data/manifest.json",
      );
      const m = JSON.parse(new TextDecoder().decode(raw)) as Manifest;
      checkManifest(m);
      await saveMeta("manifest", m).catch(() => {});
      return m;
    } catch (e) {
      const cached = (await readMeta("manifest").catch(
        () => null,
      )) as Manifest | null;
      if (cached) {
        checkManifest(cached);
        return cached;
      }
      throw e;
    }
  })();
  try {
    return await manifestPromise;
  } catch (e) {
    manifestPromise = undefined;
    throw e;
  }
}
let catalogPromise: Promise<NationalStation[]> | undefined;
export async function loadCatalog(): Promise<NationalStation[]> {
  return (catalogPromise ??= (async () => {
    const cached = (await readMeta("stations").catch(() => null)) as
      NationalStation[] | null;
    const m = await loadManifest();
    const version = await readMeta("stationVersion").catch(() => null);
    if (
      Array.isArray(cached) &&
      version === m.stations.version &&
      cached.every(
        (s) =>
          s.id &&
          s.name &&
          Array.isArray(s.operators) &&
          Array.isArray(s.lines),
      )
    )
      return cached;
    const rows = await verifiedJson<NationalStation[]>(
      import.meta.env.BASE_URL + m.stations.url,
      m.stations,
    );
    if (
      !Array.isArray(rows) ||
      rows.some(
        (s) =>
          !s.id ||
          !s.name ||
          !Array.isArray(s.operators) ||
          !Array.isArray(s.lines),
      )
    )
      throw Error("Invalid station catalog");
    try {
      const tx = (await db()).transaction("meta", "readwrite");
      await tx.store.put(rows, "stations");
      await tx.store.put(m.stations.version, "stationVersion");
      await tx.done;
    } catch {
      /* in-memory catalog remains usable */
    }
    return rows;
  })().catch((e) => {
    catalogPromise = undefined;
    throw e;
  }));
}
export function priorities(
  packages: PackageMeta[],
  registered: string[],
  history: SearchUsage[],
  now = Date.now(),
): Map<string, number> {
  const result = new Map<string, number>();
  for (const p of packages) {
    const has = (name: string) =>
      p.stopNames.some((s) => normalizeName(s) === normalizeName(name));
    let score = registered.filter(has).length * 100;
    for (const h of history)
      if (has(h.from) || has(h.to))
        score +=
          Math.min(h.count, 20) *
          10 *
          Math.exp(-(now - h.at) / (30 * 86400000));
    result.set(p.id, score);
  }
  for (const p of packages)
    if ((result.get(p.id) ?? 0) >= 100)
      for (const alternative of p.alternatives)
        result.set(alternative, Math.max(result.get(alternative) ?? 0, 40));
  return result;
}
export function storageBudget(
  estimate: { quota?: number; usage?: number },
  used: number,
): number {
  if (!estimate.quota) return 16 * 1024 * 1024; // conservative fallback; not a permanence promise
  return Math.max(
    0,
    Math.min(
      64 * 1024 * 1024,
      estimate.quota * 0.1,
      estimate.quota -
        (estimate.usage ?? 0) -
        Math.max(4 * 1024 * 1024, estimate.quota * 0.05) +
        used,
    ),
  );
}
export function evictionOrder(
  saved: StoredPackage[],
  scores: Map<string, number>,
  now = Date.now(),
) {
  return [...saved].sort(
    (a, b) =>
      Number(validOn(a.data, now)) - Number(validOn(b.data, now)) ||
      (scores.get(a.id) ?? 0) - (scores.get(b.id) ?? 0) ||
      a.lastUsed - b.lastUsed,
  );
}
let adaptive: Promise<string> | undefined;
export function adaptOffline(registered: string[]): Promise<string> {
  if (adaptive) return adaptive;
  adaptive = (async () => {
    try {
      const m = await loadManifest(true);
      const saved = await savedPackages();
      const history = await searchHistory();
      const scores = priorities(m.packages, registered, history);
      const estimate =
        (await navigator.storage?.estimate?.().catch(() => ({}))) ?? {};
      let total = saved.reduce((s, p) => s + p.bytes, 0);
      const budget = storageBudget(estimate, total);
      for (const p of evictionOrder(saved, scores))
        if (!validOn(p.data) || total > budget) {
          await deletePackage(p.id);
          total -= p.bytes;
        }
      const available = await savedPackages();
      for (const p of [...m.packages].sort(
        (a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0),
      )) {
        if (
          !validOn(p) ||
          (scores.get(p.id) ?? 0) <= 0 ||
          available.some((s) => s.id === p.id && s.data.version === p.version)
        )
          continue;
        const old = available.find((s) => s.id === p.id);
        if (total - (old?.bytes ?? 0) + p.bytes > budget) continue;
        try {
          const value = await verifiedJson<unknown>(
            import.meta.env.BASE_URL + p.url,
            p,
          );
          validatePackage(value);
          if (
            value.id !== p.id ||
            value.version !== p.version ||
            value.source !== p.source ||
            value.validTo !== p.validTo
          )
            throw Error("Metadata mismatch");
          await putPackage(value, p.bytes);
          total += p.bytes - (old?.bytes ?? 0);
        } catch (e) {
          if (e instanceof DOMException && e.name === "QuotaExceededError") {
            const victim = evictionOrder(await savedPackages(), scores).find(
              (s) =>
                s.id !== old?.id &&
                (scores.get(s.id) ?? 0) < (scores.get(p.id) ?? 0),
            );
            if (victim) await deletePackage(victim.id);
          }
          return "保存・更新できなかったデータがあります。有効な保存済みデータと外部検索を利用できます。";
        }
      }
      return (await savedPackages()).length
        ? "利用する路線の時刻表を端末に保存しました。"
        : "この区間の時刻表自動保存は未対応です。Yahoo!検索を利用できます。";
    } catch {
      return "時刻表を保存できませんでした。外部検索を利用できます。";
    }
  })().finally(() => {
    adaptive = undefined;
  });
  return adaptive;
}
export async function usablePackages(
  time = Date.now(),
): Promise<RailPackage[]> {
  const all = await savedPackages().catch(() => []);
  const usable: RailPackage[] = [];
  for (const s of all) {
    try {
      validatePackage(s.data);
      if (validOn(s.data, time)) usable.push(s.data);
    } catch {
      await deletePackage(s.id).catch(() => {});
    }
  }
  return usable;
}
export async function requestPersistence() {
  return navigator.storage?.persist?.().catch(() => false) ?? false;
}
export async function clearRailData() {
  const d = await db();
  await d.clear("packages");
}
