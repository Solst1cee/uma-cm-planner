import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { BashinStats, SimBuild } from '@/sim';
import { useSkillRank } from './useSkillRank';

const bs = (mean: number): BashinStats => ({ mean, median: mean, min: mean, max: mean, nsamples: 30, results: [] });
const build = { stats: { spd: 1200 }, strategy: 'end' } as unknown as SimBuild;

describe('useSkillRank', () => {
  it('does not simulate until run() is called', () => {
    const skillDelta = vi.fn(async () => bs(1));
    renderHook(() => useSkillRank(build, { courseId: '10906' }, ['a'], { skillDelta }));
    expect(skillDelta).not.toHaveBeenCalled();
  });

  it('run() simulates, streams rows sorted, and finishes', async () => {
    const skillDelta = vi.fn(async (_b: SimBuild, _r: unknown, id: string) => bs(id === 'a' ? 2 : 1));
    const { result } = renderHook(() => useSkillRank(build, { courseId: '10906' }, ['b', 'a'], { skillDelta }));
    expect(result.current.status).toBe('idle');
    act(() => result.current.run());
    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.rows.map((r) => r.skillId)).toEqual(['a', 'b']); // L desc
  });

  it('flips isStale when the build changes after a run, without recomputing', async () => {
    const skillDelta = vi.fn(async () => bs(1));
    const { result, rerender } = renderHook(
      ({ b }) => useSkillRank(b, { courseId: '10906' }, ['a'], { skillDelta }),
      { initialProps: { b: build } },
    );
    act(() => result.current.run());
    await waitFor(() => expect(result.current.status).toBe('done'));
    const callsAfterRun = skillDelta.mock.calls.length;
    rerender({ b: { stats: { spd: 800 }, strategy: 'end' } as unknown as SimBuild });
    expect(result.current.isStale).toBe(true);
    expect(skillDelta.mock.calls.length).toBe(callsAfterRun); // no auto recompute
  });

  it('flips isStale when the baseline build.skills changes (wishlist baseline)', async () => {
    const skillDelta = vi.fn(async () => bs(1));
    const base = { stats: { spd: 1200 }, strategy: 'end', skills: [] } as unknown as SimBuild;
    const { result, rerender } = renderHook(
      ({ b }) => useSkillRank(b, { courseId: '10906' }, ['a'], { skillDelta }),
      { initialProps: { b: base } },
    );
    act(() => result.current.run());
    await waitFor(() => expect(result.current.status).toBe('done'));
    // targeting a non-ranked wishlist skill grows the baseline deck (ids unchanged)
    rerender({ b: { ...base, skills: ['recovery-1'] } as unknown as SimBuild });
    expect(result.current.isStale).toBe(true);
  });

  it('stop() cancels an in-flight run, settles to done, and ignores later-resolving sims', async () => {
    const resolvers: Array<(v: BashinStats) => void> = [];
    const skillDelta = vi.fn(() => new Promise<BashinStats>((res) => { resolvers.push(res); }));
    const { result } = renderHook(() => useSkillRank(build, { courseId: '10906' }, ['a', 'b'], { skillDelta }));
    act(() => result.current.run());
    expect(result.current.status).toBe('running');
    act(() => result.current.stop());
    expect(result.current.status).toBe('done');
    // resolve the sim that was in flight when we stopped — it must not add a row
    await act(async () => { resolvers.forEach((r) => r(bs(1))); await Promise.resolve(); });
    expect(result.current.rows).toHaveLength(0);
  });
});
