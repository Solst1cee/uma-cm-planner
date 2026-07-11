import type { BuyableSkill, CaptureBundle } from '@/core/spOptimizer';
import { effectiveSpCost, type HintLevel } from '@/core/cost';
import type { SkillRecord, SparkRates } from '@/core/types';
import type { RankResult } from '@/features/sp-optimizer/rankBaskets';

export interface WorkingEdits {
  pins: Set<string>;
  costEdits: Map<string, number>;
  hintEdits: Map<string, HintLevel>;
  fastLearner: boolean;
}

/** Merge working edits into a fresh bundle: pins → context.pinned; per-candidate
 *  screenSpCost = cost edit ?? hint-repriced ?? captured. Pure (new objects). */
export function applyWorkingState(
  bundle: CaptureBundle,
  edits: WorkingEdits,
  skillById: ReadonlyMap<string, SkillRecord>,
  rates: SparkRates,
): CaptureBundle {
  const candidates: BuyableSkill[] = bundle.context.candidates.map((c) => {
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
  return {
    ...bundle,
    context: { ...bundle.context, candidates, pinned: [...edits.pins] },
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
