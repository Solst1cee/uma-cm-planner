/**
 * Plan #1 exit gate (spec §6). Uses the REAL vendored engine (no injected
 * fake) with the fixture bundle's fixed seed, asserting determinism and the
 * exact-branch invariants. Single-skill Δ-L vs VFalator is a MANUAL check
 * (see docs/mechanics-notes.md §11).
 */
import { describe, expect, it } from 'vitest';

import type { CaptureBundle } from '@/core/spOptimizer';
import { rankBaskets } from '@/features/sp-optimizer/rankBaskets';
import bundle from '@/core/__fixtures__/m2/basic-screen.json';

describe('rankBaskets validation (real engine, fixed seed)', () => {
  it('is deterministic across runs with the same seed', () => {
    const a = rankBaskets(bundle as CaptureBundle, { nsamples: 64 });
    const b = rankBaskets(bundle as CaptureBundle, { nsamples: 64 });
    expect(a.baskets).toEqual(b.baskets);
  });

  it('returns ≤3 baskets, each within budget, ranked descending', () => {
    const r = rankBaskets(bundle as CaptureBundle, { nsamples: 64 });
    expect(r.baskets.length).toBeLessThanOrEqual(3);
    for (const b of r.baskets) {
      expect(b.spUsed).toBeLessThanOrEqual((bundle as CaptureBundle).context.spBudget);
    }
    const scores = r.baskets.map((b) => b.score);
    expect(scores).toEqual([...scores].sort((x, y) => y - x));
  });
});
