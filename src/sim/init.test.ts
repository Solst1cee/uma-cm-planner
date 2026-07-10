// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { initEngineFromFs } from './init';

describe('initEngineFromFs', () => {
  it('resolves', async () => {
    await expect(initEngineFromFs()).resolves.toBeUndefined();
  });

  it('is idempotent — a second call returns the same (already-settled) promise', async () => {
    const first = initEngineFromFs();
    const second = initEngineFromFs();
    expect(second).toBe(first);
    await expect(second).resolves.toBeUndefined();
  });
});
