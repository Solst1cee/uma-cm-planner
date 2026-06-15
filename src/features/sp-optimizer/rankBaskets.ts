/**
 * Module 2 sim orchestrator (spec §4, "rankBaskets is the sim-layer
 * orchestrator"). Pure selection lives in @/core/spOptimizer; this drives the
 * vendored engine through it. Sim functions are injectable for deterministic
 * tests. M2 keeps its OWN per-(owned-skill-set, course) cache — the shared
 * makeDeltaCache is unsafe across differing loadouts.
 */
import {
  type BuildContext,
  type CaptureBundle,
  type ScoredBasket,
  basketSpCost,
  chooseBasketsToScore,
  selectTopDiverse,
} from '@/core/spOptimizer';
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

const REAL_DEPS: SimDeps = {
  skillDelta: (b, r, s, n, seed) => evalSkillDelta(b, r, s, n, seed),
  planner: (b, r, s, n, seed) => runPlannerCompare(b, r, s, n, seed),
};

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

export interface RankResult {
  mode: 'exact' | 'shortlist';
  baskets: RankedBasket[];
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

  const cache = new Map<string, BashinStats>();
  const cached = (key: string, compute: () => BashinStats): BashinStats => {
    const hit = cache.get(key);
    if (hit) return hit;
    const v = compute();
    cache.set(key, v);
    return v;
  };
  const baseKey = `${ctx.courseId}|${lockedSkills.slice().sort().join(',')}`;

  const deltaLById: Record<string, number> = {};
  for (const c of ctx.candidates) {
    if (lockedSkills.includes(c.skillId)) continue;
    const stats = cached(`${baseKey}|d:${c.skillId}`, () =>
      deps.skillDelta(lockedBuild, race, c.skillId, n, seed),
    );
    deltaLById[c.skillId] = stats.nsamples === 0 ? 0 : stats.mean;
  }

  const choice = chooseBasketsToScore(ctx, deltaLById, {
    exactThreshold: opts.exactThreshold ?? 256,
    shortlistLimit: opts.shortlistLimit ?? 20,
    minDistance: 2,
  });

  const scored: (ScoredBasket & { descriptor: string })[] = choice.baskets.map((skills) => {
    const additions = skills.filter((id) => !lockedSkills.includes(id));
    const stats = cached(`${baseKey}|p:${additions.slice().sort().join(',')}`, () =>
      deps.planner(lockedBuild, race, additions, n, seed),
    );
    const spUsed = basketSpCost(additions, ctx.candidates);
    return {
      skills,
      score: stats.nsamples === 0 ? 0 : stats.mean,
      spUsed,
      spLeft: ctx.spBudget - spUsed,
      descriptor: describeStats(stats),
    };
  });

  const top = selectTopDiverse(scored, { k: 3, bandBashin: 3, minDistance: 2 });
  const byKey = new Map(scored.map((s) => [s.skills.slice().sort().join(','), s.descriptor]));
  return {
    mode: choice.mode,
    baskets: top.map((b) => ({
      ...b,
      descriptor: byKey.get(b.skills.slice().sort().join(',')) ?? '',
    })),
  };
}
