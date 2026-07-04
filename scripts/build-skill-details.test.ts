import { describe, expect, it } from 'vitest';
import { applySkillDetailsOverrides, type SkillDetail } from './build-skill-details';

describe('applySkillDetailsOverrides (P5)', () => {
  const base: Record<string, SkillDetail> = {
    '200011': { effect: 'Corner speed up', condition: 'corner==1', durationMs: 30000 },
    '200332': { effect: 'Corner accel up' },
  };

  it('empty overrides leave the output identical (no rebake needed)', () => {
    expect(applySkillDetailsOverrides(base, {})).toEqual(base);
    expect(applySkillDetailsOverrides(base, { setBySkill: {}, removeSkillIds: [] })).toEqual(base);
  });

  it('setBySkill replaces / adds records last (overrides win) without mutating the base', () => {
    const out = applySkillDetailsOverrides(base, {
      setBySkill: {
        '200332': { effect: 'Corrected effect text', durationMs: 40000 }, // replace
        '999999': { effect: 'Hand-added detail' },                        // add
      },
    });
    expect(out['200332']).toEqual({ effect: 'Corrected effect text', durationMs: 40000 });
    expect(out['999999']).toEqual({ effect: 'Hand-added detail' });
    expect(base['200332']).toEqual({ effect: 'Corner accel up' }); // base untouched
  });

  it('removeSkillIds drops records', () => {
    const out = applySkillDetailsOverrides(base, { removeSkillIds: ['200011'] });
    expect(out['200011']).toBeUndefined();
    expect(out['200332']).toBeDefined();
  });
});
