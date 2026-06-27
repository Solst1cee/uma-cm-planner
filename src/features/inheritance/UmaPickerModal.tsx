// src/features/inheritance/UmaPickerModal.tsx
/** Full-screen parent picker: a spark-filter builder over the imported roster
 *  with rich tiles (sparks + affinity). Presentational + portal; the container
 *  passes already-aggregated items. */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Parent, Stat } from '@/core/types';
import { APTITUDE_OPTIONS, STAT_OPTIONS } from '@/features/parents/sparkMeta';
import type { SparkAgg } from './sparkAggregate';
import { matchesFilters, type SparkFilter } from './sparkFilter';
import { LineageSparkChips } from './LineageSparkChips';

export interface UmaPickerItem {
  /** Roster id (trained_chara_id from the json file). */
  id: string;
  name: string;
  rating?: string;
  rankScore?: number;
  portrait: ReactNode;
  /** The veteran — drives the full-lineage spark chips on the tile. */
  parent: Parent;
  agg: SparkAgg;
  affinity: number | null;
}
export interface UmaPickerModalProps {
  open: boolean;
  items: UmaPickerItem[];
  skillName: (id: string) => string;
  whiteSkillOptions: Array<{ id: string; name: string }>;
  onPick: (id: string) => void;
  onClose: () => void;
}

let seq = 0;
const newId = () => `f${(seq += 1)}`;

export function UmaPickerModal({ open, items, skillName, whiteSkillOptions, onPick, onClose }: UmaPickerModalProps) {
  const [filters, setFilters] = useState<SparkFilter[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((it) => matchesFilters(it.agg, filters) && (q === '' || it.name.toLowerCase().includes(q)))
      .sort((a, b) => (b.affinity ?? -1) - (a.affinity ?? -1) || a.name.localeCompare(b.name));
  }, [items, filters, query]);

  if (!open) return null;

  const add = (f: SparkFilter) => { setFilters((xs) => [...xs, f]); setMenuOpen(false); };
  const update = (id: string, patch: Partial<SparkFilter>) =>
    setFilters((xs) => xs.map((f) => (f.id === id ? ({ ...f, ...patch } as SparkFilter) : f)));
  const remove = (id: string) => setFilters((xs) => xs.filter((f) => f.id !== id));

  const numIn = (val: number, on: (n: number) => void, label: string, max: number) => (
    <label className="inh-uma-min">
      <span className="muted small">{label}</span>
      <input type="number" min={0} max={max} value={val} aria-label={label}
        onChange={(e) => on(Math.max(0, Math.min(max, Number(e.target.value) || 0)))} />
    </label>
  );

  const filterRow = (f: SparkFilter) => (
    <div key={f.id} className="inh-uma-filter-row">
      {f.kind === 'blue' && (
        <>
          <span className="badge spark-blue">Blue</span>
          <select aria-label="stat" value={f.stat} onChange={(e) => update(f.id, { stat: e.target.value as Stat })}>
            {STAT_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          {numIn(f.legacyMin, (n) => update(f.id, { legacyMin: n }), 'legacy ≥', 3)}
          {numIn(f.totalMin, (n) => update(f.id, { totalMin: n }), 'total ≥', 9)}
        </>
      )}
      {f.kind === 'pink' && (
        <>
          <span className="badge spark-pink">Pink</span>
          <select aria-label="aptitude" value={f.aptitude} onChange={(e) => update(f.id, { aptitude: e.target.value })}>
            {APTITUDE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
          {numIn(f.legacyMin, (n) => update(f.id, { legacyMin: n }), 'legacy ≥', 3)}
          {numIn(f.totalMin, (n) => update(f.id, { totalMin: n }), 'total ≥', 9)}
        </>
      )}
      {f.kind === 'white' && (
        <>
          <span className="badge spark-white">White</span>
          <select aria-label="skill" value={f.skillId} onChange={(e) => update(f.id, { skillId: e.target.value })}>
            {whiteSkillOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          {numIn(f.legacyMin, (n) => update(f.id, { legacyMin: n }), 'legacy ≥', 3)}
          {numIn(f.totalMin, (n) => update(f.id, { totalMin: n }), 'total ≥', 9)}
        </>
      )}
      {f.kind === 'anyBlue' && (
        <>
          <span className="badge spark-blue">Any blue</span>
          {numIn(f.totalMin, (n) => update(f.id, { totalMin: n }), 'any-blue total ≥', 9)}
        </>
      )}
      <button type="button" className="cmp-small-btn inh-uma-filter-x" aria-label="Remove filter" onClick={() => remove(f.id)}>✕</button>
    </div>
  );

  const body = (
    <div className="inh-uma-modal-backdrop" data-testid="uma-modal-backdrop" onClick={onClose}>
      <div className="cmp-plan-card inh-uma-modal" role="dialog" aria-modal="true" aria-label="Pick a parent"
        onClick={(e) => e.stopPropagation()}>
        <header className="cmp-plan-card-head inh-uma-modal-head">
          <span>Pick a parent</span>
          <span className="muted small">{shown.length} match</span>
          <button type="button" className="cmp-small-btn inh-uma-modal-x" aria-label="Close" onClick={onClose}>✕</button>
        </header>
        <div className="inh-uma-searchbar">
          <input
            type="search"
            className="inh-uma-search"
            placeholder="Search by name…"
            aria-label="Search by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="inh-uma-filterbar">
          <div className="inh-uma-add">
            <button type="button" className="cmp-small-btn" aria-haspopup="menu" onClick={() => setMenuOpen((o) => !o)}>+ Add filter</button>
            {menuOpen && (
              <div className="inh-uma-add-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => add({ id: newId(), kind: 'blue', stat: 'spd', legacyMin: 0, totalMin: 0 })}>Blue (stat)</button>
                <button type="button" role="menuitem" onClick={() => add({ id: newId(), kind: 'pink', aptitude: 'turf', legacyMin: 0, totalMin: 0 })}>Pink (aptitude)</button>
                <button type="button" role="menuitem" onClick={() => add({ id: newId(), kind: 'white', skillId: whiteSkillOptions[0]?.id ?? '', legacyMin: 0, totalMin: 1 })}>White skill</button>
                <button type="button" role="menuitem" onClick={() => add({ id: newId(), kind: 'anyBlue', totalMin: 0 })}>Any blue</button>
              </div>
            )}
          </div>
          {filters.map(filterRow)}
        </div>
        <div className="cmp-plan-card-body inh-uma-grid">
          {shown.length === 0 && <p className="muted small">No veterans match.</p>}
          {shown.map((it) => (
            <button key={it.id} type="button" className="inh-uma-tile" onClick={() => onPick(it.id)}>
              <span className="inh-uma-tile-head">
                <span className="inh-uma-tile-portrait">{it.portrait}</span>
                <span className="inh-uma-tile-name">{it.name}</span>
                {it.rating && (
                  <span className="inh-uma-rank" title="Rank">
                    <span className="inh-uma-rank-icon" aria-hidden>◆</span>
                    {it.rating}
                  </span>
                )}
                {it.rankScore !== undefined && (
                  <span className="inh-uma-score muted small" title="Rank score">{it.rankScore}</span>
                )}
                <span className="inh-uma-jsonid muted small" title="Roster ID (json)">#{it.id}</span>
              </span>
              <span className="inh-uma-aff-row">
                <span className="muted small">Affinity</span>
                <span className="inh-uma-aff" title="Affinity (incl. G1 win bonus)">{it.affinity ?? '—'}</span>
              </span>
              <span className="inh-uma-tile-sparks">
                <LineageSparkChips parent={it.parent} skillName={skillName} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
  return createPortal(body, document.body);
}
