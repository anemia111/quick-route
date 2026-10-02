// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { accuratePosition } from "./accuratePosition";
afterEach(() => vi.useRealTimers());
function mockGeo() {
  let report!: PositionCallback;
  let fail!: PositionErrorCallback;
  const clearWatch = vi.fn();
  const watchPosition = vi.fn(
    (
      ok: PositionCallback,
      bad: PositionErrorCallback,
      _options?: PositionOptions,
    ) => {
      report = ok;
      fail = bad;
      return 9;
    },
  );
  return {
    geo: { watchPosition, clearWatch } as unknown as Geolocation,
    watchPosition,
    clearWatch,
    report: (accuracy: number, timestamp = Date.now()) =>
      report({
        coords: { latitude: 35, longitude: 139, accuracy },
        timestamp,
      } as GeolocationPosition),
    fail: (code: number) => fail({ code } as GeolocationPositionError),
  };
}
it("uses high accuracy without cached fixes and picks the best sample at the time limit", async () => {
  vi.useFakeTimers();
  const mock = mockGeo();
  const result = accuratePosition(mock.geo, new AbortController().signal);
  mock.report(150);
  mock.report(70);
  mock.report(100);
  await vi.advanceTimersByTimeAsync(15000);
  expect((await result).coords.accuracy).toBe(70);
  expect(mock.watchPosition.mock.calls[0][2]).toEqual({
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 10000,
  });
  expect(mock.clearWatch).toHaveBeenCalledWith(9);
});
it("stops sampling immediately when a precise fix arrives", async () => {
  const mock = mockGeo();
  const result = accuratePosition(mock.geo, new AbortController().signal);
  mock.report(100);
  mock.report(20);
  expect((await result).coords.accuracy).toBe(20);
  expect(mock.clearWatch).toHaveBeenCalledWith(9);
});
it("rejects permission refusal and releases the location watch on cancel", async () => {
  const mock = mockGeo(),
    controller = new AbortController();
  const result = accuratePosition(mock.geo, controller.signal);
  controller.abort();
  await expect(result).rejects.toMatchObject({ name: "AbortError" });
  expect(mock.clearWatch).toHaveBeenCalledWith(9);
  const denied = accuratePosition(mock.geo, new AbortController().signal);
  mock.fail(1);
  await expect(denied).rejects.toMatchObject({ code: 1 });
});
it("does not return stale or inaccurate positions after a GPS timeout", async () => {
  const mock = mockGeo();
  const poor = accuratePosition(mock.geo, new AbortController().signal);
  mock.report(1000);
  mock.fail(3);
  await expect(poor).rejects.toThrow("精度が不足");
  const stale = accuratePosition(mock.geo, new AbortController().signal);
  mock.report(10, Date.now() - 60000);
  mock.fail(3);
  await expect(stale).rejects.toThrow("古い");
});
