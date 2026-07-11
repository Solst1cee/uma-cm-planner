// @vitest-environment node
//
// Guard for CRITICAL-1 (whole-branch review): the main-thread M2 engine seam
// MUST initialize the wasm engine before running run.ts's SYNC entries. run.ts
// deliberately does not auto-init, so calling `evalSkillDelta`/`runPlannerCompare`
// (via rankBaskets' REAL_DEPS) on a fresh, uninitialized engine throws from the
// pkg glue — the RED case pinned below. `rankBasketsWithEngine` is the fix: it
// awaits `ensureMainThreadEngine()` first.
//
// This exercises the REAL seam (rankBasketsWithEngine / ensureMainThreadEngine
// run unmocked). Only the byte-source is swapped: `initEngineFromUrl` is
// redirected to `initEngineFromFs`, because node cannot `fetch()` a Vite `?url`
// asset the way a browser worker can — the exact same "mock the external
// boundary, test our own logic" shape as init.test.ts mocking the bundle's
// `initWasm`. `vi.resetModules()` gives each test a fresh, uninitialized engine
// module graph so the RED case is genuinely pre-init.
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CaptureBundle } from '@/core/spOptimizer';
import bundle from '@/core/__fixtures__/m2/basic-screen.json';

afterEach(() => {
  vi.doUnmock('@/sim/init');
  vi.resetModules();
});

/** Fresh, uninitialized engine graph with init.ts's URL fetch redirected to the
 *  committed-wasm fs read. `ensureMainThreadEngine`/`rankBasketsWithEngine` stay
 *  real — only how the bytes are obtained is swapped. */
async function freshRankModule() {
  vi.resetModules();
  vi.doMock('@/sim/init', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/sim/init')>();
    return { ...actual, initEngineFromUrl: () => actual.initEngineFromFs() };
  });
  return await import('@/features/sp-optimizer/rankBaskets');
}

describe('main-thread M2 engine seam', () => {
  it('RED: rankBaskets (REAL_DEPS) throws on a fresh, uninitialized engine', async () => {
    const { rankBaskets } = await freshRankModule();
    // No init anywhere in this graph: the first sync runCompare throws from the
    // uninitialized pkg glue. This is exactly what the old page's direct
    // rankBaskets(b) call would have hit on the first Analyze click.
    expect(() => rankBaskets(bundle as CaptureBundle, { nsamples: 8 })).toThrow();
  });

  it('GREEN: rankBasketsWithEngine initializes the engine first, then ranks', async () => {
    const { rankBasketsWithEngine } = await freshRankModule();
    // Same fresh, uninitialized graph — the ONLY difference from RED is that this
    // seam awaits ensureMainThreadEngine() before touching the sync engine.
    const result = await rankBasketsWithEngine(bundle as CaptureBundle, { nsamples: 8 });
    expect(result.baskets.length).toBeGreaterThan(0);
  });
});
