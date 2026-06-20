// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { evalSkillDelta } from './run';
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
});
