import { describe, expect, it } from 'vitest';
import type { SkillRecord } from '@/core/types';
import { acquirableSkills, skillCategory } from './skillCatalog';

function sk(over: Partial<SkillRecord> & { skillId: string }): SkillRecord {
  return { nameEn: over.skillId, nameJp: '', baseSpCost: 100, rarity: 'white', iconId: '1',
    conditions: '', server: 'global', dataVersion: 't', ...over } as SkillRecord;
}

describe('acquirableSkills', () => {
  const all = [
    sk({ skillId: 'w', rarity: 'white' }),
    sk({ skillId: 'g', rarity: 'gold' }),
    sk({ skillId: 'iu', rarity: 'inherited_unique' }),
    sk({ skillId: 'u', rarity: 'unique' }),               // native runner unique → excluded
    sk({ skillId: 'jp', rarity: 'white', server: 'jp' }), // P4 → excluded for a global plan
  ];
  it('keeps white/gold/inherited_unique on the matching server, drops native uniques + JP', () => {
    expect(acquirableSkills(all, 'global').map((s) => s.skillId)).toEqual(['w', 'g', 'iu']);
  });
});

describe('skillCategory', () => {
  it('classifies normal / scenario / inherited', () => {
    expect(skillCategory(sk({ skillId: 'a' }))).toBe('normal');
    expect(skillCategory(sk({ skillId: 'b', scenarioId: 4 }))).toBe('scenario');
    expect(skillCategory(sk({ skillId: 'c', rarity: 'inherited_unique' }))).toBe('inherited');
  });
});
