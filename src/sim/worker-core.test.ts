// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { handleSimRequest } from './engine.worker';
import type { SimBuild } from './types';

const build: SimBuild = {
  umaId: '', stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
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
