// src/features/inheritance/weightsPanelModel.test.ts
import { describe, expect, it } from 'vitest';
import { setGeneral, setGeneralArray, setStatWeight, setUmaBonus } from './weightsPanelModel';
import { DEFAULT_SCENARIO } from '@/core/cardScore';

describe('weightsPanelModel', () => {
  it('sets a stat weight immutably', () => {
    const next = setStatWeight(DEFAULT_SCENARIO, 'speed', 0, 2.7);
    expect(next.speed.stats[0]).toBe(2.7);
    expect(DEFAULT_SCENARIO.speed.stats[0]).not.toBe(2.7); // original untouched
  });
  it('sets a general scalar and an array slot', () => {
    expect(setGeneral(DEFAULT_SCENARIO, 'bondPerDay', 12).general.bondPerDay).toBe(12);
    expect(setGeneralArray(DEFAULT_SCENARIO, 'races', 0, 9).general.races[0]).toBe(9);
  });
  it('sets an uma bonus', () => {
    expect(setUmaBonus(DEFAULT_SCENARIO, 1, 1.1).general.umaBonus[1]).toBe(1.1);
  });
});
