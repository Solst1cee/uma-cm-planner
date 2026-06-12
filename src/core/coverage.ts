/**
 * Module 4 core — pure coverage functions (plan §6, build steps 1–3 scope).
 * No deck suggester, no sparkChance — those are Phase 2.
 *
 * Operates strictly on the lists it is given; server filtering (P4) and
 * overrides merging (P5) happen upstream in the data layer.
 */
import type {
  CmPlan,
  CoverageRow,
  CoverageSource,
  LimitBreak,
  OwnedCard,
  SkillRecord,
  SkillSourceType,
  SparkRates,
  SupportCardRecord,
  Tier,
} from '@/core/types';

// ---------------------------------------------------------------------------
// Tier ordering
// ---------------------------------------------------------------------------

/**
 * Reliability rank, best (0) → worst. Mirrors the Tier union order in
 * types.ts (plan §6 mechanics basis: source reliability ordering).
 * Record form so adding a Tier member is a compile error here.
 */
const TIER_RANK: Record<Tier, number> = {
  chain: 0,
  scenario: 1,
  date_event: 2,
  hint_strong: 3,
  hint_weak: 4,
  random: 5,
  spark: 6,
  uncovered: 7,
};

/** Lower = more reliable. Exposed for UI sorting/coloring. */
export function tierRank(tier: Tier): number {
  return TIER_RANK[tier];
}

// ---------------------------------------------------------------------------
// Hint tier heuristic
// ---------------------------------------------------------------------------

/**
 * Heuristic thresholds for classifying a card's hint reliability
 * (plan §6: reliability ∝ hintFrequency, ∝ 1/hintPoolSize; pools range
 * ~4–14). Single tunable place — retune freely as real-deck feedback lands;
 * this is a qualitative tier, not a probability (P3).
 */
export const HINT_TIER_THRESHOLDS: {
  /** hint_strong needs hintFrequency at the owned LB >= this... */
  strongMinHintFrequency: number;
  /** ...AND a hint pool no bigger than this. Otherwise hint_weak. */
  strongMaxHintPoolSize: number;
} = {
  strongMinHintFrequency: 20,
  strongMaxHintPoolSize: 8,
};

export function classifyHintTier(
  card: SupportCardRecord,
  lb: LimitBreak,
): 'hint_strong' | 'hint_weak' {
  const perLevel = card.perLevel.find((p) => p.limitBreak === lb);
  // Missing perLevel row = malformed data; degrade to weak rather than throw.
  const hintFrequency = perLevel?.hintFrequency ?? 0;
  const strong =
    hintFrequency >= HINT_TIER_THRESHOLDS.strongMinHintFrequency &&
    card.hintPoolSize <= HINT_TIER_THRESHOLDS.strongMaxHintPoolSize;
  return strong ? 'hint_strong' : 'hint_weak';
}

// ---------------------------------------------------------------------------
// Coverage matrix
// ---------------------------------------------------------------------------

function cardSource(
  card: SupportCardRecord,
  lb: LimitBreak,
  sourceType: SkillSourceType,
): CoverageSource {
  switch (sourceType) {
    case 'chain':
      return { kind: 'chain', cardId: card.cardId };
    case 'date_event':
      return { kind: 'date_event', cardId: card.cardId };
    case 'random_event':
      return { kind: 'random', cardId: card.cardId };
    case 'hint_pool': {
      const perLevel = card.perLevel.find((p) => p.limitBreak === lb);
      return {
        kind: classifyHintTier(card, lb),
        cardId: card.cardId,
        // P3 evidence for the tier chip's detail popover.
        detail: {
          hintPoolSize: card.hintPoolSize,
          hintFrequency: perLevel?.hintFrequency ?? 0,
          specialtyPriority: perLevel?.specialtyPriority ?? 0,
        },
      };
    }
  }
}

/**
 * One CoverageRow per plan.targetSkills entry (1–7+, variable length),
 * in priority order — stable for equal priority. Scans ONLY owned cards.
 * Never throws on unknown ids: unknown inventory cardIds are skipped,
 * unknown target skillIds still emit an (uncovered) row for the UI.
 */
export function buildCoverageMatrix(args: {
  plan: CmPlan;
  inventory: OwnedCard[];
  cards: SupportCardRecord[];
  skills: SkillRecord[];
}): CoverageRow[] {
  const { plan, inventory, cards, skills } = args;
  const skillById = new Map(skills.map((s) => [s.skillId, s]));
  const cardById = new Map(cards.map((c) => [c.cardId, c]));

  // Array.prototype.sort is stable (ES2019+): insertion order breaks ties.
  const targets = [...plan.targetSkills].sort((a, b) => a.priority - b.priority);

  return targets.map((target): CoverageRow => {
    const sources: CoverageSource[] = [];
    const skill = skillById.get(target.skillId);

    if (skill) {
      // Scenario-exclusive skill, coverable only when the plan runs that
      // scenario (plan §6 scenario dimension); no card needed.
      if (skill.scenarioId !== undefined && skill.scenarioId === plan.scenario.id) {
        sources.push({ kind: 'scenario' });
      }
      for (const owned of inventory) {
        const card = cardById.get(owned.cardId);
        if (!card) continue;
        for (const cardSkill of card.skills) {
          if (cardSkill.skillId === target.skillId) {
            sources.push(cardSource(card, owned.limitBreak, cardSkill.sourceType));
          }
        }
      }
    }

    sources.sort((a, b) => tierRank(a.kind) - tierRank(b.kind)); // best first
    return {
      skillId: target.skillId,
      priority: target.priority,
      sources,
      bestTier: sources[0]?.kind ?? 'uncovered',
    };
  });
}

// ---------------------------------------------------------------------------
// SP cost (hint discount) — feeds Module 2
// ---------------------------------------------------------------------------

export type HintLevel = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Cumulative discount fraction at a hint level. Schedule is cumulative
 * [10,20,30,35,40]% at Lv1–5, cap 40% (mechanics-notes §7, CONFIRMED).
 */
function hintDiscountFraction(level: HintLevel, rates: SparkRates): number {
  if (level === 0) return 0;
  return (rates.hintDiscountCumulativePct[level - 1] ?? 0) / 100;
}

/** Discounted cost BEFORE rounding — components are summed pre-ceil when bundling. */
function discountedComponent(
  skill: SkillRecord,
  level: HintLevel,
  rates: SparkRates,
  opts?: { fastLearner?: boolean },
): number {
  // Fast Learner (切れ者) is a further multiplicative ×0.9 (mechanics-notes §7).
  const fastLearner = opts?.fastLearner ? rates.fastLearnerMultiplier : 1;
  return skill.baseSpCost * (1 - hintDiscountFraction(level, rates)) * fastLearner;
}

/**
 * SP cost after hint discount and optional Fast Learner. Rounding: CEIL
 * after the multiply — umalator-global cost-calculator behavior; ceil vs
 * floor is the open in-game rounding question in mechanics-notes §7, we
 * encode ceil.
 */
export function effectiveSpCost(
  skill: SkillRecord,
  expectedHintLevel: HintLevel,
  rates: SparkRates,
  opts?: { fastLearner?: boolean },
): number {
  return Math.ceil(discountedComponent(skill, expectedHintLevel, rates, opts));
}

/**
 * Gold skill + its white prereq bought together: sum both discounted
 * components BEFORE a single ceil (umalator cost-calculator behavior,
 * mechanics-notes §7) — can be 1 SP under ceiling each part separately.
 */
export function bundledSpCost(
  gold: SkillRecord,
  whitePrereq: SkillRecord,
  hintLevelGold: HintLevel,
  hintLevelWhite: HintLevel,
  rates: SparkRates,
  opts?: { fastLearner?: boolean },
): number {
  return Math.ceil(
    discountedComponent(gold, hintLevelGold, rates, opts) +
      discountedComponent(whitePrereq, hintLevelWhite, rates, opts),
  );
}
