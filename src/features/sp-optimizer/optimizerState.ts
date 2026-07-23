import { prereqClosure, type BuyableSkill, type CaptureBundle } from '@/core/spOptimizer';
import type { HintLevel } from '@/core/cost';
import type { SkillRecord, SparkRates, WishlistItem } from '@/core/types';
import type { RankResult } from '@/features/sp-optimizer/rankBaskets';

export interface PlanMatch {
  /** Wishlist skills present on the buyable screen — auto-lock these. */
  lockedIds: string[];
  lockedNames: string[];
  matched: number;
  /** Wishlist skills NOT on the buyable screen this run. */
  notBuyable: number;
}

/** Handoff "Load uma plan" semantic: the plan's wishlist prefills 🔒 locks on
 *  the CURRENT capture's buyable table — it never replaces the capture. Pure. */
export function planMatch(
  wishlist: readonly WishlistItem[],
  candidates: readonly BuyableSkill[],
  skillById: ReadonlyMap<string, SkillRecord>,
): PlanMatch {
  const onScreen = new Set(candidates.map((c) => c.skillId));
  const lockedIds = wishlist.map((w) => w.skillId).filter((id) => onScreen.has(id));
  return {
    lockedIds,
    lockedNames: lockedIds.map((id) => skillById.get(id)?.nameEn ?? id),
    matched: lockedIds.length,
    notBuyable: wishlist.length - lockedIds.length,
  };
}

export interface WorkingEdits {
  pins: Set<string>;
  /** Skills cycled to ✕: kept visible (greyed) in the table, dropped from analysis. */
  excluded: Set<string>;
  hintEdits: Map<string, HintLevel>;
  fastLearner: boolean;
}

/** Candidates whose purchase chain (transitive prereqs) passes through `skillId`. */
function dependentsOf(skillId: string, candidates: readonly BuyableSkill[]): string[] {
  return candidates
    .filter((c) => c.skillId !== skillId && prereqClosure([c.skillId], [...candidates]).includes(skillId))
    .map((c) => c.skillId);
}

/** Lock-cell cycle: blank → pinned (must buy) → excluded (never buy) → blank.
 *  Chain-aware: pinning a ◎/gold locks its whole purchase chain (the game
 *  sells them as upgrades on the base skill); excluding a base also excludes
 *  everything that needs it. Pure. */
export function cycleLockState(
  edits: WorkingEdits,
  skillId: string,
  candidates: readonly BuyableSkill[],
): WorkingEdits {
  const pins = new Set(edits.pins);
  const excluded = new Set(edits.excluded);
  if (pins.has(skillId)) {
    for (const id of [skillId, ...dependentsOf(skillId, candidates)]) {
      pins.delete(id);
      excluded.add(id);
    }
  } else if (excluded.has(skillId)) {
    excluded.delete(skillId);
  } else {
    for (const id of prereqClosure([skillId], [...candidates])) {
      pins.add(id);
      excluded.delete(id);
    }
  }
  return { ...edits, pins, excluded };
}

/** Reprice a candidate at a new hint level (+ optional Fast Learner) from its
 *  SCREEN-IMPLIED base — screenSpCost ÷ its captured hint discount — never the
 *  datasheet base. The captured screen cost is ground truth (gold on-screen
 *  costs don't match stored baseSpCost; mechanics-notes §10 item 8), and with
 *  cost no longer hand-editable this is the only way a captured number
 *  survives round-tripping the stepper. At the captured hint with FL off the
 *  screen cost is returned verbatim. Pure. */
export function repricedCost(
  candidate: BuyableSkill,
  hint: HintLevel,
  fastLearner: boolean,
  rates: SparkRates,
): number {
  const capturedHint = (candidate.hintLevel ?? 0) as HintLevel;
  if (hint === capturedHint && !fastLearner) return candidate.screenSpCost;
  const pct = (h: HintLevel): number => (h === 0 ? 0 : rates.hintDiscountCumulativePct[h - 1] ?? 0);
  const impliedBase = (candidate.screenSpCost * 100) / (100 - pct(capturedHint));
  // FL stacks additively with the hint discount (verified; core cost.ts).
  const discountPct = pct(hint) + (fastLearner ? 10 : 0);
  // Epsilon guards float noise from the base division bumping the ceil.
  return Math.ceil((impliedBase * (100 - discountPct)) / 100 - 1e-9);
}

/** All candidates with hint/Fast-Learner repricing applied — including
 *  excluded ones (for display). A row is repriced when its hint level was
 *  stepped OR Fast Learner is toggled on; an untouched row keeps the captured
 *  screen cost (the screen already reflects the uma's real discounts). Pure
 *  (new objects). */
export function mergedCandidates(
  bundle: CaptureBundle,
  edits: WorkingEdits,
  rates: SparkRates,
): BuyableSkill[] {
  return bundle.context.candidates.map((c) => {
    const hintEdit = edits.hintEdits.get(c.skillId);
    let screenSpCost = c.screenSpCost;
    if (hintEdit !== undefined || edits.fastLearner) {
      // Single-row repricing — never purchaseSpCost bundling; M2 has a
      // separate candidate row per on-screen skill.
      screenSpCost = repricedCost(c, (hintEdit ?? c.hintLevel ?? 0) as HintLevel, edits.fastLearner, rates);
    }
    return { ...c, screenSpCost, ...(hintEdit !== undefined ? { hintLevel: hintEdit } : {}) };
  });
}

/** Merge working edits into a fresh analysis bundle: pins → context.pinned;
 *  per-candidate screenSpCost = hint/Fast-Learner repriced ?? captured;
 *  excluded skills dropped entirely (from candidates AND pins). Pure. */
export function applyWorkingState(
  bundle: CaptureBundle,
  edits: WorkingEdits,
  rates: SparkRates,
): CaptureBundle {
  const candidates = mergedCandidates(bundle, edits, rates)
    .filter((c) => !edits.excluded.has(c.skillId));
  const pinned = [...edits.pins].filter((id) => !edits.excluded.has(id));
  return {
    ...bundle,
    context: { ...bundle.context, candidates, pinned },
  };
}

/** Buy = selected basket's skills; cut = every other candidate. */
export function basketBuyCut(
  result: RankResult,
  selectedIdx: number,
): { buy: Set<string>; cut: Set<string>; spUsed: number } {
  const basket = result.baskets[selectedIdx] ?? result.baskets[0];
  const buy = new Set(basket?.skills ?? []);
  const cut = new Set(result.candidates.map((c) => c.skillId).filter((id) => !buy.has(id)));
  return { buy, cut, spUsed: basket?.spUsed ?? 0 };
}
