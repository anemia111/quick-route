import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { loadStations, saveStations, validateStations } from "./stations";
import type { Stations } from "./stations";
import { routeProvider } from "./routing";
import StationInput from "./StationInput";
import ReturnHome from "./ReturnHome";
import {
  adaptOffline,
  loadCatalog,
  requestPersistence,
  usablePackages,
} from "./rail/offline";
import { resolveStation } from "./rail/stationCatalog";
import { readMeta, recordSearch, touchPackage } from "./rail/storage";
import { restoreJourney } from "./rail/journeyState";
import type {
  ActiveJourney,
  NationalStation,
  RailPackage,
  RoutingResult,
} from "./rail/model";
const JourneyPanel = lazy(() => import("./JourneyPanel"));
import "./App.css";

function Arrow({ back = false }: { back?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ transform: back ? "rotate(180deg)" : undefined }}
    >
      <path
        d="M5 12h14m-6-6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export default function App() {
  const [initial] = useState(loadStations);
  const [stations, setStations] = useState<Stations | null>(initial.stations);
  const [editing, setEditing] = useState(!initial.stations);
  const [draft, setDraft] = useState<Stations>(
    initial.stations ?? { nearby: "", destination: "" },
  );
  const [error, setError] = useState(initial.error);
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const heading = useRef<HTMLHeadingElement>(null);
  const [result, setResult] = useState<RoutingResult>();
  const [packages, setPackages] = useState<RailPackage[]>([]);
  const [catalog, setCatalog] = useState<NationalStation[]>([]);
  const [restored, setRestored] = useState<ActiveJourney>();
  const [searching, setSearching] = useState(false);
  const [tracking, setTracking] = useState(false);
  useEffect(() => {
    if (stations)
      void adaptOffline([stations.nearby, stations.destination]).then(
        async (message) => {
          if ((await usablePackages()).length)
            await Promise.all([
              import("./rail/planner"),
              import("./rail/router"),
              import("./JourneyPanel"),
            ]).catch(() => {});
          setNotice(message);
        },
      );
  }, [stations]);
  useEffect(() => {
    let alive = true;
    void readMeta("journey")
      .then(async (value) => {
        if (!value || typeof value !== "object" || !("journey" in value))
          return;
        const available = await usablePackages();
        const active = restoreJourney(value, available);
        if (!active) return;
        const rows = await loadCatalog();
        if (alive) {
          setPackages(available);
          setCatalog(rows);
          setRestored(active);
          setResult({
            journeys: [active.journey],
            nextTrainSameArrival: false,
            elapsedMs: 0,
          });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  useEffect(() => {
    if (!document.activeElement?.closest("form"))
      heading.current?.focus({ preventScroll: true });
  }, [editing]);
  function externalSearch(reverse: boolean, detected?: NationalStation) {
    if (!stations) return;
    window.location.assign(
      routeProvider.buildUrl({
        from:
          detected?.name ?? (reverse ? stations.destination : stations.nearby),
        to: reverse ? stations.nearby : stations.destination,
        departure: new Date(),
      }),
    );
  }
  async function search(reverse: boolean, detected?: NationalStation) {
    if (!stations || searching) return;
    const departure = Date.now();
    setSearching(true);
    const from =
        detected?.name ?? (reverse ? stations.destination : stations.nearby),
      to = reverse ? stations.nearby : stations.destination;
    void recordSearch(from, to).catch(() => {});
    try {
      const available = await usablePackages(departure);
      if (!available.length) {
        if (navigator.onLine) externalSearch(reverse, detected);
        else
          setNotice(
            "有効な保存済み時刻表がありません。通信復帰後にYahoo!検索を利用できます。",
          );
        return;
      }
      const rows = await loadCatalog();
      const a = resolveStation(
          rows,
          from,
          detected?.id ??
            (reverse ? stations.destinationId : stations.nearbyId),
        ),
        b = resolveStation(
          rows,
          to,
          reverse ? stations.nearbyId : stations.destinationId,
        );
      if (!a || !b) {
        if (navigator.onLine) externalSearch(reverse, detected);
        else
          setNotice(
            "駅の照合に必要な情報が不足しています。駅候補を選び直すか、通信復帰後に外部検索を利用してください。",
          );
        return;
      }
      const [{ calculate }, { getRealtime }] = await Promise.all([
        import("./rail/planner"),
        import("./rail/realtime"),
      ]);
      const realtime = navigator.onLine
        ? await Promise.race([
            getRealtime(),
            new Promise<undefined>((resolve) =>
              setTimeout(() => resolve(undefined), 800),
            ),
          ])
        : undefined;
      const planned = await calculate({
        packages: available,
        from: a,
        to: b,
        departure,
        realtime,
      });
      if (!planned.journeys.length) {
        if (navigator.onLine) externalSearch(reverse, detected);
        else setNotice(planned.reason ?? "この区間の独自計算は未対応です。");
        return;
      }
      setCatalog(rows);
      setPackages(available);
      setRestored(undefined);
      setResult(planned);
      for (const leg of planned.journeys[0].legs)
        void touchPackage(leg.packageId).catch(() => {});
    } catch {
      if (navigator.onLine) externalSearch(reverse, detected);
      else
        setNotice(
          "データを読み込めませんでした。通信復帰後に外部検索を利用できます。",
        );
    } finally {
      setSearching(false);
      void adaptOffline([from, to]).catch(() => {});
    }
  }
  function save(event: React.FormEvent) {
    event.preventDefault();
    const cleaned = {
      nearby: draft.nearby.trim(),
      destination: draft.destination.trim(),
      ...(draft.nearbyId ? { nearbyId: draft.nearbyId } : {}),
      ...(draft.destinationId ? { destinationId: draft.destinationId } : {}),
    };
    const problem = validateStations(cleaned);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      saveStations(cleaned);
      setStations(cleaned);
      setDraft(cleaned);
      setError("");
      setEditing(false);
      setNotice("駅を保存しました");
      void requestPersistence();
    } catch {
      setError(
        "保存できませんでした。ブラウザの保存設定や空き容量を確認してください。",
      );
    }
  }
  return (
    <div className="app">
      <header>
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          aria-label="Quick Route ホーム"
        >
          <span className="brand-icon">
            <Arrow />
          </span>
          Quick Route
        </a>
        {!editing && (
          <button
            className="icon-button"
            aria-label="設定を開く"
            disabled={tracking}
            onClick={() => {
              setDraft(stations!);
              setError("");
              setNotice("");
              setEditing(true);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="m9 3-.6 2.4-2 .9-2.2-.7-2 3.4 1.7 1.7v2.5L2.2 15l2 3.4 2.2-.7 2 .9L9 21h4l.6-2.4 2-.9 2.2.7 2-3.4-1.7-1.8v-2.5L19.8 9l-2-3.4-2.2.7-2-.9L13 3Z"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle
                cx="11"
                cy="12"
                r="3"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        )}
      </header>
      <main>
        {editing ? (
          <section className="settings">
            <div className="eyebrow">YOUR ROUTE</div>
            <h1 ref={heading} tabIndex={-1}>
              {stations ? (
                "駅の設定"
              ) : (
                <>
                  いつもの2駅を、
                  <br />
                  登録しよう。
                </>
              )}
            </h1>
            <p className="intro">一度保存すれば、次からはワンタップ。</p>
            <form onSubmit={save} noValidate>
              <div className="station-fields">
                <label htmlFor="nearby">
                  <span className="dot blue" />
                  最寄り駅
                </label>
                <StationInput
                  id="nearby"
                  value={draft.nearby}
                  error={!!error}
                  onChange={(nearby) => {
                    setDraft({ ...draft, nearby, nearbyId: undefined });
                    setError("");
                  }}
                  onSelect={(s) =>
                    setDraft({ ...draft, nearby: s.name, nearbyId: s.id })
                  }
                />
                <div className="swap-row">
                  <button
                    className="swap"
                    type="button"
                    onClick={() => {
                      setDraft({
                        nearby: draft.destination,
                        destination: draft.nearby,
                        nearbyId: draft.destinationId,
                        destinationId: draft.nearbyId,
                      });
                      setError("");
                    }}
                  >
                    ⇅ <span>駅を入れ替え</span>
                  </button>
                </div>
                <label htmlFor="destination">
                  <span className="dot green" />
                  目的地駅
                </label>
                <StationInput
                  id="destination"
                  value={draft.destination}
                  error={!!error}
                  onChange={(destination) => {
                    setDraft({
                      ...draft,
                      destination,
                      destinationId: undefined,
                    });
                    setError("");
                  }}
                  onSelect={(s) =>
                    setDraft({
                      ...draft,
                      destination: s.name,
                      destinationId: s.id,
                    })
                  }
                />
              </div>
              {error && (
                <p id="form-error" className="error" role="alert">
                  {error}
                </p>
              )}
              <button className="save" type="submit">
                {stations ? "変更を保存" : "保存してはじめる"}
                <Arrow />
              </button>
              {stations && (
                <button
                  className="cancel"
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setError("");
                  }}
                >
                  キャンセル
                </button>
              )}
            </form>
            <p className="privacy">駅の設定は、このブラウザに保存されます。</p>
          </section>
        ) : (
          <section className="home">
            <div className="eyebrow">YOUR DAILY SHORTCUT</div>
            <h1 ref={heading} tabIndex={-1}>
              いつもの移動を、
              <br />
              もっとスムーズに。
            </h1>
            <div
              className="route"
              aria-label={`${stations!.nearby} ⇄ ${stations!.destination}`}
            >
              <div>
                <span className="label">
                  <i className="dot blue" />
                  最寄り
                </span>
                <strong>{stations!.nearby}</strong>
              </div>
              <span className="route-swap" aria-hidden="true">
                ⇄
              </span>
              <div>
                <span className="label">
                  <i className="dot green" />
                  目的地
                </span>
                <strong>{stations!.destination}</strong>
              </div>
            </div>
            <div className="actions">
              <p className="departure">
                <span />
                {tracking ? "移動モード中" : "今から出発"}
              </p>
              <button
                className="route-button outbound"
                onClick={() => void search(false)}
                disabled={searching || tracking}
              >
                <span>
                  <span className="button-caption">最寄り → 目的地</span>
                  <span className="button-title">
                    {stations!.destination}へ
                  </span>
                </span>
                <span className="arrow-circle">
                  <Arrow />
                </span>
              </button>
              <button
                className="route-button inbound"
                onClick={() => void search(true)}
                disabled={searching || tracking}
              >
                <span>
                  <span className="button-caption">目的地 → 最寄り</span>
                  <span className="button-title">{stations!.nearby}へ</span>
                </span>
                <span className="arrow-circle">
                  <Arrow back />
                </span>
              </button>
            </div>
            <ReturnHome
              home={stations!.nearby}
              disabled={searching || tracking}
              onStation={(station) => void search(true, station)}
            />
            {!online && (
              <p className="error" role="status">
                オフラインです。有効な保存済み時刻表がある区間のみ独自検索できます。Yahoo!検索には通信が必要です。
              </p>
            )}
            <p className="search-note">
              現在時刻・到着が早い順で検索。
              <br />
              データ不足の区間はYahoo!乗換案内を開きます。
            </p>
            <p className="muted" role="status">
              {searching ? "経路を確認しています…" : notice}
            </p>
            {result && (
              <Suspense
                fallback={<p role="status">経路候補を読み込んでいます…</p>}
              >
                <JourneyPanel
                  key={
                    result.journeys[0]?.id + ":" + result.journeys[0]?.arrival
                  }
                  result={result}
                  packages={packages}
                  catalog={catalog}
                  restored={restored}
                  onClose={() => setResult(undefined)}
                  onExternal={(from, to) =>
                    window.location.assign(
                      routeProvider.buildUrl({
                        from,
                        to,
                        departure: new Date(),
                      }),
                    )
                  }
                  onTrackingChanged={setTracking}
                />
              </Suspense>
            )}
          </section>
        )}
      </main>
      <footer>
        <span className="footer-mark">↗</span> いつものルート、ワンタップ。
        <details>
          <summary>データ・対応範囲</summary>
          <p>
            全国駅：国土交通省 国土数値情報
            N02（2025年末基準）。時刻表：東京都交通局・公共交通オープンデータ協議会、CC
            BY
            4.0、加工あり。都営6路線の列車を収録。乗換時間未収録の接続は独自計算しません。
          </p>
          <p>
            <a href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2025.html">
              全国駅の提供元
            </a>{" "}
            / <a href="https://ckan.odpt.org/dataset/train-toei">都営時刻表</a>{" "}
            /{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/deed.ja">
              ライセンス
            </a>
            {" / "}
            <a href={import.meta.env.BASE_URL + "licenses.txt"}>
              ソフトウェアのライセンス
            </a>
          </p>
          <p>
            運行情報は公式発着予測を取得できた列車のみ反映。取得失敗・期限切れを正常運行と判断しません。履歴・設定・位置情報は端末内で処理します。外部検索時は駅名と日時をYahoo!へ送信します。データに誤りがある場合はアプリの
            <a href="https://github.com/anemia111/quick-route/issues">
              問い合わせ先
            </a>
            へお知らせください。
          </p>
        </details>
      </footer>
    </div>
  );
}
