/**
 * M4 §1 — "Pick runner — Unique-skill chart". Ranks Global umas by their native
 * unique skill's bashin L on the selected track (best of 4 styles, fixed reference
 * runner — see rankUmaChart). Runs ONLY on the Run button. Reuses the sidebar's
 * GameIcon + SkillDetailDisclosure (skill plate). Styles live in uma-chart.css
 * (kept separate from cm-planner.css).
 */
import './uma-chart.css';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CmPlan } from '@/core/types';
import type { BashinStats, SimBuild, SimRaceParams, Strategy } from '@/sim';
import type { UmaChartRow, UmaChartCandidate } from '@/core/rankUmaChart';
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

function lDisplay(row: UmaChartRow): string {
  if (row.status === 'na') return 'n/a';
  // 'zero' = best L <= DEAD_L; surface a net-negative honestly rather than as "0 L" (P3).
  if (row.status === 'zero') return row.L != null && row.L < 0 ? `${row.L.toFixed(2)} L` : '0 L';
  return `+${(row.L ?? 0).toFixed(2)}`;
}

function UmaRow({ row, uma, unique, isRunner, onSelect }: {
  row: UmaChartRow;
  uma: { nameEn: string; epithet?: string } | undefined;
  unique: SkillSummary | null;
  isRunner: boolean;
  onSelect: (outfitId: string, uniqueSkillId: string) => void;
}) {
  const lChip: ReactNode = (
    <span className={`L sm ${row.status !== 'live' ? 'mut' : ''}`.trim()}>
      {lDisplay(row)}
      {row.status === 'live' && row.bestStrategy && <span className="mut"> · {STRATEGY_LABEL[row.bestStrategy]}</span>}
    </span>
  );
  return (
    <li className={`cmp-uma-row ${row.status === 'live' ? '' : 'is-dim'}`.trim()}>
      <GameIcon kind="uma" id={row.outfitId} size={40} alt="" />
      <div className="cmp-uma-row-main">
        <div className="cmp-uma-row-head">
          <strong>{uma?.nameEn ?? `Uma ${row.outfitId}`}</strong>
          {uma?.epithet && <span className="muted small">{uma.epithet}</span>}
        </div>
        {unique ? (
          <SkillDetailDisclosure skill={unique} showCost={false} side={lChip} />
        ) : (
          <span className="cmp-missing-skill">No unique-skill data</span>
        )}
        {row.perStyle.length > 0 && (
          <div className="cmp-uma-perstyle" aria-label="Per-style length">
            {row.perStyle.map((p) => (
              <span key={p.strategy} className={`cmp-chip ${p.strategy === row.bestStrategy ? 'on' : ''}`.trim()}>
                {STRATEGY_LABEL[p.strategy]} {p.L.toFixed(2)}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        className="cmp-small-btn"
        aria-pressed={isRunner}
        disabled={!row.uniqueSkillId}
        onClick={() => row.uniqueSkillId && onSelect(row.outfitId, row.uniqueSkillId)}
      >
        {isRunner ? '✓ runner' : 'Select'}
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

  const ready = uniqueByUmaId != null;
  const q = query.trim().toLowerCase();
  const visible = rows.filter((row) => {
    if (!showAll && row.status !== 'live') return false;
    if (q) {
      const uma = umaById?.get(row.outfitId);
      const unique = uniqueByUmaId?.get(row.outfitId);
      const hay = [uma?.nameEn, uma?.epithet, unique?.nameEn].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <section className="panel cmp-uma-chart" aria-labelledby="uma-chart-h">
      <div className="cmp-uma-runbar">
        <h2 id="uma-chart-h">Pick runner — Unique-skill chart</h2>
        <button type="button" className="cmp-run-btn" disabled={!ready || status === 'running'} onClick={run}>
          {status === 'idle' ? 'Run' : 'Re-run'}
        </button>
        {status === 'running' && <span className="muted small" role="status">ranking {done}/{total}</span>}
        {isStale && status !== 'running' && <span className="cmp-stale small">track changed — Run again</span>}
      </div>

      {status === 'idle' ? (
        <p className="muted small">
          Run to rank umas by their unique skill&apos;s length on this track. Uses a fixed standard
          runner — independent of your build (a relative estimate, P3).
        </p>
      ) : (
        <>
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
          <ul className="cmp-uma-rows" aria-label="Uma unique-skill ranking">
            {visible.map((row) => (
              <UmaRow
                key={row.outfitId}
                row={row}
                uma={umaById?.get(row.outfitId)}
                unique={uniqueByUmaId?.get(row.outfitId) ?? null}
                isRunner={plan.umaId === row.outfitId}
                onSelect={onSelectRunner}
              />
            ))}
            {visible.length === 0 && (
              <li className="muted small">No umas to show{!showAll ? ' (try “show all”)' : ''}.</li>
            )}
          </ul>
        </>
      )}
    </section>
  );
}
