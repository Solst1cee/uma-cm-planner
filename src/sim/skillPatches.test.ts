// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { evalSkillDelta } from './run';
import type { SimBuild, SimRaceParams } from './types';

// Shooting Star (Special Week unique) — proven to fire on 10906 (see skillLevel.test.ts).
// Its speed effect is type 27 with base modifier 0.35 (skill-level-coef provenance header).
const SKILL = '100011';
const base: SimBuild = {
  umaId: '100101',
  stats: { spd: 1400, sta: 1000, pow: 1100, gut: 600, wit: 1100 },
  strategy: 'pace',
  aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
  skills: [],
};
const race: SimRaceParams = { courseId: '10906', ground: 1, weather: 1, season: 1, time: 2, grade: 100 };

describe('engine skillPatches', () => {
  it('identity: absent, empty, and unrelated-skill patches are all byte-identical', () => {
    const plain = evalSkillDelta(base, race, SKILL, 100, 7);
    const empty = evalSkillDelta({ ...base, skillPatches: {} }, race, SKILL, 100, 7);
    const unrelated = evalSkillDelta({ ...base, skillPatches: { '999999': { modifier: 9 } } }, race, SKILL, 100, 7);
    expect(empty).toEqual(plain);
    expect(unrelated).toEqual(plain);
  });

  it('modifier override moves L (0.7 vs base 0.35 → strictly larger mean)', () => {
    const plain = evalSkillDelta(base, race, SKILL, 200, 1);
    const patched = evalSkillDelta({ ...base, skillPatches: { [SKILL]: { modifier: 0.7 } } }, race, SKILL, 200, 1);
    expect(patched.mean).toBeGreaterThan(plain.mean);
  });

  it('duration override moves L (double duration → strictly larger mean)', () => {
    const plain = evalSkillDelta(base, race, SKILL, 200, 1);
    const patched = evalSkillDelta({ ...base, skillPatches: { [SKILL]: { duration: 10 } } }, race, SKILL, 200, 1);
    expect(patched.mean).toBeGreaterThan(plain.mean);
  });

  it('conditions override changes activation (impossible condition → never fires)', () => {
    const patched = evalSkillDelta(
      { ...base, skillPatches: { [SKILL]: { conditions: 'distance_rate>=101' } } },
      race, SKILL, 100, 1,
    );
    expect(patched.activated).toBe(false);
    expect(patched.mean).toBeLessThan(0.05);
  });
});
