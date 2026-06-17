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

import { skillActivationRate } from './run';

describe('skillActivationRate', () => {
  it('returns a rate in [0,1] over nsamples for a real skill', () => {
    const r = skillActivationRate(build, { courseId: '10101' }, '200332', 50, 5);
    expect(r.nsamples).toBe(50);
    expect(r.rate).toBeGreaterThanOrEqual(0);
    expect(r.rate).toBeLessThanOrEqual(1);
  });

  it('returns rate 0 / nsamples 0 for a non-simulatable skill', () => {
    const r = skillActivationRate(build, { courseId: '10101' }, '000000', 20, 1);
    expect(r).toEqual({ rate: 0, nsamples: 0 });
  });
});
