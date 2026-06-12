/**
 * Module 4 core — pure coverage functions (plan §6, build steps 1–3 scope).
 * No deck suggester, no sparkChance — those are Phase 2.
 *
 * Operates strictly on the lists it is given; server filtering (P4) and
 * overrides merging (P5) happen upstream in the data layer.
 */
import type {
  CardSkill,
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
  owned: OwnedCard,
  sourceType: SkillSourceType,
): CoverageSource {
  const lb = owned.limitBreak;
  // Every card-derived source carries the owning inventory copy's identity
  // (ownedId, when persisted) and limitBreak, so duplicate copies of the same
  // cardId never show each other's tiers or feed the wrong LB into SP
  // estimates (review 2026-06-12: duplicate-copy attribution).
  const copy: Pick<CoverageSource, 'cardId' | 'ownedId' | 'limitBreak'> = {
    cardId: card.cardId,
    ...(owned.id !== undefined ? { ownedId: owned.id } : {}),
    limitBreak: lb,
  };
  switch (sourceType) {
    case 'chain':
      return { kind: 'chain', ...copy };
    case 'date_event':
      return { kind: 'date_event', ...copy };
    case 'random_event':
      return { kind: 'random', ...copy };
    case 'hint_pool': {
      const perLevel = card.perLevel.find((p) => p.limitBreak === lb);
      return {
        kind: classifyHintTier(card, lb),
        ...copy,
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
            sources.push(cardSource(card, owned, cardSkill.sourceType));
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
 * Expected hint level a coverage source contributes when the user buys the
 * skill — feeds effectiveSpCost/bundledSpCost for the UI's SP estimate.
 *
 * Model, per source kind:
 *
 * - 'hint_strong' / 'hint_weak' (training hints): base level per hint take is
 *   the skill's master.mdb `single_mode_hint_gain.hint_value_2`
 *   (CardSkill.hintLevels — currently 1 on every Global hint_gain_type=0 row,
 *   verified against master.mdb v10006400, 2026-06-12), plus the card's Hint
 *   Levels passive (effect 17, mechanics-notes §9) evaluated at the OWNING
 *   COPY's limit break (source.limitBreak), clamped to the game's 0–5 range.
 *
 * - 'chain' / 'date_event' / 'random' / 'scenario' (and 'spark'/'uncovered'):
 *   returns 0, i.e. estimate FULL SP cost. Event rewards carry their own
 *   per-event hint levels which are embedded in unparsed reward strings
 *   (provenance §3 open item 3), and no source supports applying the
 *   effect-17 training-hint passive to event grants — that extension was an
 *   unsourced heuristic (review 2026-06-12). Until the in-game verification
 *   queue resolves it (mechanics-notes §10; P3 honest numbers), the UI shows
 *   full cost with a caveat rather than a fabricated discount.
 *
 * Pure and total: missing card / perLevel row / skill metadata degrade to the
 * 0-passive / base-1 defaults rather than throwing.
 */
export function expectedHintLevel(
  source: CoverageSource,
  card: SupportCardRecord | undefined,
  skill: CardSkill | undefined,
): HintLevel {
  if (source.kind !== 'hint_strong' && source.kind !== 'hint_weak') return 0;
  // Base hint levels granted per take (master.mdb hint_value_2; default 1).
  const base = skill?.hintLevels ?? 1;
  // Hint Levels passive (effect 17) at the owning copy's limit break.
  const perLevel = card?.perLevel.find((p) => p.limitBreak === source.limitBreak);
  const passive = perLevel?.hintLevels ?? 0;
  return Math.min(5, Math.max(0, Math.floor(base + passive))) as HintLevel;
}

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
