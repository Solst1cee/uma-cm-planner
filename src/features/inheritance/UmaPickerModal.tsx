// src/features/inheritance/UmaPickerModal.tsx
/** Full-screen parent picker: a spark-filter builder over the imported roster
 *  with rich tiles (sparks + affinity). Presentational + portal; the container
 *  passes already-aggregated items. */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Parent, Stat } from '@/core/types';
import type { SparkAgg } from './sparkAggregate';
import { matchesFilters, type SparkFilter } from './sparkFilter';
import { LineageSparkChips } from './LineageSparkChips';
import { SparkFilterCards, SPARK_NAMES, type SparkCat, type SparkVal } from './SparkFilterCards';
import { SparkSummary, type SummaryChip } from './SparkSummary';
import { maxTotalForKey } from './sparkBudget';

/** Green (unique) total caps at 3★ (one member's inherited-unique spark). */
const GREEN_TOTAL_CAP = 3;
const STAT_ORDER = ['spd', 'sta', 'pow', 'gut', 'wit'];
const APT_ORDER = ['turf', 'dirt', 'sprint', 'mile', 'medium', 'long', 'front', 'pace', 'late', 'end'];
type BpKind = 'blue' | 'pink';

export interface UmaPickerItem {
  /** Roster id (trained_chara_id from the json file). */
  id: string;
  name: string;
  /** Pre-built evaluation-rank badge node (icon) — container-wired. */
  rankBadge?: ReactNode;
  /** Numeric evaluation score, shown under the rank badge. */
  rankScore?: number;
  portrait: ReactNode;
  /** Pre-built grandparent portrait nodes (the veteran's 1–2 GPs) — container-wired. */
  gpPortraits?: ReactNode[];
  /** Pre-built stat row (colour-coded stat icon + value ×5) — container-wired. */
  statRow?: ReactNode;
  /** The veteran — drives the full-lineage spark chips on the tile. */
  parent: Parent;
  agg: SparkAgg;
  affinity: number | null;
  /** Already chosen in the other parent slot — greyed, not selectable, sorted last. */
  disabled?: boolean;
}
export interface UmaPickerModalProps {
  open: boolean;
  items: UmaPickerItem[];
  skillName: (id: string) => string;
  /** True when a spark's skill id is on the plan's wishlist → blue glow on the tile. */
  isWishlisted?: (skillId: string) => boolean;
  /** @deprecated white-skill filter dropped in the Star Tracks redesign. */
  whiteSkillOptions?: Array<{ id: string; name: string }>;
  /** Selectable unique skills for the green-spark search. */
  uniqueSkillOptions?: Array<{ id: string; name: string }>;
  /** Optional green skill icon node (container-wired GameIcon). */
  greenIcon?: (skillId: string) => ReactNode;
  onPick: (id: string) => void;
  onClose: () => void;
}

let seq = 0;
const newId = () => `f${(seq += 1)}`;

export function UmaPickerModal({ open, items, skillName, isWishlisted, uniqueSkillOptions = [], greenIcon, onPick, onClose }: UmaPickerModalProps) {
  const [filters, setFilters] = useState<SparkFilter[]>([]);
  const [query, setQuery] = useState('');

  // --- blue/pink spark state, derived from / written to `filters` ---
  const sameTile = (f: SparkFilter, kind: BpKind, key: string) =>
    (kind === 'blue' && f.kind === 'blue' && f.stat === key) ||
    (kind === 'pink' && f.kind === 'pink' && f.aptitude === key);
  const inCategory = (f: SparkFilter, kind: BpKind) =>
    (kind === 'blue' && f.kind === 'blue') || (kind === 'pink' && f.kind === 'pink');

  const bpValue = (kind: BpKind, key: string): SparkVal => {
    const f = filters.find((x) => sameTile(x, kind, key));
    return f && 'legacyMin' in f ? { legacy: f.legacyMin, total: f.totalMin } : { legacy: 0, total: 0 };
  };
  const bpMaxTotal = (kind: BpKind, key: string): number => {
    const totals: Record<string, number> = {};
    for (const f of filters) {
      if (f.kind === 'blue' && kind === 'blue') totals[f.stat] = f.totalMin;
      else if (f.kind === 'pink' && kind === 'pink') totals[f.aptitude] = f.totalMin;
    }
    return maxTotalForKey(totals, key);
  };
  const bpLegacyLocked = (kind: BpKind, key: string): boolean =>
    filters.some((f) => inCategory(f, kind) && 'legacyMin' in f && f.legacyMin > 0 && !sameTile(f, kind, key));

  const setBp = (kind: BpKind, key: string, legacy: number, total: number) => {
    setFilters((xs) => {
      let others = xs.filter((f) => !sameTile(f, kind, key));
      if (legacy > 0) others = others.map((f) => (inCategory(f, kind) && 'legacyMin' in f ? ({ ...f, legacyMin: 0 } as SparkFilter) : f));
      if (legacy === 0 && total === 0) return others;
      const clause: SparkFilter = kind === 'blue'
        ? { id: newId(), kind: 'blue', stat: key as Stat, legacyMin: legacy, totalMin: total }
        : { id: newId(), kind: 'pink', aptitude: key, legacyMin: legacy, totalMin: total };
      return [...others, clause];
    });
  };

  // --- green (unique) spark state (single-legacy, total capped at 3) ---
  type GreenF = Extract<SparkFilter, { kind: 'green' }>;
  const greenClauses = filters.filter((f): f is GreenF => f.kind === 'green');
  const greenLegacyLocked = (skillId: string): boolean =>
    greenClauses.some((c) => c.legacyMin > 0 && c.skillId !== skillId);
  const setGreen = (skillId: string, legacy: number, total: number) => {
    setFilters((xs) => {
      let others = xs.filter((f) => !(f.kind === 'green' && f.skillId === skillId));
      if (legacy > 0) others = others.map((f) => (f.kind === 'green' ? ({ ...f, legacyMin: 0 } as SparkFilter) : f));
      if (legacy === 0 && total === 0) return others;
      return [...others, { id: newId(), kind: 'green', skillId, legacyMin: legacy, totalMin: total }];
    });
  };

  // --- unified spark API for the cards ---
  const sparkValue = (cat: SparkCat, key: string): SparkVal => {
    if (cat === 'green') { const c = greenClauses.find((x) => x.skillId === key); return { legacy: c?.legacyMin ?? 0, total: c?.totalMin ?? 0 }; }
    return bpValue(cat, key);
  };
  const setSpark = (cat: SparkCat, key: string, legacy: number, total: number) => {
    if (cat === 'green') setGreen(key, legacy, total); else setBp(cat, key, legacy, total);
  };
  const sparkMaxTotal = (cat: SparkCat, key: string): number => (cat === 'green' ? GREEN_TOTAL_CAP : bpMaxTotal(cat, key));
  const sparkLegacyLocked = (cat: SparkCat, key: string): boolean => (cat === 'green' ? greenLegacyLocked(key) : bpLegacyLocked(cat, key));
  const membersUsed = (cat: SparkCat): number => {
    if (cat === 'green') return greenClauses.length;
    let used = 0;
    for (const f of filters) if ((cat === 'blue' && f.kind === 'blue') || (cat === 'pink' && f.kind === 'pink')) used += Math.ceil(f.totalMin / 3);
    return Math.min(3, used);
  };
  const activeGreen = greenClauses.map((c) => ({ key: c.skillId, name: skillName(c.skillId) }));
  const greenOptions = uniqueSkillOptions.filter((o) => !greenClauses.some((c) => c.skillId === o.id));

  // summary chips (canonical order) + spark-only match count
  const chipRank = (f: SparkFilter): number => {
    if (f.kind === 'blue') return STAT_ORDER.indexOf(f.stat);
    if (f.kind === 'pink') return 100 + APT_ORDER.indexOf(f.aptitude);
    if (f.kind === 'green') { const i = uniqueSkillOptions.findIndex((o) => o.id === f.skillId); return 200 + (i < 0 ? 99 : i); }
    return 999;
  };
  const summaryChips: SummaryChip[] = filters
    .filter((f): f is Extract<SparkFilter, { kind: 'blue' | 'pink' | 'green' }> =>
      (f.kind === 'blue' || f.kind === 'pink' || f.kind === 'green') && (f.legacyMin > 0 || f.totalMin > 0))
    .sort((a, b) => chipRank(a) - chipRank(b))
    .map((f) => {
      const cat = f.kind as SparkCat;
      const key = f.kind === 'blue' ? f.stat : f.kind === 'pink' ? f.aptitude : f.skillId;
      const name = f.kind === 'green' ? skillName(f.skillId) : (SPARK_NAMES[key] ?? key);
      return { id: f.id, cat, name, legacy: f.legacyMin, total: f.totalMin, onRemove: () => setSpark(cat, key, 0, 0) };
    });
  const sparkMatchCount = useMemo(() => items.filter((it) => matchesFilters(it.agg, filters)).length, [items, filters]);

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
      // Disabled (already-the-other-parent) tiles sink to the bottom; then affinity desc, then name.
      .sort((a, b) =>
        Number(!!a.disabled) - Number(!!b.disabled) ||
        (b.affinity ?? -1) - (a.affinity ?? -1) ||
        a.name.localeCompare(b.name));
  }, [items, filters, query]);

  if (!open) return null;

  const body = (
    <div className="inh-uma-modal-backdrop" data-testid="uma-modal-backdrop" onClick={onClose}>
      <div className="cmp-plan-card inh-uma-modal" role="dialog" aria-modal="true" aria-label="Pick a parent"
        onClick={(e) => e.stopPropagation()}>
        <header className="cmp-plan-card-head inh-uma-modal-head">
          <span>Pick a parent</span>
          <button type="button" className="cmp-small-btn inh-uma-modal-x" aria-label="Close" onClick={onClose}>✕</button>
        </header>
        <div className="inh-uma-split">
          <div className="inh-uma-filter-col">
            <SparkSummary matchCount={sparkMatchCount} total={items.length} chips={summaryChips} onReset={() => setFilters([])} />
            <SparkFilterCards
              value={sparkValue}
              onSet={setSpark}
              maxTotal={sparkMaxTotal}
              legacyLocked={sparkLegacyLocked}
              membersUsed={membersUsed}
              activeGreen={activeGreen}
              greenOptions={greenOptions}
              greenIcon={greenIcon}
            />
          </div>
          <div className="inh-uma-results-col">
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
            <div className="cmp-plan-card-body inh-uma-grid">
          {shown.length === 0 && <p className="muted small">No veterans match.</p>}
          {shown.map((it) => (
            <button key={it.id} type="button"
              className={`inh-uma-tile${it.disabled ? ' is-disabled' : ''}`}
              aria-disabled={it.disabled || undefined}
              title={it.disabled ? 'Already selected as the other parent' : undefined}
              onClick={() => { if (!it.disabled) onPick(it.id); }}>
              <span className="inh-uma-tile-left">
                {/* Pedigree row: uma icon ──┤ stacked grandparents, rank badge alongside. */}
                <span className="inh-uma-ped">
                  <span className="inh-uma-tile-portrait">{it.portrait}</span>
                  {it.gpPortraits && it.gpPortraits.length > 0 && (
                    <span className="inh-uma-gp-stack" title="Grandparents">
                      {it.gpPortraits.map((node, i) => (
                        <span key={i} className="inh-uma-gp-item">{node}</span>
                      ))}
                    </span>
                  )}
                  <span className="inh-uma-rank-cell">
                    {it.rankBadge}
                    {it.rankScore !== undefined && (
                      <span className="inh-uma-rank-score" title="Rank score">{it.rankScore}</span>
                    )}
                  </span>
                </span>
                <span className="inh-uma-name-row">
                  <span className="inh-uma-tile-name">{it.name}</span>
                  <span className="inh-uma-jsonid muted small" title="Roster ID (json)">#{it.id}</span>
                </span>
                {it.statRow && <span className="inh-uma-stats">{it.statRow}</span>}
                <span className="inh-uma-aff-row">
                  <span className="muted small">Affinity</span>
                  <span className="inh-uma-aff" title="Affinity (incl. G1 win bonus)">{it.affinity ?? '—'}</span>
                </span>
              </span>
              <span className="inh-uma-tile-right">
                <LineageSparkChips parent={it.parent} skillName={skillName} isWishlisted={isWishlisted} />
              </span>
            </button>
          ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
  return createPortal(body, document.body);
}
