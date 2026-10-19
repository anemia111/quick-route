import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export default function AppUpdate({ busy }: { busy: boolean }) {
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const [message, setMessage] = useState("");
  const [needRefresh, setNeedRefresh] = useState(false);
  useRegisterSW({
    immediate: true,
    onNeedReload() { setNeedRefresh(true); },
    onRegisteredSW(_url, value) { registration.current = value; },
    onRegisterError() { setMessage("更新を確認できませんでした。通信復帰後に再度お試しください。"); },
  });
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "visible" && navigator.onLine)
        void registration.current?.update().catch(() => {});
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("online", check);
    const timer = window.setInterval(check, 60 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("online", check);
      window.clearInterval(timer);
    };
  }, []);
  async function checkNow() {
    try {
      if (!navigator.onLine || !registration.current) throw new Error("unavailable");
      await registration.current.update();
      setMessage("更新を確認しました。新版が見つかると更新ボタンが表示されます。");
    } catch {
      setMessage("更新を確認できませんでした。通信復帰後に再度お試しください。");
    }
  }
  return <div className="app-update">
    <p>表示中の版：<a href={`https://github.com/anemia111/quick-route/commit/${__BUILD_COMMIT__}`}>{__BUILD_COMMIT__.slice(0, 7)}</a></p>
    {needRefresh ? <div role="status">
      <p>Quick Routeの新しい版を利用できます。登録した駅・保存済み時刻表は保持されます。</p>
      <button type="button" disabled={busy} onClick={() => window.location.reload()}>最新版を表示</button>
      {busy && <p>設定の編集・検索・移動モードを終えてから更新できます。</p>}
    </div> : <button type="button" onClick={() => void checkNow()}>最新版を確認</button>}
    {message && <p role="status">{message}</p>}
  </div>;
}
