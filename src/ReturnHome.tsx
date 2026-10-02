import { useEffect, useRef, useState } from "react";
import { loadCatalog } from "./rail/offline";
import { nearbyStations } from "./rail/nearbyStations";
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
  const [message, setMessage] = useState("");
  const request = useRef(0);
  const controller = useRef<AbortController | undefined>(undefined);
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
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  function cancel() {
    request.current++;
    controller.current?.abort();
    setBusy(false);
    setMessage("");
  }
  async function locate() {
    if (busy || disabled) return;
    const id = ++request.current;
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
      if (request.current !== id || controller.current.signal.aborted) return;
      const matches = nearbyStations(
        stations,
        position.coords.latitude,
        position.coords.longitude,
        position.coords.accuracy,
      );
      if (!matches.length) {
        setMessage(
          "5km以内に駅候補が見つかりませんでした。通常の駅検索を利用してください。",
        );
        return;
      }
      if (Math.abs(Date.now() - position.timestamp) > 60000)
        throw Error(
          "位置情報が古いため使用できません。もう一度試してください。",
        );
      const nearest = matches[0];
      setMessage(
        `${nearest.station.name}から${home}への経路を検索しています。位置の誤差は約${Math.ceil(position.coords.accuracy)}mです。`,
      );
      onStation(nearest.station);
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
        近い駅から到着が早い順で自動検索します。徒歩時間は未計算です。位置座標は保存・送信しません。
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
    </div>
  );
}
