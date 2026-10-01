// @vitest-environment node
import "fake-indexeddb/auto";
import { webcrypto } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import {
  db,
  putPackage,
  recordSearch,
  savedPackages,
  searchHistory,
} from "./storage";
import {
  priorities,
  storageBudget,
  verifiedJson,
  validatePackage,
  usablePackages,
} from "./offline";
it("preserves the old valid version when an actual quota error prevents replacement", async () => {
  await putPackage(p, 200);
  const d = await db();
  const spy = vi
    .spyOn(d, "put")
    .mockRejectedValueOnce(new DOMException("full", "QuotaExceededError"));
  await expect(putPackage({ ...p, version: "new" }, 300)).rejects.toMatchObject(
    { name: "QuotaExceededError" },
  );
  spy.mockRestore();
  expect((await savedPackages())[0].data.version).toBe(p.version);
});
it("removes corrupt stored data safely before reuse", async () => {
  await putPackage({ ...p, license: "unknown" }, 200);
  expect(
    await usablePackages(Date.parse("2026-10-01T00:00:00+09:00")),
  ).toHaveLength(0);
  expect(await savedPackages()).toHaveLength(0);
});
import { readFileSync } from "node:fs";
import type { RailPackage, PackageMeta } from "./model";
const manifest = JSON.parse(readFileSync("public/data/manifest.json", "utf8"));
const p = JSON.parse(
  readFileSync("public/" + manifest.packages[0].url, "utf8"),
) as RailPackage;
beforeEach(async () => {
  const d = await db();
  await d.clear("packages");
  await d.clear("usage");
  vi.restoreAllMocks();
});
it("stores, reuses, atomically updates and deletes valid railway data", async () => {
  await putPackage(p, 200);
  expect((await savedPackages())[0].data.version).toBe(p.version);
  await putPackage({ ...p, version: "new" }, 300);
  expect(await savedPackages()).toHaveLength(1);
  expect((await savedPackages())[0].bytes).toBe(300);
  await (await db()).delete("packages", p.id);
  expect(await savedPackages()).toHaveLength(0);
});
it("never uses expired saved data", async () => {
  await putPackage({ ...p, validTo: "20260101" }, 200);
  expect(
    await usablePackages(Date.parse("2026-10-01T00:00:00+09:00")),
  ).toHaveLength(0);
});
it("keeps bounded local history and increments frequency", async () => {
  await recordSearch("A", "B", 10);
  await recordSearch("A", "B", 20);
  expect((await searchHistory())[0].count).toBe(2);
  for (let i = 0; i < 105; i++) await recordSearch("A", String(i), i + 30);
  expect(await searchHistory()).toHaveLength(100);
});
it("automatically limits capacity without a user setting", () => {
  expect(storageBudget({}, 0)).toBe(16 * 1024 * 1024);
  expect(storageBudget({ quota: 100000000, usage: 99000000 }, 1000)).toBe(0);
  expect(
    storageBudget({ quota: 1000000000, usage: 100 }, 0),
  ).toBeLessThanOrEqual(64 * 1024 * 1024);
});
it("prioritizes habitual routes and available alternatives", () => {
  const metas = [
    { id: "a", stopNames: ["A"], alternatives: ["b"] },
    { id: "b", stopNames: ["B"], alternatives: [] },
  ] as PackageMeta[];
  const scores = priorities(metas, ["A"], [], 100);
  expect(scores.get("a")).toBe(100);
  expect(scores.get("b")).toBe(40);
});
it("rejects partial/corrupt download before touching valid stored data", async () => {
  vi.stubGlobal("crypto", webcrypto);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode("{}").buffer,
    }),
  );
  await putPackage(p, 200);
  await expect(
    verifiedJson("/test", { bytes: 2, sha256: "0".repeat(64) }),
  ).rejects.toThrow("Checksum");
  expect((await savedPackages())[0].data.version).toBe(p.version);
  vi.unstubAllGlobals();
});
it("rejects malformed times, unknown stops and unlicensed sources", () => {
  expect(() => validatePackage({ ...p, license: "unknown" })).toThrow();
  const corrupt = structuredClone(p);
  corrupt.trips[0].times[0][2] = -1;
  expect(() => validatePackage(corrupt)).toThrow();
});
it("reports a disconnected download", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
  await expect(
    verifiedJson("/test", { bytes: 2, sha256: "0".repeat(64) }),
  ).rejects.toThrow("offline");
  vi.unstubAllGlobals();
});
