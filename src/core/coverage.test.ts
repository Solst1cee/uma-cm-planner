/**
 * Tests for the Module 4 coverage core. Mechanics assertions cite
 * docs/mechanics-notes.md §7 (hint SP discount schedule, retrieved 2026-06-12).
 */
import { describe, expect, it } from 'vitest';

import {
  HINT_TIER_THRESHOLDS,
  buildCoverageMatrix,
  classifyHintTier,
  combinedSparkPct,
  tierRank,
} from '@/core/coverage';
import { bundledSpCost, effectiveSpCost, expectedHintLevel } from '@/core/cost';
import {
  FIXTURE_CARDS,
  FIXTURE_PLAN,
  FIXTURE_SKILLS,
  FIXTURE_SPARK_RATES,
} from '@/core/fixtures';
import type {
  CmPlan,
  CoverageSource,
  LimitBreak,
  Parent,
  SkillRecord,
  SupportCardRecord,
} from '@/core/types';

// --- test helpers ----------------------------------------------------------

function getSkill(skillId: string): SkillRecord {
  const skill = FIXTURE_SKILLS.find((s) => s.skillId === skillId);
  if (!skill) throw new Error(`fixture skill ${skillId} missing`);
  return skill;
}

function makePlan(overrides: Partial<CmPlan>): CmPlan {
  return { ...FIXTURE_PLAN, ...overrides };
}

/** Minimal synthetic card: same hint stats at every LB unless given per-LB. */
function makeCard(args: {
  cardId?: string;
  hintFrequency: number | [number, number, number, number, number];
  hintPoolSize: number;
  skills?: SupportCardRecord['skills'];
}): SupportCardRecord {
  const freq = (lb: LimitBreak): number =>
    typeof args.hintFrequency === 'number' ? args.hintFrequency : args.hintFrequency[lb];
  return {
    cardId: args.cardId ?? '99001',
    nameEn: '[Synthetic]',
    charName: 'Test Uma',
    rarity: 'SR',
    type: 'speed',
    perLevel: ([0, 1, 2, 3, 4] as const).map((lb) => ({
      limitBreak: lb,
      hintFrequency: freq(lb),
      hintLevels: 1,
      specialtyPriority: 0,
    })),
    skills: args.skills ?? [],
    hintPoolSize: args.hintPoolSize,
    server: 'global',
    dataVersion: 'test',
  };
}

const KITASAN = { cardId: '30028', limitBreak: 4 as LimitBreak };
const TAZUNA = { cardId: '30016', limitBreak: 4 as LimitBreak };
const R_EXAMPLE = { cardId: '10001', limitBreak: 4 as LimitBreak };

// --- classifyHintTier ------------------------------------------------------

describe('classifyHintTier', () => {
  const kitasan = FIXTURE_CARDS[0];
  const rExample = FIXTURE_CARDS[2];

  it('classifies Kitasan (high frequency, small pool) hint_strong at every LB', () => {
    if (!kitasan) throw new Error('fixture card missing');
    expect(classifyHintTier(kitasan, 0)).toBe('hint_strong'); // freq 30, pool 2
    expect(classifyHintTier(kitasan, 4)).toBe('hint_strong'); // freq 40, pool 2
  });

  it('classifies the R card (low frequency, 12-skill pool) hint_weak even at LB4', () => {
    if (!rExample) throw new Error('fixture card missing');
    expect(classifyHintTier(rExample, 4)).toBe('hint_weak'); // freq 15, pool 12
  });

  it('is strong exactly at both thresholds (freq >= 20 AND pool <= 8)', () => {
    const at = makeCard({
      hintFrequency: HINT_TIER_THRESHOLDS.strongMinHintFrequency,
      hintPoolSize: HINT_TIER_THRESHOLDS.strongMaxHintPoolSize,
    });
    expect(classifyHintTier(at, 0)).toBe('hint_strong');
  });

  it('is weak just under the frequency threshold', () => {
    const under = makeCard({
      hintFrequency: HINT_TIER_THRESHOLDS.strongMinHintFrequency - 1,
      hintPoolSize: HINT_TIER_THRESHOLDS.strongMaxHintPoolSize,
    });
    expect(classifyHintTier(under, 0)).toBe('hint_weak');
  });

  it('is weak just over the pool-size threshold', () => {
    const over = makeCard({
      hintFrequency: HINT_TIER_THRESHOLDS.strongMinHintFrequency,
      hintPoolSize: HINT_TIER_THRESHOLDS.strongMaxHintPoolSize + 1,
    });
    expect(classifyHintTier(over, 0)).toBe('hint_weak');
  });

  it('depends on the owned LB when frequency crosses the threshold per level', () => {
    const grows = makeCard({ hintFrequency: [10, 14, 18, 22, 26], hintPoolSize: 4 });
    expect(classifyHintTier(grows, 0)).toBe('hint_weak');
    expect(classifyHintTier(grows, 3)).toBe('hint_strong');
  });

  it('degrades to hint_weak when the perLevel row for the LB is missing', () => {
    const card = makeCard({ hintFrequency: 40, hintPoolSize: 2 });
    card.perLevel = card.perLevel.filter((p) => p.limitBreak !== 4);
    expect(classifyHintTier(card, 4)).toBe('hint_weak');
  });
});

// --- buildCoverageMatrix ---------------------------------------------------

describe('buildCoverageMatrix', () => {
  const baseArgs = { cards: FIXTURE_CARDS, skills: FIXTURE_SKILLS };

  it('covers the fixture plan with Kitasan: chain / random / scenario', () => {
    const rows = buildCoverageMatrix({ ...baseArgs, plan: FIXTURE_PLAN, inventory: [KITASAN] });

    expect(rows.map((r) => r.skillId)).toEqual(['200331', '200014', '210061']); // priority order
    // 200331 is Kitasan's chain skill.
    expect(rows[0]?.bestTier).toBe('chain');
    expect(rows[0]?.sources).toEqual([{ kind: 'chain', cardId: '30028', limitBreak: 4 }]);
    // 200014 is only a random (non-chain) event on Kitasan.
    expect(rows[1]?.bestTier).toBe('random');
    expect(rows[1]?.sources).toEqual([{ kind: 'random', cardId: '30028', limitBreak: 4 }]);
    // 210061 is scenario-exclusive (scenarioId 4 === plan.scenario.id 4): no card needed.
    expect(rows[2]?.bestTier).toBe('scenario');
    expect(rows[2]?.sources).toEqual([{ kind: 'scenario' }]);
  });

  it('drops the scenario source when the plan runs a different scenario', () => {
    const plan = makePlan({ scenario: { id: 1, isDefault: false } });
    const rows = buildCoverageMatrix({ ...baseArgs, plan, inventory: [KITASAN] });
    expect(rows[2]?.skillId).toBe('210061');
    expect(rows[2]?.bestTier).toBe('uncovered');
    expect(rows[2]?.sources).toEqual([]);
  });

  it('marks a target with no owner sources uncovered', () => {
    const plan = makePlan({ targetSkills: [{ skillId: '900021', priority: 1 }] });
    const rows = buildCoverageMatrix({ ...baseArgs, plan, inventory: [KITASAN] });
    expect(rows).toEqual([
      { skillId: '900021', priority: 1, sources: [], bestTier: 'uncovered' },
    ]);
  });

  it('skips unknown inventory cardIds gracefully', () => {
    const plan = makePlan({ targetSkills: [{ skillId: '200331', priority: 1 }] });
    const rows = buildCoverageMatrix({
      ...baseArgs,
      plan,
      inventory: [{ cardId: '99999', limitBreak: 4 }],
    });
    expect(rows[0]?.bestTier).toBe('uncovered');
  });

  it('emits an uncovered row for a target skillId missing from the dataset', () => {
    const plan = makePlan({
      targetSkills: [
        { skillId: '123456', priority: 1 }, // not in FIXTURE_SKILLS
        { skillId: '200331', priority: 2 },
      ],
    });
    const rows = buildCoverageMatrix({ ...baseArgs, plan, inventory: [KITASAN] });
    expect(rows[0]).toEqual({ skillId: '123456', priority: 1, sources: [], bestTier: 'uncovered' });
    expect(rows[1]?.bestTier).toBe('chain');
  });

  it('picks the best tier across sources and sorts sources best-first', () => {
    // 200012: hint on Kitasan (strong), date event on Tazuna — date_event wins.
    const plan = makePlan({ targetSkills: [{ skillId: '200012', priority: 1 }] });
    const rows = buildCoverageMatrix({ ...baseArgs, plan, inventory: [KITASAN, TAZUNA] });
    expect(rows[0]?.bestTier).toBe('date_event');
    expect(rows[0]?.sources.map((s) => s.kind)).toEqual(['date_event', 'hint_strong']);
    expect(tierRank('date_event')).toBeLessThan(tierRank('hint_strong'));
  });

  it('fills hint detail (pool size, frequency, specialty priority) at the owned LB', () => {
    const plan = makePlan({ targetSkills: [{ skillId: '200332', priority: 1 }] });
    const rows = buildCoverageMatrix({ ...baseArgs, plan, inventory: [R_EXAMPLE] });
    expect(rows[0]?.bestTier).toBe('hint_weak');
    expect(rows[0]?.sources).toEqual([
      {
        kind: 'hint_weak',
        cardId: '10001',
        limitBreak: 4,
        detail: { hintPoolSize: 12, hintFrequency: 15, specialtyPriority: 35 },
      },
    ]);
  });

  it('emits one source per owned copy (different LBs can differ in tier detail)', () => {
    const plan = makePlan({ targetSkills: [{ skillId: '200332', priority: 1 }] });
    const rows = buildCoverageMatrix({
      ...baseArgs,
      plan,
      inventory: [
        { cardId: '30028', limitBreak: 0 },
        { cardId: '30028', limitBreak: 4 },
      ],
    });
    expect(rows[0]?.sources).toHaveLength(2);
    expect(rows[0]?.sources.map((s) => s.detail?.hintFrequency)).toEqual([30, 40]);
  });

  it('attributes each card-derived source to its owning copy (ownedId + limitBreak)', () => {
    // Duplicate copies of one cardId: each source must carry ITS copy's
    // identity so the UI never shows one copy's tier/LB under the other's
    // column (review 2026-06-12: duplicate-copy attribution).
    const plan = makePlan({ targetSkills: [{ skillId: '200332', priority: 1 }] });
    const rows = buildCoverageMatrix({
      ...baseArgs,
      plan,
      inventory: [
        { id: 7, cardId: '30028', limitBreak: 0 },
        { id: 11, cardId: '30028', limitBreak: 4 },
      ],
    });
    expect(rows[0]?.sources.map((s) => ({ ownedId: s.ownedId, limitBreak: s.limitBreak }))).toEqual(
      [
        { ownedId: 7, limitBreak: 0 },
        { ownedId: 11, limitBreak: 4 },
      ],
    );
  });

  it('sets ownedId + limitBreak on chain/random/date_event sources too', () => {
    const plan = makePlan({
      targetSkills: [
        { skillId: '200331', priority: 1 }, // chain on Kitasan
        { skillId: '200014', priority: 2 }, // random on Kitasan
        { skillId: '200012', priority: 3 }, // date_event on Tazuna
      ],
    });
    const rows = buildCoverageMatrix({
      ...baseArgs,
      plan,
      inventory: [
        { id: 1, cardId: '30028', limitBreak: 2 },
        { id: 2, cardId: '30016', limitBreak: 3 },
      ],
    });
    expect(rows[0]?.sources).toEqual([
      { kind: 'chain', cardId: '30028', ownedId: 1, limitBreak: 2 },
    ]);
    expect(rows[1]?.sources).toEqual([
      { kind: 'random', cardId: '30028', ownedId: 1, limitBreak: 2 },
    ]);
    // 200012 is also a hint on Kitasan; the date_event source is Tazuna's copy.
    const dateSource = rows[2]?.sources.find((s) => s.kind === 'date_event');
    expect(dateSource).toMatchObject({ cardId: '30016', ownedId: 2, limitBreak: 3 });
  });

  it('omits ownedId (but keeps limitBreak) for unpersisted inventory rows', () => {
    const plan = makePlan({ targetSkills: [{ skillId: '200331', priority: 1 }] });
    const rows = buildCoverageMatrix({ ...baseArgs, plan, inventory: [KITASAN] });
    const source = rows[0]?.sources[0];
    expect(source).toBeDefined();
    expect(source && 'ownedId' in source).toBe(false);
    expect(source?.limitBreak).toBe(4);
  });

  it('handles a 1-skill target list', () => {
    const plan = makePlan({ targetSkills: [{ skillId: '200331', priority: 1 }] });
    const rows = buildCoverageMatrix({ ...baseArgs, plan, inventory: [KITASAN] });
    expect(rows).toHaveLength(1);
  });

  it('handles a 7-skill target list (variable length, priority drives order)', () => {
    const plan = makePlan({
      targetSkills: [
        { skillId: '200014', priority: 2 },
        { skillId: '200331', priority: 1 },
        { skillId: '210061', priority: 3 },
        { skillId: '200012', priority: 2 },
        { skillId: '200332', priority: 1 },
        { skillId: '900021', priority: 3 },
        { skillId: '201242', priority: 2 },
      ],
    });
    const rows = buildCoverageMatrix({ ...baseArgs, plan, inventory: [KITASAN] });
    expect(rows).toHaveLength(7);
    // Priority ascending; insertion order preserved within equal priority.
    expect(rows.map((r) => r.skillId)).toEqual([
      '200331',
      '200332',
      '200014',
      '200012',
      '201242',
      '210061',
      '900021',
    ]);
  });
});

// --- expectedHintLevel -------------------------------------------------------

describe('expectedHintLevel', () => {
  const kitasan = FIXTURE_CARDS[0]; // Hint Levels passive (effect 17) = 2 at every LB
  const hintSkill = { skillId: '200332', sourceType: 'hint_pool' } as const;

  function hintSource(limitBreak?: LimitBreak): CoverageSource {
    return {
      kind: 'hint_strong',
      cardId: '30028',
      ...(limitBreak !== undefined ? { limitBreak } : {}),
    };
  }

  it('hint source = base 1 + Hint Levels passive (effect 17, mechanics-notes §9) at the owned LB', () => {
    // master.mdb single_mode_hint_gain hint_value_2 (base per take) defaults
    // to 1 — verified: all Global hint_gain_type=0 rows grant 1 (2026-06-12).
    expect(expectedHintLevel(hintSource(4), kitasan, hintSkill)).toBe(3); // 1 + 2
  });

  it('uses the OWNING copy\'s limitBreak from the source, not a global max', () => {
    const card = makeCard({ hintFrequency: 30, hintPoolSize: 4 });
    card.perLevel = card.perLevel.map((p) => ({ ...p, hintLevels: p.limitBreak })); // passive 0..4
    expect(expectedHintLevel(hintSource(0), card, hintSkill)).toBe(1); // 1 + 0
    expect(expectedHintLevel(hintSource(3), card, hintSkill)).toBe(4); // 1 + 3
  });

  it('honors a per-skill base > 1 (CardSkill.hintLevels = master.mdb hint_value_2)', () => {
    const skill = { ...hintSkill, hintLevels: 2 };
    expect(expectedHintLevel(hintSource(0), kitasan, skill)).toBe(4); // 2 + 2
  });

  it('caps at hint Lv5 (game range 0–5)', () => {
    const card = makeCard({ hintFrequency: 30, hintPoolSize: 4 });
    card.perLevel = card.perLevel.map((p) => ({ ...p, hintLevels: 4 }));
    const skill = { ...hintSkill, hintLevels: 3 };
    expect(expectedHintLevel(hintSource(4), card, skill)).toBe(5); // min(5, 3 + 4)
  });

  it.each(['chain', 'date_event', 'random', 'scenario'] as const)(
    'returns 0 (full SP cost, P3) for %s sources — event hint levels are unparsed/unverified',
    (kind) => {
      // Event rewards embed their own hint levels in unparsed reward strings
      // (provenance §3 open item 3); applying the effect-17 training passive
      // to them is unsourced. In the mechanics-notes §10 verification queue —
      // until resolved, the honest estimate is full cost with a UI caveat.
      const source: CoverageSource = { kind, cardId: '30028', limitBreak: 4 };
      expect(expectedHintLevel(source, kitasan, hintSkill)).toBe(0);
    },
  );

  it.each(['spark', 'uncovered'] as const)('returns 0 for %s sources', (kind) => {
    expect(expectedHintLevel({ kind }, undefined, undefined)).toBe(0);
  });

  it('degrades gracefully: missing card, perLevel row, or source LB → base only', () => {
    expect(expectedHintLevel(hintSource(4), undefined, hintSkill)).toBe(1);
    expect(expectedHintLevel(hintSource(), kitasan, hintSkill)).toBe(1); // no limitBreak on source
    const sparse = makeCard({ hintFrequency: 30, hintPoolSize: 4 });
    sparse.perLevel = sparse.perLevel.filter((p) => p.limitBreak !== 4);
    expect(expectedHintLevel(hintSource(4), sparse, hintSkill)).toBe(1);
  });

  it('degrades gracefully: missing skill metadata → base 1', () => {
    expect(expectedHintLevel(hintSource(4), kitasan, undefined)).toBe(3); // 1 + 2
  });
});

// --- effectiveSpCost / bundledSpCost ----------------------------------------

describe('effectiveSpCost', () => {
  const rates = FIXTURE_SPARK_RATES;
  const gold110 = getSkill('200014'); // base 110

  it('base 110 at hint Lv4 → ceil(110×0.65) = 72 (mechanics-notes §7: the ceil/floor divergence case — we encode ceil)', () => {
    expect(effectiveSpCost(gold110, 4, rates)).toBe(72);
  });

  it('hint Lv0 → full base cost', () => {
    expect(effectiveSpCost(gold110, 0, rates)).toBe(110);
  });

  it('hint Lv1 → 10% off (cumulative schedule [10,20,30,35,40]%, mechanics-notes §7)', () => {
    expect(effectiveSpCost(gold110, 1, rates)).toBe(99);
  });

  it('hint Lv5 → 40% cap', () => {
    expect(effectiveSpCost(gold110, 5, rates)).toBe(66);
  });

  it('Fast Learner stacks ADDITIVELY with hint discount (mechanics-notes §7/§10 item 7; 2026-06-15 screenshot)', () => {
    // additive FL: hint% + 10% (mechanics-notes §7/§10 item 7; 2026-06-15 screenshot)
    // 110 × (1 - 0.35 - 0.10) = 110 × 0.55 = 60.5 → ceil = 61
    expect(effectiveSpCost(gold110, 4, rates, { fastLearner: true })).toBe(61);
    // No hint discount: 110 × (1 - 0 - 0.10) = 110 × 0.90 = 99
    expect(effectiveSpCost(gold110, 0, rates, { fastLearner: true })).toBe(99);
  });
});

describe('bundledSpCost', () => {
  const rates = FIXTURE_SPARK_RATES;
  const gold = getSkill('200014'); // base 110, prereq 200012
  const white = getSkill('200012'); // base 90

  it('sums discounted components BEFORE one ceil (mechanics-notes §7) — 1 SP under separate ceils', () => {
    // 110×0.65 = 71.5 and 90×0.65 = 58.5 → bundle ceil(130) = 130,
    // but separately ceil(71.5)+ceil(58.5) = 72+59 = 131.
    expect(bundledSpCost(gold, white, 4, 4, rates)).toBe(130);
    expect(effectiveSpCost(gold, 4, rates) + effectiveSpCost(white, 4, rates)).toBe(131);
  });

  it('supports different hint levels per component', () => {
    // 110×0.80 + 90×0.65 = 88 + 58.5 → ceil(146.5) = 147
    expect(bundledSpCost(gold, white, 2, 4, rates)).toBe(147);
  });

  it('applies Fast Learner additively to the whole bundle', () => {
    // additive FL: hint% + 10% (mechanics-notes §7/§10 item 7; 2026-06-15 screenshot)
    // discountPct = 35 + 10 = 45; ceil(110×55/100 + 90×55/100) = ceil(60.5 + 49.5) = ceil(110) = 110
    // (integer-percent arithmetic: no float drift, so exactly 110 not 111)
    expect(bundledSpCost(gold, white, 4, 4, rates, { fastLearner: true })).toBe(110);
  });
});

// --- spark sources (Phase 2: parents + rates) --------------------------------
// Spark % values derive from sparkChance, golden-tested against Ice's sheet in
// spark.test.ts (mechanics-notes §1–§4). Here we test the matrix integration:
// per-parent sources, 1dp rounding, tier ranking, detail fields, combination.

describe('buildCoverageMatrix — spark sources', () => {
  const baseArgs = { cards: FIXTURE_CARDS, skills: FIXTURE_SKILLS, rates: FIXTURE_SPARK_RATES };

  function makeParent(overrides: Partial<Parent> & Pick<Parent, 'id'>): Parent {
    return {
      umaId: '100201',
      blueSpark: { stat: 'spd', stars: 3 },
      pinkSpark: { aptitude: 'turf', stars: 3 },
      whiteSparks: [],
      source: 'mine',
      ...overrides,
    };
  }

  // Use white skill 200012 — white-spark factors map ONLY to white skills
  // (mechanics-notes §8). A gold skillId like 200014 is filtered (covered by a
  // dedicated test below: "gold whiteSparks entry filtered").
  const parentA = makeParent({
    id: 'parent-a',
    whiteSparks: [{ skillId: '200012', stars: 1 }],
    affinityHint: 95,
  });
  const parentB = makeParent({
    id: 'parent-b',
    whiteSparks: [{ skillId: '200012', stars: 2 }],
    affinityHint: 95,
  });

  it('emits one spark source per covering parent, ranked below a card source (Tier order)', () => {
    const plan = makePlan({ targetSkills: [{ skillId: '200012', priority: 1 }] });
    const rows = buildCoverageMatrix({
      ...baseArgs,
      plan,
      inventory: [KITASAN], // 200012 is a hint_pool skill on Kitasan
      parents: [parentA],
    });
    // Kitasan's hint source (hint_strong/weak) ranks above the spark.
    const kinds = rows[0]?.sources.map((s) => s.kind) ?? [];
    expect(kinds[kinds.length - 1]).toBe('spark'); // spark is always last
    expect(rows[0]?.bestTier).not.toBe('spark'); // a card source outranks it
    expect(tierRank('spark')).toBeGreaterThan(tierRank('random'));
    const sparkSource = rows[0]?.sources.find((s) => s.kind === 'spark');
    // 1★ white at affinity 95 = 11.357775% (Ice AO1065) → 1dp; finding:
    // positive affinity is the lineage total used per-member → approximate.
    expect(sparkSource).toEqual({
      kind: 'spark',
      parentId: 'parent-a',
      sparkPct: 11.4,
      approximate: true,
      detail: { sparkStars: 1, grandparent: false, affinityUsed: 95 },
    });
  });

  it('gold whiteSparks entry is filtered — not priced as a white spark (finding)', () => {
    // 200014 is gold in fixtures; recording it as a white spark must NOT
    // produce a spark source (mechanics-notes §8). Only Kitasan's random_event
    // covers it here.
    const goldSparkParent = makeParent({
      id: 'parent-gold',
      whiteSparks: [{ skillId: '200014', stars: 3 }],
      affinityHint: 95,
    });
    const plan = makePlan({ targetSkills: [{ skillId: '200014', priority: 1 }] });
    const rows = buildCoverageMatrix({
      ...baseArgs,
      plan,
      inventory: [KITASAN],
      parents: [goldSparkParent],
    });
    expect(rows[0]?.sources.map((s) => s.kind)).toEqual(['random']); // no spark
  });

  it('two covering parents → one source each; combinedSparkPct combines them', () => {
    const plan = makePlan({ targetSkills: [{ skillId: '200012', priority: 1 }] });
    const rows = buildCoverageMatrix({
      ...baseArgs,
      plan,
      inventory: [],
      parents: [parentA, parentB],
    });
    const sources = rows[0]?.sources ?? [];
    expect(sources.map((s) => [s.parentId, s.sparkPct])).toEqual([
      ['parent-a', 11.4],
      ['parent-b', 22], // 22.0311% (Ice AO1086) → 1dp
    ]);
    expect(rows[0]?.bestTier).toBe('spark');
    // 1 − (1−0.114)(1−0.22) = 0.30892 → 30.9 (combines the rounded values).
    expect(combinedSparkPct(sources)).toBe(30.9);
  });

  it('grandparent-only branch: conservative affinity-0 floor, approximate, gp detail', () => {
    const plan = makePlan({ targetSkills: [{ skillId: '200012', priority: 1 }] });
    const gpParent = makeParent({
      id: 'parent-c',
      affinityHint: 95,
      grandparents: [
        { umaId: '100101', whiteSparks: [{ skillId: '200012', stars: 1 }] },
        undefined,
      ],
    });
    const rows = buildCoverageMatrix({ ...baseArgs, plan, inventory: [], parents: [gpParent] });
    // base-only 1★: 1 − 0.97² = 5.91% → 5.9 (no flat ×0.5, mechanics-notes §4).
    expect(rows[0]?.sources).toEqual([
      {
        kind: 'spark',
        parentId: 'parent-c',
        sparkPct: 5.9,
        approximate: true,
        detail: { sparkStars: 1, grandparent: true, affinityUsed: 0 },
      },
    ]);
  });

  it('parent + own grandparent in one branch → ONE source with the branch-combined pct; detail = strongest contribution', () => {
    const plan = makePlan({ targetSkills: [{ skillId: '200012', priority: 1 }] });
    const branch = makeParent({
      id: 'parent-d',
      whiteSparks: [{ skillId: '200012', stars: 1 }],
      affinityHint: 95,
      grandparents: [
        { umaId: '100101', whiteSparks: [{ skillId: '200012', stars: 1 }] },
        undefined,
      ],
    });
    const rows = buildCoverageMatrix({ ...baseArgs, plan, inventory: [], parents: [branch] });
    // 1 − (1−0.11357775)(1−0.0591) = 16.5965…% → 16.6; parent-held contribution
    // (11.36% > 5.91%) drives the detail; gp involvement makes it approximate.
    expect(rows[0]?.sources).toEqual([
      {
        kind: 'spark',
        parentId: 'parent-d',
        sparkPct: 16.6,
        approximate: true,
        detail: { sparkStars: 1, grandparent: false, affinityUsed: 95 },
      },
    ]);
  });

  it('green spark covers its 9xxxxx inherited-unique target', () => {
    const plan = makePlan({ targetSkills: [{ skillId: '900021', priority: 1 }] });
    const green = makeParent({
      id: 'parent-g',
      greenSpark: { skillId: '900021', stars: 1 },
      affinityHint: 95,
    });
    const rows = buildCoverageMatrix({ ...baseArgs, plan, inventory: [], parents: [green] });
    // green 1★ at 95 = 18.549375% (Ice AO715) → 18.5; positive affinity →
    // approximate (lineage total used per-member, finding).
    expect(rows[0]?.sources).toEqual([
      {
        kind: 'spark',
        parentId: 'parent-g',
        sparkPct: 18.5,
        approximate: true,
        detail: { sparkStars: 1, grandparent: false, affinityUsed: 95 },
      },
    ]);
    expect(rows[0]?.bestTier).toBe('spark');
  });

  it('emits spark sources even for a skillId missing from the dataset (the parent record is the evidence)', () => {
    const plan = makePlan({ targetSkills: [{ skillId: '123456', priority: 1 }] });
    const parent = makeParent({
      id: 'parent-x',
      whiteSparks: [{ skillId: '123456', stars: 1 }],
      affinityHint: 95,
    });
    const rows = buildCoverageMatrix({ ...baseArgs, plan, inventory: [], parents: [parent] });
    expect(rows[0]?.bestTier).toBe('spark');
    expect(rows[0]?.sources).toHaveLength(1);
  });

  it('ignores parents when rates are not provided (spark math needs SparkRates)', () => {
    const plan = makePlan({ targetSkills: [{ skillId: '200014', priority: 1 }] });
    const rows = buildCoverageMatrix({
      plan,
      inventory: [],
      cards: FIXTURE_CARDS,
      skills: FIXTURE_SKILLS,
      parents: [parentA],
    });
    expect(rows[0]?.sources).toEqual([]);
    expect(rows[0]?.bestTier).toBe('uncovered');
  });

  it('non-covering parents emit nothing', () => {
    const plan = makePlan({ targetSkills: [{ skillId: '200331', priority: 1 }] });
    const rows = buildCoverageMatrix({ ...baseArgs, plan, inventory: [], parents: [parentA] });
    expect(rows[0]?.sources).toEqual([]);
  });
});

describe('combinedSparkPct', () => {
  it('returns 0 for no spark sources and ignores non-spark sources', () => {
    expect(combinedSparkPct([])).toBe(0);
    expect(combinedSparkPct([{ kind: 'chain', cardId: '30028' }])).toBe(0);
  });

  it('passes a single spark source through unchanged', () => {
    expect(combinedSparkPct([{ kind: 'spark', parentId: 'p', sparkPct: 11.4 }])).toBe(11.4);
  });

  it('combines independent branches: 1 − Π(1 − pct/100), 1dp', () => {
    const sources: CoverageSource[] = [
      { kind: 'spark', parentId: 'a', sparkPct: 11.4 },
      { kind: 'spark', parentId: 'b', sparkPct: 22 },
      { kind: 'random', cardId: '30028' }, // ignored
    ];
    expect(combinedSparkPct(sources)).toBe(30.9);
  });

  it('skips spark sources without a sparkPct', () => {
    expect(combinedSparkPct([{ kind: 'spark', parentId: 'p' }])).toBe(0);
  });
});
