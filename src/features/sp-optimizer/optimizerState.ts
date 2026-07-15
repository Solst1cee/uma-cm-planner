import type { BuyableSkill, CaptureBundle } from '@/core/spOptimizer';
import { effectiveSpCost, type HintLevel } from '@/core/cost';
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
  /** Skills cycled to ✕: kept visible (dimmed) in the table, dropped from analysis. */
  excluded: Set<string>;
  costEdits: Map<string, number>;
  hintEdits: Map<string, HintLevel>;
  fastLearner: boolean;
}

/** Lock-cell cycle: blank → pinned (must buy) → excluded (never buy) → blank. Pure. */
export function cycleLockState(edits: WorkingEdits, skillId: string): WorkingEdits {
  const pins = new Set(edits.pins);
  const excluded = new Set(edits.excluded);
  if (pins.has(skillId)) {
    pins.delete(skillId);
    excluded.add(skillId);
  } else if (excluded.has(skillId)) {
    excluded.delete(skillId);
  } else {
    pins.add(skillId);
  }
  return { ...edits, pins, excluded };
}

/** All candidates with cost/hint edits applied — including excluded ones (for
 *  display). Pure (new objects). */
export function mergedCandidates(
  bundle: CaptureBundle,
  edits: WorkingEdits,
  skillById: ReadonlyMap<string, SkillRecord>,
  rates: SparkRates,
): BuyableSkill[] {
  return bundle.context.candidates.map((c) => {
    const costEdit = edits.costEdits.get(c.skillId);
    const hintEdit = edits.hintEdits.get(c.skillId);
    let screenSpCost = c.screenSpCost;
    if (costEdit !== undefined) {
      screenSpCost = costEdit;
    } else if (hintEdit !== undefined) {
      const skill = skillById.get(c.skillId);
      // Single-skill effectiveSpCost — NOT purchaseSpCost, which bundles a
      // gold's white prereq. M2 has a separate candidate row per on-screen
      // skill (the white gets its own row + its own cost), so bundling here
      // would double-count the white's cost when both are edited.
      if (skill) screenSpCost = effectiveSpCost(skill, hintEdit, rates, { fastLearner: edits.fastLearner });
    }
    return { ...c, screenSpCost, ...(hintEdit !== undefined ? { hintLevel: hintEdit } : {}) };
  });
}

/** Merge working edits into a fresh analysis bundle: pins → context.pinned;
 *  per-candidate screenSpCost = cost edit ?? hint-repriced ?? captured;
 *  excluded skills dropped entirely (from candidates AND pins). Pure. */
export function applyWorkingState(
  bundle: CaptureBundle,
  edits: WorkingEdits,
  skillById: ReadonlyMap<string, SkillRecord>,
  rates: SparkRates,
): CaptureBundle {
  const candidates = mergedCandidates(bundle, edits, skillById, rates)
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
