import { describe, it, expect } from 'vitest';
import { effectiveSpCost, hintDiscountFraction, purchaseSpCost } from './cost';
import { FIXTURE_SPARK_RATES } from './fixtures';
import type { SkillRecord } from './types';

const skill = (baseSpCost: number, over: Partial<SkillRecord> = {}): SkillRecord => ({
  skillId: 'x', nameEn: 'x', nameJp: 'x', baseSpCost, rarity: 'white', iconId: '0',
  conditions: '', server: 'global', dataVersion: 'test', ...over,
});

describe('effectiveSpCost — additive Fast Learner', () => {
  it('Lv1 + FL = 20% off (base×0.8), not ×0.81', () => {
    expect(effectiveSpCost(skill(160), 1, FIXTURE_SPARK_RATES, { fastLearner: true })).toBe(128);
    expect(effectiveSpCost(skill(200), 1, FIXTURE_SPARK_RATES, { fastLearner: true })).toBe(160);
  });
  it('Lv1 without FL = 10% off (ceil)', () => {
    expect(effectiveSpCost(skill(160), 1, FIXTURE_SPARK_RATES)).toBe(144);
  });
  it('hintDiscountFraction is cumulative 10/20/30/35/40', () => {
    expect(hintDiscountFraction(0, FIXTURE_SPARK_RATES)).toBe(0);
    expect(hintDiscountFraction(1, FIXTURE_SPARK_RATES)).toBeCloseTo(0.1);
    expect(hintDiscountFraction(4, FIXTURE_SPARK_RATES)).toBeCloseTo(0.35);
  });
});

describe('purchaseSpCost — gold bundles its white prerequisite', () => {
  const whiteBase = skill(110, { skillId: 'w', rarity: 'white' });
  const gold = skill(130, { skillId: 'g', rarity: 'gold', prereqSkillId: 'w' });
  const byId = new Map<string, SkillRecord>([['w', whiteBase], ['g', gold]]);

  it('a gold with a prereq costs gold base + white base (one ceil)', () => {
    // 130 + 110 = 240 at hint Lv0 (no discount).
    expect(purchaseSpCost(gold, byId, 0, FIXTURE_SPARK_RATES)).toBe(240);
  });

  it('a white/standalone skill costs only its own effective price', () => {
    expect(purchaseSpCost(whiteBase, byId, 0, FIXTURE_SPARK_RATES)).toBe(110);
  });

  it('a gold whose prereq is missing from the map falls back to its own cost', () => {
    const orphan = skill(130, { skillId: 'g2', rarity: 'gold', prereqSkillId: 'missing' });
    expect(purchaseSpCost(orphan, byId, 0, FIXTURE_SPARK_RATES)).toBe(130);
  });
});
