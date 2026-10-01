import { useEffect, useState } from "react";
import type { NationalStation } from "./rail/model";
import { findStations } from "./rail/stationCatalog";
import { loadCatalog } from "./rail/offline";
export default function StationInput({
  id,
  value,
  onChange,
  onSelect,
  error,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onSelect: (s: NationalStation) => void;
  error: boolean;
}) {
  const [catalog, setCatalog] = useState<NationalStation[]>([]),
    [failed, setFailed] = useState(false),
    [focused, setFocused] = useState(false),
    [query, setQuery] = useState(value);
  useEffect(() => {
    let alive = true;
    loadCatalog()
      .then((rows) => {
        if (alive) setCatalog(rows);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const t = setTimeout(() => setQuery(value), 100);
    return () => clearTimeout(t);
  }, [value]);
  const candidates = focused ? findStations(catalog, query) : [];
  return (
    <div
      className="station-input"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
    >
      <input
        id={id}
        value={value}
        placeholder={id === "nearby" ? "例：東京" : "例：新宿"}
        autoComplete="off"
        maxLength={100}
        aria-describedby={error ? "form-error" : undefined}
        aria-controls={id + "-candidates"}
        onFocus={() => setFocused(true)}
        onChange={(e) => onChange(e.target.value)}
      />
      {candidates.length > 0 && (
        <ul
          id={id + "-candidates"}
          className="candidates"
          aria-label="駅の候補"
        >
          {candidates.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(s);
                  setFocused(false);
                }}
              >
                <strong>{s.name}</strong>
                <small>
                  {s.operators.join("・")} / {s.lines.join("・")}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
      {failed && (
        <small className="muted">
          全国駅候補を取得できません。駅名を直接入力して検索できます。
        </small>
      )}
    </div>
  );
}
