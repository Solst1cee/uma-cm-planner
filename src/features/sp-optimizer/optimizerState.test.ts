import { describe, expect, it } from 'vitest';
import { applyWorkingState, basketBuyCut, type WorkingEdits } from '@/features/sp-optimizer/optimizerState';
import type { CaptureBundle } from '@/core/spOptimizer';
import type { SkillRecord, SparkRates } from '@/core/types';

const rates = { hintDiscountCumulativePct: [10, 20, 30, 35, 40] } as SparkRates;
const skill = (id: string, base: number): SkillRecord =>
  ({ skillId: id, nameEn: id, baseSpCost: base, rarity: 'white', server: 'global' } as unknown as SkillRecord);
const skillById = new Map([['a', skill('a', 200)], ['b', skill('b', 100)]]);
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
    const edits: WorkingEdits = { pins: new Set(['a']), costEdits: new Map(), hintEdits: new Map(), fastLearner: false };
    expect(applyWorkingState(base, edits, skillById, rates).context.pinned).toEqual(['a']);
  });
  it('reprices from a hint edit (200 @ Lv1 → 180)', () => {
    const edits: WorkingEdits = { pins: new Set(), costEdits: new Map(), hintEdits: new Map([['a', 1]]), fastLearner: false };
    const out = applyWorkingState(base, edits, skillById, rates);
    expect(out.context.candidates.find((c) => c.skillId === 'a')!.screenSpCost).toBe(180);
  });
  it('a cost edit overrides the hint reprice', () => {
    const edits: WorkingEdits = { pins: new Set(), costEdits: new Map([['a', 42]]), hintEdits: new Map([['a', 3]]), fastLearner: false };
    const out = applyWorkingState(base, edits, skillById, rates);
    expect(out.context.candidates.find((c) => c.skillId === 'a')!.screenSpCost).toBe(42);
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
