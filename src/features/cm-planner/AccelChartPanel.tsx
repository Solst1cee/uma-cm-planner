/**
 * M4 §1 — collapsible "Accel skill chart". Ranks acceleration skills only
 * (acquirable skills whose effect type is 31 = acceleration), filtered from the
 * full acquirable set by async-loaded `accelIds`. Extends the SkillChartPanel
 * table with three extra columns: Effect (the accel boost value, sortable),
 * Position (human-readable positioning requirement from conditions), and Wit
 * (wit-check pass chance, or ✗ if not wit-gated).
 *
 * Built by copying SkillChartPanel.tsx and applying the C3 deltas — the shared
 * ranking logic stays in useSkillRank/rankSkillChart; only the presentational
 * scaffolding is duplicated (owner-approved blast-radius limit).
 */
import './skill-chart.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CmPlan, SkillRecord, TimelineEntry } from '@/core/types';
import type { SimRaceParams } from '@/sim';
import type { SkillChartRow } from '@/core/rankSkillChart';
import { isReleasedBy } from '@/core/availability';
import { nullsLast } from '@/core/compare';
import { acquirableSkills } from '@/core/skillCatalog';
import { purchaseSpCost } from '@/core/cost';
import { chartBaselineBuild } from '@/core/simBuild';
import {
  addOrReplaceWishlistSkill,
  areSkillVariants,
  familyRepresentatives,
  wishlistSkillId,
  wishlistSkillRecord,
} from '@/features/skill-planner/skillFamilies';
import { useGameData } from '@/features/data/gameData';
import { SkillDetailDisclosure } from './SkillDetailDisclosure';
import { HeaderHelp } from './HeaderHelp';
import {
  loadAccelSkillIds as defaultLoadAccelSkillIds,
  loadSkillEffectValues as defaultLoadSkillEffectValues,
  skillRecordToSummary,
} from './skillTechnicalDetails';
import { describePositioning, requiresWitCheck, witCheckPassChance } from '@/core/skillConditions';
import { useSkillRank } from './useSkillRank';
import { useStaminaProbe } from './useStaminaProbe';
import { useStaminaWarnThreshold } from './useStaminaWarnThreshold';
import type { SkillChartPanelDeps } from './SkillChartPanel';

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

type SortMetric = 'L' | 'sp' | 'eff' | 'effect';
const SORTABLE_COLUMNS: ReadonlyArray<{ key: SortMetric; label: string }> = [
  { key: 'L', label: 'L' },
  { key: 'sp', label: 'SP' },
  { key: 'eff', label: 'L/100SP' },
  { key: 'effect', label: 'Effect' },
];

export interface AccelChartPanelDeps extends SkillChartPanelDeps {
  loadAccelSkillIds?: () => Promise<Set<string>>;
  loadSkillEffectValues?: () => Promise<Map<string, number>>;
}

interface RowView {
  row: SkillChartRow;
  skill: SkillRecord;
  sp: number | null;
  eff: number | null;
  effectValue: number | null;
  positioning: string;
  witChance: number | null;
  targeted: boolean;
  inBuild?: boolean;
}

// L and efficiency rank best-first (desc); SP ranks cheapest-first (asc) by default;
// effect ranks highest-first (desc). Clicking the active column again inverts the direction.
// null/na metrics always sort last.
const DEFAULT_DIR: Record<SortMetric, 'asc' | 'desc'> = { L: 'desc', sp: 'asc', eff: 'desc', effect: 'desc' };
const rawMetric = (v: RowView, m: SortMetric): number | null =>
  m === 'L' ? v.row.L : m === 'sp' ? v.sp : m === 'eff' ? v.eff : v.effectValue;
const signed = (n: number): string => `${n >= 0 ? '+' : ''}${n.toFixed(2)}`;

export function AccelChartPanel({ courseId, plan, onChange, collapseSkillSignal, onStaleChange, deps }: {
  courseId: string;
  plan: CmPlan;
  onChange: (next: CmPlan) => void;
  collapseSkillSignal?: number;
  onStaleChange?: (stale: boolean) => void;
  deps?: AccelChartPanelDeps;
}) {
  const { skills, skillById, sparkRates, timeline } = useGameData();
  const [open, setOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SkillFilter>('all');
  const [showAll, setShowAll] = useState(false);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [sortMetric, setSortMetric] = useState<SortMetric>('L');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Async-loaded accel ID set + effect values (injectable via deps for tests)
  const [accelIds, setAccelIds] = useState<Set<string> | null>(null);
  const [effectValues, setEffectValues] = useState<Map<string, number>>(new Map());
  const loadIds = useMemo(
    () => deps?.loadAccelSkillIds ?? defaultLoadAccelSkillIds,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deps?.loadAccelSkillIds],
  );
  const loadVals = useMemo(
    () => deps?.loadSkillEffectValues ?? defaultLoadSkillEffectValues,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deps?.loadSkillEffectValues],
  );
  useEffect(() => {
    let cancelled = false;
    loadIds()
      .then((s) => { if (!cancelled) setAccelIds(s); })
      .catch(() => { if (!cancelled) setAccelIds(new Set()); });
    loadVals()
      .then((m) => { if (!cancelled) setEffectValues(m); })
      .catch(() => { if (!cancelled) setEffectValues(new Map()); });
    return () => { cancelled = true; };
  }, [loadIds, loadVals]);

  const hasSpeed = plan.statProfile.stats.spd > 0;

  const cmNumber = plan.cmRef.kind === 'cm' ? plan.cmRef.cmNumber : undefined;
  const cmEntry = (timeline as TimelineEntry[] | undefined)
    ?.find((e) => e.type === 'cm' && e.cm?.cmNumber === cmNumber);
  const asOfISO = cmEntry?.dates.start ?? cmEntry?.dates.finals ?? new Date().toISOString().slice(0, 10);

  // All acquirable skill reps (same derivation as SkillChartPanel)
  const reps = useMemo(() => {
    const catalog = acquirableSkills(skills ?? [], plan.server);
    const baseReps = (['white', 'gold', 'inherited_unique'] as const).flatMap((r) =>
      familyRepresentatives(catalog.filter((s) => s.rarity === r), skillById),
    );
    const upcoming =
      plan.server === 'global'
        ? (['white', 'gold', 'inherited_unique'] as const).flatMap((r) =>
            familyRepresentatives(
              (skills ?? []).filter(
                (s) => s.server === 'jp' && s.rarity === r && isReleasedBy(s, asOfISO),
              ),
              skillById,
            ),
          )
        : [];
    return [...baseReps, ...upcoming];
  }, [skills, skillById, plan.server, asOfISO]);

  // Filter reps to accel skills only (while accelIds is null → empty, no sim yet)
  const accelReps = useMemo(
    () => (accelIds ? reps.filter((s) => accelIds.has(s.skillId)) : []),
    [reps, accelIds],
  );

  const isTargeted = (rep: SkillRecord): boolean =>
    plan.wishlist.some((it) => {
      const rec = wishlistSkillRecord(it.skillId, skillById);
      return rec ? areSkillVariants(rec, rep) : it.skillId === rep.skillId;
    });

  const ids = useMemo(
    () => (hasSpeed ? accelReps.filter((s) => !isTargeted(s)).map((s) => s.skillId) : []),
    [accelReps, hasSpeed, plan.wishlist, skillById],
  );
  const build = useMemo(() => chartBaselineBuild(plan, skillById), [plan, skillById]);
  const race = useMemo<SimRaceParams>(() => ({ courseId }), [courseId]);

  const [warnThreshold, setWarnThreshold] = useStaminaWarnThreshold();
  const probeDeps = deps?.vacuum ? { vacuum: deps.vacuum, nsamples: deps.nsamples } : undefined;
  const { survival, probe } = useStaminaProbe(build, race, probeDeps);
  const staminaOut = survival != null && survival < warnThreshold;

  const chartDeps = deps?.skillDelta ? { skillDelta: deps.skillDelta, nsamples: deps.nsamples } : undefined;
  const { rows, status, done, total, isStale, run, stop } = useSkillRank(build, race, ids, chartDeps);

  // Report stale state up so the tabstrip can flag this tab (fires only when it flips).
  const onStaleRef = useRef(onStaleChange);
  onStaleRef.current = onStaleChange;
  useEffect(() => {
    onStaleRef.current?.(isStale);
  }, [isStale]);

  const targetSkill = (rep: SkillRecord, L: number | null) => {
    const wl = addOrReplaceWishlistSkill(plan.wishlist, rep.skillId, skillById);
    const resolvedId = wishlistSkillId(rep.skillId, skillById);
    const patch = L != null ? { projectedL: L, projectedLStale: false } : {};
    onChange({ ...plan, wishlist: wl.map((it) => (it.skillId === resolvedId ? { ...it, ...patch } : it)) });
  };

  const onSortClick = (m: SortMetric) => {
    if (m === sortMetric) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortMetric(m); setSortDir(DEFAULT_DIR[m]); }
  };

  const q = query.trim().toLowerCase();

  const makeRowView = (rec: SkillRecord, row: SkillChartRow, targeted: boolean, inBuild?: boolean): RowView => {
    const sp = sparkRates ? purchaseSpCost(rec, skillById, 0, sparkRates) : null;
    const eff = row.L != null && sp != null && sp > 0 ? (100 * row.L) / sp : null;
    const effectValue = effectValues.get(rec.skillId) ?? null;
    const positioning = describePositioning(rec.conditions);
    const witChance = requiresWitCheck(rec.conditions) ? witCheckPassChance(plan.statProfile.stats.wit) : null;
    return { row, skill: rec, sp, eff, effectValue, positioning, witChance, targeted, inBuild };
  };

  // In-build rows: targeted wishlist items whose record is in accelReps
  const inBuildViews: RowView[] = plan.wishlist
    .map((it): RowView | null => {
      const rec = wishlistSkillRecord(it.skillId, skillById);
      if (!rec || !accelReps.some((rep) => areSkillVariants(rep, rec))) return null;
      const L = it.projectedL ?? null;
      const sp = sparkRates ? purchaseSpCost(rec, skillById, 0, sparkRates) : null;
      const eff = L != null && sp != null && sp > 0 ? (100 * L) / sp : null;
      const effectValue = effectValues.get(rec.skillId) ?? null;
      const positioning = describePositioning(rec.conditions);
      const witChance = requiresWitCheck(rec.conditions) ? witCheckPassChance(plan.statProfile.stats.wit) : null;
      const row: SkillChartRow = { skillId: rec.skillId, L, min: null, max: null, median: null, status: 'live', nsamples: 0 };
      return { row, skill: rec, sp, eff, effectValue, positioning, witChance, targeted: true, inBuild: true };
    })
    .filter((v): v is RowView => v !== null);

  const rankedViews: RowView[] = rows
    .map((row): RowView | null => {
      const skill = skillById.get(row.skillId);
      if (!skill) return null;
      return makeRowView(skill, row, isTargeted(skill));
    })
    // A targeted skill is shown once — as its in-build row — so drop its ranked duplicate.
    .filter((v): v is RowView => v !== null && !v.targeted);

  const views: RowView[] = [...inBuildViews, ...rankedViews]
    .filter((v) => {
      if (!showUpcoming && v.skill.server === 'jp') return false;
      if (!showAll && v.row.status === 'inactive') return false;
      if (!matchesFilter(v.skill.rarity, filter)) return false;
      if (q && !v.skill.nameEn.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort(nullsLast((v) => rawMetric(v, sortMetric), sortDir));

  return (
    <section className="cmp-plan-card cmp-skill-chart cmp-accel-chart">
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
        <span className="cmp-skill-chart-title">Accel skill chart</span>
        <HeaderHelp label="How the accel chart works">
          <p className="cmp-help-title">Accel skill chart</p>
          <p>
            Like the Skill chart, but only <b>acceleration</b> skills (excludes uniques). Run to rank by
            the バ身 each adds to your current uma plan. Re-run after editing the plan.
          </p>
          <ul>
            <li>
              <b>Effect</b> — the speed it adds: acceleration × duration (m/s). E.g. a +0.2 m/s²
              accel for 5&nbsp;s ≈ 1.00. Computed from the skill&apos;s strongest acceleration effect
              (modifier ÷ 10000 m/s²) times its base duration (÷ 10000 s). Bigger = more speed. Sortable.
            </li>
            <li><b>Position</b> — where it needs you to be, parsed from its activation conditions.</li>
            <li>
              <b>Wit</b> — <b>✗</b> = no wit check (it has no random/陥入 trigger), so the skill fires
              <i>whenever its other conditions are met</i> — not necessarily always. A number = the
              wit-check pass chance (from your wit stat) on top of those conditions.
            </li>
          </ul>
        </HeaderHelp>
        <button
          type="button"
          className="cmp-run-btn"
          disabled={!hasSpeed}
          aria-label={status === 'running' ? 'Stop ranking' : status === 'idle' ? 'Run' : 'Re-run'}
          onClick={(e) => { e.stopPropagation(); if (status === 'running') stop(); else { run(); probe(); } }}
        >
          {status === 'running' ? '■' : status === 'idle' ? 'Run' : 'Re-run'}
        </button>
        {status === 'running' && <span className="muted small cmp-uma-progress" role="status">ranking {done}/{total}</span>}
        {status === 'done' && !isStale && (
          <span className="muted small cmp-uma-progress" role="status">
            {done >= total ? 'Done' : `${done}/${total} skills ran`}
          </span>
        )}
        {isStale && <span className="cmp-stale small">Changed detected!, please re-run</span>}
        <span className="cmp-collapse-caret" data-open={open || undefined} aria-hidden="true" />
      </header>

      {open && (
        <div className="cmp-skill-body">
          {!hasSpeed ? (
            <p className="muted small">Enter your runner&apos;s stats (Speed is required) in the sidebar to rank skills.</p>
          ) : (
            <>
              {staminaOut && (
                <p className="cmp-stamina-warn small" role="status">
                  ⚠ Build survives only {Math.round((survival ?? 0) * 100)}% of runs (stamina-out).
                  Recovery is inflated and speed skills undervalued — secure stamina/recovery, then Re-run.
                </p>
              )}
              {status === 'idle' && (
                <p className="muted small">Press Run to score acceleration skills for your build.</p>
              )}
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
                    <label
                      className="cmp-showall small"
                      title="Upcoming skills from cards/banners that release on or before this CM's start date (not available yet)."
                    >
                      <input type="checkbox" checked={showUpcoming} onChange={(e) => setShowUpcoming(e.target.checked)} /> show upcoming
                    </label>
                    <label className="cmp-stamina-thresh small" title="Warn when the build's stamina survival is below this percentage.">
                      warn&nbsp;&lt;&nbsp;
                      <input
                        type="number" min={0} max={100} step={5}
                        aria-label="Stamina warning threshold (%)"
                        value={Math.round(warnThreshold * 100)}
                        onChange={(e) => { const v = e.target.value; if (v !== '') setWarnThreshold(Number(v) / 100); }}
                      />
                      %
                    </label>
                  </div>

                  <div className="cmp-skill-table">
                    <div className="cmp-skill-thead" role="row">
                      <span>Skill</span>
                      {SORTABLE_COLUMNS.map((c) => (
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
                      {/* Non-sortable headers — plain spans so they match the sortable headers'
                          uppercase styling (don't reuse the muted data-cell classes here). */}
                      <span>Position</span>
                      <span>Wit</span>
                      <span />
                    </div>

                    <div className="cmp-skill-scroll">
                      <ul className="cmp-skill-rows" aria-label="Accel skill ranking">
                        {views.map((v) => (
                          <li key={v.skill.skillId} className={`cmp-skill-row ${v.row.status === 'inactive' ? 'is-dim' : ''}`.trim()}>
                            <SkillDetailDisclosure
                              skill={skillRecordToSummary(v.skill)}
                              collapseSignal={collapseSkillSignal}
                              showCost={false}
                              showSourcing
                              className="cmp-uma-plate"
                              side={v.inBuild ? <span className="cmp-inbuild">in build</span> : undefined}
                              technicalHeaderSide={
                                v.row.L != null
                                  ? v.inBuild
                                    ? <span className="muted small">L +{v.row.L.toFixed(2)} · in build</span>
                                    : <span className="muted small">L +{v.row.L.toFixed(2)} · min {(v.row.min ?? 0).toFixed(2)} · max {(v.row.max ?? 0).toFixed(2)} · med {(v.row.median ?? 0).toFixed(2)} · n={v.row.nsamples}</span>
                                  : undefined
                              }
                            />
                            <span className={`cmp-uma-num ${sortMetric === 'L' ? 'is-sort' : ''}`.trim()}>
                              {v.row.status === 'na' ? 'n/a' : v.row.status === 'inactive' ? '—' : v.row.L == null ? '—' : signed(v.row.L)}
                            </span>
                            <span className={`cmp-uma-num ${sortMetric === 'sp' ? 'is-sort' : ''}`.trim()}>
                              {v.sp ?? '—'}
                            </span>
                            <span className={`cmp-uma-num ${sortMetric === 'eff' ? 'is-sort' : ''}`.trim()}>
                              {v.eff != null ? v.eff.toFixed(2) : '—'}
                            </span>
                            <span className={`cmp-uma-num ${sortMetric === 'effect' ? 'is-sort' : ''}`.trim()}>
                              {v.effectValue != null ? v.effectValue.toFixed(2) : '—'}
                            </span>
                            <span className="cmp-accel-pos-cell" title={v.skill.conditions}>
                              {v.positioning}
                            </span>
                            <span className="cmp-accel-wit-cell">
                              {v.witChance !== null ? `${v.witChance}%` : '✗'}
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
                          <li className="muted small">No acceleration skills to show{!showAll ? ' (try "show not-activatable")' : ''}.</li>
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
