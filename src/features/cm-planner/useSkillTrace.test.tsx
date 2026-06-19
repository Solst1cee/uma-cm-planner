import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { SkillImpact, SkillTrace, SkillTraceRun } from '@/sim';
import { useSkillTrace } from './useSkillTrace';

const oneRun: SkillTraceRun = { withSkill: [{ t: 0, v: 1, pos: 0, hp: 1 }], without: [{ t: 0, v: 1, pos: 0, hp: 1 }], activation: [], L: 2 };
const trace: SkillTrace = { runs: { min: oneRun, max: oneRun, mean: oneRun, median: oneRun }, meanL: 2, nsamples: 20 };
const ctx = { build: { umaId: 'x', stats: { spd: 1000, sta: 1, pow: 1, gut: 1, wit: 1 }, strategy: 'pace' as const, aptitudes: { distance: 'A' as const, surface: 'A' as const, strategy: 'A' as const }, skills: [] }, race: { courseId: '10101' } };
// 168 activating samples of 400 → derived rate 0.42.
const impact: SkillImpact = { samples: Array.from({ length: 168 }, () => ({ horseLength: 1, positions: [800] })), nsamples: 400, distance: 1200 };

describe('useSkillTrace', () => {
  it('does not simulate while disabled', () => {
    const skillTrace = vi.fn(async () => trace);
    const skillImpact = vi.fn(async () => impact);
    renderHook(() => useSkillTrace('200332', ctx, false, { skillTrace, skillImpact }));
    expect(skillTrace).not.toHaveBeenCalled();
    expect(skillImpact).not.toHaveBeenCalled();
  });

  it('auto-runs BOTH the trace and the impact when enabled; derives the rate', async () => {
    const skillTrace = vi.fn(async () => trace);
    const skillImpact = vi.fn(async () => impact);
    const { result } = renderHook(() => useSkillTrace('200332', ctx, true, { skillTrace, skillImpact }));
    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.run?.L).toBe(2);
    await waitFor(() => expect(result.current.impactStatus).toBe('done'));
    expect(skillImpact).toHaveBeenCalled();
    expect(result.current.impact?.samples.length).toBe(168);
    expect(result.current.rate).toBeCloseTo(0.42, 5); // 168 / 400
  });

  it('na when the build has zero speed', async () => {
    const skillTrace = vi.fn(async () => ({ ...trace, nsamples: 0 }));
    const skillImpact = vi.fn(async () => ({ samples: [], nsamples: 0, distance: 0 } as SkillImpact));
    const dead = { ...ctx, build: { ...ctx.build, stats: { ...ctx.build.stats, spd: 0 } } };
    const { result } = renderHook(() => useSkillTrace('200332', dead, true, { skillTrace, skillImpact }));
    await waitFor(() => expect(result.current.status).toBe('na'));
  });

  it('setRunChoice switches the displayed run without re-simulating', async () => {
    const max: SkillTraceRun = { ...oneRun, L: 9 };
    const skillTrace = vi.fn(async () => ({ ...trace, runs: { ...trace.runs, max } }));
    const skillImpact = vi.fn(async () => impact);
    const { result } = renderHook(() => useSkillTrace('200332', ctx, true, { skillTrace, skillImpact }));
    await waitFor(() => expect(result.current.status).toBe('done'));
    const calls = skillTrace.mock.calls.length;
    act(() => result.current.setRunChoice('max'));
    expect(result.current.run?.L).toBe(9);
    expect(skillTrace.mock.calls.length).toBe(calls);
  });

  it('re-runs when a non-speed stat changes', async () => {
    const skillTrace = vi.fn(async () => trace);
    const skillImpact = vi.fn(async () => impact);
    const { result, rerender } = renderHook(
      ({ sta }) =>
        useSkillTrace('200332', { ...ctx, build: { ...ctx.build, stats: { ...ctx.build.stats, sta } } }, true, { skillTrace, skillImpact }),
      { initialProps: { sta: 800 } },
    );
    await waitFor(() => expect(result.current.status).toBe('done'));
    const calls = skillTrace.mock.calls.length;
    rerender({ sta: 1000 });
    await waitFor(() => expect(skillTrace.mock.calls.length).toBe(calls + 1));
  });
});
