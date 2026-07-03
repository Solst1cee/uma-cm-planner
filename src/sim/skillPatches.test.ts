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

  // Cooldown patches interact with the 2026-06-22 multifire gate: re-fire needs a
  // corner/straight-random policy AND cooldownTime < 5,000,000 (the "no cooldown"
  // single-fire sentinel). patch.cooldown lands on exactly that field (×10000).
  describe('cooldown patches (multi-fire gate interaction)', () => {
    // Professor of Curvature: all_corner_random, upstream cd 300000 → re-fires on
    // Hanshin 3200 (CLAUDE.md: 2× there). cooldown: 499 → 4,990,000 stays under the
    // sentinel (still eligible) but the distance-scaled wait (499 × 3.2s) outlasts
    // the race — the second fire disappears, so mean L strictly drops.
    it('a longer patched cooldown removes the re-fire (smaller mean)', () => {
      const prof = '200331';
      const long: SimRaceParams = { courseId: '10914', ground: 1, weather: 1, season: 1, time: 2, grade: 100 };
      const plain = evalSkillDelta(base, long, prof, 200, 1);
      const patched = evalSkillDelta(
        { ...base, skillPatches: { [prof]: { cooldown: 499 } } }, long, prof, 200, 1,
      );
      expect(patched.mean).toBeLessThan(plain.mean);
    });

    // THE FLIP (curation hazard, pinned): Pace Chaser Corners ◎ has NO upstream
    // cooldown — its cooldownTime is the 5,000,000 sentinel, which the gate reads
    // as single-fire. Patching a cooldown under the sentinel doesn't shorten a
    // wait, it NEWLY ENABLES re-fire (here cooldown: 30 = exactly Professor of
    // Curvature's cd, which re-fires on this course). A curator "adding a
    // cooldown" to such a skill makes it fire MORE, not less.
    it('a cooldown patched onto a sentinel (no-cooldown) skill newly enables re-fire (larger mean)', () => {
      const pcCorners = '201321'; // running_style==2 & all_corner_random==1, cd 5,000,000
      const long: SimRaceParams = { courseId: '10914', ground: 1, weather: 1, season: 1, time: 2, grade: 100 };
      const plain = evalSkillDelta(base, long, pcCorners, 200, 1);
      const patched = evalSkillDelta(
        { ...base, skillPatches: { [pcCorners]: { cooldown: 30 } } }, long, pcCorners, 200, 1,
      );
      expect(plain.activated).toBe(true);
      expect(patched.mean).toBeGreaterThan(plain.mean);
    });
  });
});
