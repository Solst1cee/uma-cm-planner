// SP-cost + hint-discount model — shared by M4 coverage and (future) M2 spOptimizer
// (shared-data-model §7: "one cost module"). Extracted from coverage.ts.
import type { SkillRecord, SparkRates, SupportCardRecord, CardSkill, CoverageSource } from '@/core/types';

export type HintLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** Hint level for a hinted source: card effect-17 passive (at the owning copy's LB) + base. */
export function expectedHintLevel(
  source: CoverageSource,
  card: SupportCardRecord | undefined,
  skill: CardSkill | undefined,
): HintLevel {
  if (source.kind !== 'hint_strong' && source.kind !== 'hint_weak') return 0;
  const base = skill?.hintLevels ?? 1;
  const perLevel = card?.perLevel.find((p) => p.limitBreak === source.limitBreak);
  const passive = perLevel?.hintLevels ?? 0;
  return Math.min(5, Math.max(0, Math.floor(base + passive))) as HintLevel;
}

/** Cumulative hint discount fraction [10,20,30,35,40]% at Lv1–5; 0 at Lv0. */
export function hintDiscountFraction(level: HintLevel, rates: SparkRates): number {
  if (level === 0) return 0;
  return (rates.hintDiscountCumulativePct[level - 1] ?? 0) / 100;
}

/**
 * Discounted (pre-ceil) cost. Fast Learner (切れ者) stacks ADDITIVELY with the hint discount —
 * hint% + 10%, a single multiply (mechanics-notes §7/§10 item 7). Verified by a real Global
 * screenshot (2026-06-15, spikes/ocr/): at Hint Lv1 + FL, base 160→128, 200→160 (×0.8), NOT
 * ×0.81. The old multiplicative `× rates.fastLearnerMultiplier` was wrong.
 */
export function discountedComponent(
  skill: SkillRecord,
  level: HintLevel,
  rates: SparkRates,
  opts?: { fastLearner?: boolean },
): number {
  const discount = hintDiscountFraction(level, rates) + (opts?.fastLearner ? 0.1 : 0);
  return skill.baseSpCost * (1 - discount);
}

/** Effective single-skill SP cost (ceil after discount). */
export function effectiveSpCost(
  skill: SkillRecord,
  expectedHintLevelValue: HintLevel,
  rates: SparkRates,
  opts?: { fastLearner?: boolean },
): number {
  return Math.ceil(discountedComponent(skill, expectedHintLevelValue, rates, opts));
}

/** Gold + its white prerequisite, summed before one ceil (gold bundles its white). */
export function bundledSpCost(
  gold: SkillRecord,
  whitePrereq: SkillRecord,
  hintLevelGold: HintLevel,
  hintLevelWhite: HintLevel,
  rates: SparkRates,
  opts?: { fastLearner?: boolean },
): number {
  // TODO (mechanics-notes §10 item 8): gold's on-screen cost is ~2× its white-equivalent base
  // (the 2× lives in derivation, not stored baseSpCost). bundle-vs-flat-×2 unresolved — this keeps
  // the current gold+white sum (no ×2) until a disambiguating screenshot settles it.
  return Math.ceil(
    discountedComponent(gold, hintLevelGold, rates, opts) +
      discountedComponent(whitePrereq, hintLevelWhite, rates, opts),
  );
}
