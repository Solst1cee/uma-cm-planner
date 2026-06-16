/**
 * M4 §1 — collapsible "Unique-skill chart". Ranks Global umas by their native
 * unique skill's bashin L on the selected track (best of 4 styles, fixed reference
 * runner — see rankUmaChart). Runs ONLY on the Run button. Each row's L is a
 * per-style dropdown: all 4 styles are pre-simulated, so picking a realistic style
 * (e.g. a front-runner unique mis-ranked as End) re-sorts instantly with no re-sim.
 * Reuses GameIcon + SkillDetailDisclosure (skill plate). Styles in uma-chart.css.
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

export interface UmaChartPanelDeps {
  loadUniqueByUmaId?: () => Promise<Map<string, SkillSummary>>;
  skillDelta?: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => BashinStats | Promise<BashinStats>;
  nsamples?: number;
}

const signed = (n: number): string => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;

/** The per-style entry a row is currently displayed/ranked by (user override, else best). */
function effectiveStyle(row: UmaChartRow, override: Map<string, Strategy>): UmaStyleL | null {
  if (row.perStyle.length === 0) return null;
  const want = override.get(row.outfitId) ?? row.bestStrategy;
  return row.perStyle.find((p) => p.strategy === want) ?? row.perStyle[0] ?? null;
}
function effectiveL(row: UmaChartRow, override: Map<string, Strategy>): number {
  return effectiveStyle(row, override)?.L ?? Number.MIN_SAFE_INTEGER; // na sorts last
}

function UmaRow({ row, umaName, unique, isRunner, override, onStyle, onSelect }: {
  row: UmaChartRow;
  umaName: string;
  unique: SkillSummary | null;
  isRunner: boolean;
  override: Map<string, Strategy>;
  onStyle: (outfitId: string, strategy: Strategy) => void;
  onSelect: (outfitId: string, uniqueSkillId: string) => void;
}) {
  const eff = effectiveStyle(row, override);
  const hover = row.perStyle
    .map((p) => `${STRATEGY_LABEL[p.strategy]}: mean ${signed(p.L)} (min ${p.min.toFixed(1)} / med ${p.median.toFixed(1)} / max ${p.max.toFixed(1)}) · ${p.nsamples} samples`)
    .join('\n');

  return (
    <li className={`cmp-uma-row ${row.status === 'live' ? '' : 'is-dim'}`.trim()}>
      <GameIcon kind="uma" id={row.outfitId} size={32} alt={umaName} className="cmp-uma-portrait" />
      {unique ? (
        <SkillDetailDisclosure skill={unique} showCost={false} className="cmp-uma-plate" />
      ) : (
        <span className="cmp-missing-skill cmp-uma-plate">No unique-skill data</span>
      )}
      {eff ? (
        <select
          className={`cmp-uma-style ${row.status === 'live' ? '' : 'is-dim'}`.trim()}
          aria-label={`Strategy and length for ${umaName}`}
          title={hover}
          value={eff.strategy}
          onChange={(e) => onStyle(row.outfitId, e.target.value as Strategy)}
        >
          {row.perStyle.map((p) => (
            <option key={p.strategy} value={p.strategy}>
              {signed(p.L)} · {STRATEGY_LABEL[p.strategy]}
            </option>
          ))}
        </select>
      ) : (
        <span className="cmp-uma-style cmp-uma-na" title="engine could not evaluate this unique on this track">n/a</span>
      )}
      <button
        type="button"
        className="cmp-small-btn cmp-uma-select"
        aria-pressed={isRunner}
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
  const visible = rows
    .filter((row) => {
      if (!showAll && row.status !== 'live') return false;
      if (q) {
        const uma = umaById?.get(row.outfitId);
        const unique = uniqueByUmaId?.get(row.outfitId);
        const hay = [uma?.nameEn, uma?.epithet, unique?.nameEn].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    // re-rank by each row's effective (possibly user-overridden) style L
    .sort((a, b) => effectiveL(b, styleOverride) - effectiveL(a, styleOverride));

  return (
    <details className="panel cmp-uma-chart" open>
      <summary className="cmp-uma-summary">
        <span className="cmp-uma-title">Unique-skill chart</span>
        <span className="cmp-uma-caret" aria-hidden="true" />
      </summary>

      <div className="cmp-uma-body">
        <div className="cmp-uma-runbar">
          <button type="button" className="cmp-run-btn" disabled={!ready || status === 'running'} onClick={run}>
            {status === 'idle' ? 'Run' : 'Re-run'}
          </button>
          {status === 'running' && <span className="muted small" role="status">ranking {done}/{total}</span>}
          {isStale && status !== 'running' && <span className="cmp-stale small">track changed — Run again</span>}
          {status !== 'idle' && (
            <div className="cmp-uma-filters">
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
          )}
        </div>

        {status === 'idle' ? (
          <p className="muted small">
            Run to rank umas by their unique skill&apos;s length on this track. Uses a fixed standard
            runner — independent of your build (a relative estimate, P3). Each row&apos;s L is a per-style
            dropdown; hover for min/median/max.
          </p>
        ) : (
          <ul className="cmp-uma-rows" aria-label="Uma unique-skill ranking">
            {visible.map((row) => (
              <UmaRow
                key={row.outfitId}
                row={row}
                umaName={umaById?.get(row.outfitId)?.nameEn ?? `Uma ${row.outfitId}`}
                unique={uniqueByUmaId?.get(row.outfitId) ?? null}
                isRunner={plan.umaId === row.outfitId}
                override={styleOverride}
                onStyle={onStyle}
                onSelect={onSelectRunner}
              />
            ))}
            {visible.length === 0 && (
              <li className="muted small">No umas to show{!showAll ? ' (try “show all”)' : ''}.</li>
            )}
          </ul>
        )}
      </div>
    </details>
  );
}
