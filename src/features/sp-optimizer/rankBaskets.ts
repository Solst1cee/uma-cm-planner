/**
 * Module 2 sim orchestrator (spec §4, "rankBaskets is the sim-layer
 * orchestrator"). Pure selection lives in @/core/spOptimizer; this drives the
 * vendored engine through it. Sim functions are injectable for deterministic
 * tests. M2 keeps its OWN per-(owned-skill-set, course) cache — the shared
 * makeDeltaCache is unsafe across differing loadouts.
 */
import type { HintLevel } from '@/core/coverage';
import {
  type BuildContext,
  type CaptureBundle,
  type ScoredBasket,
  basketSpCost,
  chooseBasketsToScore,
  greedyByRatioBasket,
  selectTopDiverse,
} from '@/core/spOptimizer';
import type { SkillRarity } from '@/core/types';
import {
  type BashinStats,
  type SimBuild,
  type SimRaceParams,
  evalSkillDelta,
  runPlannerCompare,
} from '@/sim';

/** The two engine calls the orchestrator needs; injectable for tests. */
export interface SimDeps {
  skillDelta: (b: SimBuild, r: SimRaceParams, skillId: string, n: number, seed: number) => BashinStats;
  planner: (b: SimBuild, r: SimRaceParams, skills: string[], n: number, seed: number) => BashinStats;
}

// evalSkillDelta / runPlannerCompare already match the SimDeps signatures.
const REAL_DEPS: SimDeps = { skillDelta: evalSkillDelta, planner: runPlannerCompare };

export interface RankOpts {
  deps?: SimDeps;
  nsamples?: number;
  exactThreshold?: number;
  shortlistLimit?: number;
}

export interface RankedBasket extends ScoredBasket {
  /** Short, honest distribution descriptor (NOT a phase profile — see note). */
  descriptor: string;
}

/** One candidate skill's row for the UI table: single-skill ΔL (measured vs the
 *  owned-only base, so it's pin-independent) + the L/SP ratio it implies. */
export interface CandidateRow {
  skillId: string;
  rarity: SkillRarity;
  deltaL: number;
  screenSpCost: number;
  baseSpCost?: number;
  lPerSp: number;
  hintLevel?: HintLevel;
  /** True when the working hint level differs from the imported capture's —
   *  the shown cost is a projection, not the captured screen truth (red accent). */
  hintEdited?: boolean;
  prereqSkillId?: string;
  pinned: boolean;
}

export interface RankResult {
  mode: 'exact' | 'shortlist';
  baskets: RankedBasket[];
  candidates: CandidateRow[];
  /** Mean L of the greedy-by-ratio basket (the "vs greedy" banner comparison); 0 if none. */
  greedyScore: number;
}

/** Build a SimBuild from a BuildContext + the basket's skill set. */
export function toSimBuild(ctx: BuildContext, skills: string[]): SimBuild {
  return {
    umaId: ctx.umaId,
    stats: ctx.stats,
    strategy: ctx.strategy,
    aptitudes: ctx.aptitudes,
    skills,
  };
}

/**
 * Honest, measurable descriptor from the bashin distribution (spec §4 / P3:
 * NO early/mid/late phase profile — the adapter doesn't expose phase telemetry
 * yet; that is a deferred enhancement).
 */
function describeStats(stats: BashinStats): string {
  const spread = stats.max - stats.min;
  const consistency = spread <= 1 ? 'tight' : spread <= 3 ? 'moderate' : 'wide';
  return `+${stats.mean.toFixed(1)} lengths · ${consistency} spread`;
}

/**
 * The adaptive hybrid (spec §4): lock → Δ-L per candidate → exact-or-shortlist
 * → full-build sim each candidate basket → top-3 diverse on simulated Δ-L.
 */
export function rankBaskets(bundle: CaptureBundle, opts: RankOpts = {}): RankResult {
  const deps = opts.deps ?? REAL_DEPS;
  const n = opts.nsamples ?? 200;
  const seed = bundle.seed ?? 0;
  const ctx = bundle.context;
  const race: SimRaceParams = { courseId: ctx.courseId };

  const lockedSkills = [...new Set([...ctx.ownedSkills, ...ctx.pinned])];
  const lockedBuild = toSimBuild(ctx, lockedSkills);
  const ownedBuild = toSimBuild(ctx, ctx.ownedSkills);

  const cache = new Map<string, BashinStats>();
  const cached = (key: string, compute: () => BashinStats): BashinStats => {
    const hit = cache.get(key);
    if (hit) return hit;
    const v = compute();
    cache.set(key, v);
    return v;
  };
  const lockedKey = `${ctx.courseId}|${lockedSkills.slice().sort().join(',')}`;
  const ownedKey = `${ctx.courseId}|owned:${ctx.ownedSkills.slice().sort().join(',')}`;

  // Single-skill ΔL vs the OWNED base for every candidate (pin-independent, so the
  // table's ΔL/L-SP columns don't shift when you pin — only basket sims depend on pins).
  const deltaLById: Record<string, number> = {};
  const lPerSpById: Record<string, number> = {};
  for (const c of ctx.candidates) {
    const stats = cached(`${ownedKey}|d:${c.skillId}`, () =>
      deps.skillDelta(ownedBuild, race, c.skillId, n, seed),
    );
    const dl = stats.nsamples === 0 ? 0 : stats.mean;
    deltaLById[c.skillId] = dl;
    lPerSpById[c.skillId] = c.screenSpCost > 0 ? (dl / c.screenSpCost) * 1000 : 0;
  }

  const pinnedSet = new Set(ctx.pinned);
  const candidateRows: CandidateRow[] = ctx.candidates.map((c) => ({
    skillId: c.skillId,
    rarity: c.rarity,
    deltaL: deltaLById[c.skillId] ?? 0,
    screenSpCost: c.screenSpCost,
    ...(c.hintLevel !== undefined ? { hintLevel: c.hintLevel } : {}),
    ...(c.prereqSkillId !== undefined ? { prereqSkillId: c.prereqSkillId } : {}),
    lPerSp: lPerSpById[c.skillId] ?? 0,
    pinned: pinnedSet.has(c.skillId),
  }));

  const choice = chooseBasketsToScore(ctx, deltaLById, {
    exactThreshold: opts.exactThreshold ?? 256,
    shortlistLimit: opts.shortlistLimit ?? 20,
    minDistance: 2,
  });

  const scoreBasket = (skills: string[]): BashinStats => {
    // The sim adds only the non-locked skills on top of the locked base (owned +
    // pinned are already in lockedBuild).
    const additions = skills.filter((id) => !lockedSkills.includes(id));
    return cached(`${lockedKey}|p:${additions.slice().sort().join(',')}`, () =>
      deps.planner(lockedBuild, race, additions, n, seed),
    );
  };

  const scored: (ScoredBasket & { descriptor: string })[] = choice.baskets.map((skills) => {
    const stats = scoreBasket(skills);
    // SP is spent on every PURCHASED skill in the basket — pinned must-buys cost
    // money; only already-owned skills are free, and those are never candidates
    // (so basketSpCost scores them 0). Use the full basket skills, not additions.
    const spUsed = basketSpCost(skills, ctx.candidates);
    return {
      skills,
      // The planner path never returns nsamples 0 (the engine throws on missing
      // data); this guard is purely defensive.
      score: stats.nsamples === 0 ? 0 : stats.mean,
      spUsed,
      spLeft: ctx.spBudget - spUsed,
      descriptor: describeStats(stats),
    };
  });

  // "vs greedy" banner comparison (spec §4): the naive greedy-by-(L/SP) basket,
  // scored the same way as the sim-ranked baskets — never used to rank them.
  const greedy = greedyByRatioBasket(ctx.candidates, ctx.spBudget, ctx.pinned, lPerSpById);
  const greedyStats = greedy.length ? scoreBasket(greedy) : undefined;
  const greedyScore = greedyStats && greedyStats.nsamples > 0 ? greedyStats.mean : 0;

  const top = selectTopDiverse(scored, { k: 3, bandBashin: 3, minDistance: 2 });
  const byKey = new Map(scored.map((s) => [s.skills.slice().sort().join(','), s.descriptor]));
  return {
    mode: choice.mode,
    candidates: candidateRows,
    greedyScore,
    baskets: top.map((b) => ({
      ...b,
      descriptor: byKey.get(b.skills.slice().sort().join(',')) ?? '',
    })),
  };
}

/**
 * The main-thread production entry: ensure the wasm engine is initialized, then
 * run the SYNC orchestrator. This is the single seam every main-thread M2
 * consumer goes through, so none can reach the uninitialized sync engine — the
 * bug the guard test (`rankBaskets.init.test.ts`) pins. Only the REAL_DEPS path
 * needs init: when a caller injects `opts.deps` (deterministic tests / jsdom),
 * the real engine is never touched, so init is skipped entirely. The wasm asset
 * URL lives behind the `@/sim/ensureMainThread` dynamic import so it stays out
 * of eager chunks (chunk discipline: only the lazy M2 chunk pulls it).
 */
export async function rankBasketsWithEngine(bundle: CaptureBundle, opts: RankOpts = {}): Promise<RankResult> {
  if (!opts.deps) {
    const { ensureMainThreadEngine } = await import('@/sim/ensureMainThread');
    await ensureMainThreadEngine();
  }
  return rankBaskets(bundle, opts);
}
