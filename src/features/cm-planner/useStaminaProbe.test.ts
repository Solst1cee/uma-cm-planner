import { describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { SimBuild, SimRaceParams, VacuumResult } from '@/sim';
import { useStaminaProbe } from './useStaminaProbe';

const build = { stats: { spd: 1200 }, strategy: 'pace', skills: [] } as unknown as SimBuild;
const race: SimRaceParams = { courseId: '10906' };
const vac = (survival: number): VacuumResult => ({
  mean: 0, median: 0, min: 0, max: 0, nsamples: 30, results: [],
  aFirstPlaceRate: 0, bFirstPlaceRate: 0, aStaminaSurvival: survival, bStaminaSurvival: survival,
  aFullSpurtRate: 0, bFullSpurtRate: 0,
});

describe('useStaminaProbe', () => {
  it('starts idle with no survival and does not call vacuum before probe()', () => {
    const vacuum = vi.fn(async () => vac(0.5));
    const { result } = renderHook(() => useStaminaProbe(build, race, { vacuum }));
    expect(result.current.survival).toBeNull();
    expect(result.current.status).toBe('idle');
    expect(vacuum).not.toHaveBeenCalled();
  });

  it('probe() stores aStaminaSurvival from a build-vs-itself vacuum run', async () => {
    const vacuum = vi.fn(async () => vac(0.42));
    const { result } = renderHook(() => useStaminaProbe(build, race, { vacuum }));
    act(() => result.current.probe());
    await waitFor(() => expect(result.current.survival).toBe(0.42));
    expect(result.current.status).toBe('done');
    expect(vacuum).toHaveBeenCalledWith(build, build, race, 30, undefined);
  });
});
