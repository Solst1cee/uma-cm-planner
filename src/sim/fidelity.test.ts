// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { runSkillComparison, coursesService } from '@/sim/vendor/umalator.bundle.mjs';
import { evalSkillDelta } from './run';
import { initEngineFromFs } from './init';
import type { SimBuild } from './types';

// `evalSkillDelta` now runs the v0.27.0 WASM engine (Task 4) → needs init. The
// upstream-parity golden (test 1) uses the OLD bundle directly and is unaffected.
// NOTE: the WASM fidelity re-baseline (new goldens + parity record) is Task 6; this
// file keeps only the engine-agnostic sanity here until then.
beforeAll(async () => { await initEngineFromFs(); });

// Exact inputs from the engine's own scripts/adversarial-smoke.ts.
const smokeBuild: SimBuild = {
  umaId: '',
  stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
  strategy: 'pace',
  aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
  skills: [],
};
const EXPECTED_MEAN = 0.2202; // Recorded from bundle smoke on the cooldownReactivation:false (upstream-identical) path: mean=0.2202 (seed 12345, 50 samples)

describe('vendored bundle fidelity', () => {
  it('reproduces the upstream adversarial-smoke mean for the same seed', () => {
    // Recreate the smoke exactly: 50 samples, seed 12345, ignoreStaminaConsumption true.
    const course = coursesService.getSimCourse(10101);
    const runner = {
      outfitId: '', speed: 1150, stamina: 800, power: 1000, guts: 500, wisdom: 850,
      strategy: 'Pace Chaser' as const, distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2 as const, skills: [] as string[],
    };
    const r = runSkillComparison({
      trackedSkillId: '200332', nsamples: 50, course,
      racedef: { ground: 1, weather: 1, season: 3, time: 2, grade: 100 },
      runnerA: runner, runnerB: { ...runner, skills: ['200332'] },
      // OFF path: this is the canonical upstream-parity anchor, so it must ride the
      // byte-identical single-fire path (200332 is an eligible multi-fire skill).
      options: { seed: 12345, ignoreStaminaConsumption: true, cooldownReactivation: false },
    });
    expect(r.results).toHaveLength(50);
    expect(Number(r.mean.toFixed(4))).toBe(Number(EXPECTED_MEAN.toFixed(4)));
  });

  it('Corner Adept gives a non-negative mean on a cornered course (sanity)', () => {
    const stats = evalSkillDelta(smokeBuild, { courseId: '10101' }, '200332', 50, 12345);
    expect(stats.mean).toBeGreaterThanOrEqual(0);
  });
});
