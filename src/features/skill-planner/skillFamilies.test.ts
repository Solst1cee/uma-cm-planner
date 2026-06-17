import { describe, expect, it } from 'vitest';
import type { SkillRecord } from '@/core/types';
import { familyRepresentatives } from './skillFamilies';

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
