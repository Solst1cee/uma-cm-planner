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
