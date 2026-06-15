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
  /** OCR/import-row provenance for the UI badge; absent/'manual' on manual entry. */
  matchTier?: 'exact' | 'fuzzy' | 'manual';
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

export function enumerateFeasibleBaskets(
  candidates: BuyableSkill[],
  budget: number,
  pinned: string[],
): string[][];
export function enumerateFeasibleBaskets(
  candidates: BuyableSkill[],
  budget: number,
  pinned: string[],
  abortOver: number,
): string[][] | null;
/**
 * Every prereq-closed subset of `candidates` whose total on-screen cost fits
 * `budget`, with `pinned` (+ their prereqs) forced into each. Returned baskets
 * INCLUDE the pinned set and are deduped. Pure and total.
 *
 * When `abortOver` is given, returns `null` as soon as more than `abortOver`
 * distinct feasible baskets are found, so the caller can bail to the shortlist
 * branch without paying the full 2^n cost (spec §4 step 2).
 */
export function enumerateFeasibleBaskets(
  candidates: BuyableSkill[],
  budget: number,
  pinned: string[],
  abortOver?: number,
): string[][] | null {
  const pinnedClosed = prereqClosure(pinned, candidates);
  const pinnedCost = basketSpCost(pinnedClosed, candidates);
  const pinnedSet = new Set(pinnedClosed);
  const optional = candidates.filter((c) => !pinnedSet.has(c.skillId));

  const out: string[][] = [];
  const seen = new Set<string>();
  const n = optional.length;
  for (let mask = 0; mask < 1 << n; mask++) {
    const picked: string[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) picked.push(optional[i]!.skillId);
    const closed = prereqClosure(picked, candidates);
    const totalCost =
      pinnedCost + basketSpCost(closed.filter((id) => !pinnedSet.has(id)), candidates);
    if (totalCost > budget) continue;
    const basket = [...new Set([...pinnedClosed, ...closed])];
    const key = basket.slice().sort().join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(basket);
    if (abortOver !== undefined && out.length > abortOver) return null;
  }
  return out;
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

// --- proxy shortlister (large-residual branch) ---

export interface ShortlistOpts {
  /** Max baskets to return for simulation. */
  limit: number;
  /** Minimum diversity between shortlisted baskets. */
  minDistance: number;
}

/**
 * Exact DP-over-SP knapsack on the single-skill Δ-L proxy → the proxy-optimal
 * feasible basket, then a diverse spread around it, capped at `limit`. The
 * proxy ONLY narrows the field (spec §4 step 3); the sim re-ranks the result.
 * Beats greedy-by-ratio (the knapsack is exact). Pure and total.
 *
 * `deltaLById` is the per-candidate single-skill Δ-lengths; missing ⇒ 0.
 */
export function shortlistByProxy(
  candidates: BuyableSkill[],
  budget: number,
  pinned: string[],
  deltaLById: Record<string, number>,
  opts: ShortlistOpts,
): string[][] {
  const pinnedClosed = prereqClosure(pinned, candidates);
  const pinnedCost = basketSpCost(pinnedClosed, candidates);
  const pinnedSet = new Set(pinnedClosed);
  // The DP indexes by integer SP, so round to integers (in-game costs are
  // already integers; this guards against fractional estimate inputs).
  const residual = Math.floor(Math.max(0, budget - pinnedCost));

  const items = candidates
    .filter((c) => !pinnedSet.has(c.skillId))
    .map((c) => {
      const closed = prereqClosure([c.skillId], candidates).filter((id) => !pinnedSet.has(id));
      return {
        id: c.skillId,
        members: closed,
        cost: Math.ceil(basketSpCost(closed, candidates)),
        value: closed.reduce((s, id) => s + (deltaLById[id] ?? 0), 0),
      };
    })
    .filter((it) => it.cost > 0 && it.cost <= residual);

  const best: { value: number; picked: number[] }[] = Array.from({ length: residual + 1 }, () => ({
    value: 0,
    picked: [],
  }));
  items.forEach((it, idx) => {
    for (let sp = residual; sp >= it.cost; sp--) {
      const cand = best[sp - it.cost]!;
      // Backward SP sweep guarantees 0/1 semantics (an item is never revisited).
      if (cand.value + it.value > best[sp]!.value) {
        best[sp] = { value: cand.value + it.value, picked: [...cand.picked, idx] };
      }
    }
  });

  // Collect the optimum at each SP level for a diverse spread. Low-SP cells can
  // under-spend the budget; acceptable in v1 — the sim re-ranks, and the
  // value-desc sort + diversity filter below keep the best baskets first.
  const raw: string[][] = best
    .map((cell) => [...pinnedClosed, ...cell.picked.flatMap((i) => items[i]!.members)])
    .map((b) => [...new Set(b)]);

  const out: string[][] = [];
  const seen = new Set<string>();
  const valueOf = (b: string[]) => b.reduce((s, id) => s + (deltaLById[id] ?? 0), 0);
  for (const b of raw.sort((x, y) => valueOf(y) - valueOf(x))) {
    const key = b.slice().sort().join(',');
    if (seen.has(key)) continue;
    if (out.some((o) => skillSetDistance(o, b) < opts.minDistance)) continue;
    seen.add(key);
    out.push(b);
    if (out.length === opts.limit) break;
  }
  return out;
}

// --- CaptureBundle import validation (F1) ---

function fail(msg: string): never { throw new Error(`Invalid CaptureBundle: ${msg}`); }
function asObject(v: unknown, name: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(`${name} must be an object`);
  return v as Record<string, unknown>;
}
function asString(v: unknown, name: string): string {
  if (typeof v !== 'string') fail(`${name} must be a string`);
  return v;
}
function asNumber(v: unknown, name: string): number {
  if (typeof v !== 'number' || Number.isNaN(v)) fail(`${name} must be a number`);
  return v;
}
function asArray(v: unknown, name: string): unknown[] {
  if (!Array.isArray(v)) fail(`${name} must be an array`);
  return v;
}

const SOURCES = ['manual', 'ocr', 'video'];
const STAT_KEYS: Stat[] = ['spd', 'sta', 'pow', 'gut', 'wit'];
const RARITIES = ['white', 'gold', 'unique', 'inherited_unique'];

/** Validate + normalize an imported value into a CaptureBundle. Throws a descriptive Error otherwise. */
export function parseCaptureBundle(data: unknown): CaptureBundle {
  const root = asObject(data, 'bundle');
  if (root['schemaVersion'] !== 1) fail('schemaVersion must be 1');
  const source = asString(root['source'], 'source');
  if (!SOURCES.includes(source)) fail(`source must be one of ${SOURCES.join('|')}`);

  const ctx = asObject(root['context'], 'context');
  const statsObj = asObject(ctx['stats'], 'context.stats');
  const stats = {} as Record<Stat, number>;
  for (const k of STAT_KEYS) stats[k] = asNumber(statsObj[k], `context.stats.${k}`);

  const apt = asObject(ctx['aptitudes'], 'context.aptitudes');
  const aptitudes = {
    distance: asString(apt['distance'], 'context.aptitudes.distance') as Grade,
    surface: asString(apt['surface'], 'context.aptitudes.surface') as Grade,
    strategy: asString(apt['strategy'], 'context.aptitudes.strategy') as Grade,
  };

  const candidates: BuyableSkill[] = asArray(ctx['candidates'], 'context.candidates').map((c, i) => {
    const o = asObject(c, `context.candidates[${i}]`);
    const rarity = asString(o['rarity'], `context.candidates[${i}].rarity`);
    if (!RARITIES.includes(rarity)) fail(`context.candidates[${i}].rarity must be a skill rarity`);
    const bs: BuyableSkill = {
      skillId: asString(o['skillId'], `context.candidates[${i}].skillId`),
      rarity: rarity as SkillRarity,
      screenSpCost: asNumber(o['screenSpCost'], `context.candidates[${i}].screenSpCost`),
    };
    if (o['prereqSkillId'] !== undefined) bs.prereqSkillId = asString(o['prereqSkillId'], `context.candidates[${i}].prereqSkillId`);
    if (o['matchTier'] !== undefined) bs.matchTier = asString(o['matchTier'], `context.candidates[${i}].matchTier`) as BuyableSkill['matchTier'];
    return bs;
  });

  const context: BuildContext = {
    umaId: asString(ctx['umaId'], 'context.umaId'),
    stats,
    aptitudes,
    strategy: asString(ctx['strategy'], 'context.strategy') as Strategy,
    courseId: asString(ctx['courseId'], 'context.courseId'),
    spBudget: asNumber(ctx['spBudget'], 'context.spBudget'),
    ownedSkills: asArray(ctx['ownedSkills'], 'context.ownedSkills').map((s, i) => asString(s, `context.ownedSkills[${i}]`)),
    pinned: asArray(ctx['pinned'], 'context.pinned').map((s, i) => asString(s, `context.pinned[${i}]`)),
    candidates,
  };

  const bundle: CaptureBundle = {
    schemaVersion: 1,
    source: source as CaptureBundle['source'],
    capturedAt: asString(root['capturedAt'], 'capturedAt'),
    server: asString(root['server'], 'server') as Server,
    dataVersion: asString(root['dataVersion'], 'dataVersion'),
    context,
  };
  if (root['seed'] !== undefined) bundle.seed = asNumber(root['seed'], 'seed');
  return bundle;
}

// --- branch chooser ---

/** Above this many OPTIONAL candidates, never attempt exact (2^n) enumeration
 *  (2^16 masks is the worst-case bound on the exact branch). */
const MAX_EXACT_BITS = 16;

export interface ChooseOpts {
  /** Max feasible subsets to allow the exact (sim-everything) branch. */
  exactThreshold: number;
  shortlistLimit: number;
  minDistance: number;
}

export interface ChooseResult {
  mode: 'exact' | 'shortlist';
  /** Candidate baskets (skill-id arrays, incl. pinned) for the sim to score. */
  baskets: string[][];
}

export function chooseBasketsToScore(
  ctx: Pick<BuildContext, 'candidates' | 'spBudget' | 'pinned'>,
  deltaLById: Record<string, number>,
  opts: ChooseOpts,
): ChooseResult {
  const pinnedClosed = prereqClosure(ctx.pinned, ctx.candidates);
  // Must-buys that exceed the budget are a real, actionable state — surface the
  // forced (over-budget) basket rather than silently returning nothing.
  if (basketSpCost(pinnedClosed, ctx.candidates) > ctx.spBudget) {
    return { mode: 'exact', baskets: [pinnedClosed] };
  }
  const pinnedSet = new Set(pinnedClosed);
  const optionalCount = ctx.candidates.filter((c) => !pinnedSet.has(c.skillId)).length;
  if (optionalCount <= MAX_EXACT_BITS) {
    // Early-abort once feasible exceeds the exact-branch threshold.
    const feasible = enumerateFeasibleBaskets(ctx.candidates, ctx.spBudget, ctx.pinned, opts.exactThreshold);
    if (feasible) {
      return { mode: 'exact', baskets: feasible };
    }
  }
  return {
    mode: 'shortlist',
    baskets: shortlistByProxy(ctx.candidates, ctx.spBudget, ctx.pinned, deltaLById, {
      limit: opts.shortlistLimit,
      minDistance: opts.minDistance,
    }),
  };
}
