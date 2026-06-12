/**
 * Tests for the Module 4 coverage core. Mechanics assertions cite
 * docs/mechanics-notes.md §7 (hint SP discount schedule, retrieved 2026-06-12).
 */
import { describe, expect, it } from 'vitest';

import {
  HINT_TIER_THRESHOLDS,
  buildCoverageMatrix,
  bundledSpCost,
  classifyHintTier,
  effectiveSpCost,
  expectedHintLevel,
  tierRank,
} from '@/core/coverage';
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

  it('Fast Learner is a further ×0.9 before the single ceil (mechanics-notes §7)', () => {
    // 110 × 0.65 × 0.9 = 64.35 → 65
    expect(effectiveSpCost(gold110, 4, rates, { fastLearner: true })).toBe(65);
    // No hint discount: 110 × 0.9 = 99
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

  it('applies Fast Learner to the whole bundle', () => {
    // (71.5 + 58.5) × 0.9 = 117 → 117
    expect(bundledSpCost(gold, white, 4, 4, rates, { fastLearner: true })).toBe(117);
  });
});
