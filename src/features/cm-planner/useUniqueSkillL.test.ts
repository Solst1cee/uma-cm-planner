import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUniqueSkillL } from './useUniqueSkillL';
import type { SimBuild } from '@/sim/types';

const race = { courseId: '10906', ground: 1, weather: 1, season: 1, time: 2, grade: 100 };

describe('useUniqueSkillL', () => {
  it('returns the mean L for the current strategy/level and passes skillLevels', async () => {
    const calls: SimBuild[] = [];
    const skillDelta = async (build: SimBuild) => {
      calls.push(build);
      return { mean: 2.5, median: 2.5, min: 2, max: 3, nsamples: 4, results: [2, 2, 3, 3], activated: true };
    };
    const { result } = renderHook(() =>
      useUniqueSkillL({
        outfitId: '100101', uniqueSkillId: '100011', strategy: 'pace', level: 6, race,
        deps: { skillDelta, nsamples: 4 },
      }),
    );
    await waitFor(() => expect(result.current.L).toBe(2.5));
    expect(calls[0]?.skillLevels).toEqual({ '100011': 6 });
  });

  it('yields null L when there is no unique skill', async () => {
    const { result } = renderHook(() =>
      useUniqueSkillL({
        outfitId: '100101', uniqueSkillId: '', strategy: 'pace', level: 5, race,
        deps: { skillDelta: async () => { throw new Error('should not be called'); }, nsamples: 4 },
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.L).toBeNull();
  });

  it('passes skillPatches into the reference build and re-runs when they differ (availability #4b)', async () => {
    const calls: SimBuild[] = [];
    const skillDelta = async (build: SimBuild) => {
      calls.push(build);
      return { mean: 2.5, median: 2.5, min: 2, max: 3, nsamples: 4, results: [2, 2, 3, 3], activated: true };
    };
    const { result, rerender } = renderHook(
      ({ skillPatches }) =>
        useUniqueSkillL({
          outfitId: '100101', uniqueSkillId: '100011', strategy: 'pace', level: 6, race,
          skillPatches,
          deps: { skillDelta, nsamples: 4 },
        }),
      { initialProps: { skillPatches: { '100011': { modifier: 2000 } } } },
    );
    await waitFor(() => expect(result.current.L).toBe(2.5));
    expect(calls[0]?.skillPatches).toEqual({ '100011': { modifier: 2000 } });

    rerender({ skillPatches: { '100011': { modifier: 3000 } } });
    await waitFor(() => expect(calls.length).toBe(2));
    expect(calls[1]?.skillPatches).toEqual({ '100011': { modifier: 3000 } });
  });
});
