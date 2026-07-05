// src/features/inheritance/UmaPickerModal.tsx
/** Full-screen parent picker: a spark-filter builder over the imported roster
 *  with rich tiles (sparks + affinity). Presentational + portal; the container
 *  passes already-aggregated items. */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Parent } from '@/core/types';
import type { SparkAgg } from './sparkAggregate';
import { matchesFilters, type SparkFilter } from './sparkFilter';
import { LineageSparkChips } from './LineageSparkChips';
import { SparkFilterCards, SPARK_NAMES, type SparkCat } from './SparkFilterCards';
import { SparkSummary, type SummaryChip } from './SparkSummary';
import { AffinityMark } from './AffinityMark';
import { useSparkFilterState } from './useSparkFilterState';

const STAT_ORDER = ['spd', 'sta', 'pow', 'gut', 'wit'];
const APT_ORDER = ['turf', 'dirt', 'sprint', 'mile', 'medium', 'long', 'front', 'pace', 'late', 'end'];

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
  /** Already chosen in a parent slot — greyed, not selectable, sorted last. */
  disabled?: boolean;
  /** Short tag on the tile ("Parent 1" / "Parent 2" / "Same as Parent 1"). */
  selectedLabel?: string;
  /** Full tooltip explaining why the tile is unavailable. */
  unavailableReason?: string;
}
export interface UmaPickerModalProps {
  open: boolean;
  items: UmaPickerItem[];
  skillName: (id: string) => string;
  /** True when a spark's skill id is on the plan's wishlist → blue glow on the tile. */
  isWishlisted?: (skillId: string) => boolean;
  /** Selectable white skills for the white (SKILL) spark search. */
  whiteSkillOptions?: Array<{ id: string; name: string }>;
  /** Selectable unique skills for the green-spark search. */
  uniqueSkillOptions?: Array<{ id: string; name: string }>;
  /** Optional green skill icon node (container-wired GameIcon). */
  greenIcon?: (skillId: string) => ReactNode;
  /** Optional white skill icon node (container-wired GameIcon). */
  whiteIcon?: (skillId: string) => ReactNode;
  /** Optional container-wired upload-data control, pinned to the summary bar's right. */
  uploadButton?: ReactNode;
  onPick: (id: string) => void;
  onClose: () => void;
}

export function UmaPickerModal({ open, items, skillName, isWishlisted, uniqueSkillOptions = [], whiteSkillOptions = [], greenIcon, whiteIcon, uploadButton, onPick, onClose }: UmaPickerModalProps) {
  const [filters, setFilters] = useState<SparkFilter[]>([]);
  const [query, setQuery] = useState('');

  const sf = useSparkFilterState(filters, setFilters);
  const { sparkValue, setSpark, sparkMaxTotal, legacyLocked: sparkLegacyLocked, membersUsed } = sf;

  // --- name-resolution + option lists stay page-wired (the hook returns raw clauses) ---
  const activeGreen = sf.activeGreen.map((c) => ({ key: c.skillId, name: skillName(c.skillId) }));
  const greenOptions = uniqueSkillOptions.filter((o) => !sf.activeGreen.some((c) => c.skillId === o.id));
  const activeWhite = sf.activeWhite.map((c) => ({ key: c.skillId, name: skillName(c.skillId) }));
  const whiteOptions = whiteSkillOptions.filter((o) => !sf.activeWhite.some((c) => c.skillId === o.id));

  // summary chips (canonical order) + spark-only match count
  const optionIndex = (opts: Array<{ id: string }>): Map<string, number> => {
    const m = new Map<string, number>();
    opts.forEach((o, i) => { if (!m.has(o.id)) m.set(o.id, i); });
    return m;
  };
  const greenOptionRank = useMemo(() => optionIndex(uniqueSkillOptions), [uniqueSkillOptions]);
  const whiteOptionRank = useMemo(() => optionIndex(whiteSkillOptions), [whiteSkillOptions]);
  const chipRank = (f: SparkFilter): number => {
    if (f.kind === 'blue') return STAT_ORDER.indexOf(f.stat);
    if (f.kind === 'pink') return 100 + APT_ORDER.indexOf(f.aptitude);
    if (f.kind === 'green') return 200 + (greenOptionRank.get(f.skillId) ?? 99);
    if (f.kind === 'white') return 300 + (whiteOptionRank.get(f.skillId) ?? 99);
    return 999;
  };
  const summaryChips: SummaryChip[] = filters
    .filter((f): f is Extract<SparkFilter, { kind: 'blue' | 'pink' | 'green' | 'white' }> =>
      (f.kind === 'blue' || f.kind === 'pink' || f.kind === 'green' || f.kind === 'white') && (f.legacyMin > 0 || f.totalMin > 0))
    .map((f) => ({ f, rank: chipRank(f) }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ f }) => {
      const cat = f.kind as SparkCat;
      const key = f.kind === 'blue' ? f.stat : f.kind === 'pink' ? f.aptitude : f.skillId;
      const name = (f.kind === 'green' || f.kind === 'white') ? skillName(f.skillId) : (SPARK_NAMES[key] ?? key);
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
          <button type="button" className="cmp-inventory-icon-btn inh-clear inh-uma-modal-x" aria-label="Close" title="Close" onClick={onClose}>
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m5.3 3.9 4.7 4.7 4.7-4.7 1.4 1.4-4.7 4.7 4.7 4.7-1.4 1.4-4.7-4.7-4.7 4.7-1.4-1.4L8.6 10 3.9 5.3l1.4-1.4Z" /></svg>
          </button>
        </header>
        <div className="inh-uma-split">
          <div className="inh-uma-filter-col">
            <SparkSummary matchCount={sparkMatchCount} total={items.length} chips={summaryChips} onReset={() => setFilters([])} uploadButton={uploadButton} />
            <SparkFilterCards
              value={sparkValue}
              onSet={setSpark}
              maxTotal={sparkMaxTotal}
              legacyLocked={sparkLegacyLocked}
              membersUsed={membersUsed}
              activeGreen={activeGreen}
              greenOptions={greenOptions}
              greenIcon={greenIcon}
              activeWhite={activeWhite}
              whiteOptions={whiteOptions}
              whiteIcon={whiteIcon}
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
              title={it.unavailableReason}
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
                  {it.selectedLabel && <span className="inh-uma-selected-tag">{it.selectedLabel}</span>}
                </span>
                {it.statRow && <span className="inh-uma-stats">{it.statRow}</span>}
                <span className="inh-uma-aff-row">
                  <span className="muted small">Affinity</span>
                  <span className="inh-uma-aff" title="Affinity (incl. G1 win bonus)">{it.affinity ?? '—'}</span>
                  {it.affinity != null && <AffinityMark score={it.affinity} />}
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
