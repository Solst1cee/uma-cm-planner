import { describe, expect, it } from 'vitest';
import { applySkillCategoriesOverrides } from './build-skill-categories';
import type { SkillSortMeta } from '@/core/skillCategory';

describe('applySkillCategoriesOverrides (P5)', () => {
  const base: Record<string, SkillSortMeta> = {
    '200011': { group: 20001 },
    '201221': { group: 20122 },
  };

  it('empty overrides leave the output identical (no rebake needed)', () => {
    expect(applySkillCategoriesOverrides(base, {})).toEqual(base);
    expect(applySkillCategoriesOverrides(base, { setBySkill: {}, removeSkillIds: [] })).toEqual(base);
  });

  it('setBySkill replaces / adds records last (overrides win) without mutating the base', () => {
    const out = applySkillCategoriesOverrides(base, {
      setBySkill: {
        '201221': { group: 30122 }, // replace
        '999999': { group: 0 },     // add
      },
    });
    expect(out['201221']).toEqual({ group: 30122 });
    expect(out['999999']).toEqual({ group: 0 });
    expect(base['201221']).toEqual({ group: 20122 }); // base untouched
  });

  it('removeSkillIds drops records', () => {
    const out = applySkillCategoriesOverrides(base, { removeSkillIds: ['200011'] });
    expect(out['200011']).toBeUndefined();
    expect(out['201221']).toBeDefined();
  });
});
