/**
 * M4 §1 — collapsible "Skill chart" (VFalator-style table). Ranks acquirable
 * skills (white/gold/inherited) by marginal bashin L on the user's plan build
 * (planToSimBuild), with SP cost + efficiency (L per 100 SP). Runs ONLY on Run.
 * Variant families collapse to one row (strongest variant); + target adds via the
 * family-aware addOrReplaceWishlistSkill and stamps projectedL so the sidebar's L
 * total moves. Reuses GameIcon + SkillDetailDisclosure (effect-chips on expand).
 */
import './skill-chart.css';
import { useMemo, useState } from 'react';
import type { CmPlan, SkillRecord } from '@/core/types';
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';
import type { SkillChartRow } from '@/core/rankSkillChart';
import { acquirableSkills } from '@/core/skillCatalog';
import { effectiveSpCost } from '@/core/cost';
import { planToSimBuild } from '@/core/simBuild';
import {
  addOrReplaceWishlistSkill,
  areSkillVariants,
  familyRepresentatives,
  wishlistSkillId,
  wishlistSkillRecord,
} from '@/features/skill-planner/skillFamilies';
import { useGameData } from '@/features/data/gameData';
import { SkillDetailDisclosure } from './SkillDetailDisclosure';
import { skillRecordToSummary } from './skillTechnicalDetails';
import { useSkillRank } from './useSkillRank';

type SkillFilter = 'all' | 'non-unique' | 'inherited' | 'white' | 'gold';
const FILTERS: ReadonlyArray<{ key: SkillFilter; label: string }> = [
  { key: 'all', label: 'all' },
  { key: 'non-unique', label: 'non-unique' },
  { key: 'inherited', label: 'inherited unique' },
  { key: 'white', label: 'white' },
  { key: 'gold', label: 'gold' },
];
function matchesFilter(rarity: SkillRecord['rarity'], f: SkillFilter): boolean {
  switch (f) {
    case 'all': return true;
    case 'non-unique': return rarity === 'white' || rarity === 'gold';
    case 'inherited': return rarity === 'inherited_unique';
    default: return rarity === f; // 'white' | 'gold'
  }
}
type SortMetric = 'L' | 'sp' | 'eff';
const COLUMNS: ReadonlyArray<{ key: SortMetric; label: string }> = [
  { key: 'L', label: 'L' },
  { key: 'sp', label: 'SP' },
  { key: 'eff', label: 'L/100SP' },
];

export interface SkillChartPanelDeps {
  skillDelta?: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => BashinStats | Promise<BashinStats>;
  nsamples?: number;
}

interface RowView {
  row: SkillChartRow;
  skill: SkillRecord;
  sp: number | null;
  eff: number | null;
  targeted: boolean;
}

// L and efficiency rank best-first (desc); SP ranks cheapest-first (asc) by default.
// Clicking the active column again inverts the direction. null/na metrics always sort last.
const DEFAULT_DIR: Record<SortMetric, 'asc' | 'desc'> = { L: 'desc', sp: 'asc', eff: 'desc' };
const rawMetric = (v: RowView, m: SortMetric): number | null =>
  m === 'L' ? v.row.L : m === 'sp' ? v.sp : v.eff;
const signed = (n: number): string => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;

export function SkillChartPanel({ courseId, plan, onChange, collapseSkillSignal, deps }: {
  courseId: string;
  plan: CmPlan;
  onChange: (next: CmPlan) => void;
  collapseSkillSignal?: number;
  deps?: SkillChartPanelDeps;
}) {
  const { skills, skillById, sparkRates } = useGameData();
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SkillFilter>('all');
  const [showAll, setShowAll] = useState(false);
  const [sortMetric, setSortMetric] = useState<SortMetric>('L');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const hasSpeed = plan.statProfile.stats.spd > 0;
  // One representative per (family × rarity): cosmetic tiers (○/◎/×) collapse within a
  // rarity, but white / gold / inherited stay distinct rows so the rarity filters work.
  const reps = useMemo(() => {
    const catalog = acquirableSkills(skills ?? [], plan.server);
    return (['white', 'gold', 'inherited_unique'] as const).flatMap((r) =>
      familyRepresentatives(catalog.filter((s) => s.rarity === r), skillById),
    );
  }, [skills, skillById, plan.server]);
  const ids = useMemo(() => (hasSpeed ? reps.map((s) => s.skillId) : []), [reps, hasSpeed]);
  const build = useMemo(() => planToSimBuild(plan), [plan]);
  const race = useMemo<SimRaceParams>(() => ({ courseId }), [courseId]);

  const chartDeps = deps?.skillDelta ? { skillDelta: deps.skillDelta, nsamples: deps.nsamples } : undefined;
  const { rows, status, done, total, isStale, run, stop } = useSkillRank(build, race, ids, chartDeps);

  const targetSkill = (rep: SkillRecord, L: number | null) => {
    const wl = addOrReplaceWishlistSkill(plan.wishlist, rep.skillId, skillById);
    const resolvedId = wishlistSkillId(rep.skillId, skillById);
    const patch = L != null ? { projectedL: L, projectedLStale: false } : {};
    onChange({ ...plan, wishlist: wl.map((it) => (it.skillId === resolvedId ? { ...it, ...patch } : it)) });
  };

  const isTargeted = (rep: SkillRecord): boolean =>
    plan.wishlist.some((it) => {
      const rec = wishlistSkillRecord(it.skillId, skillById);
      return rec ? areSkillVariants(rec, rep) : it.skillId === rep.skillId;
    });

  const onSortClick = (m: SortMetric) => {
    if (m === sortMetric) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortMetric(m); setSortDir(DEFAULT_DIR[m]); }
  };

  const q = query.trim().toLowerCase();
  const views: RowView[] = rows
    .map((row): RowView | null => {
      const skill = skillById.get(row.skillId);
      if (!skill) return null;
      const sp = sparkRates ? effectiveSpCost(skill, 0, sparkRates) : null;
      const eff = row.L != null && sp != null && sp > 0 ? (100 * row.L) / sp : null;
      return { row, skill, sp, eff, targeted: isTargeted(skill) };
    })
    .filter((v): v is RowView => v !== null)
    .filter((v) => {
      if (!showAll && v.row.status === 'inactive') return false; // hide only never-proc skills
      if (!matchesFilter(v.skill.rarity, filter)) return false;
      if (q && !v.skill.nameEn.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => {
      const av = rawMetric(a, sortMetric);
      const bv = rawMetric(b, sortMetric);
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls (na / no-SP) always sort last
      if (bv == null) return -1;
      return sortDir === 'desc' ? bv - av : av - bv;
    });

  return (
    <section className="cmp-plan-card cmp-skill-chart">
      <header
        className="cmp-plan-card-head cmp-collapse-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); }
        }}
      >
        <span className="cmp-skill-chart-title">Skill chart</span>
        <button
          type="button"
          className="cmp-run-btn"
          disabled={!hasSpeed}
          aria-label={status === 'running' ? 'Stop ranking' : status === 'idle' ? 'Run' : 'Re-run'}
          onClick={(e) => { e.stopPropagation(); if (status === 'running') stop(); else run(); }}
        >
          {status === 'running' ? '■' : status === 'idle' ? 'Run' : 'Re-run'}
        </button>
        {status === 'running' && <span className="muted small cmp-uma-progress" role="status">ranking {done}/{total}</span>}
        {status === 'done' && !isStale && (
          <span className="muted small cmp-uma-progress" role="status">
            {done >= total ? 'Done' : `${done}/${total} skills ran`}
          </span>
        )}
        {isStale && status !== 'running' && <span className="cmp-stale small">Changed detected!, please re-run</span>}
        <span className="cmp-collapse-caret" data-open={open || undefined} aria-hidden="true" />
      </header>

      {open && (
        <div className="cmp-skill-body">
          {!hasSpeed ? (
            <p className="muted small">Enter your runner&apos;s stats (Speed is required) in the sidebar to rank skills.</p>
          ) : (
            <>
              <p className="cmp-skill-caption muted small">
                Run to rank acquirable skills by length on your current uma plan. Editing the plan won&apos;t
                update the chart until you Re-run.
              </p>
              {status !== 'idle' && (
                <>
                  <div className="cmp-uma-toolbar">
                    <input
                      className="search"
                      type="search"
                      placeholder="search skill…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      aria-label="Search skills"
                    />
                    {FILTERS.map((f) => (
                      <button key={f.key} type="button" className="chip" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                        {f.label}
                      </button>
                    ))}
                    <label
                      className="cmp-showall small"
                      title="Skills whose conditions can never trigger on this track (they never proc). Recovery and other 0-length skills that DO proc stay visible."
                    >
                      <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> show not-activatable
                    </label>
                  </div>

                  <div className="cmp-skill-table">
                    <div className="cmp-skill-thead" role="row">
                      <span>Skill</span>
                      {COLUMNS.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          className={`cmp-uma-sort ${sortMetric === c.key ? 'is-sort' : ''}`.trim()}
                          onClick={() => onSortClick(c.key)}
                          title={`Sort by ${c.label.toLowerCase()}`}
                        >
                          {c.label}
                          {sortMetric === c.key && (
                            <span aria-hidden="true"> {sortDir === 'desc' ? '▼' : '▲'}</span>
                          )}
                        </button>
                      ))}
                      <span />
                    </div>

                    <div className="cmp-skill-scroll">
                <ul className="cmp-skill-rows" aria-label="Acquirable skill ranking">
                  {views.map((v) => (
                    <li key={v.skill.skillId} className={`cmp-skill-row ${v.row.status === 'inactive' ? 'is-dim' : ''}`.trim()}>
                      <SkillDetailDisclosure
                        skill={skillRecordToSummary(v.skill)}
                        collapseSignal={collapseSkillSignal}
                        showCost={false}
                        className="cmp-uma-plate"
                        technicalHeaderSide={
                          v.row.L != null
                            ? <span className="muted small">L +{v.row.L.toFixed(2)} · min {(v.row.min ?? 0).toFixed(2)} · max {(v.row.max ?? 0).toFixed(2)} · med {(v.row.median ?? 0).toFixed(2)} · n={v.row.nsamples}</span>
                            : undefined
                        }
                      />
                      <span className={`cmp-uma-num ${sortMetric === 'L' ? 'is-sort' : ''}`.trim()}>
                        {v.row.status === 'na' ? 'n/a' : v.row.status === 'inactive' ? '—' : signed(v.row.L ?? 0)}
                      </span>
                      <span className={`cmp-uma-num ${sortMetric === 'sp' ? 'is-sort' : ''}`.trim()}>
                        {v.sp ?? '—'}
                      </span>
                      <span className={`cmp-uma-num ${sortMetric === 'eff' ? 'is-sort' : ''}`.trim()}>
                        {v.eff != null ? v.eff.toFixed(2) : '—'}
                      </span>
                      <button
                        type="button"
                        className="cmp-small-btn cmp-uma-select"
                        aria-pressed={v.targeted}
                        aria-label={v.targeted ? `${v.skill.nameEn} targeted` : `Add ${v.skill.nameEn} to target`}
                        onClick={() => targetSkill(v.skill, v.row.L)}
                      >
                        {v.targeted ? '✓' : '+'}
                      </button>
                    </li>
                  ))}
                  {views.length === 0 && (
                    <li className="muted small">No skills to show{!showAll ? ' (try "show not-activatable")' : ''}.</li>
                  )}
                </ul>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
