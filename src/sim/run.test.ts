// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { evalSkillDelta, simulatableBase } from './run';
import type { SimBuild } from './types';

const build: SimBuild = {
  umaId: '',
  stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
  strategy: 'pace',
  aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
  skills: [],
};

describe('evalSkillDelta', () => {
  it('returns a finite mean bashin over nsamples for a real skill', () => {
    // Corner Adept ○ (200332) on Sapporo turf 1200m (10101).
    const stats = evalSkillDelta(build, { courseId: '10101' }, '200332', 30, 12345);
    expect(stats.nsamples).toBe(30);
    expect(Number.isFinite(stats.mean)).toBe(true);
    expect(stats.results).toHaveLength(30);
  });

  it('is deterministic for a fixed seed', () => {
    const a = evalSkillDelta(build, { courseId: '10101' }, '200332', 20, 999);
    const b = evalSkillDelta(build, { courseId: '10101' }, '200332', 20, 999);
    expect(b.results).toEqual(a.results);
    expect(b.mean).toBe(a.mean);
  });

  it('returns a zeroed result for a non-simulatable skill (no throw)', () => {
    const stats = evalSkillDelta(build, { courseId: '10101' }, '000000', 10, 1);
    expect(stats.mean).toBe(0);
    expect(stats.nsamples).toBe(0);
  });

  it('guards nsamples < 1 (returns EMPTY, no engine crash)', () => {
    const stats = evalSkillDelta(build, { courseId: '10101' }, '200332', 0, 1);
    expect(stats.nsamples).toBe(0);
    expect(stats.mean).toBe(0);
  });
});

describe('simulatableBase', () => {
  const base = {
    umaId: '100201', stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
    strategy: 'pace' as const, aptitudes: { distance: 'A', surface: 'A', strategy: 'A' } as const,
    skills: [],
  };

  it('drops ids the engine cannot simulate (no throw on unknown ids)', () => {
    const out = simulatableBase({ ...base, skills: ['zzz-bogus-id'] });
    expect(out.skills).toEqual([]);
  });

  it('removes a bogus baseline id while leaving valid ids + the rest of the build intact', () => {
    const out = simulatableBase({ ...base, skills: ['200332', 'zzz-bogus-id'] });
    expect(out.skills).toEqual(['200332']);   // valid id MUST survive (guards against over-eager filtering)
    expect(out.stats).toEqual(base.stats);
    expect(out.strategy).toBe('pace');
  });
});

describe('evalSkillDelta with a non-simulatable baseline skill', () => {
  it('does not throw — a bogus baseline id is filtered out before the sim runs', () => {
    const buildWithBogus = {
      umaId: '100201', stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
      strategy: 'pace' as const, aptitudes: { distance: 'A', surface: 'A', strategy: 'A' } as const,
      skills: ['zzz-bogus-id'],
    };
    expect(() => evalSkillDelta(buildWithBogus, { courseId: '10101' }, '200332', 4, 1)).not.toThrow();
  });
});

import { runVacuumCompare, runPlannerCompare } from './run';

const buildB: SimBuild = { ...build, stats: { spd: 1100, sta: 850, pow: 950, gut: 520, wit: 880 } };

describe('runVacuumCompare', () => {
  it('returns bashin gap + first-place + stamina rates for A vs B', () => {
    const r = runVacuumCompare(build, buildB, { courseId: '10101' }, 30, 7);
    expect(r.nsamples).toBe(30);
    expect(Number.isFinite(r.mean)).toBe(true);
    expect(r.aFirstPlaceRate).toBeGreaterThanOrEqual(0);
    expect(r.aFirstPlaceRate).toBeLessThanOrEqual(1);
    expect(r.aStaminaSurvival).toBeGreaterThanOrEqual(0);
  });

  it('accepts injected stamina debuffs (representative ids stay simulatable)', () => {
    const injectedDebuffs = {
      uma1: [
        { skillId: '201222', position: 300 }, // white: Stamina Eater
        { skillId: '201221', position: 600 }, // gold: Stamina Siphon
      ],
      uma2: [],
    };
    // must not throw, and must still return valid results
    const r = runVacuumCompare(build, buildB, { courseId: '10101' }, 20, 1, injectedDebuffs);
    expect(r.nsamples).toBe(20);
    expect(r.results).toHaveLength(20);
    expect(r.results.every((h) => typeof h === 'number')).toBe(true);
  });
});

describe('runPlannerCompare', () => {
  it('returns a bashin delta tracking candidate skills', () => {
    const r = runPlannerCompare(build, { courseId: '10101' }, ['200332'], 20, 3);
    expect(r.nsamples).toBe(20);
    expect(Number.isFinite(r.mean)).toBe(true);
  });
});

import { runSkillTrace } from './run';

describe('runSkillTrace', () => {
  it('returns per-frame with/without traces and a finite L', () => {
    const t = runSkillTrace(build, { courseId: '10101' }, '200332', 20, 42);
    expect(t.nsamples).toBe(20);
    expect(t.runs.median.withSkill.length).toBeGreaterThan(0);
    expect(t.runs.median.without.length).toBeGreaterThan(0);
    const f = t.runs.median.withSkill[0]!;
    expect(Number.isFinite(f.t)).toBe(true);
    expect(Number.isFinite(f.v)).toBe(true);
    expect(Number.isFinite(t.meanL)).toBe(true);
  });

  it('is empty (no throw) for a non-simulatable skill', () => {
    const t = runSkillTrace(build, { courseId: '10101' }, '000000', 10, 1);
    expect(t.nsamples).toBe(0);
    expect(t.runs.median.withSkill).toHaveLength(0);
  });

  it('is empty for a zero-speed build (guards firstPositionInLateRace)', () => {
    const zero = { ...build, stats: { ...build.stats, spd: 0 } };
    const t = runSkillTrace(zero, { courseId: '10101' }, '200332', 10, 1);
    expect(t.nsamples).toBe(0);
  });

  it('does not throw on an engine-unknown baseline id (filtered via simulatableBase)', () => {
    const withBogus = { ...build, skills: ['zzz-bogus-id'] };
    expect(() => runSkillTrace(withBogus, { courseId: '10101' }, '200332', 6, 1)).not.toThrow();
    expect(runSkillTrace(withBogus, { courseId: '10101' }, '200332', 6, 1).nsamples).toBeGreaterThan(0);
  });
});

import { skillImpact } from './run';

describe('skillImpact', () => {
  it('returns per-sample {horseLength, positions} + nsamples + course distance for a real skill', () => {
    const r = skillImpact(build, { courseId: '10101' }, '200332', 50, 5);
    expect(r.nsamples).toBe(50);
    expect(r.distance).toBeGreaterThan(0);                 // Sapporo 1200m turf
    expect(r.samples.length).toBeGreaterThan(0);
    expect(r.samples.length).toBeLessThanOrEqual(50);      // one entry per activating sample
    const s = r.samples[0]!;
    expect(Number.isFinite(s.horseLength)).toBe(true);
    expect(Array.isArray(s.positions)).toBe(true);
    for (const p of s.positions) expect(p).toBeGreaterThanOrEqual(0);
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

import { runRaceCompare } from './run';

describe('runRaceCompare', () => {
  const uma1: SimBuild = { ...build, skills: ['200332'] };       // Corner Adept ○
  const uma2: SimBuild = { ...buildB, skills: [] };

  it('maps both runners + gap over a real run', () => {
    const rc = runRaceCompare(uma1, uma2, { courseId: '10101' }, 20, 42);
    expect(rc.nsamples).toBe(20);
    expect(rc.distance).toBeGreaterThan(0);
    expect(Number.isFinite(rc.meanBashin)).toBe(true);
    const m = rc.runs.median;
    expect(m.uma1Frames.length).toBeGreaterThan(0);
    expect(m.uma2Frames.length).toBeGreaterThan(0);
    // gap is computed at uma1 positions, value = (pos1 - pos2)/2.5
    expect(m.gap.length).toBe(m.uma1Frames.length);
    expect(m.gap[0]!.pos).toBeCloseTo(m.uma1Frames[0]!.pos, 5);
    // uma1 has a skill → at least one activation region somewhere across the reps
    const anyAct = Object.values(rc.runs).some((r) => r.uma1Acts.length > 0);
    expect(anyAct).toBe(true);
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
    // A single bad id (inherited-unique 9… / JP-only / imported) must not blank the whole overlay.
    const badUma1: SimBuild = { ...build, skills: ['200332', 'zzz-bogus-id'] };
    const badUma2: SimBuild = { ...buildB, skills: ['zzz-bogus-id'] };
    expect(() => runRaceCompare(badUma1, badUma2, { courseId: '10101' }, 6, 1)).not.toThrow();
    const rc = runRaceCompare(badUma1, badUma2, { courseId: '10101' }, 6, 1);
    expect(rc.nsamples).toBeGreaterThan(0);
  });
});

import { runComparison } from './vendor/umalator.bundle.mjs';
import { toRunnerState, toRaceDef, resolveCourse } from './adapter';
import { allActivationRegions } from './run';
import type { SimulationRun } from './vendor/umalator.bundle.mjs';

describe('allActivationRegions (effect-log grouping)', () => {
  // Only skillActivations[runner] is read; synthesize a minimal run.
  const mk = (acts: Record<string, { skillId: string; start: number; end: number }[]>): SimulationRun =>
    ({ skillActivations: [{}, acts] } as unknown as SimulationRun);

  it('collapses multiple effect-logs at the same start into ONE region (longest window wins)', () => {
    // e.g. Nimble Navigator: a 2-effect activation logs two entries at the same start.
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

const GOLDEN_MEANBASHIN = 0.460891;

describe('cooldown multi-fire', () => {
  const stayer = {
    umaId: '', stats: { spd: 1150, sta: 1100, pow: 1000, gut: 600, wit: 900 },
    strategy: 'pace' as const, aptitudes: { distance: 'A' as const, surface: 'A' as const, strategy: 'A' as const }, skills: [],
  };
  const profPositions = (courseId: string, cooldownReactivation: boolean) => {
    const r = runComparison({
      nsamples: 60, course: resolveCourse(courseId), racedef: toRaceDef({ courseId }),
      uma1: toRunnerState(stayer), uma2: toRunnerState({ ...stayer, skills: ['200331'] }),
      options: { seed: 1234, ignoreStaminaConsumption: false, cooldownReactivation },
    });
    // distinct activation starts for Prof in the max-bashin representative run
    const logs = r.runData.maxrun.skillActivations[1]?.['200331'] ?? [];
    return new Set(logs.map((l: { start: number }) => Math.round(l.start))).size;
  };

  it('flag ON: Prof fires twice on Hanshin 3200m', () => {
    expect(profPositions('10811', true)).toBe(2);
  });
  it('flag ON: Prof fires once on a mile (1600m)', () => {
    // 10304 = a 1600m turf course (see courseCatalog)
    expect(profPositions('10304', true)).toBe(1);
  });
  it('flag OFF: Prof fires once on Hanshin 3200m (upstream behavior)', () => {
    expect(profPositions('10811', false)).toBe(1);
  });
  it('flag OFF reproduces the fidelity golden meanBashin', () => {
    const r = runComparison({
      nsamples: 200, course: resolveCourse('10811'), racedef: toRaceDef({ courseId: '10811' }),
      uma1: toRunnerState(stayer), uma2: toRunnerState({ ...stayer, skills: ['200331'] }),
      options: { seed: 1234, ignoreStaminaConsumption: false, cooldownReactivation: false },
    });
    const mean = r.results.reduce((a: number, b: number) => a + b, 0) / r.results.length;
    expect(mean).toBeCloseTo(GOLDEN_MEANBASHIN, 4);
  });
  it('overlay surfaces both fires: runRaceCompare yields 2 Prof markers (flag default ON)', () => {
    // uma2 has Prof, uma1 does not — the max-gap run biases toward samples where Prof fired
    // (especially twice on 3200 m), so uma2Acts on the max run reliably shows 2 regions.
    const rc = runRaceCompare(stayer, { ...stayer, skills: ['200331'] }, { courseId: '10811' }, 60, 1234);
    const markers = rc.runs.max.uma2Acts.filter((a) => a.skillId === '200331').length;
    expect(markers).toBe(2);
  });
});
