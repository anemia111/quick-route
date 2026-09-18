import { useEffect, useRef, useState } from 'react'
import { loadStations, saveStations, validateStations } from './stations'
import type { Stations } from './stations'
import { routeProvider } from './routing'
import './App.css'

function Arrow({ back = false }: { back?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ transform: back ? 'rotate(180deg)' : undefined }}><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}
export default function App() {
  const [initial] = useState(loadStations)
  const [stations, setStations] = useState<Stations | null>(initial.stations)
  const [editing, setEditing] = useState(!initial.stations)
  const [draft, setDraft] = useState<Stations>(initial.stations ?? { nearby: '', destination: '' })
  const [error, setError] = useState(initial.error)
  const [notice, setNotice] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  useEffect(() => { heading.current?.focus() }, [editing])
  function search(reverse: boolean) {
    if (!stations) return
    window.location.assign(routeProvider.buildUrl({ from: reverse ? stations.destination : stations.nearby, to: reverse ? stations.nearby : stations.destination, departure: new Date() }))
  }
  function save(event: React.FormEvent) {
    event.preventDefault()
    const cleaned = { nearby: draft.nearby.trim(), destination: draft.destination.trim() }
    const problem = validateStations(cleaned)
    if (problem) { setError(problem); return }
    try { saveStations(cleaned); setStations(cleaned); setDraft(cleaned); setError(''); setEditing(false); setNotice('駅を保存しました') }
    catch { setError('保存できませんでした。ブラウザの保存設定や空き容量を確認してください。') }
  }
  return <div className="app">
    <header><a className="brand" href={import.meta.env.BASE_URL} aria-label="Quick Route ホーム"><span className="brand-icon"><Arrow /></span>Quick Route</a>
      {!editing && <button className="icon-button" aria-label="設定を開く" onClick={() => { setDraft(stations!); setError(''); setNotice(''); setEditing(true) }}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 3-.6 2.4-2 .9-2.2-.7-2 3.4 1.7 1.7v2.5L2.2 15l2 3.4 2.2-.7 2 .9L9 21h4l.6-2.4 2-.9 2.2.7 2-3.4-1.7-1.8v-2.5L19.8 9l-2-3.4-2.2.7-2-.9L13 3Z" stroke="currentColor" strokeWidth="1.5"/><circle cx="11" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/></svg></button>}
    </header>
    <main>{editing ? <section className="settings">
      <div className="eyebrow">YOUR ROUTE</div>
      <h1 ref={heading} tabIndex={-1}>{stations ? '駅の設定' : <>いつもの2駅を、<br />登録しよう。</>}</h1>
      <p className="intro">一度保存すれば、次からはワンタップ。</p>
      <form onSubmit={save} noValidate>
        <div className="station-fields">
          <label htmlFor="nearby"><span className="dot blue"/>最寄り駅</label>
          <input id="nearby" value={draft.nearby} placeholder="例：東京" autoComplete="off" maxLength={100} aria-describedby={error ? 'form-error' : undefined} onChange={e => { setDraft({ ...draft, nearby: e.target.value }); setError('') }} />
          <div className="swap-row"><button className="swap" type="button" onClick={() => { setDraft({ nearby: draft.destination, destination: draft.nearby }); setError('') }}>⇅ <span>駅を入れ替え</span></button></div>
          <label htmlFor="destination"><span className="dot green"/>目的地駅</label>
          <input id="destination" value={draft.destination} placeholder="例：新宿" autoComplete="off" maxLength={100} aria-describedby={error ? 'form-error' : undefined} onChange={e => { setDraft({ ...draft, destination: e.target.value }); setError('') }} />
        </div>
        {error && <p id="form-error" className="error" role="alert">{error}</p>}
        <button className="save" type="submit">{stations ? '変更を保存' : '保存してはじめる'}<Arrow /></button>
        {stations && <button className="cancel" type="button" onClick={() => { setEditing(false); setError('') }}>キャンセル</button>}
      </form>
      <p className="privacy">駅の設定は、このブラウザに保存されます。</p>
    </section> : <section className="home">
      <div className="eyebrow">YOUR DAILY SHORTCUT</div>
      <h1 ref={heading} tabIndex={-1}>いつもの移動を、<br />もっとスムーズに。</h1>
      <div className="route" aria-label={`${stations!.nearby} ⇄ ${stations!.destination}`}><div><span className="label"><i className="dot blue"/>最寄り</span><strong>{stations!.nearby}</strong></div><span className="route-swap" aria-hidden="true">⇄</span><div><span className="label"><i className="dot green"/>目的地</span><strong>{stations!.destination}</strong></div></div>
      <div className="actions"><p className="departure"><span/>今から出発</p>
        <button className="route-button outbound" onClick={() => search(false)}><span><span className="button-caption">最寄り → 目的地</span><span className="button-title">目的地へ</span></span><span className="arrow-circle"><Arrow /></span></button>
        <button className="route-button inbound" onClick={() => search(true)}><span><span className="button-caption">目的地 → 最寄り</span><span className="button-title">最寄りへ</span></span><span className="arrow-circle"><Arrow back /></span></button>
      </div>
      {!online && <p className="error" role="status">オフラインです。経路検索にはインターネット接続が必要です。</p>}
      <p className="search-note">現在時刻・到着が早い順で<br />Yahoo!乗換案内を開きます。</p>
      <p className="sr-only" role="status">{notice}</p>
    </section>}</main>
    <footer><span className="footer-mark">↗</span> いつものルート、ワンタップ。</footer>
  </div>
}
