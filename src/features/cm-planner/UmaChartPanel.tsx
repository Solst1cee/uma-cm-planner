/**
 * M4 §1 — collapsible "Unique-skill chart" (VFalator-style table). Ranks Global
 * umas by their native unique skill's bashin L on the selected track (best of 4
 * styles, fixed reference runner — see rankUmaChart). Runs ONLY on the Run button.
 * All 4 styles are pre-simulated, so the per-row Style dropdown re-ranks instantly
 * with no re-sim. Columns show mean/min/max/median (engine distribution); click a
 * column header to sort by it. Reuses GameIcon + SkillDetailDisclosure (skill plate).
 */
import './uma-chart.css';
import { useEffect, useMemo, useState } from 'react';
import type { CmPlan } from '@/core/types';
import type { BashinStats, SimBuild, SimRaceParams, Strategy } from '@/sim';
import type { UmaChartRow, UmaChartCandidate, UmaStyleL } from '@/core/rankUmaChart';
import { useGameData } from '@/features/data/gameData';
import { GameIcon } from '@/features/data/GameIcon';
import { SkillDetailDisclosure } from './SkillDetailDisclosure';
import { loadUniqueSkillByUmaId, type SkillSummary } from './skillTechnicalDetails';
import { useUmaChart } from './useUmaChart';

const STRATEGY_LABEL: Record<Strategy, string> = { front: 'Front', pace: 'Pace', late: 'Late', end: 'End' };

type SortMetric = 'mean' | 'min' | 'max' | 'median';
const METRIC_COLUMNS: ReadonlyArray<{ key: SortMetric; label: string }> = [
  { key: 'min', label: 'Min' },
  { key: 'max', label: 'Max' },
  { key: 'mean', label: 'Mean' },
  { key: 'median', label: 'Median' },
];
const metricOf = (p: UmaStyleL, m: SortMetric): number => (m === 'mean' ? p.L : p[m]);
const signed = (n: number): string => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;

export interface UmaChartPanelDeps {
  loadUniqueByUmaId?: () => Promise<Map<string, SkillSummary>>;
  skillDelta?: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => BashinStats | Promise<BashinStats>;
  nsamples?: number;
}

/** The per-style entry a row is displayed/ranked by (user override, else best-by-mean). */
function effStyle(row: UmaChartRow, override: Map<string, Strategy>): UmaStyleL | null {
  if (row.perStyle.length === 0) return null;
  const want = override.get(row.outfitId) ?? row.bestStrategy;
  return row.perStyle.find((p) => p.strategy === want) ?? row.perStyle[0] ?? null;
}

function UmaRow({ row, eff, umaName, unique, isRunner, sortMetric, onStyle, onSelect }: {
  row: UmaChartRow;
  eff: UmaStyleL | null;
  umaName: string;
  unique: SkillSummary | null;
  isRunner: boolean;
  sortMetric: SortMetric;
  onStyle: (outfitId: string, strategy: Strategy) => void;
  onSelect: (outfitId: string, uniqueSkillId: string) => void;
}) {
  const hover = row.perStyle.length
    ? row.perStyle
        .map((p) => `${STRATEGY_LABEL[p.strategy]} — mean ${signed(p.L)} · min ${p.min.toFixed(2)} · max ${p.max.toFixed(2)} · med ${p.median.toFixed(2)}`)
        .join('\n')
    : 'No simulatable unique on this track';
  return (
    <li className={`cmp-uma-row ${row.status === 'live' ? '' : 'is-dim'}`.trim()} title={hover}>
      <GameIcon kind="uma" id={row.outfitId} size={30} alt={umaName} className="cmp-uma-portrait" />
      {unique ? (
        <SkillDetailDisclosure skill={unique} showCost={false} className="cmp-uma-plate" />
      ) : (
        <span className="cmp-missing-skill cmp-uma-plate">No unique-skill data</span>
      )}
      {eff ? (
        <select
          className={`cmp-uma-style ${row.status === 'live' ? '' : 'is-dim'}`.trim()}
          aria-label={`Running style for ${umaName}`}
          value={eff.strategy}
          onChange={(e) => onStyle(row.outfitId, e.target.value as Strategy)}
        >
          {row.perStyle.map((p) => (
            <option key={p.strategy} value={p.strategy}>
              {STRATEGY_LABEL[p.strategy]} {signed(p.L)}
            </option>
          ))}
        </select>
      ) : (
        <span className="cmp-uma-style cmp-uma-na">n/a</span>
      )}
      {METRIC_COLUMNS.map((m) => (
        <span key={m.key} className={`cmp-uma-num ${sortMetric === m.key ? 'is-sort' : ''}`.trim()}>
          {eff ? metricOf(eff, m.key).toFixed(2) : '—'}
        </span>
      ))}
      <button
        type="button"
        className="cmp-small-btn cmp-uma-select"
        aria-pressed={isRunner}
        aria-label={isRunner ? `${umaName} selected as runner` : `Select ${umaName} as runner`}
        disabled={!row.uniqueSkillId}
        onClick={() => row.uniqueSkillId && onSelect(row.outfitId, row.uniqueSkillId)}
      >
        {isRunner ? '✓' : 'Select'}
      </button>
    </li>
  );
}

export function UmaChartPanel({ courseId, plan, onSelectRunner, deps }: {
  courseId: string;
  plan: CmPlan;
  onSelectRunner: (outfitId: string, uniqueSkillId: string) => void;
  deps?: UmaChartPanelDeps;
}) {
  const { umas, umaById } = useGameData();
  const [uniqueByUmaId, setUniqueByUmaId] = useState<Map<string, SkillSummary> | null>(null);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState(true);
  const [sortMetric, setSortMetric] = useState<SortMetric>('mean');
  const [styleOverride, setStyleOverride] = useState<Map<string, Strategy>>(new Map());

  // Memoize so an inline-arrow deps.loadUniqueByUmaId can't make the load effect re-fetch every render.
  const loadUnique = useMemo(() => deps?.loadUniqueByUmaId ?? loadUniqueSkillByUmaId, [deps?.loadUniqueByUmaId]);
  useEffect(() => {
    let cancelled = false;
    loadUnique()
      .then((m) => { if (!cancelled) setUniqueByUmaId(m); })
      .catch(() => { if (!cancelled) setUniqueByUmaId(new Map()); });
    return () => { cancelled = true; };
  }, [loadUnique]);

  const globalUmas = useMemo(() => (umas ?? []).filter((u) => u.server === plan.server), [umas, plan.server]);
  const candidates: UmaChartCandidate[] = useMemo(
    () => globalUmas.map((u) => ({ outfitId: u.umaId, uniqueSkillId: uniqueByUmaId?.get(u.umaId)?.skillId ?? null })),
    [globalUmas, uniqueByUmaId],
  );
  const race = useMemo<SimRaceParams>(() => ({ courseId }), [courseId]);
  const chartDeps = deps?.skillDelta ? { skillDelta: deps.skillDelta, nsamples: deps.nsamples } : undefined;
  const { rows, status, done, total, isStale, run } = useUmaChart(candidates, race, chartDeps);

  const onStyle = (outfitId: string, strategy: Strategy) =>
    setStyleOverride((prev) => new Map(prev).set(outfitId, strategy));

  const ready = uniqueByUmaId != null;
  const q = query.trim().toLowerCase();
  const sortKey = (eff: UmaStyleL | null): number => (eff ? metricOf(eff, sortMetric) : Number.MIN_SAFE_INTEGER);
  const visible = rows
    .map((row) => ({ row, eff: effStyle(row, styleOverride) }))
    .filter(({ row }) => {
      if (!showAll && row.status !== 'live') return false;
      if (q) {
        const uma = umaById?.get(row.outfitId);
        const unique = uniqueByUmaId?.get(row.outfitId);
        const hay = [uma?.nameEn, uma?.epithet, unique?.nameEn].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => sortKey(b.eff) - sortKey(a.eff)); // re-rank by each row's effective style + chosen metric

  return (
    <section className="panel cmp-uma-chart">
      <div className="cmp-uma-head">
        <span className="cmp-uma-title">Unique-skill chart</span>
        <button
          type="button"
          className="cmp-run-btn"
          disabled={!ready || status === 'running'}
          onClick={run}
        >
          {status === 'idle' ? 'Run' : 'Re-run'}
        </button>
        {status === 'running' && <span className="muted small cmp-uma-progress" role="status">ranking {done}/{total}</span>}
        {isStale && status !== 'running' && <span className="cmp-stale small">re-run</span>}
        <button
          type="button"
          className="cmp-uma-toggle"
          aria-expanded={open}
          aria-label={open ? 'Collapse chart' : 'Expand chart'}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="cmp-uma-caret" data-open={open || undefined} aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="cmp-uma-body">
          {status === 'idle' ? (
            <p className="muted small">
              Run to rank umas by their unique skill&apos;s length on this track. Uses a fixed standard
              runner — independent of your build (a relative estimate, P3). Switch each row&apos;s style;
              sort by mean / min / max / median.
            </p>
          ) : (
            <>
              <div className="cmp-uma-toolbar">
                <input
                  className="search"
                  type="search"
                  placeholder="search uma / unique…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search uma"
                />
                <label className="cmp-showall small">
                  <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> show all
                </label>
              </div>

              <div className="cmp-uma-table">
                <div className="cmp-uma-thead" aria-hidden="true">
                <span />
                <span>Skill</span>
                <span>Style</span>
                {METRIC_COLUMNS.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    className={`cmp-uma-sort ${sortMetric === m.key ? 'is-sort' : ''}`.trim()}
                    onClick={() => setSortMetric(m.key)}
                    title={`Sort by ${m.label.toLowerCase()}`}
                  >
                    {m.label}
                  </button>
                ))}
                <span />
              </div>

              <ul className="cmp-uma-rows" aria-label="Uma unique-skill ranking">
                {visible.map(({ row, eff }) => (
                  <UmaRow
                    key={row.outfitId}
                    row={row}
                    eff={eff}
                    umaName={umaById?.get(row.outfitId)?.nameEn ?? `Uma ${row.outfitId}`}
                    unique={uniqueByUmaId?.get(row.outfitId) ?? null}
                    isRunner={plan.umaId === row.outfitId}
                    sortMetric={sortMetric}
                    onStyle={onStyle}
                    onSelect={onSelectRunner}
                  />
                ))}
                {visible.length === 0 && (
                  <li className="muted small">No umas to show{!showAll ? ' (try “show all”)' : ''}.</li>
                )}
              </ul>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
