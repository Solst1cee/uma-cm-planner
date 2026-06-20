// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { handleSimRequest } from './engine.worker';
import type { SimBuild } from './types';

const build: SimBuild = {
  umaId: '', stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
  strategy: 'pace', aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, skills: [],
};
const buildB: SimBuild = {
  umaId: '', stats: { spd: 1100, sta: 750, pow: 950, gut: 480, wit: 820 },
  strategy: 'pace', aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, skills: [],
};

describe('handleSimRequest', () => {
  it('handles a skillDelta request', () => {
    const res = handleSimRequest({ id: 1, kind: 'skillDelta', build, race: { courseId: '10101' }, skillId: '200332', nsamples: 10, seed: 1 });
    expect(res.ok).toBe(true);
    if (res.ok && res.kind === 'skillDelta') expect(res.stats.nsamples).toBe(10);
  });
  it('returns ok:false with a message on a bad course', () => {
    const res = handleSimRequest({ id: 2, kind: 'skillDelta', build, race: { courseId: '99999999' }, skillId: '200332', nsamples: 5 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/course/i);
  });
  it('handles a vacuum request with first-place rates', () => {
    const res = handleSimRequest({ id: 3, kind: 'vacuum', a: build, b: build, race: { courseId: '10101' }, nsamples: 10, seed: 2 });
    expect(res.ok && res.kind === 'vacuum').toBe(true);
  });
});

describe('handleSimRequest — raceCompare', () => {
  it('handles raceCompare', () => {
    const res = handleSimRequest({ id: 9, kind: 'raceCompare', uma1: build, uma2: buildB, race: { courseId: '10101' }, nsamples: 8, seed: 1 });
    expect(res.ok).toBe(true);
    if (res.ok && res.kind === 'raceCompare') expect(res.result.nsamples).toBe(8);
  });
});

describe('handleSimRequest — skillTrace / skillImpact', () => {
  const b: SimBuild = {
    umaId: '', stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
    strategy: 'pace' as const, aptitudes: { distance: 'A' as const, surface: 'A' as const, strategy: 'A' as const }, skills: [],
  };
  it('dispatches skillTrace', () => {
    const res = handleSimRequest({ id: 1, kind: 'skillTrace', build: b, race: { courseId: '10101' }, skillId: '200332', nsamples: 10, seed: 1 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.kind).toBe('skillTrace');
      if (res.kind === 'skillTrace') expect(res.trace.nsamples).toBe(10);
    }
  });
  it('dispatches skillImpact', () => {
    const res = handleSimRequest({ id: 2, kind: 'skillImpact', build: b, race: { courseId: '10101' }, skillId: '200332', nsamples: 10, seed: 1 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.kind).toBe('skillImpact');
      if (res.kind === 'skillImpact') expect(res.impact.nsamples).toBe(10);
    }
  });
});
