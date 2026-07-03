import { describe, expect, it } from 'vitest';
import { categoryRank, classifySkill, CATEGORY_ORDER } from './skillCategory';

describe('classifySkill', () => {
  it('routes uniques + inherited-uniques by rarity (no ability needed)', () => {
    expect(classifySkill('unique', undefined)).toBe('unique');
    expect(classifySkill('inherited_unique', undefined)).toBe('unique');
  });

  it('recovery = ability_type 9 on self (Stamina to Spare / Corner Recovery)', () => {
    expect(classifySkill('white', { category: 1, abilityType: 9, targetType: 1, value: 150 })).toBe('recovery');
    expect(classifySkill('white', { category: 4, abilityType: 9, targetType: 1, value: 150 })).toBe('recovery');
  });

  it('green = skill_category 0 (race-start passives — Right-Handed, Runaway)', () => {
    expect(classifySkill('white', { category: 0, abilityType: 1, targetType: 1, value: 600000 })).toBe('green');
    expect(classifySkill('white', { category: 0, abilityType: 6, targetType: 1, value: 0 })).toBe('green'); // Runaway (type 6)
  });

  it('debuff = targets opponents (Speed Eater) OR negative HP-recovery (Stamina Eater)', () => {
    expect(classifySkill('white', { category: 2, abilityType: 21, targetType: 10, value: -1500 })).toBe('debuff');
    expect(classifySkill('white', { category: 2, abilityType: 9, targetType: 9, value: -50 })).toBe('debuff'); // stamina drain
  });

  it('normal = active speed/accel + self-only downside (No Stopping Me / Reckless)', () => {
    expect(classifySkill('white', { category: 3, abilityType: 31, targetType: 1, value: 4000 })).toBe('normal');
    expect(classifySkill('white', { category: 3, abilityType: 21, targetType: 1, value: -2000 })).toBe('normal'); // self downside
    expect(classifySkill('white', undefined)).toBe('normal'); // no mdb entry, non-unique
  });
});

describe('categoryRank', () => {
  it('orders unique → normal → recovery → green → debuff', () => {
    expect(CATEGORY_ORDER.map(categoryRank)).toEqual([0, 1, 2, 3, 4]);
  });
  it('unknown category sorts after all known ones', () => {
    expect(categoryRank(undefined)).toBe(CATEGORY_ORDER.length);
  });
});
