/**
 * Module 4 core — pure coverage functions (plan §6, build steps 1–4).
 * Phase 2 added the parents/spark dimension (sparkChance lives in spark.ts;
 * deck suggester in deck.ts; contingency view in contingency.ts).
 *
 * Operates strictly on the lists it is given; server filtering (P4) and
 * overrides merging (P5) happen upstream in the data layer.
 */
import { sparkChance } from '@/core/spark';
// Back-compat: existing importers of these from '@/core/coverage' keep working.
export { expectedHintLevel, effectiveSpCost, bundledSpCost } from '@/core/cost';
export type { HintLevel } from '@/core/cost';
import type {
  CmPlan,
  CoverageRow,
  CoverageSource,
  LimitBreak,
  OwnedCard,
  Parent,
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

/**
 * Tier a card grants for one of its skills, at the owned copy's LB. The single
 * sourceType → Tier mapping — shared with the deck suggester's scoring.
 */
export function tierForCardSkill(
  card: SupportCardRecord,
  lb: LimitBreak,
  sourceType: SkillSourceType,
): Tier {
  switch (sourceType) {
    case 'chain':
      return 'chain';
    case 'date_event':
      return 'date_event';
    case 'random_event':
      return 'random';
    case 'hint_pool':
      return classifyHintTier(card, lb);
  }
}

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
  const kind = tierForCardSkill(card, lb, sourceType);
  if (sourceType === 'hint_pool') {
    const perLevel = card.perLevel.find((p) => p.limitBreak === lb);
    return {
      kind,
      ...copy,
      // P3 evidence for the tier chip's detail popover.
      detail: {
        hintPoolSize: card.hintPoolSize,
        hintFrequency: perLevel?.hintFrequency ?? 0,
        specialtyPriority: perLevel?.specialtyPriority ?? 0,
      },
    };
  }
  return { kind, ...copy };
}

/** Round to 1 decimal place — the display precision for spark % (P3). */
function round1(pct: number): number {
  return Math.round(pct * 10) / 10;
}

/**
 * One 'spark' CoverageSource per parent whose lineage branch can grant the
 * skill. sparkPct is that branch's combined whole-career chance (parent spark
 * + that parent's grandparents' sparks), rounded to 1dp; detail describes the
 * branch's strongest single contribution (highest pct; parent-held wins ties).
 */
function sparkSources(
  parents: Parent[],
  skillId: string,
  rates: SparkRates,
  skillRarity: ReadonlyMap<string, SkillRecord['rarity']>,
): CoverageSource[] {
  const sources: CoverageSource[] = [];
  for (const parent of parents) {
    // Pass the rarity lookup so a gold/unique whiteSparks entry is not priced
    // as a white spark (mechanics-notes §8; review finding "Gold skills priced
    // as white sparks"). Without it sparkChance would fabricate a percent.
    const result = sparkChance({ parents: [parent], skillId, rates, opts: { skillRarity } });
    const best = [...result.contributions].sort(
      (a, b) => b.pct - a.pct || Number(a.grandparent) - Number(b.grandparent),
    )[0];
    if (!best) continue; // this parent's branch holds no matching spark
    sources.push({
      kind: 'spark',
      parentId: parent.id,
      sparkPct: round1(result.pct),
      approximate: result.approximate,
      detail: {
        sparkStars: best.stars,
        grandparent: best.grandparent,
        affinityUsed: best.affinityUsed,
      },
    });
  }
  return sources;
}

/**
 * Combined whole-career spark % across a row's 'spark' sources (independent
 * branches: 1 − Π(1 − pct/100)). Operates on the already-1dp-rounded
 * per-source sparkPct values — the UI's "all parents together" number, not a
 * re-derivation. Non-spark sources are ignored; returns 0 when none. 1dp.
 *
 * BACK-COMPAT chip variant: this re-combines per-source CHIPS that were each
 * rounded to 1dp, so it can drift from a single raw-float pass across many
 * parents (review finding: "combinedSparkPct double-rounds"). For the precise
 * "all parents together" figure prefer spark.ts `combinedSparkChance`, which
 * rounds ONCE over raw floats. Kept here for callers that only have the
 * rounded CoverageSource chips (e.g. a row already built without the parents).
 */
export function combinedSparkPct(sources: CoverageSource[]): number {
  let missAll = 1;
  for (const source of sources) {
    if (source.kind !== 'spark' || source.sparkPct === undefined) continue;
    missAll *= 1 - source.sparkPct / 100;
  }
  return round1((1 - missAll) * 100);
}

/**
 * One CoverageRow per plan.targetSkills entry (1–7+, variable length),
 * in priority order — stable for equal priority. Scans ONLY owned cards.
 * Never throws on unknown ids: unknown inventory cardIds are skipped,
 * unknown target skillIds still emit an (uncovered) row for the UI.
 *
 * Phase 2: pass `parents` (the plan's resolved chosen parents) AND `rates`
 * to add 'spark' tier sources — one per parent branch that can grant the
 * target (see sparkSources). Spark sources rank below 'random' (Tier order).
 * They are emitted even for skillIds missing from the dataset: the parent's
 * recorded spark is itself the evidence, no SkillRecord needed.
 */
export function buildCoverageMatrix(args: {
  plan: CmPlan;
  inventory: OwnedCard[];
  cards: SupportCardRecord[];
  skills: SkillRecord[];
  parents?: Parent[];
  /** Required for spark math; without it parents are ignored. */
  rates?: SparkRates;
}): CoverageRow[] {
  const { plan, inventory, cards, skills, parents, rates } = args;
  const skillById = new Map(skills.map((s) => [s.skillId, s]));
  const cardById = new Map(cards.map((c) => [c.cardId, c]));
  // skillId → rarity, so sparkSources can gate white-spark pricing (finding 2).
  const rarityById = new Map(skills.map((s) => [s.skillId, s.rarity]));

  // Array.prototype.sort is stable (ES2019+): insertion order breaks ties.
  const targets = [...plan.wishlist].sort((a, b) => a.priority - b.priority);

  return targets.map((target): CoverageRow => {
    const sources: CoverageSource[] = [];
    const skill = skillById.get(target.skillId);

    if (skill) {
      // Scenario-exclusive skill, coverable only when the plan runs that
      // scenario (plan §6 scenario dimension); no card needed.
      if (skill.scenarioId !== undefined && skill.scenarioId === plan.scenarioId) {
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

    if (parents && rates) {
      sources.push(...sparkSources(parents, target.skillId, rates, rarityById));
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
// SP cost (hint discount) — moved to src/core/cost.ts
// Back-compat re-exports are at the top of this file (import block).
// ---------------------------------------------------------------------------
