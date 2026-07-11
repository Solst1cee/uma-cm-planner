// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initEngineFromFs } from './init';
import {
  evalSkillDelta, simulatableBase, runVacuumCompare, runPlannerCompare,
  runSkillTrace, skillImpact, runRaceCompare, allActivationRegions,
} from './run';
import type { SimBuild } from './types';
import type { SimulationRun } from '@/sim/vendor/umalator-wasm.bundle.mjs';

// The wasm engine is synchronous AFTER a one-time async init — every entry assumes
// the caller inited (worker in Task 5 / tests here). A throwaway warm-up call after
// init absorbs the Task-0 lazy-static first-call warm-up so same-seed determinism
// checks compare stabilized calls, not call-1-vs-call-2.
beforeAll(async () => {
  await initEngineFromFs();
  evalSkillDelta(
    { umaId: '', stats: { spd: 1000, sta: 800, pow: 900, gut: 500, wit: 800 }, strategy: 'pace',
      aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, skills: [] },
    { courseId: '10101' }, '200332', 2, 1,
  );
});

// Canonical skill-id names used below (shared with fidelity.test.ts):
// 200332 = Corner Adept ○ (trigger all_corner_random),
// 200331 = Professor of Curvature (all_corner_random, short cooldown — multi-fire).
const build: SimBuild = {
  umaId: '',
  stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
  strategy: 'pace',
  aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
  skills: [],
};

describe('evalSkillDelta', () => {
  it('returns n results sorted ascending, with activated=true for a firing skill', () => {
    // Corner Adept ○ (200332) on Sapporo turf 1200m (10101) — fires on corners.
    const stats = evalSkillDelta(build, { courseId: '10101' }, '200332', 30, 12345);
    expect(stats.nsamples).toBe(30);
    expect(stats.results).toHaveLength(30);
    expect(Number.isFinite(stats.mean)).toBe(true);
    // results come back sorted ascending (BashinStats contract).
    for (let i = 1; i < stats.results.length; i++) {
      expect(stats.results[i]!).toBeGreaterThanOrEqual(stats.results[i - 1]!);
    }
    expect(stats.min).toBe(stats.results[0]);
    expect(stats.max).toBe(stats.results[stats.results.length - 1]);
    expect(stats.activated).toBe(true);
  });

  it('is deterministic for a fixed seed (identical stats twice)', () => {
    const a = evalSkillDelta(build, { courseId: '10101' }, '200332', 20, 999);
    const b = evalSkillDelta(build, { courseId: '10101' }, '200332', 20, 999);
    expect(b.results).toEqual(a.results);
    expect(b.mean).toBe(a.mean);
  });

  it('returns EMPTY for an unknown / non-simulatable tracked id (no throw)', () => {
    const stats = evalSkillDelta(build, { courseId: '10101' }, '000000', 10, 1);
    expect(stats).toEqual({ mean: 0, median: 0, min: 0, max: 0, nsamples: 0, results: [] });
  });

  it('guards nsamples < 1 (returns EMPTY, no engine crash)', () => {
    const stats = evalSkillDelta(build, { courseId: '10101' }, '200332', 0, 1);
    expect(stats.nsamples).toBe(0);
    expect(stats.mean).toBe(0);
  });

  it('does not throw on an engine-unknown baseline id (filtered via simulatableBase)', () => {
    const withBogus = { ...build, skills: ['zzz-bogus-id'] };
    expect(() => evalSkillDelta(withBogus, { courseId: '10101' }, '200332', 6, 1)).not.toThrow();
    expect(evalSkillDelta(withBogus, { courseId: '10101' }, '200332', 6, 1).nsamples).toBe(6);
  });
});

describe('simulatableBase', () => {
  const base = {
    umaId: '100201', stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
    strategy: 'pace' as const, aptitudes: { distance: 'A', surface: 'A', strategy: 'A' } as const,
    skills: [],
  };

  it('drops ids the engine cannot simulate (no throw on unknown ids)', () => {
    expect(simulatableBase({ ...base, skills: ['zzz-bogus-id'] }).skills).toEqual([]);
  });

  it('removes a bogus baseline id while leaving valid ids + the rest of the build intact', () => {
    const out = simulatableBase({ ...base, skills: ['200332', 'zzz-bogus-id'] });
    expect(out.skills).toEqual(['200332']);
    expect(out.stats).toEqual(base.stats);
    expect(out.strategy).toBe('pace');
  });

  it('keeps the skillLevels map after filtering skills', () => {
    const b: SimBuild = {
      umaId: '106801', stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 },
      strategy: 'front', aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
      skills: ['100011'], skillLevels: { '100011': 5 },
    };
    expect(simulatableBase(b).skillLevels).toEqual({ '100011': 5 });
  });
});

const buildB: SimBuild = { ...build, stats: { spd: 1100, sta: 850, pow: 950, gut: 520, wit: 880 } };

describe('runVacuumCompare', () => {
  it('returns a per-sample finish-HP array of length n for both runners', () => {
    const r = runVacuumCompare(build, buildB, { courseId: '10101' }, 30, 1);
    expect(r.aFinalHp).toHaveLength(30);
    expect(r.bFinalHp).toHaveLength(30);
    expect(r.aFinalHp.every((h) => typeof h === 'number')).toBe(true);
    expect(r.bFinalHp.every((h) => typeof h === 'number')).toBe(true);
  });

  it('returns bashin gap + first-place + stamina rates in [0,1]', () => {
    const r = runVacuumCompare(build, buildB, { courseId: '10101' }, 30, 7);
    expect(r.nsamples).toBe(30);
    expect(Number.isFinite(r.mean)).toBe(true);
    expect(r.aFirstPlaceRate).toBeGreaterThanOrEqual(0);
    expect(r.aFirstPlaceRate).toBeLessThanOrEqual(1);
    expect(r.aStaminaSurvival).toBeGreaterThanOrEqual(0);
    expect(r.aStaminaSurvival).toBeLessThanOrEqual(1);
  });

  it('surfaces full-spurt rate in [0,1]', () => {
    const r = runVacuumCompare(build, buildB, { courseId: '10101' }, 30, 1);
    expect(r.aFullSpurtRate).toBeGreaterThanOrEqual(0);
    expect(r.aFullSpurtRate).toBeLessThanOrEqual(1);
    expect(r.bFullSpurtRate).toBeGreaterThanOrEqual(0);
    expect(r.bFullSpurtRate).toBeLessThanOrEqual(1);
  });

  it('accepts the downhill option and returns a valid stamina survival number', () => {
    // 10811 = Hanshin 3200m (long course with downhill slopes); option must be accepted, no throw.
    const r = runVacuumCompare(build, buildB, { courseId: '10811' }, 20, 7, { downhill: true });
    expect(r.aStaminaSurvival).toBeGreaterThanOrEqual(0);
    expect(r.aStaminaSurvival).toBeLessThanOrEqual(1);
  });

  it('accepts injected stamina debuffs (representative ids stay simulatable)', () => {
    // The Stamina tab injects representative debuff ids (white 201222 / gold 201221). They
    // bypass simulatableBase (per-runner injectedDebuffs), so guard they stay simulatable.
    const injectedDebuffs = {
      uma1: [
        { skillId: '201222', position: 400 },
        { skillId: '201221', position: 800 },
      ],
      uma2: [],
    };
    const r = runVacuumCompare(build, buildB, { courseId: '10101' }, 20, 1, { injectedDebuffs });
    expect(r.aFinalHp).toHaveLength(20);
    expect(r.aFinalHp.every((h) => typeof h === 'number')).toBe(true);
  });
});

describe('runPlannerCompare', () => {
  it('returns a bashin delta tracking candidate skills', () => {
    const r = runPlannerCompare(build, { courseId: '10101' }, ['200332'], 20, 3);
    expect(r.nsamples).toBe(20);
    expect(Number.isFinite(r.mean)).toBe(true);
  });
});

describe('runSkillTrace', () => {
  it('returns populated with/without frame arrays and activation regions within [0, distance]', () => {
    const t = runSkillTrace(build, { courseId: '10101' }, '200332', 20, 42);
    expect(t.nsamples).toBe(20);
    const m = t.runs.median;
    expect(m.withSkill.length).toBeGreaterThan(0);
    expect(m.without.length).toBeGreaterThan(0);
    const f = m.withSkill[0]!;
    expect(Number.isFinite(f.t)).toBe(true);
    expect(Number.isFinite(f.v)).toBe(true);
    expect(Number.isFinite(t.meanL)).toBe(true);
    // Both with/without frame arrays are populated + activation regions lie inside the
    // course (Sapporo 1200m turf). The two runners finish in independent frame counts
    // (the with-skill runner is faster), so the arrays are NOT required to be equal-length.
    for (const run of Object.values(t.runs)) {
      expect(run.withSkill.length).toBeGreaterThan(0);
      expect(run.without.length).toBeGreaterThan(0);
      for (const region of run.activation) {
        expect(region.start).toBeGreaterThanOrEqual(0);
        expect(region.end).toBeLessThanOrEqual(1200 + 1);
        expect(region.end).toBeGreaterThanOrEqual(region.start);
      }
    }
  });

  it('is empty (no throw) for a non-simulatable skill', () => {
    const t = runSkillTrace(build, { courseId: '10101' }, '000000', 10, 1);
    expect(t.nsamples).toBe(0);
    expect(t.runs.median.withSkill).toHaveLength(0);
  });

  it('is empty for a zero-speed build (guards firstPositionInLateRace)', () => {
    const zero = { ...build, stats: { ...build.stats, spd: 0 } };
    expect(runSkillTrace(zero, { courseId: '10101' }, '200332', 10, 1).nsamples).toBe(0);
  });

  it('does not throw on an engine-unknown baseline id (filtered via simulatableBase)', () => {
    const withBogus = { ...build, skills: ['zzz-bogus-id'] };
    expect(() => runSkillTrace(withBogus, { courseId: '10101' }, '200332', 6, 1)).not.toThrow();
    expect(runSkillTrace(withBogus, { courseId: '10101' }, '200332', 6, 1).nsamples).toBeGreaterThan(0);
  });
});

describe('skillImpact', () => {
  it('returns per-sample {horseLength, positions}; samples ⊆ nsamples, positions in-range', () => {
    const r = skillImpact(build, { courseId: '10101' }, '200332', 50, 5);
    expect(r.nsamples).toBe(50);
    expect(r.distance).toBeGreaterThan(0); // Sapporo 1200m turf
    expect(r.samples.length).toBeGreaterThan(0);
    expect(r.samples.length).toBeLessThanOrEqual(50); // one entry per activating sample
    const s = r.samples[0]!;
    expect(Number.isFinite(s.horseLength)).toBe(true);
    expect(Array.isArray(s.positions)).toBe(true);
    for (const sample of r.samples) {
      for (const p of sample.positions) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(r.distance + 1);
      }
    }
  });

  it('is empty for a non-simulatable skill', () => {
    expect(skillImpact(build, { courseId: '10101' }, '000000', 20, 1)).toEqual({ samples: [], nsamples: 0, distance: 0 });
  });

  it('is empty for a zero-speed build', () => {
    const zero = { ...build, stats: { ...build.stats, spd: 0 } };
    expect(skillImpact(zero, { courseId: '10101' }, '200332', 10, 1)).toEqual({ samples: [], nsamples: 0, distance: 0 });
  });

  it('does not throw on an engine-unknown baseline id (filtered via simulatableBase)', () => {
    const withBogus = { ...build, skills: ['zzz-bogus-id'] };
    expect(() => skillImpact(withBogus, { courseId: '10101' }, '200332', 8, 1)).not.toThrow();
    expect(skillImpact(withBogus, { courseId: '10101' }, '200332', 8, 1).nsamples).toBe(8);
  });
});

describe('runRaceCompare', () => {
  const uma1: SimBuild = { ...build, skills: ['200332'] }; // Corner Adept ○
  const uma2: SimBuild = { ...buildB, skills: [] };

  it('maps both runners + a gap curve (length > 0) over a real run', () => {
    const rc = runRaceCompare(uma1, uma2, { courseId: '10101' }, 20, 42);
    expect(rc.nsamples).toBe(20);
    expect(rc.distance).toBeGreaterThan(0);
    expect(Number.isFinite(rc.meanBashin)).toBe(true);
    const m = rc.runs.median;
    expect(m.uma1Frames.length).toBeGreaterThan(0);
    expect(m.uma2Frames.length).toBeGreaterThan(0);
    expect(m.gap.length).toBeGreaterThan(0);
    // gap is computed at uma1 positions, value = (pos1 - pos2)/2.5
    expect(m.gap.length).toBe(m.uma1Frames.length);
    expect(m.gap[0]!.pos).toBeCloseTo(m.uma1Frames[0]!.pos, 5);
    // uma1 has a skill → at least one activation region somewhere across the reps.
    expect(Object.values(rc.runs).some((r) => r.uma1Acts.length > 0)).toBe(true);
  });

  it('is deterministic for a fixed seed', () => {
    const a = runRaceCompare(uma1, uma2, { courseId: '10101' }, 15, 7);
    const b = runRaceCompare(uma1, uma2, { courseId: '10101' }, 15, 7);
    expect(b.meanBashin).toBe(a.meanBashin);
    expect(b.runs.median.gap.map((g) => g.bashin)).toEqual(a.runs.median.gap.map((g) => g.bashin));
  });

  it('guards 0-speed and nsamples<1 (empty, no crash)', () => {
    const dead: SimBuild = { ...uma1, stats: { spd: 0, sta: 0, pow: 0, gut: 0, wit: 0 } };
    expect(runRaceCompare(dead, uma2, { courseId: '10101' }, 10, 1).nsamples).toBe(0);
    expect(runRaceCompare(uma1, uma2, { courseId: '10101' }, 0, 1).nsamples).toBe(0);
  });

  it('does not throw on an engine-unknown skill id in either deck (filtered via simulatableBase)', () => {
    const badUma1: SimBuild = { ...build, skills: ['200332', 'zzz-bogus-id'] };
    const badUma2: SimBuild = { ...buildB, skills: ['zzz-bogus-id'] };
    expect(() => runRaceCompare(badUma1, badUma2, { courseId: '10101' }, 6, 1)).not.toThrow();
    expect(runRaceCompare(badUma1, badUma2, { courseId: '10101' }, 6, 1).nsamples).toBeGreaterThan(0);
  });
});

describe('allActivationRegions (effect-log grouping — pure)', () => {
  // Only skillActivations[runner] is read; synthesize a minimal run.
  const mk = (acts: Record<string, { skillId: string; start: number; end: number }[]>): SimulationRun =>
    ({ skillActivations: [{}, acts] } as unknown as SimulationRun);

  it('collapses multiple effect-logs at the same start into ONE region (longest window wins)', () => {
    const r = allActivationRegions(
      mk({ A: [{ skillId: 'A', start: 100, end: 100 }, { skillId: 'A', start: 100, end: 130 }] }),
      1,
    );
    expect(r).toEqual([{ skillId: 'A', start: 100, end: 130 }]);
  });

  it('keeps genuine multi-fire (distinct starts) as separate regions', () => {
    const r = allActivationRegions(
      mk({ B: [{ skillId: 'B', start: 200, end: 210 }, { skillId: 'B', start: 500, end: 510 }] }),
      1,
    );
    expect(r).toEqual([
      { skillId: 'B', start: 200, end: 210 },
      { skillId: 'B', start: 500, end: 510 },
    ]);
  });
});

describe('cooldown multi-fire (flag default ON)', () => {
  // Professor of Curvature (200331, all_corner_random, short cd) re-fires on a long course.
  // Multi-fire surfaces as a sample whose tracked-skill activation has ≥2 fire positions.
  // (The exact "2 markers in the max-representative run on Hanshin 3200m" — which
  // representative sample happens to double — is a fidelity oracle owned by Task 6; here we
  // assert the engine-level behavior directly via skillImpact positions, independent of
  // representative-run selection.)
  const stayer: SimBuild = {
    umaId: '', stats: { spd: 1150, sta: 1100, pow: 1000, gut: 600, wit: 900 },
    strategy: 'pace', aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, skills: [],
  };

  it('re-fires (some samples double) on a 3200m course', () => {
    const long = skillImpact(stayer, { courseId: '10811' }, '200331', 200, 1234);
    expect(long.distance).toBe(3200);
    expect(long.samples.some((s) => s.positions.length >= 2)).toBe(true);
  });

  it('does not double-fire on a shorter (2200m) course', () => {
    const short = skillImpact(stayer, { courseId: '10906' }, '200331', 200, 1234);
    expect(short.samples.length).toBeGreaterThan(0);
    expect(short.samples.every((s) => s.positions.length <= 1)).toBe(true);
  });
});
