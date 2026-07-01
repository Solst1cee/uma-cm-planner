// src/features/inheritance/useScoreWeights.test.ts
import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useScoreWeights } from './useScoreWeights';
import { DEFAULT_SCENARIO } from '@/core/cardScore';

afterEach(() => localStorage.clear());

describe('useScoreWeights', () => {
  it('defaults to the GL scenario', () => {
    const { result } = renderHook(() => useScoreWeights());
    expect(result.current.scenario.general.bondPerDay).toBe(DEFAULT_SCENARIO.general.bondPerDay);
  });
  it('persists changes and reset restores defaults', () => {
    const { result } = renderHook(() => useScoreWeights());
    act(() => result.current.setScenario({ ...result.current.scenario, general: { ...result.current.scenario.general, bondPerDay: 25 } }));
    expect(JSON.parse(localStorage.getItem('scb_score_weights')!).general.bondPerDay).toBe(25);
    act(() => result.current.reset());
    expect(result.current.scenario.general.bondPerDay).toBe(DEFAULT_SCENARIO.general.bondPerDay);
  });
  it('ignores a version-mismatched stored value', () => {
    localStorage.setItem('scb_score_weights', JSON.stringify({ version: -1 }));
    const { result } = renderHook(() => useScoreWeights());
    expect(result.current.scenario.version).toBe(DEFAULT_SCENARIO.version);
  });
});
