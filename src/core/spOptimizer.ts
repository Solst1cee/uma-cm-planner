/**
 * Module 2 core — pure, sim-free SP-basket selection (spec §4, the adaptive
 * hybrid). Operates strictly on the candidates + scores it is given; the
 * Monte-Carlo simulation that actually ranks baskets lives in the sim layer
 * (src/features/sp-optimizer/rankBaskets.ts) and is injected. Costs are the
 * on-screen effective costs (no cost calculation here — spec §2/§4).
 */
import type { HintLevel } from '@/core/coverage';
import type { Server, SkillRarity, Stat } from '@/core/types';
import type { Grade, Strategy } from '@/sim';

/** One buyable skill row on the post-run screen (M2-local). */
export interface BuyableSkill {
  skillId: string;
  rarity: SkillRarity;
  /** Effective on-screen SP cost (already discounted by hints + Fast Learner). */
  screenSpCost: number;
  /** Informational only in v1. */
  hintLevel?: HintLevel;
  /** Gold skills require their white base; a constraint, not a cost calc. */
  prereqSkillId?: string;
}

/** The post-run build context — the serialized `CaptureBundle.context`. */
export interface BuildContext {
  umaId: string;
  stats: Record<Stat, number>;
  aptitudes: { distance: Grade; surface: Grade; strategy: Grade };
  strategy: Strategy;
  /** master.mdb course id as string (matches SimRaceParams.courseId). */
  courseId: string;
  /** Available SP to spend (the runtime budget — never on CmPlan). */
  spBudget: number;
  /** Skills already learned this run; the sim base loadout (may be empty). */
  ownedSkills: string[];
  /** The buyable skills on screen. */
  candidates: BuyableSkill[];
  /** Must-buy skill ids forced into every basket. */
  pinned: string[];
}

/** The serializable import↔analysis artifact (spec §3). */
export interface CaptureBundle {
  schemaVersion: 1;
  source: 'manual' | 'ocr' | 'video';
  /** ISO timestamp; supplied by the caller (core stays clock-free). */
  capturedAt: string;
  server: Server;
  dataVersion: string;
  /** Fixed seed → deterministic sim (reproducible baskets). */
  seed?: number;
  context: BuildContext;
}

/** A selected basket of skill ids (pinned + chosen), with SP accounting. */
export interface Basket {
  skills: string[];
  spUsed: number;
  spLeft: number;
}

// --- feasibility helpers ---

/** Expand a skill-id set to include any prereqs found in `candidates`
 *  (transitively — resolves prereq chains, not just one level). */
export function prereqClosure(skillIds: string[], candidates: BuyableSkill[]): string[] {
  const byId = new Map(candidates.map((c) => [c.skillId, c]));
  const out = new Set(skillIds);
  const worklist = [...skillIds];
  while (worklist.length) {
    const id = worklist.pop()!;
    const prereq = byId.get(id)?.prereqSkillId;
    if (prereq && !out.has(prereq)) {
      out.add(prereq);
      worklist.push(prereq);
    }
  }
  return [...out];
}

/** Sum the on-screen cost of the given skills (ids not in `candidates` cost 0). */
export function basketSpCost(skillIds: string[], candidates: BuyableSkill[]): number {
  const cost = new Map(candidates.map((c) => [c.skillId, c.screenSpCost]));
  return skillIds.reduce((sum, id) => sum + (cost.get(id) ?? 0), 0);
}

// --- enumeration (exact branch) ---

/**
 * Every prereq-closed subset of `candidates` whose total on-screen cost fits
 * `budget`, with `pinned` (+ their prereqs) forced into each. Returned baskets
 * are arrays of skill ids that INCLUDE the pinned set. Pure and total.
 *
 * Cost is bounded by the lock-threshold in practice (spec §4 step 2): the
 * caller only enumerates when the optional skill count is small.
 */
export function enumerateFeasibleBaskets(
  candidates: BuyableSkill[],
  budget: number,
  pinned: string[],
): string[][] {
  const pinnedClosed = prereqClosure(pinned, candidates);
  const pinnedCost = basketSpCost(pinnedClosed, candidates);
  const pinnedSet = new Set(pinnedClosed);
  // Optional skills are the non-pinned candidates; golds carry their prereq.
  const optional = candidates.filter((c) => !pinnedSet.has(c.skillId));

  const out: string[][] = [];
  const n = optional.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    const picked: string[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) picked.push(optional[i]!.skillId);
    const closed = prereqClosure(picked, candidates);
    const totalCost = pinnedCost + basketSpCost(closed.filter((id) => !pinnedSet.has(id)), candidates);
    if (totalCost > budget) continue;
    out.push([...new Set([...pinnedClosed, ...closed])]);
  }
  // Dedupe baskets (closures can collapse two masks to the same set).
  const seen = new Set<string>();
  return out.filter((b) => {
    const key = b.slice().sort().join(',');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// --- diversity + selection ---

/** A basket plus its simulated score (mean Δ-lengths) and SP accounting. */
export interface ScoredBasket extends Basket {
  /** Simulated combined Δ-lengths (higher = better). */
  score: number;
}

export interface SelectOpts {
  k: number;
  /** Drop baskets more than this many bashin below the best. */
  bandBashin: number;
  /** Minimum symmetric-difference between any two chosen baskets. */
  minDistance: number;
}

/** Symmetric-difference size of two skill-id sets. */
export function skillSetDistance(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  let d = 0;
  for (const x of sa) if (!sb.has(x)) d++;
  for (const x of sb) if (!sa.has(x)) d++;
  return d;
}

/**
 * Greedy top-K by descending score, skipping any basket within `minDistance`
 * of an already-chosen one or more than `bandBashin` below the best score.
 * Stable: equal scores keep input order. Pure and total.
 */
export function selectTopDiverse(scored: ScoredBasket[], opts: SelectOpts): ScoredBasket[] {
  if (scored.length === 0) return [];
  const ranked = [...scored].sort((x, y) => y.score - x.score);
  const best = ranked[0]!.score;
  const chosen: ScoredBasket[] = [];
  for (const cand of ranked) {
    if (cand.score < best - opts.bandBashin) break; // ranked desc → rest are worse
    const tooClose = chosen.some(
      (c) => skillSetDistance(c.skills, cand.skills) < opts.minDistance,
    );
    if (tooClose) continue;
    chosen.push(cand);
    if (chosen.length === opts.k) break;
  }
  return chosen;
}
