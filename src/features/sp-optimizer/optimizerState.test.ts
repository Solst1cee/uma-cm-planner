import { describe, expect, it } from 'vitest';
import { applyWorkingState, basketBuyCut, cycleLockState, planMatch, repricedCost, type WorkingEdits } from '@/features/sp-optimizer/optimizerState';
import type { CaptureBundle } from '@/core/spOptimizer';
import type { SkillRecord, SparkRates } from '@/core/types';

const rates = { hintDiscountCumulativePct: [10, 20, 30, 35, 40] } as SparkRates;
const skill = (id: string, base: number, prereqSkillId?: string): SkillRecord =>
  ({ skillId: id, nameEn: id, baseSpCost: base, rarity: 'white', server: 'global', prereqSkillId } as unknown as SkillRecord);
const skillById = new Map([
  ['a', skill('a', 200)], ['b', skill('b', 100)],
  ['g', skill('g', 200, 'w')], ['w', skill('w', 100)],
]);
const base: CaptureBundle = {
  schemaVersion: 1, source: 'manual', capturedAt: 'x', server: 'global', dataVersion: 'v',
  context: {
    umaId: 'u', stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 },
    aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, strategy: 'pace',
    courseId: '10906', spBudget: 500, ownedSkills: [], pinned: [],
    candidates: [
      { skillId: 'a', rarity: 'white', screenSpCost: 200 },
      { skillId: 'b', rarity: 'white', screenSpCost: 100 },
    ],
  },
};

describe('applyWorkingState', () => {
  it('sets pinned from the pins set', () => {
    const edits: WorkingEdits = { pins: new Set(['a']), excluded: new Set(), hintEdits: new Map(), fastLearner: false };
    expect(applyWorkingState(base, edits, rates).context.pinned).toEqual(['a']);
  });
  it('reprices from a hint edit (200 @ Lv1 → 180)', () => {
    const edits: WorkingEdits = { pins: new Set(), excluded: new Set(), hintEdits: new Map([['a', 1]]), fastLearner: false };
    const out = applyWorkingState(base, edits, rates);
    expect(out.context.candidates.find((c) => c.skillId === 'a')!.screenSpCost).toBe(180);
  });
  it('Fast Learner ON reprices every row from base (200 @ hint 0, −10% → 180); untouched rows keep screen cost when OFF', () => {
    const flOn: WorkingEdits = { pins: new Set(), excluded: new Set(), hintEdits: new Map(), fastLearner: true };
    const on = applyWorkingState(base, flOn, rates);
    expect(on.context.candidates.find((c) => c.skillId === 'a')!.screenSpCost).toBe(180);
    const flOff: WorkingEdits = { pins: new Set(), excluded: new Set(), hintEdits: new Map(), fastLearner: false };
    const off = applyWorkingState(base, flOff, rates);
    expect(off.context.candidates.find((c) => c.skillId === 'a')!.screenSpCost).toBe(200);
  });
  it('a stepped hint stacks ADDITIVELY with Fast Learner (200 @ Lv1+FL = 10%+10% → 160, not ×0.9×0.9)', () => {
    const edits: WorkingEdits = { pins: new Set(), excluded: new Set(), hintEdits: new Map([['a', 1]]), fastLearner: true };
    const out = applyWorkingState(base, edits, rates);
    expect(out.context.candidates.find((c) => c.skillId === 'a')!.screenSpCost).toBe(160);
  });
  it('reprices a gold hint edit on the gold alone — no white-prereq bundling (M2 rows are one-per-skill)', () => {
    const withGold: CaptureBundle = {
      ...base,
      context: {
        ...base.context,
        candidates: [
          { skillId: 'g', rarity: 'gold', screenSpCost: 200, prereqSkillId: 'w' },
          { skillId: 'w', rarity: 'white', screenSpCost: 100 },
        ],
      },
    };
    const edits: WorkingEdits = { pins: new Set(), excluded: new Set(), hintEdits: new Map([['g', 1]]), fastLearner: false };
    const out = applyWorkingState(withGold, edits, rates);
    // Single-skill effectiveSpCost(200, Lv1) = ceil(200*0.9) = 180 — NOT 270
    // (ceil((200+100)*0.9)), which would double-count the white's own row.
    expect(out.context.candidates.find((c) => c.skillId === 'g')!.screenSpCost).toBe(180);
  });
});

describe('repricedCost — screen-implied base (gold screen ≠ datasheet base)', () => {
  // A gold captured at 160 SP, hint 2 (−20%): implied base = 200.
  const gold = { skillId: 'g', rarity: 'gold' as const, screenSpCost: 160, hintLevel: 2 as const };
  it('returns the captured screen cost verbatim at the captured hint (FL off)', () => {
    expect(repricedCost(gold, 2, false, rates)).toBe(160);
  });
  it('steps relative to the screen-implied base, not the datasheet base', () => {
    expect(repricedCost(gold, 3, false, rates)).toBe(140); // 200 × 0.70
    expect(repricedCost(gold, 0, false, rates)).toBe(200); // back to implied base
  });
  it('stacks Fast Learner additively on the implied base', () => {
    expect(repricedCost(gold, 2, true, rates)).toBe(140); // 20% + 10% = −30%
  });
});

describe('applyWorkingState — excluded skills', () => {
  it('drops excluded candidates from the analysis bundle (and never pins them)', () => {
    const edits: WorkingEdits = { pins: new Set(['a', 'b']), excluded: new Set(['b']), hintEdits: new Map(), fastLearner: false };
    const out = applyWorkingState(base, edits, rates);
    expect(out.context.candidates.map((c) => c.skillId)).toEqual(['a']);
    expect(out.context.pinned).toEqual(['a']);
  });
});

describe('cycleLockState', () => {
  const edits = (): WorkingEdits => ({ pins: new Set(), excluded: new Set(), hintEdits: new Map(), fastLearner: false });
  const NO_CHAIN: never[] = [];
  it('cycles blank → pinned → excluded → blank', () => {
    const e0 = edits();
    const e1 = cycleLockState(e0, 'a', NO_CHAIN);
    expect(e1.pins.has('a')).toBe(true);
    expect(e1.excluded.has('a')).toBe(false);
    const e2 = cycleLockState(e1, 'a', NO_CHAIN);
    expect(e2.pins.has('a')).toBe(false);
    expect(e2.excluded.has('a')).toBe(true);
    const e3 = cycleLockState(e2, 'a', NO_CHAIN);
    expect(e3.pins.has('a')).toBe(false);
    expect(e3.excluded.has('a')).toBe(false);
  });
  it('is pure — does not mutate the input edits', () => {
    const e0 = edits();
    cycleLockState(e0, 'a', NO_CHAIN);
    expect(e0.pins.size).toBe(0);
    expect(e0.excluded.size).toBe(0);
  });

  // Purchase chains: gold→white and ◎→○ (candidates carry prereqSkillId).
  const chain = [
    { skillId: 'o', rarity: 'white' as const, screenSpCost: 90 },
    { skillId: 'dc', rarity: 'white' as const, screenSpCost: 110, prereqSkillId: 'o' },
    { skillId: 'g', rarity: 'gold' as const, screenSpCost: 160, prereqSkillId: 'dc' },
  ];
  it('pinning a chain head locks its whole purchase chain', () => {
    const e1 = cycleLockState(edits(), 'g', chain);
    expect([...e1.pins].sort()).toEqual(['dc', 'g', 'o']);
  });
  it('excluding a base skill also excludes (and unpins) everything that needs it', () => {
    let e = cycleLockState(edits(), 'g', chain); // pins o, dc, g
    e = cycleLockState(e, 'o', chain); // pinned ○ → excluded, dependents follow
    expect(e.pins.size).toBe(0);
    expect([...e.excluded].sort()).toEqual(['dc', 'g', 'o']);
  });
  it('excluding a mid-chain skill keeps its base pinned but drags its dependents out', () => {
    let e = cycleLockState(edits(), 'dc', chain); // pins dc + o
    e = cycleLockState(e, 'dc', chain); // ◎ → excluded; ○ stays; g (needs ◎) follows out
    expect([...e.pins]).toEqual(['o']);
    expect([...e.excluded].sort()).toEqual(['dc', 'g']);
  });
});

describe('planMatch', () => {
  const wishlist = [
    { skillId: 'a', priority: 1 as const, source: 'targeted' as const },
    { skillId: 'zzz', priority: 1 as const, source: 'targeted' as const },
  ];
  it('splits a plan wishlist into locked (buyable on screen) vs not-yet-buyable', () => {
    const m = planMatch(wishlist, base.context.candidates, skillById);
    expect(m.lockedIds).toEqual(['a']);
    expect(m.lockedNames).toEqual(['a']); // fixture nameEn === id
    expect(m.matched).toBe(1);
    expect(m.notBuyable).toBe(1);
  });
  it('falls back to the raw id when the skill record is unknown', () => {
    const m = planMatch([{ skillId: 'b', priority: 1, source: 'targeted' }], base.context.candidates, new Map());
    expect(m.lockedNames).toEqual(['b']);
  });
});

describe('basketBuyCut', () => {
  it('splits candidates into buy vs cut for the selected basket', () => {
    const result = { mode: 'exact', greedyScore: 0, candidates: [
      { skillId: 'a', rarity: 'white', deltaL: 1, screenSpCost: 200, lPerSp: 5, pinned: false },
      { skillId: 'b', rarity: 'white', deltaL: 1, screenSpCost: 100, lPerSp: 10, pinned: false },
    ], baskets: [{ skills: ['b'], score: 1, spUsed: 100, spLeft: 400, descriptor: 'd' }] } as const;
    const { buy, cut } = basketBuyCut(result as never, 0);
    expect([...buy]).toEqual(['b']);
    expect([...cut]).toEqual(['a']);
  });
});
