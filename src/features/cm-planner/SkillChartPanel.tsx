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

type RarityFilter = 'all' | 'white' | 'gold';
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

// L and efficiency sort descending (best first); SP sorts ascending (cheapest first)
// via negation. null/na metrics sort last either way (finite sentinel = NaN-safe).
function metricOf(v: RowView, m: SortMetric): number {
  if (m === 'L') return v.row.L ?? Number.MIN_SAFE_INTEGER;
  if (m === 'sp') return -(v.sp ?? Number.MAX_SAFE_INTEGER);
  return v.eff ?? Number.MIN_SAFE_INTEGER;
}

export function SkillChartPanel({ courseId, plan, onChange, deps }: {
  courseId: string;
  plan: CmPlan;
  onChange: (next: CmPlan) => void;
  deps?: SkillChartPanelDeps;
}) {
  const { skills, skillById, sparkRates } = useGameData();
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [rarity, setRarity] = useState<RarityFilter>('all');
  const [showAll, setShowAll] = useState(false);
  const [sortMetric, setSortMetric] = useState<SortMetric>('L');

  const hasSpeed = plan.statProfile.stats.spd > 0;
  const reps = useMemo(
    () => familyRepresentatives(acquirableSkills(skills ?? [], plan.server), skillById),
    [skills, skillById, plan.server],
  );
  const ids = useMemo(() => (hasSpeed ? reps.map((s) => s.skillId) : []), [reps, hasSpeed]);
  const build = useMemo(() => planToSimBuild(plan), [plan]);
  const race = useMemo<SimRaceParams>(() => ({ courseId }), [courseId]);

  const chartDeps = deps?.skillDelta ? { skillDelta: deps.skillDelta, nsamples: deps.nsamples } : undefined;
  const { rows, status, done, total, isStale, run } = useSkillRank(build, race, ids, chartDeps);

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
      if (!showAll && v.row.status !== 'live') return false;
      if (rarity !== 'all' && v.skill.rarity !== rarity) return false;
      if (q && !v.skill.nameEn.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => metricOf(b, sortMetric) - metricOf(a, sortMetric));

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
          disabled={!hasSpeed || status === 'running'}
          onClick={(e) => { e.stopPropagation(); run(); }}
        >
          {status === 'idle' ? 'Run' : 'Re-run'}
        </button>
        {status === 'running' && <span className="muted small cmp-uma-progress" role="status">ranking {done}/{total}</span>}
        {isStale && status !== 'running' && <span className="cmp-stale small">re-run</span>}
        <span className="cmp-collapse-caret" data-open={open || undefined} aria-hidden="true" />
      </header>

      {open && (
        <div className="cmp-skill-body">
          {!hasSpeed ? (
            <p className="muted small">Enter your runner&apos;s stats (Speed is required) in the sidebar to rank skills.</p>
          ) : status === 'idle' ? (
            <p className="muted small">
              Run to rank acquirable skills by length on your build (a simulated estimate, P3). Sort by L / SP /
              efficiency; expand a skill for its effects and conditions.
            </p>
          ) : (
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
                {(['all', 'white', 'gold'] as const).map((r) => (
                  <button key={r} type="button" className="chip" aria-pressed={rarity === r} onClick={() => setRarity(r)}>
                    {r}
                  </button>
                ))}
                <label className="cmp-showall small">
                  <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> show all
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
                      onClick={() => setSortMetric(c.key)}
                      title={`Sort by ${c.label.toLowerCase()}`}
                    >
                      {c.label}
                    </button>
                  ))}
                  <span />
                </div>

                <ul className="cmp-skill-rows" aria-label="Acquirable skill ranking">
                  {views.map((v) => (
                    <li key={v.skill.skillId} className={`cmp-skill-row ${v.row.status === 'live' ? '' : 'is-dim'}`.trim()}>
                      <SkillDetailDisclosure
                        skill={skillRecordToSummary(v.skill)}
                        showCost={false}
                        className="cmp-uma-plate"
                        technicalHeaderSide={
                          v.row.L != null
                            ? <span className="muted small">L +{v.row.L.toFixed(2)} · min {(v.row.min ?? 0).toFixed(2)} · max {(v.row.max ?? 0).toFixed(2)} · med {(v.row.median ?? 0).toFixed(2)} · n={v.row.nsamples}</span>
                            : undefined
                        }
                      />
                      <span className={`cmp-uma-num ${sortMetric === 'L' ? 'is-sort' : ''}`.trim()}>
                        {v.row.status === 'na' ? 'n/a' : `+${(v.row.L ?? 0).toFixed(2)}`}
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
                    <li className="muted small">No skills to show{!showAll ? ' (try "show all")' : ''}.</li>
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
