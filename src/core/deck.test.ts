/**
 * Tests for the deck suggester (Module 4, plan §6 build step 5).
 *
 * Acceptance criteria under test (plan §6): the suggester NEVER violates
 * locked slots (including a constructed case where greedy would want the
 * locked slot), and rationale lists which target each pick covers.
 * Weights are planning heuristics (DECK_TUNABLES), not probabilities (P3).
 */
import { describe, expect, it } from 'vitest';

import { DECK_TUNABLES, suggestDeck } from '@/core/deck';
import {
  FIXTURE_CARDS,
  FIXTURE_PLAN,
  FIXTURE_SKILLS,
} from '@/core/fixtures';
import type {
  CmPlan,
  LimitBreak,
  Parent,
  SkillRecord,
  SupportCardRecord,
} from '@/core/types';

// --- helpers -----------------------------------------------------------------

const KITASAN = { cardId: '30028', limitBreak: 4 as LimitBreak };
const TAZUNA = { cardId: '30016', limitBreak: 4 as LimitBreak };
const R_EXAMPLE = { cardId: '10001', limitBreak: 4 as LimitBreak };

function makePlan(overrides: Partial<CmPlan>): CmPlan {
  return { ...FIXTURE_PLAN, ...overrides };
}

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

function syntheticSkill(skillId: string): SkillRecord {
  return {
    skillId,
    nameEn: `Skill ${skillId}`,
    nameJp: skillId,
    baseSpCost: 100,
    rarity: 'white',
    conditions: '',
    server: 'global',
    dataVersion: 'test',
  };
}

function syntheticCard(args: {
  cardId: string;
  type: SupportCardRecord['type'];
  skills: SupportCardRecord['skills'];
  hintFrequency?: number | [number, number, number, number, number];
}): SupportCardRecord {
  const freq = (lb: LimitBreak): number =>
    typeof args.hintFrequency === 'number' || args.hintFrequency === undefined
      ? (args.hintFrequency ?? 0)
      : args.hintFrequency[lb];
  return {
    cardId: args.cardId,
    nameEn: `[Card ${args.cardId}]`,
    charName: 'Test Uma',
    rarity: 'SR',
    type: args.type,
    perLevel: ([0, 1, 2, 3, 4] as const).map((lb) => ({
      limitBreak: lb,
      hintFrequency: freq(lb),
      hintLevels: 1,
      specialtyPriority: 0,
    })),
    skills: args.skills,
    hintPoolSize: args.skills.filter((s) => s.sourceType === 'hint_pool').length,
    server: 'global',
    dataVersion: 'test',
  };
}

const fixtureArgs = { cards: FIXTURE_CARDS, skills: FIXTURE_SKILLS };

// --- greedy fill on fixtures ---------------------------------------------------

describe('suggestDeck — greedy fill', () => {
  it('fills free slots by marginal score and leaves zero-gain slots empty (honest "free for training")', () => {
    const result = suggestDeck({
      ...fixtureArgs,
      plan: FIXTURE_PLAN,
      inventory: [KITASAN, TAZUNA, R_EXAMPLE],
    });
    // Kitasan (chain on the p1 target) first, then the R card (hint_weak on
    // 200014 beats Kitasan's random); Tazuna covers no target → no slot.
    expect(result.deck).toEqual([
      { slot: 0, cardId: '30028' },
      { slot: 1, cardId: '10001' },
      { slot: 2 },
      { slot: 3 },
      { slot: 4 },
      { slot: 5 },
    ]);
    // 200331 chain (4×5) + 200014 hint_weak (2×1.5) + 210061 scenario (1×4.5).
    expect(result.coverageScore).toBe(27.5);
    expect(result.uncovered).toEqual([]);
  });

  it('rationale lists which target(s) each pick covers, at the tier the card provides', () => {
    const result = suggestDeck({
      ...fixtureArgs,
      plan: FIXTURE_PLAN,
      inventory: [KITASAN, TAZUNA, R_EXAMPLE],
    });
    expect(result.rationale[0]).toBe(
      'slot 0: [Feel the Burn, Princess!] — covers Professor of Curvature(chain), Right Turns ◎(random)',
    );
    expect(result.rationale[1]).toBe(
      'slot 1: [R Example] — covers Right Turns ◎(hint_weak), Shooting for the Top(hint_weak)',
    );
    expect(result.rationale[2]).toBe('slot 2: no skill-relevant pick — free for training needs');
  });

  it('uses each card at most once across the deck', () => {
    const result = suggestDeck({
      ...fixtureArgs,
      plan: FIXTURE_PLAN,
      inventory: [KITASAN, { ...KITASAN }, TAZUNA, R_EXAMPLE],
    });
    const picked = result.deck.map((d) => d.cardId).filter((id) => id !== undefined);
    expect(new Set(picked).size).toBe(picked.length);
  });

  it('prefers the higher-LB copy of a duplicated card (better hint passives → better tier)', () => {
    // hint_weak at LB0 (freq 10), hint_strong at LB4 (freq 40, pool 1 ≤ 8).
    const card = syntheticCard({
      cardId: '90010',
      type: 'speed',
      skills: [{ skillId: '100001', sourceType: 'hint_pool' }],
      hintFrequency: [10, 10, 10, 10, 40],
    });
    const plan = makePlan({ targetSkills: [{ skillId: '100001', priority: 1 }] });
    const result = suggestDeck({
      plan,
      inventory: [
        { cardId: '90010', limitBreak: 0 },
        { cardId: '90010', limitBreak: 4 },
      ],
      cards: [card],
      skills: [syntheticSkill('100001')],
    });
    // hint_strong (3) × priority 1 (4) = 12; the LB0 copy would only score 6.
    expect(result.coverageScore).toBe(12);
    expect(result.rationale[0]).toContain('(hint_strong)');
    expect(result.deck.filter((d) => d.cardId === '90010')).toHaveLength(1);
  });

  it('handles an empty inventory: all slots free, only scenario coverage remains', () => {
    const result = suggestDeck({ ...fixtureArgs, plan: FIXTURE_PLAN, inventory: [] });
    expect(result.deck.every((d) => d.cardId === undefined)).toBe(true);
    expect(result.coverageScore).toBe(4.5); // 210061 scenario × priority 3
    expect(result.uncovered).toEqual(['200331', '200014']);
  });
});

// --- locked slots (acceptance invariant) ---------------------------------------

describe('suggestDeck — locked slots are never violated', () => {
  it('cardId lock holds even when greedy would want that slot for a better card', () => {
    // Slot 0 locked to Tazuna (covers no target); Kitasan (chain on the p1
    // target) is the card greedy would otherwise put in slot 0.
    const plan = makePlan({ lockedDeckSlots: [{ slot: 0, cardId: '30016' }] });
    const result = suggestDeck({
      ...fixtureArgs,
      plan,
      inventory: [KITASAN, TAZUNA, R_EXAMPLE],
    });
    expect(result.deck[0]).toEqual({ slot: 0, cardId: '30016', lockedBy: 'cardId' });
    expect(result.deck[1]).toEqual({ slot: 1, cardId: '30028' });
    // The locked card is consumed: it never reappears in another slot.
    expect(result.deck.filter((d) => d.cardId === '30016')).toHaveLength(1);
  });

  it('cardId lock consumes the card even when it is NOT in inventory, and notes it in rationale', () => {
    const plan = makePlan({ lockedDeckSlots: [{ slot: 5, cardId: '77777' }] });
    const result = suggestDeck({ ...fixtureArgs, plan, inventory: [KITASAN] });
    expect(result.deck[5]).toEqual({ slot: 5, cardId: '77777', lockedBy: 'cardId' });
    expect(
      result.rationale.some((line) => line.includes('77777') && line.includes('not in inventory')),
    ).toBe(true);
  });

  it('cardType lock restricts the slot to that type even when a better off-type card exists', () => {
    // Greedy would want Kitasan (speed, gain 21) in slot 0, but slot 0 only
    // accepts stamina: the R card (stamina) must land there, Kitasan elsewhere.
    const plan = makePlan({ lockedDeckSlots: [{ slot: 0, cardType: 'stamina' }] });
    const result = suggestDeck({
      ...fixtureArgs,
      plan,
      inventory: [KITASAN, TAZUNA, R_EXAMPLE],
    });
    expect(result.deck[0]).toEqual({ slot: 0, cardId: '10001', lockedBy: 'cardType' });
    expect(result.deck[0]?.cardId).not.toBe('30028');
    expect(result.deck[1]).toEqual({ slot: 1, cardId: '30028' });
    expect(result.coverageScore).toBe(27.5);
  });

  it('cardType lock with no eligible candidate stays empty (never violated by an off-type fill)', () => {
    const plan = makePlan({ lockedDeckSlots: [{ slot: 3, cardType: 'guts' }] });
    const result = suggestDeck({
      ...fixtureArgs,
      plan,
      inventory: [KITASAN, TAZUNA, R_EXAMPLE],
    });
    expect(result.deck[3]).toEqual({ slot: 3, lockedBy: 'cardType' });
  });

  it('locked deck entries echo lockedBy for the UI', () => {
    const plan = makePlan({
      lockedDeckSlots: [
        { slot: 0, cardId: '30028' },
        { slot: 1, cardType: 'speed' },
      ],
    });
    const result = suggestDeck({ ...fixtureArgs, plan, inventory: [KITASAN, R_EXAMPLE] });
    expect(result.deck[0]?.lockedBy).toBe('cardId');
    expect(result.deck[1]?.lockedBy).toBe('cardType');
    // Kitasan is consumed by the slot-0 lock — it cannot also fill slot 1.
    expect(result.deck.filter((d) => d.cardId === '30028')).toHaveLength(1);
  });
});

// --- 1-swap refinement ----------------------------------------------------------

describe('suggestDeck — 1-swap refinement pass', () => {
  it('repairs a greedy pick made redundant by a later pick (type-locked slot)', () => {
    // Targets s1, s2 (p1) and s3 (p2). Slot 0 takes only stamina; slots 2–5
    // take only guts (none owned) — so the deck is slot 0 (stamina) + slot 1.
    // Greedy: slot 0 → A (s1 chain, gain 20 > C's 10); slot 1 → B (adds s2).
    // B also chains s1, so A is now redundant; one swap A→C reaches 50.
    const skills = [syntheticSkill('100001'), syntheticSkill('100002'), syntheticSkill('100003')];
    const cardA = syntheticCard({
      cardId: '90001',
      type: 'stamina',
      skills: [{ skillId: '100001', sourceType: 'chain' }],
    });
    const cardB = syntheticCard({
      cardId: '90002',
      type: 'speed',
      skills: [
        { skillId: '100001', sourceType: 'chain' },
        { skillId: '100002', sourceType: 'chain' },
      ],
    });
    const cardC = syntheticCard({
      cardId: '90003',
      type: 'stamina',
      skills: [{ skillId: '100003', sourceType: 'chain' }],
    });
    const plan = makePlan({
      scenario: { id: 1, isDefault: false },
      targetSkills: [
        { skillId: '100001', priority: 1 },
        { skillId: '100002', priority: 1 },
        { skillId: '100003', priority: 2 },
      ],
      lockedDeckSlots: [
        { slot: 0, cardType: 'stamina' },
        { slot: 2, cardType: 'guts' },
        { slot: 3, cardType: 'guts' },
        { slot: 4, cardType: 'guts' },
        { slot: 5, cardType: 'guts' },
      ],
    });
    const result = suggestDeck({
      plan,
      inventory: [
        { cardId: '90001', limitBreak: 0 },
        { cardId: '90002', limitBreak: 0 },
        { cardId: '90003', limitBreak: 0 },
      ],
      cards: [cardA, cardB, cardC],
      skills,
    });
    // Post-swap optimum: C in the stamina slot, B free — all three targets chain.
    expect(result.deck[0]).toEqual({ slot: 0, cardId: '90003', lockedBy: 'cardType' });
    expect(result.deck[1]).toEqual({ slot: 1, cardId: '90002' });
    expect(result.coverageScore).toBe(50); // 4×5 + 4×5 + 2×5
    expect(result.uncovered).toEqual([]);
  });
});

// --- uncovered + parents ----------------------------------------------------------

describe('suggestDeck — uncovered and parents', () => {
  it('lists targets with no source across deck + parents; spark coverage removes them but scores 0', () => {
    const plan = makePlan({
      scenario: { id: 1, isDefault: false },
      targetSkills: [
        { skillId: '200331', priority: 1 },
        { skillId: '900021', priority: 2 },
      ],
    });
    const noParents = suggestDeck({ ...fixtureArgs, plan, inventory: [TAZUNA] });
    expect(noParents.uncovered).toEqual(['200331', '900021']);

    const greenParent = makeParent({
      id: 'parent-g',
      greenSpark: { skillId: '900021', stars: 2 },
      affinityHint: 95,
    });
    const withParents = suggestDeck({
      ...fixtureArgs,
      plan,
      inventory: [TAZUNA],
      parents: [greenParent],
    });
    expect(withParents.uncovered).toEqual(['200331']);
    // Sparks come from parents, not deck picks: weight is 0 by design.
    expect(DECK_TUNABLES.TIER_WEIGHTS.spark).toBe(0);
    expect(withParents.coverageScore).toBe(noParents.coverageScore);
  });

  it('leaves slots empty when the only coverage is parent sparks (spark weight 0, no card chases it)', () => {
    // 900021 is spark-covered by the parent; Tazuna offers nothing for it, so
    // no slot is spent — yet the target is not "uncovered" (the spark counts).
    const plan = makePlan({
      targetSkills: [{ skillId: '900021', priority: 1 }],
    });
    const parent = makeParent({
      id: 'p',
      greenSpark: { skillId: '900021', stars: 3 },
      affinityHint: 95,
    });
    const result = suggestDeck({ ...fixtureArgs, plan, inventory: [TAZUNA], parents: [parent] });
    // Tazuna covers nothing for this target: no pick, target stays covered by spark.
    expect(result.deck.every((d) => d.cardId === undefined)).toBe(true);
    expect(result.uncovered).toEqual([]);
  });
});
