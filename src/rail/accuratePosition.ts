// Foreground-only sampling; coordinates never leave this promise or enter storage.
export function accuratePosition(
  geo: Geolocation,
  signal: AbortSignal,
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Canceled", "AbortError"));
      return;
    }
    let watch: number | undefined;
    let finished = false;
    let best: GeolocationPosition | undefined;
    let problem = "位置情報を取得できませんでした。もう一度試してください。";
    const finish = (error?: unknown) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (watch !== undefined) geo.clearWatch(watch);
      if (error) reject(error);
      else if (best && Date.now() - best.timestamp <= 30000) resolve(best);
      else reject(Error(problem));
    };
    const abort = () => finish(new DOMException("Canceled", "AbortError"));
    const timer = setTimeout(() => finish(), 15000);
    signal.addEventListener("abort", abort, { once: true });
    try {
      watch = geo.watchPosition(
        (position) => {
          if (finished) return;
          const { accuracy, latitude, longitude } = position.coords;
          if (
            !Number.isFinite(position.timestamp) ||
            Math.abs(Date.now() - position.timestamp) > 30000
          ) {
            problem =
              "位置情報が古いため使用できません。もう一度試してください。";
            return;
          }
          if (
            !Number.isFinite(accuracy) ||
            accuracy < 0 ||
            accuracy > 200 ||
            !Number.isFinite(latitude) ||
            Math.abs(latitude) > 90 ||
            !Number.isFinite(longitude) ||
            Math.abs(longitude) > 180
          ) {
            problem =
              "位置情報の精度が不足しています。場所を変えて再試行してください。";
            return;
          }
          if (!best || accuracy < best.coords.accuracy) best = position;
          // Wait briefly for better samples; an accuracy of 30m is sufficient to show candidates.
          if (accuracy <= 30) finish();
        },
        (error) => {
          if (error.code === 1) finish(error);
          else finish();
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
      );
      // Also supports synchronous callback implementations used by test environments.
      if (finished) geo.clearWatch(watch);
    } catch (error) {
      finish(error);
    }
  });
}
