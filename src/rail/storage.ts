import { openDB, type DBSchema } from "idb";
import type {
  ActiveJourney,
  Manifest,
  NationalStation,
  RailPackage,
  SearchUsage,
  StoredPackage,
} from "./model";
interface RailDB extends DBSchema {
  meta: {
    key: string;
    value: Manifest | NationalStation[] | ActiveJourney | string | null;
  };
  packages: { key: string; value: StoredPackage };
  usage: { key: string; value: SearchUsage };
}
let database: ReturnType<typeof openDB<RailDB>> | undefined;
export const db = () =>
  (database ??= openDB<RailDB>("quick-route.rail.v1", 1, {
    upgrade(d) {
      d.createObjectStore("meta");
      d.createObjectStore("packages", { keyPath: "id" });
      d.createObjectStore("usage", { keyPath: "id" });
    },
  }));
export const readMeta = async (key: string) => (await db()).get("meta", key);
export const saveMeta = async (key: string, value: RailDB["meta"]["value"]) =>
  (await db()).put("meta", value, key);
export const savedPackages = async () => (await db()).getAll("packages");
export const deletePackage = async (id: string) =>
  (await db()).delete("packages", id);
export async function putPackage(
  data: RailPackage,
  bytes: number,
  now = Date.now(),
) {
  // Replacement is a single transaction: interrupted downloads cannot replace a valid version.
  await (
    await db()
  ).put("packages", { id: data.id, data, bytes, lastUsed: now, savedAt: now });
}
export async function touchPackage(id: string) {
  const d = await db();
  const tx = d.transaction("packages", "readwrite");
  const p = await tx.store.get(id);
  if (p) await tx.store.put({ ...p, lastUsed: Date.now() });
  await tx.done;
}
export async function recordSearch(from: string, to: string, now = Date.now()) {
  const d = await db();
  const tx = d.transaction("usage", "readwrite");
  const id = JSON.stringify([from, to]);
  const old = await tx.store.get(id);
  await tx.store.put({
    id,
    from,
    to,
    at: now,
    count: Math.min((old?.count ?? 0) + 1, 10000),
  });
  const all = await tx.store.getAll();
  all.sort((a, b) => b.at - a.at);
  for (const item of all.slice(100)) await tx.store.delete(item.id);
  await tx.done;
}
export const searchHistory = async () => (await db()).getAll("usage");
