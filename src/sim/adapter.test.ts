// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { toRunnerState, STRATEGY_LABEL } from './adapter';
import type { SimBuild } from './types';

const build: SimBuild = {
  umaId: '100201',
  stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
  strategy: 'pace',
  aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
  skills: ['200332'],
};

describe('toRunnerState', () => {
  it('maps our stat keys to engine fields (wit -> wisdom)', () => {
    const r = toRunnerState(build);
    expect(r.speed).toBe(1150);
    expect(r.stamina).toBe(800);
    expect(r.power).toBe(1000);
    expect(r.guts).toBe(500);
    expect(r.wisdom).toBe(850); // 'wit' maps to engine 'wisdom'
  });

  it('maps strategy label and passes aptitudes + skills through', () => {
    const r = toRunnerState(build);
    expect(r.strategy).toBe('Pace Chaser');
    expect(r.distanceAptitude).toBe('A');
    expect(r.skills).toEqual(['200332']);
    expect(r.outfitId).toBe('100201');
    expect(r.mood).toBe(2); // default Great
  });

  it('STRATEGY_LABEL covers all four of our strategies', () => {
    expect(STRATEGY_LABEL).toEqual({ front: 'Front Runner', pace: 'Pace Chaser', late: 'Late Surger', end: 'End Closer' });
  });
});

import { toRaceDef, resolveCourse, bashinStatsFrom } from './adapter';

describe('toRaceDef', () => {
  it('applies sensible defaults (firm/sunny/G1)', () => {
    const d = toRaceDef({ courseId: '10101' });
    expect(d).toEqual({ ground: 1, weather: 1, season: 3, time: 2, grade: 100 });
  });
  it('lets callers override conditions', () => {
    const d = toRaceDef({ courseId: '10101', ground: 2, grade: 999 });
    expect(d.ground).toBe(2);
    expect(d.grade).toBe(999);
  });
});

describe('resolveCourse', () => {
  it('looks up real engine course geometry by string courseId', () => {
    const c = resolveCourse('10101'); // Sapporo turf 1200m in the engine data
    expect(c.distance).toBe(1200);
    expect(c.surface).toBe(1); // turf
  });
  it('throws a clear error for an unknown course', () => {
    expect(() => resolveCourse('99999999')).toThrow(/course/i);
  });
});

describe('bashinStatsFrom', () => {
  it('projects the engine result onto our BashinStats; empty skillActivations -> activated false', () => {
    const stats = bashinStatsFrom({ results: [1, 2, 3], min: 1, max: 3, mean: 2, median: 2, skillActivations: {}, runData: null });
    expect(stats).toEqual({ mean: 2, median: 2, min: 1, max: 3, nsamples: 3, results: [1, 2, 3], activated: false });
  });
  it('sets activated when the engine recorded an activation for the tracked skill', () => {
    const stats = bashinStatsFrom({ results: [1], min: 1, max: 1, mean: 1, median: 1, skillActivations: { '200332': [{}] }, runData: null });
    expect(stats.activated).toBe(true);
  });
});

const buildWithLevels: SimBuild = {
  umaId: '106801',
  stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 },
  strategy: 'front',
  aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
  skills: ['100011'],
  skillLevels: { '100011': 6 },
};

describe('toRunnerState skillLevels', () => {
  it('maps skillLevels onto the runner state', () => {
    expect(toRunnerState(buildWithLevels).skillLevels).toEqual({ '100011': 6 });
  });
  it('omits skillLevels when not provided', () => {
    const { skillLevels, ...rest } = buildWithLevels;
    expect(toRunnerState(rest).skillLevels).toBeUndefined();
  });
});
