import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { BashinStats, SimBuild } from '@/sim';
import { useUmaChart } from './useUmaChart';
import type { UmaChartCandidate } from '@/core/rankUmaChart';

const bs = (mean: number): BashinStats => ({ mean, median: mean, min: mean, max: mean, nsamples: 30, results: [] });
const cands: UmaChartCandidate[] = [{ outfitId: 'A', uniqueSkillId: 'uA' }];

describe('useUmaChart', () => {
  it('does not simulate until run() is called', () => {
    const skillDelta = vi.fn(async (_b: SimBuild) => bs(1));
    renderHook(() => useUmaChart(cands, { courseId: '10906' }, { skillDelta }));
    expect(skillDelta).not.toHaveBeenCalled();
  });

  it('run() simulates and produces rows', async () => {
    const skillDelta = vi.fn(async () => bs(1.5));
    const { result } = renderHook(() => useUmaChart(cands, { courseId: '10906' }, { skillDelta }));
    expect(result.current.status).toBe('idle');
    act(() => result.current.run());
    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.rows).toHaveLength(1);
    expect(skillDelta).toHaveBeenCalled();
  });

  it('flips isStale when the course changes after a run, without recomputing', async () => {
    const skillDelta = vi.fn(async () => bs(1));
    const { result, rerender } = renderHook(
      ({ courseId }) => useUmaChart(cands, { courseId }, { skillDelta }),
      { initialProps: { courseId: '10906' } },
    );
    act(() => result.current.run());
    await waitFor(() => expect(result.current.status).toBe('done'));
    const callsAfterRun = skillDelta.mock.calls.length;
    rerender({ courseId: '10501' });
    expect(result.current.isStale).toBe(true);
    expect(skillDelta.mock.calls.length).toBe(callsAfterRun); // no auto recompute
  });

  it('stop() cancels an in-flight run, settles to done, and ignores later-resolving sims', async () => {
    const resolvers: Array<(v: BashinStats) => void> = [];
    const skillDelta = vi.fn(() => new Promise<BashinStats>((res) => { resolvers.push(res); }));
    const { result } = renderHook(() => useUmaChart(cands, { courseId: '10906' }, { skillDelta }));
    act(() => result.current.run());
    expect(result.current.status).toBe('running');
    act(() => result.current.stop());
    expect(result.current.status).toBe('done');
    await act(async () => { resolvers.forEach((r) => r(bs(1))); await Promise.resolve(); });
    expect(result.current.rows).toHaveLength(0);
  });
});
