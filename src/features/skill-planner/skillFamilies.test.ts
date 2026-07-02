import { describe, expect, it } from 'vitest';
import type { SkillRecord } from '@/core/types';
import { familyRepresentatives, isBlockedBySelectedVariant } from './skillFamilies';

function skill(over: Partial<SkillRecord> & { skillId: string }): SkillRecord {
  return {
    nameEn: `Skill ${over.skillId}`,
    nameJp: '',
    baseSpCost: 100,
    rarity: 'white',
    iconId: '1',
    conditions: '',
    server: 'global',
    dataVersion: 't',
    ...over,
  };
}

describe('familyRepresentatives', () => {
  it('keeps one row per family (the strongest variant) and passes singletons through', () => {
    const white = skill({ skillId: '100', rarity: 'white', baseSpCost: 90, variantSkillIds: ['101'] });
    const gold = skill({ skillId: '101', rarity: 'gold', baseSpCost: 170, variantSkillIds: ['100'] });
    const solo = skill({ skillId: '200', rarity: 'white' });
    const skillById = new Map([white, gold, solo].map((s) => [s.skillId, s]));

    const reps = familyRepresentatives([white, gold, solo], skillById);

    // gold outranks white (skillVariantRank: gold +3000) → family collapses to '101'
    expect(reps.map((s) => s.skillId)).toEqual(['101', '200']);
  });

  it('restricts the representative to members present in the input set', () => {
    const white = skill({ skillId: '100', rarity: 'white', baseSpCost: 90, variantSkillIds: ['101'] });
    const gold = skill({ skillId: '101', rarity: 'gold', baseSpCost: 170, variantSkillIds: ['100'] });
    const skillById = new Map([white, gold].map((s) => [s.skillId, s]));

    // only the white is in the chart's input; the gold must NOT become the rep
    const reps = familyRepresentatives([white], skillById);
    expect(reps.map((s) => s.skillId)).toEqual(['100']);
  });
});

describe('server-aware variant families (P4: JP-ahead never suppresses Global)', () => {
  // Real-data shape: jp gold 200034 "Child of Fuchu" lists global whites in its
  // gt-derived variantSkillIds (e.g. 200031 "Tokyo Racecourse ◎").
  const globalWhite = skill({ skillId: '200031', rarity: 'white', baseSpCost: 110, variantSkillIds: ['200034'] });
  const jpGold = skill({ skillId: '200034', rarity: 'gold', baseSpCost: 170, server: 'jp', variantSkillIds: ['200031'] });
  const globalGold = skill({ skillId: '200035', rarity: 'gold', baseSpCost: 170, variantSkillIds: ['200031'] });

  it('a wishlisted JP-ahead variant does not block its Global family member in the picker', () => {
    const skillById = new Map([globalWhite, jpGold].map((s) => [s.skillId, s]));
    expect(isBlockedBySelectedVariant(globalWhite, ['200034'], skillById)).toBe(false);
  });

  it('same-server blocking still applies (control)', () => {
    const white = { ...globalWhite, variantSkillIds: ['200035'] };
    const skillById = new Map([white, globalGold].map((s) => [s.skillId, s]));
    expect(isBlockedBySelectedVariant(white, ['200035'], skillById)).toBe(true);
  });

  it('a JP-ahead variant does not represent (hide) Global members in the chart family collapse', () => {
    const skillById = new Map([globalWhite, jpGold].map((s) => [s.skillId, s]));
    const reps = familyRepresentatives([globalWhite, jpGold], skillById);
    // both stay: the jp gold must not claim the global white's family slot
    expect(reps.map((s) => s.skillId)).toEqual(['200031', '200034']);
  });
});
