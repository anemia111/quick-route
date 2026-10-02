import { useEffect, useRef, useState } from "react";
import { loadCatalog } from "./rail/offline";
import { nearbyStations, type NearbyStation } from "./rail/nearbyStations";
import type { NationalStation } from "./rail/model";
import { accuratePosition } from "./rail/accuratePosition";

export default function ReturnHome({
  home,
  disabled,
  onStation,
}: {
  home: string;
  disabled: boolean;
  onStation: (station: NationalStation) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [candidates, setCandidates] = useState<NearbyStation[]>([]);
  const [message, setMessage] = useState("");
  const request = useRef(0);
  const controller = useRef<AbortController | undefined>(undefined);
  const detectedAt = useRef(0);
  const [accuracy, setAccuracy] = useState(0);
  useEffect(
    () => () => {
      request.current++;
      controller.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (disabled) {
      controller.current?.abort();
    }
  }, [disabled]);
  useEffect(() => {
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        request.current++;
        controller.current?.abort();
        setBusy(false);
        setCandidates([]);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  function cancel() {
    request.current++;
    controller.current?.abort();
    setBusy(false);
    setCandidates([]);
    setMessage("");
  }
  async function locate() {
    if (busy || disabled) return;
    const id = ++request.current;
    setCandidates([]);
    setMessage("");
    if (!navigator.geolocation) {
      setMessage("位置情報を利用できません。通常の駅検索を利用してください。");
      return;
    }
    setBusy(true);
    controller.current = new AbortController();
    try {
      const position = await accuratePosition(
        navigator.geolocation,
        controller.current.signal,
      );
      if (request.current !== id) return;
      if (
        !Number.isFinite(position.timestamp) ||
        Math.abs(Date.now() - position.timestamp) > 60000
      )
        throw Error(
          "位置情報が古いため使用できません。もう一度試してください。",
        );
      // Validate before downloading station data for a rejected/poor fix.
      nearbyStations(
        [],
        position.coords.latitude,
        position.coords.longitude,
        position.coords.accuracy,
      );
      const stations = await loadCatalog();
      if (request.current !== id) return;
      const matches = nearbyStations(
        stations,
        position.coords.latitude,
        position.coords.longitude,
        position.coords.accuracy,
      );
      setCandidates(matches);
      detectedAt.current = position.timestamp;
      setAccuracy(position.coords.accuracy);
      if (!matches.length)
        setMessage(
          "5km以内に駅候補が見つかりませんでした。通常の駅検索を利用してください。",
        );
    } catch (error) {
      if (request.current !== id) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      const denied =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 1;
      setMessage(
        denied
          ? "位置情報が許可されていません。通常の検索はそのまま利用できます。"
          : error instanceof Error && error.message.startsWith("位置情報")
            ? error.message
            : "位置情報または駅データを取得できませんでした。通信状態を確認するか、通常の検索を利用してください。",
      );
    } finally {
      if (request.current === id) setBusy(false);
    }
  }
  return (
    <div className="return-home">
      <button
        className="location-button"
        disabled={busy || disabled}
        onClick={() => void locate()}
      >
        <span aria-hidden="true">◎</span>
        {busy ? "近くの駅を探しています…" : "現在地から帰る"}
        <small>帰宅先：{home}</small>
      </button>
      <p className="location-help">
        高精度GPSを最大15秒利用します。このアプリでは座標を保存・送信しません。
      </p>
      {busy && (
        <button className="cancel" onClick={cancel}>
          駅の検出をキャンセル
        </button>
      )}
      {message && (
        <p className="muted" role="status">
          {message}
        </p>
      )}
      {!disabled && !!candidates.length && (
        <section className="nearby-candidates" aria-label="近くの駅から帰る">
          <p>
            <strong>出発する駅を選んでください</strong>
          </p>
          <p className="muted">
            位置の誤差は約{Math.ceil(accuracy)}mです。
            距離は直線距離です。入口・徒歩時間・乗車できる列車は未確認です。選んだ駅から到着が早い順で検索します。
          </p>
          {candidates.map(({ station, metres }) => (
            <button
              key={station.id}
              className="nearby-choice"
              disabled={disabled}
              onClick={() => {
                if (Date.now() - detectedAt.current > 60000) {
                  cancel();
                  setMessage(
                    "位置情報の検出から時間が経ちました。もう一度取得してください。",
                  );
                  return;
                }
                cancel();
                onStation(station);
              }}
            >
              <strong>{station.name}から帰る</strong>
              <small>
                約
                {metres < 1000
                  ? `${Math.max(10, Math.round(metres / 10) * 10)}m`
                  : `${(metres / 1000).toFixed(1)}km`}{" "}
                · {station.operators.join("・")} · {station.lines.join("・")}
              </small>
            </button>
          ))}
          <button className="cancel" onClick={cancel}>
            閉じる
          </button>
        </section>
      )}
    </div>
  );
}
