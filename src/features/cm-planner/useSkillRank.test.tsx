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
});
