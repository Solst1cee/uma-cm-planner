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
