/** Regression test: deps-absent path (UmaChartPanel production mount) threads uniqueLevel.
 *  The production page mounts UmaChartPanel without a skillDelta dep, so chartDeps only
 *  carries uniqueLevel. useStreamingRank.run() must merge sharedDeps() + the provided
 *  uniqueLevel so that the rank callback receives the correct level — NOT fall back to
 *  the sharedDeps() default (which has no uniqueLevel, so rankUmaChart would use Lv5).
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { StreamingRankDeps } from './useStreamingRank';
import { useStreamingRank } from './useStreamingRank';

// Mock the shared SimClient so we never touch a real Worker in jsdom.
vi.mock('@/sim/client', () => ({
  SimClient: class {
    skillDelta = vi.fn(async () => ({ mean: 0, median: 0, min: 0, max: 0, nsamples: 1, results: [] }));
  },
}));

describe('useStreamingRank — uniqueLevel threading', () => {
  it('deps with only uniqueLevel (no skillDelta) passes uniqueLevel through to the rank callback', async () => {
    // This simulates the production path: UmaChartPanel builds
    //   chartDeps = { uniqueLevel: plan.uniqueSkillLevel ?? 5 }   (no skillDelta)
    // and passes it as deps to useUmaChart → useStreamingRank.
    const capturedDeps: StreamingRankDeps[] = [];

    const { result } = renderHook(() =>
      useStreamingRank<number>({
        total: 1,
        sig: 'test',
        compare: (a, b) => a - b,
        rank: async (deps, onRow) => {
          capturedDeps.push(deps);
          onRow(deps.uniqueLevel ?? -1);
          return [deps.uniqueLevel ?? -1];
        },
        deps: { uniqueLevel: 3 }, // only uniqueLevel, no skillDelta
      }),
    );

    act(() => result.current.run());
    // Wait for the async rank to finish
    await vi.waitFor(() => expect(result.current.status).toBe('done'));

    expect(capturedDeps).toHaveLength(1);
    // The merged deps must carry uniqueLevel 3 from the provided partial deps
    expect(capturedDeps[0]!.uniqueLevel).toBe(3);
    // And must have a skillDelta from sharedDeps() fallback (the shared SimClient)
    expect(typeof capturedDeps[0]!.skillDelta).toBe('function');
    // The rank output (rows) confirms the level was threaded correctly
    expect(result.current.rows).toEqual([3]);
  });
});
