import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { SkillTrace, SkillRate, SkillTraceRun } from '@/sim';
import { useSkillTrace } from './useSkillTrace';

const oneRun: SkillTraceRun = { withSkill: [{ t: 0, v: 1, pos: 0, hp: 1 }], without: [{ t: 0, v: 1, pos: 0, hp: 1 }], activation: [], L: 2 };
const trace: SkillTrace = { runs: { min: oneRun, max: oneRun, mean: oneRun, median: oneRun }, meanL: 2, nsamples: 20 };
const ctx = { build: { umaId: 'x', stats: { spd: 1000, sta: 1, pow: 1, gut: 1, wit: 1 }, strategy: 'pace' as const, aptitudes: { distance: 'A' as const, surface: 'A' as const, strategy: 'A' as const }, skills: [] }, race: { courseId: '10101' } };

describe('useSkillTrace', () => {
  it('does not simulate while disabled', () => {
    const skillTrace = vi.fn(async () => trace);
    const skillRate = vi.fn(async () => ({ rate: 0.5, nsamples: 400 } as SkillRate));
    renderHook(() => useSkillTrace('200332', ctx, false, { skillTrace, skillRate }));
    expect(skillTrace).not.toHaveBeenCalled();
  });

  it('auto-runs the trace when enabled and reaches done', async () => {
    const skillTrace = vi.fn(async () => trace);
    const skillRate = vi.fn(async () => ({ rate: 0.5, nsamples: 400 } as SkillRate));
    const { result } = renderHook(() => useSkillTrace('200332', ctx, true, { skillTrace, skillRate }));
    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.run?.L).toBe(2);
    expect(skillRate).not.toHaveBeenCalled(); // rate is button-gated
  });

  it('computeRate runs the rate sim on demand', async () => {
    const skillTrace = vi.fn(async () => trace);
    const skillRate = vi.fn(async () => ({ rate: 0.42, nsamples: 400 } as SkillRate));
    const { result } = renderHook(() => useSkillTrace('200332', ctx, true, { skillTrace, skillRate }));
    await waitFor(() => expect(result.current.status).toBe('done'));
    act(() => result.current.computeRate());
    await waitFor(() => expect(result.current.rateStatus).toBe('done'));
    expect(result.current.rate).toBe(0.42);
  });

  it('na when the build has zero speed', async () => {
    const skillTrace = vi.fn(async () => ({ ...trace, nsamples: 0 }));
    const skillRate = vi.fn(async () => ({ rate: 0, nsamples: 0 } as SkillRate));
    const dead = { ...ctx, build: { ...ctx.build, stats: { ...ctx.build.stats, spd: 0 } } };
    const { result } = renderHook(() => useSkillTrace('200332', dead, true, { skillTrace, skillRate }));
    await waitFor(() => expect(result.current.status).toBe('na'));
  });

  it('setRunChoice switches the displayed run without re-simulating', async () => {
    const max: SkillTraceRun = { ...oneRun, L: 9 };
    const skillTrace = vi.fn(async () => ({ ...trace, runs: { ...trace.runs, max } }));
    const skillRate = vi.fn(async () => ({ rate: 0, nsamples: 0 } as SkillRate));
    const { result } = renderHook(() => useSkillTrace('200332', ctx, true, { skillTrace, skillRate }));
    await waitFor(() => expect(result.current.status).toBe('done'));
    const calls = skillTrace.mock.calls.length;
    act(() => result.current.setRunChoice('max'));
    expect(result.current.run?.L).toBe(9);
    expect(skillTrace.mock.calls.length).toBe(calls); // no re-sim
  });
});
