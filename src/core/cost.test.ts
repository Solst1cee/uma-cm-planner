import { describe, it, expect } from 'vitest';
import { effectiveSpCost, hintDiscountFraction } from './cost';
import { FIXTURE_SPARK_RATES } from './fixtures';
import type { SkillRecord } from './types';

const skill = (baseSpCost: number): SkillRecord => ({
  skillId: 'x', nameEn: 'x', nameJp: 'x', baseSpCost, rarity: 'white', iconId: '0',
  conditions: '', server: 'global', dataVersion: 'test',
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
