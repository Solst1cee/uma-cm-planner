// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { handleSimRequest, createReadyGate, dispatchWhenReady } from './worker-core';
import { initEngineFromFs } from './init';
import type { SimBuild, SimRequest } from './types';

// `handleSimRequest` calls the SYNC wasm entries in run.ts; the engine must be
// initialized first (the real worker inits at startup — Task 5; node tests init here).
beforeAll(async () => { await initEngineFromFs(); });

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

describe('createReadyGate — init retry semantics (the real worker entry uses this gate)', () => {
  it('memoizes on success: a second call returns the same promise, no re-invocation', async () => {
    let calls = 0;
    const gate = createReadyGate(() => { calls++; return Promise.resolve(); });
    const first = gate();
    await first;
    expect(gate()).toBe(first);
    expect(calls).toBe(1);
  });

  it('shares one in-flight attempt across concurrent callers', () => {
    let calls = 0;
    const gate = createReadyGate(() => { calls++; return new Promise<void>(() => {}); });
    expect(gate()).toBe(gate());
    expect(calls).toBe(1);
  });

  it('does NOT cache a rejection — the next call re-invokes the factory (worker un-bricks itself)', async () => {
    let calls = 0;
    const gate = createReadyGate(() => {
      calls++;
      return calls === 1 ? Promise.reject(new Error('transient wasm fetch blip')) : Promise.resolve();
    });
    await expect(gate()).rejects.toThrow('transient wasm fetch blip');
    await expect(gate()).resolves.toBeUndefined();
    expect(calls).toBe(2);
  });
});

describe('dispatchWhenReady — full per-message worker behavior (init fails once, then recovers)', () => {
  const req = (id: number): SimRequest =>
    ({ id, kind: 'skillDelta', build, race: { courseId: '10101' }, skillId: '200332', nsamples: 5, seed: 1 });

  it('first message gets an honest {ok:false} init error; second message retries init and succeeds', async () => {
    let calls = 0;
    // Factory fails once, then succeeds (the engine itself is already initialized
    // by the suite's beforeAll, so the successful attempt just resolves — this
    // mirrors initEngineFromUrl's memo-cleared retry succeeding on re-fetch).
    const gate = createReadyGate(() => {
      calls++;
      return calls === 1 ? Promise.reject(new Error('net down')) : Promise.resolve();
    });

    const res1 = await dispatchWhenReady(gate, req(1));
    expect(res1.ok).toBe(false);
    expect(res1.id).toBe(1);
    if (!res1.ok) expect(res1.error).toMatch(/failed to initialize.*net down/);

    const res2 = await dispatchWhenReady(gate, req(2));
    expect(calls).toBe(2); // second message re-invoked the init factory
    expect(res2.ok).toBe(true);
    expect(res2.id).toBe(2);
    if (res2.ok && res2.kind === 'skillDelta') expect(res2.stats.nsamples).toBe(5);
  });

  it('messages queued behind a pending init all resolve once it settles (none dropped)', async () => {
    let release!: () => void;
    const gate = createReadyGate(() => new Promise<void>((r) => { release = r; }));
    const p1 = dispatchWhenReady(gate, req(1));
    const p2 = dispatchWhenReady(gate, req(2));
    release();
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.ok && r1.id === 1).toBe(true);
    expect(r2.ok && r2.id === 2).toBe(true);
  });

  it('every request pending during a failed init gets its own error response (no hang)', async () => {
    let fail!: (e: Error) => void;
    const gate = createReadyGate(() => new Promise<void>((_r, rej) => { fail = rej; }));
    const p1 = dispatchWhenReady(gate, req(1));
    const p2 = dispatchWhenReady(gate, req(2));
    fail(new Error('boom'));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
    expect(r1.id).toBe(1);
    expect(r2.id).toBe(2);
  });
});
