// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { SimClient } from './client';
import { handleSimRequest } from './engine.worker';
import type { SimRequest, SimResponse } from './types';

/** Minimal fake Worker: routes posts through the real pure handler, async. */
class FakeWorker {
  onmessage: ((e: { data: SimResponse }) => void) | null = null;
  postMessage(req: SimRequest) {
    queueMicrotask(() => this.onmessage?.({ data: handleSimRequest(req) }));
  }
  terminate() {}
}

describe('SimClient error handling', () => {
  /** A worker that "crashes" — fires onerror instead of replying. */
  class CrashWorker {
    onmessage: ((e: { data: unknown }) => void) | null = null;
    onerror: ((e: unknown) => void) | null = null;
    onmessageerror: ((e: unknown) => void) | null = null;
    postMessage() { queueMicrotask(() => this.onerror?.({ message: 'boom' })); }
    terminate() {}
  }
  it('rejects pending requests when the worker errors (no hang)', async () => {
    const client = new SimClient(() => new CrashWorker() as unknown as Worker);
    await expect(client.skillDelta(
      { umaId: '', stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 }, strategy: 'pace', aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, skills: [] },
      { courseId: '10101' }, '200332', 5,
    )).rejects.toThrow(/worker/i);
  });
});

describe('SimClient', () => {
  it('resolves a skillDelta request to BashinStats', async () => {
    const client = new SimClient(() => new FakeWorker() as unknown as Worker);
    const stats = await client.skillDelta(
      { umaId: '', stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 }, strategy: 'pace', aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, skills: [] },
      { courseId: '10101' }, '200332', 10, 1,
    );
    expect(stats.nsamples).toBe(10);
  });

  it('rejects when the worker reports an error', async () => {
    const client = new SimClient(() => new FakeWorker() as unknown as Worker);
    await expect(client.skillDelta(
      { umaId: '', stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 }, strategy: 'pace', aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, skills: [] },
      { courseId: '99999999' }, '200332', 5,
    )).rejects.toThrow(/course/i);
  });
});
