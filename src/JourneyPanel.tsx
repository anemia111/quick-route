import { useEffect, useRef, useState } from "react";
import type {
  ActiveJourney,
  Journey,
  NationalStation,
  RailPackage,
  RealtimeSnapshot,
  RoutingResult,
} from "./rail/model";
import { saveMeta } from "./rail/storage";
import { calculate } from "./rail/planner";
import {
  decideAlert,
  journeyImpact,
  type AlertState,
} from "./rail/intelligence";
import { getRealtime } from "./rail/realtime";
const clock = (n: number) =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(n);
export default function JourneyPanel({
  result,
  packages,
  catalog,
  restored,
  onExternal,
  onClose,
  onTrackingChanged,
}: {
  result: RoutingResult;
  packages: RailPackage[];
  catalog: NationalStation[];
  restored?: ActiveJourney;
  onExternal: (from: string, to: string) => void;
  onClose: () => void;
  onTrackingChanged?: (active: boolean) => void;
}) {
  const [selected, setSelected] = useState(
    restored?.journey ?? result.journeys[0],
  );
  const [active, setActive] = useState(!!restored),
    [visible, setVisible] = useState(document.visibilityState !== "hidden");
  useEffect(() => {
    onTrackingChanged?.(active);
  }, [active, onTrackingChanged]);
  const [message, setMessage] = useState(
    restored
      ? "移動状態を復元しました。非表示中の追跡は行っていません。現在の駅を確認してください。"
      : "",
  );
  const [anchor, setAnchor] = useState<NationalStation>(),
    [nearby, setNearby] = useState<NationalStation>(),
    [alternative, setAlternative] = useState<Journey>();
  const [alert, setAlert] = useState(""),
    [rt, setRt] = useState<RealtimeSnapshot>();
  const [now, setNow] = useState(() => Date.now());
  const anchorAt = useRef(0);
  useEffect(() => {
    const expiry = selected.realtimeExpiresAt;
    if (!expiry || expiry <= Date.now()) return;
    const timer = setTimeout(() => setNow(Date.now()), expiry - Date.now() + 1);
    return () => clearTimeout(timer);
  }, [selected]);
  const history = useRef<AlertState>({ lastAt: 0, fingerprints: [] }),
    busy = useRef(false),
    started = useRef(restored?.startedAt ?? now);
  const persist = (
    journey: Journey,
    status: "active" | "paused",
    station?: NationalStation,
  ) =>
    saveMeta("journey", {
      journey,
      startedAt: started.current,
      status,
      lastEvaluated: Date.now(),
      anchor: station?.id,
    }).catch(() =>
      setMessage(
        "移動状態を保存できませんでした。表示中の追跡は利用できます。",
      ),
    );
  useEffect(() => {
    const visibility = () => {
      const shown = document.visibilityState !== "hidden";
      setVisible(shown);
      setNow(Date.now());
      setNearby(undefined);
      if (active) {
        void persist(selected, shown ? "active" : "paused", anchor);
        if (shown) {
          setNow(Date.now());
          setRt(undefined);
          setAlert("");
          setAlternative(undefined);
          setAnchor(undefined);
          setMessage(
            "アプリ復帰後の情報を更新します。現在の駅を確認してください。",
          );
        }
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [active, selected, anchor]);
  useEffect(() => {
    if (!active || !visible) return;
    let disposed = false;
    const update = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const fresh = await getRealtime();
        if (disposed) return;
        setRt(fresh);
        setNow(Date.now());
        const minimum = selected.legs
          .slice(1)
          .map(
            (leg, i) =>
              packages
                .find((p) => p.id === leg.packageId)
                ?.transfers.find(
                  (t) =>
                    t.from === selected.legs[i].to.id && t.to === leg.from.id,
                )?.seconds ?? NaN,
          );
        const impact = journeyImpact(selected, fresh, Date.now(), minimum);
        let candidate: Journey | undefined;
        if (anchor && Date.now() - anchorAt.current <= 120000) {
          const end = selected.legs[selected.legs.length - 1].to;
          const targets = catalog.filter(
            (s) => s.name === end.name && s.operators.includes("東京都"),
          );
          const target = targets.sort(
            (a, b) =>
              Math.hypot(a.lat - end.lat, a.lon - end.lon) -
              Math.hypot(b.lat - end.lat, b.lon - end.lon),
          )[0];
          if (target) {
            const plan = await calculate({
              packages,
              from: anchor,
              to: target,
              departure: Date.now(),
              realtime: fresh,
            });
            if (disposed) return;
            candidate = plan.journeys.find((j) => j.id !== selected.id);
          }
        }
        const notification = decideAlert(
          selected,
          candidate,
          impact,
          history.current,
        );
        if (notification) {
          history.current = {
            lastAt: Date.now(),
            fingerprints: [
              ...history.current.fingerprints.slice(-49),
              notification.fingerprint,
            ],
          };
          setAlert(notification.message);
          setAlternative(candidate);
        }
        void persist(selected, "active", anchor);
      } finally {
        busy.current = false;
      }
    };
    void update().catch(() =>
      setMessage(
        "更新できませんでした。通常ダイヤと未取得の運行情報を区別して表示します。",
      ),
    );
    const timer = setInterval(() => void update().catch(() => {}), 60000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [active, visible, selected, anchor, packages, catalog]);
  const watch = useRef<number | undefined>(undefined);
  const lastLocation = useRef(0);
  useEffect(
    () => () => {
      if (watch.current !== undefined)
        navigator.geolocation?.clearWatch(watch.current);
    },
    [],
  );
  useEffect(() => {
    if ((!active || !visible) && watch.current !== undefined) {
      navigator.geolocation?.clearWatch(watch.current);
      watch.current = undefined;
    }
  }, [active, visible]);
  function locate() {
    if (!navigator.geolocation) {
      setMessage("位置情報は利用できません。現在の駅を選択してください。");
      return;
    }
    if (watch.current !== undefined) return;
    watch.current = navigator.geolocation.watchPosition(
      (position) => {
        if (Date.now() - lastLocation.current < 15000) return;
        lastLocation.current = Date.now();
        if (position.coords.accuracy > 200) {
          setNearby(undefined);
          setMessage("GPSの精度が不足しています。乗車列車は特定できません。");
          return;
        }
        const nearest = [...catalog].sort(
          (a, b) =>
            Math.hypot(
              a.lat - position.coords.latitude,
              a.lon - position.coords.longitude,
            ) -
            Math.hypot(
              b.lat - position.coords.latitude,
              b.lon - position.coords.longitude,
            ),
        )[0];
        if (
          nearest &&
          Math.hypot(
            nearest.lat - position.coords.latitude,
            nearest.lon - position.coords.longitude,
          ) *
            111000 <
            500
        )
          setNearby(nearest);
      },
      () => {
        setNearby(undefined);
        setMessage(
          "位置情報を取得できません。駅を確認する操作で移動モードを利用できます。",
        );
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 },
    );
  }
  const impact = journeyImpact(selected, rt, now);
  return (
    <section className="journey-panel" aria-label="経路候補">
      <div className="panel-heading">
        <strong>保存済み時刻表の経路候補</strong>
        <button
          type="button"
          className="cancel"
          onClick={onClose}
          disabled={active}
        >
          閉じる
        </button>
      </div>
      <p className="muted">
        未収録路線・未確認の乗換を含む全国最速は保証しません。
      </p>
      {!active &&
        result.journeys.slice(0, 4).map((j, i) => (
          <button
            className={
              "journey-choice" + (j.id === selected.id ? " chosen" : "")
            }
            key={j.id}
            onClick={() => setSelected(j)}
          >
            <span>
              {i === 0 ? "最も早い候補" : "別の候補"} · {clock(j.departure)} →{" "}
              {clock(j.arrival)}
            </span>
            <small>
              {j.legs.map((l) => l.route).join(" → ")} / 乗換{j.changes}回
            </small>
          </button>
        ))}
      <p>
        <strong>
          {clock(selected.departure)} → {clock(selected.arrival)}
        </strong>{" "}
        ·{" "}
        {selected.evidence === "official-prediction"
          ? selected.realtimeExpiresAt && selected.realtimeExpiresAt > now
            ? "公式発着予測を含む"
            : "以前の公式発着予測（最新未確認）"
          : "通常ダイヤ"}
      </p>
      <ol>
        {selected.legs.map((l, i) => (
          <li key={i}>
            {l.from.name} {clock(l.departure)} → {l.to.name} {clock(l.arrival)}
            <small>{l.route}</small>
          </li>
        ))}
      </ol>
      <details>
        <summary>時刻表の出典・有効期間</summary>
        {[...new Set(selected.legs.map((l) => l.packageId))].map((id) => {
          const p = packages.find((p) => p.id === id);
          return p ? (
            <p key={id}>
              {p.operator} · 収録版{p.version}
              <br />
              有効期間 {p.validFrom}〜{p.validTo}
              <br />
              <a href="https://ckan.odpt.org/dataset/train-toei">
                公式データの案内
              </a>
            </p>
          ) : null;
        })}
      </details>
      {result.journeys.length < 2 && (
        <p className="muted">比較できる別の候補はありません。</p>
      )}
      {result.nextTrainSameArrival && (
        <p>
          後の列車でも同じ到着時刻の候補があります。駅まで・構内の移動時間は未確認です。
        </p>
      )}
      {!active ? (
        <button
          className="save"
          onClick={() => {
            started.current = Date.now();
            setActive(true);
            setMessage(
              "移動モードを開始しました。現在の駅を確認してから代替経路を評価します。",
            );
            void persist(selected, "active");
          }}
        >
          この経路で移動を開始
        </button>
      ) : (
        <>
          <p role="status">
            {visible
              ? "表示中に移動状況を再評価しています。"
              : "追跡を一時停止しています。"}{" "}
            {impact.message}
          </p>
          {impact.arrival !== undefined && (
            <p>公式発着予測での到着 {clock(impact.arrival)}</p>
          )}
          <label>
            現在の駅を確認
            <select
              value={anchor?.id ?? ""}
              onChange={(e) => {
                anchorAt.current = Date.now();
                setAnchor(catalog.find((s) => s.id === e.target.value));
                setAlternative(undefined);
                setAlert("");
              }}
            >
              <option value="">駅を選択</option>
              {catalog
                .filter(
                  (s) =>
                    s.operators.includes("東京都") &&
                    packages.some((p) =>
                      p.stops.some((t) => t.name === s.name),
                    ),
                )
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.lines.join("・")}
                  </option>
                ))}
            </select>
          </label>
          <button className="cancel" onClick={locate}>
            位置情報で近くの駅を確認
          </button>
          {nearby && (
            <button
              className="cancel"
              onClick={() => {
                anchorAt.current = Date.now();
                setAnchor(nearby);
                setNearby(undefined);
              }}
            >
              近くの{nearby.name}駅にいると確認する
            </button>
          )}
          <p className="muted">
            GPSだけで乗車列車を断定しません。画面ロック中の継続追跡・通知は保証しません。
          </p>
          {alert && (
            <div className="route-alert" role="status">
              <strong>{alert}</strong>
              {alternative && (
                <>
                  <p>
                    現在 {clock(impact.arrival ?? selected.arrival)} / 候補{" "}
                    {clock(alternative.arrival)}
                    <br />
                    {alternative.legs.map((l) => l.route).join(" → ")}
                  </p>
                  <button
                    className="save"
                    onClick={() => {
                      setSelected(alternative);
                      setAlternative(undefined);
                      setAlert("");
                      void persist(alternative, "active", anchor);
                    }}
                  >
                    この変更を承認する
                  </button>
                </>
              )}
              <button className="cancel" onClick={() => setAlert("")}>
                現在の経路を維持
              </button>
            </div>
          )}
          <button
            className="cancel"
            onClick={() => {
              setActive(false);
              setAnchor(undefined);
              setAlert("");
              void saveMeta("journey", null);
              setMessage("追跡を終了しました。");
            }}
          >
            追跡を終了
          </button>
        </>
      )}
      {message && (
        <p className="muted" role="status">
          {message}
        </p>
      )}
      {rt && rt.expiresAt > now && (
        <p className="muted">
          都営交通 / 運行情報の取得 {clock(rt.fetchedAt)}
          {" / 生成 "}
          {clock(rt.timestamp)}
          。予測がない列車は通常ダイヤです。
        </p>
      )}
      <button
        className="cancel"
        onClick={() =>
          onExternal(
            anchor?.name ?? selected.legs[0].from.name,
            selected.legs.at(-1)!.to.name,
          )
        }
      >
        Yahoo!で全国の経路を比較
      </button>
    </section>
  );
}
