// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { evalSkillDelta } from './run';
import { initEngineFromFs } from './init';
import type { SimBuild, SimRaceParams } from './types';

// `evalSkillDelta` now runs the v0.27.0 WASM engine (Task 4) → needs init. The
// skillLevels transform is verified purely in adapter.test.ts (Task 3); this KEPT
// end-to-end directional check exercises the transform THROUGH the live engine (a
// layer adapter.test.ts's pure-transform tests don't cover), and it never touched the
// old bundle so it survived the Task-9 deletion unchanged.
beforeAll(async () => { await initEngineFromFs(); });

// Shooting Star (Special Week unique) on a course where it fires (phase>=2, mid-pack).
const SKILL = '100011';
const base: SimBuild = {
  umaId: '100101', // Special Week (outfit id; any uma that can run is fine for solo vacuum)
  stats: { spd: 1400, sta: 1000, pow: 1100, gut: 600, wit: 1100 },
  strategy: 'pace',
  aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
  skills: [],
};
const race: SimRaceParams = { courseId: '10906', ground: 1, weather: 1, season: 1, time: 2, grade: 100 };

describe('unique-skill level scaling', () => {
  it('Lv6 yields a strictly larger mean L than Lv1', () => {
    const lv1 = evalSkillDelta({ ...base, skillLevels: { [SKILL]: 1 } }, race, SKILL, 200, 1);
    const lv6 = evalSkillDelta({ ...base, skillLevels: { [SKILL]: 6 } }, race, SKILL, 200, 1);
    expect(lv1.nsamples).toBe(200);
    expect(lv6.mean).toBeGreaterThan(lv1.mean);
    // Bounded magnitude: Lv6/Lv1 ratio reflects the coef scaling (~+13% for type-27 at Lv6).
    // Seed 1 makes this deterministic; a wide band protects against minor engine changes.
    const ratio = lv6.mean / lv1.mean;
    expect(ratio).toBeGreaterThan(1.02);
    expect(ratio).toBeLessThan(1.25);
  });
});
