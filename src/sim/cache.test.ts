// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { simCacheKey, makeDeltaCache } from './cache';
import type { SimBuild, SimRaceParams } from './types';

const build: SimBuild = {
  umaId: '', stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
  strategy: 'pace', aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, skills: [],
};
const race: SimRaceParams = { courseId: '10101' };

describe('simCacheKey', () => {
  it('is stable across stat order and bucketed', () => {
    const k1 = simCacheKey(build, race, '200332', 'v1');
    const reordered = { ...build, stats: { wit: 850, spd: 1150, sta: 800, pow: 1000, gut: 500 } };
    expect(simCacheKey(reordered, race, '200332', 'v1')).toBe(k1);
  });
  it('changes when course, skill, strategy, or dataVersion changes', () => {
    const base = simCacheKey(build, race, '200332', 'v1');
    expect(simCacheKey(build, { courseId: '10901' }, '200332', 'v1')).not.toBe(base);
    expect(simCacheKey(build, race, '200999', 'v1')).not.toBe(base);
    expect(simCacheKey({ ...build, strategy: 'front' }, race, '200332', 'v1')).not.toBe(base);
    expect(simCacheKey(build, race, '200332', 'v2')).not.toBe(base);
  });
});

describe('makeDeltaCache', () => {
  it('memoizes by key — computes once per distinct key', () => {
    const compute = vi.fn(() => ({ mean: 1, median: 1, min: 1, max: 1, nsamples: 1, results: [1] }));
    const cache = makeDeltaCache('v1');
    cache.get(build, race, '200332', compute);
    cache.get(build, race, '200332', compute);
    expect(compute).toHaveBeenCalledTimes(1);
  });
});
