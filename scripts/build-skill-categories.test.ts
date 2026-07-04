import { describe, expect, it } from 'vitest';
import { applySkillCategoriesOverrides } from './build-skill-categories';
import type { SkillSortMeta } from '@/core/skillCategory';

describe('applySkillCategoriesOverrides (P5)', () => {
  const base: Record<string, SkillSortMeta> = {
    '200011': { category: 'normal', group: 20001 },
    '201221': { category: 'debuff', group: 20122 },
  };

  it('empty overrides leave the output identical (no rebake needed)', () => {
    expect(applySkillCategoriesOverrides(base, {})).toEqual(base);
    expect(applySkillCategoriesOverrides(base, { setBySkill: {}, removeSkillIds: [] })).toEqual(base);
  });

  it('setBySkill replaces / adds records last (overrides win) without mutating the base', () => {
    const out = applySkillCategoriesOverrides(base, {
      setBySkill: {
        '201221': { category: 'recovery', group: 20122 }, // replace
        '999999': { category: 'green', group: 0 },        // add
      },
    });
    expect(out['201221']).toEqual({ category: 'recovery', group: 20122 });
    expect(out['999999']).toEqual({ category: 'green', group: 0 });
    expect(base['201221']).toEqual({ category: 'debuff', group: 20122 }); // base untouched
  });

  it('removeSkillIds drops records', () => {
    const out = applySkillCategoriesOverrides(base, { removeSkillIds: ['200011'] });
    expect(out['200011']).toBeUndefined();
    expect(out['201221']).toBeDefined();
  });
});
