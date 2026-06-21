import { it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRaceCompare, clearRaceCompareCache, type RaceCompareCtx } from './useRaceCompare';
import type { RaceCompare, SimBuild } from '@/sim';

const b = (spd: number, skills: string[] = []): SimBuild =>
  ({ umaId: 'u', stats: { spd, sta: 800, pow: 1000, gut: 500, wit: 850 }, strategy: 'pace',
     aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, skills });
const emptyRun = { uma1Frames: [], uma2Frames: [], uma1Acts: [], uma2Acts: [], gap: [] };
const fake = (meanBashin: number): RaceCompare =>
  ({ runs: { min: emptyRun, max: emptyRun, mean: emptyRun, median: emptyRun }, distance: 1200, nsamples: 30, meanBashin });

beforeEach(() => clearRaceCompareCache());

it('auto-runs and resolves done with the chosen run', async () => {
  const raceCompare = vi.fn(async () => fake(1.5));
  const ctx: RaceCompareCtx = { uma1: b(1150), uma2: b(1100), race: { courseId: '10101' } };
  const { result } = renderHook(() => useRaceCompare(ctx, true, { raceCompare }));
  await waitFor(() => expect(result.current.status).toBe('done'));
  expect(result.current.meanBashin).toBe(1.5);
  expect(result.current.distance).toBe(1200);
  expect(raceCompare).toHaveBeenCalledTimes(1);
});

it('memoizes identical sigs (no second sim)', async () => {
  const raceCompare = vi.fn(async () => fake(1));
  const ctx: RaceCompareCtx = { uma1: b(1150), uma2: b(1100), race: { courseId: '10101' } };
  const a = renderHook(() => useRaceCompare(ctx, true, { raceCompare }));
  await waitFor(() => expect(a.result.current.status).toBe('done'));
  renderHook(() => useRaceCompare(ctx, true, { raceCompare }));
  await waitFor(() => expect(raceCompare).toHaveBeenCalledTimes(1));
});

it('does NOT memoize across differing mood (mood changes the sim result)', async () => {
  const raceCompare = vi.fn(async () => fake(1));
  const ctxA: RaceCompareCtx = { uma1: { ...b(1150), mood: 2 }, uma2: b(1100), race: { courseId: '10101' } };
  const a = renderHook(() => useRaceCompare(ctxA, true, { raceCompare }));
  await waitFor(() => expect(a.result.current.status).toBe('done'));
  const ctxB: RaceCompareCtx = { uma1: { ...b(1150), mood: -2 }, uma2: b(1100), race: { courseId: '10101' } };
  renderHook(() => useRaceCompare(ctxB, true, { raceCompare }));
  await waitFor(() => expect(raceCompare).toHaveBeenCalledTimes(2));
});

it('na when a build has 0 speed', async () => {
  const raceCompare = vi.fn(async () => fake(0));
  const ctx: RaceCompareCtx = { uma1: b(0), uma2: b(1100), race: { courseId: '10101' } };
  const { result } = renderHook(() => useRaceCompare(ctx, true, { raceCompare }));
  await waitFor(() => expect(result.current.status).toBe('na'));
  expect(raceCompare).not.toHaveBeenCalled();
});
