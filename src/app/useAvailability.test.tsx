/**
 * useAvailability: the app-wide planning-horizon lens (Availability #3).
 * Mocks useActivePlan (controllable horizon/plan/setHorizon) and useGameData
 * (a small timeline fixture) rather than a full provider — simpler, and this
 * hook's only job is deriving cutoff/tier/visible/futureCms from those two.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAvailability } from '@/app/useAvailability';
import type { CmPlan, TimelineEntry } from '@/core/types';

const setHorizon = vi.fn();
let mockHorizon: { kind: 'current' } | { kind: 'cm'; cmNumber: number } | { kind: 'allJp' } = { kind: 'current' };
let mockPlan: CmPlan | null = null;

vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({ plan: mockPlan, horizon: mockHorizon, setHorizon }),
}));

const CM17: TimelineEntry = {
  id: 'cm17',
  type: 'cm',
  title: 'Virgo Cup',
  dates: { start: '2026-08-26' },
  cm: { cmNumber: 17 },
  tier: 'prediction',
  status: 'unconfirmed',
  source: { kind: 'manual', url: '' },
  server: 'global',
  dataVersion: '2026-07-02',
};

const CM16: TimelineEntry = {
  id: 'cm16',
  type: 'cm',
  title: 'Leo Cup',
  dates: { start: '2026-05-01' },
  cm: { cmNumber: 16 },
  tier: 'official',
  status: 'confirmed',
  source: { kind: 'manual', url: '' },
  server: 'global',
  dataVersion: '2026-07-02',
};

let mockTimeline: TimelineEntry[] = [CM17, CM16];

vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ timeline: mockTimeline }),
}));

function planWithCm(cmNumber: number): CmPlan {
  return {
    cmRef: { kind: 'cm', cmId: `CM${cmNumber}`, cmNumber, courseId: '10906', surface: 'turf', distance: 2200 },
  } as CmPlan;
}

beforeEach(() => {
  vi.setSystemTime(new Date('2026-07-02T00:00:00.000Z'));
  mockHorizon = { kind: 'current' };
  mockPlan = null;
  mockTimeline = [CM17, CM16];
  setHorizon.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAvailability', () => {
  it('current horizon: visible only when server is global', () => {
    const { result } = renderHook(() => useAvailability());
    expect(result.current.visible({ server: 'jp', releaseDate: '2026-08-01' })).toBe(false);
    expect(result.current.visible({ server: 'global' })).toBe(true);
  });

  it('cm horizon reveals JP records released by the chosen CM date', () => {
    mockHorizon = { kind: 'cm', cmNumber: 17 };
    const { result } = renderHook(() => useAvailability());
    expect(result.current.visible({ server: 'jp', releaseDate: '2026-08-01' })).toBe(true);
    expect(result.current.visible({ server: 'jp', releaseDate: '2027-01-01' })).toBe(false);
  });

  it('allJp horizon reveals future jp records', () => {
    mockHorizon = { kind: 'allJp' };
    const { result } = renderHook(() => useAvailability());
    expect(result.current.visible({ server: 'jp', releaseDate: '2027-01-01' })).toBe(true);
  });

  it('setHorizon delegates to the context setter', () => {
    const { result } = renderHook(() => useAvailability());
    result.current.setHorizon({ kind: 'allJp' });
    expect(setHorizon).toHaveBeenCalledWith({ kind: 'allJp' });
  });

  it('a stale cm number falls back to a today cutoff', () => {
    mockHorizon = { kind: 'cm', cmNumber: 99 };
    const { result } = renderHook(() => useAvailability());
    expect(result.current.cutoffISO).toBe(result.current.todayISO);
  });

  it('futureCms lists timeline CMs dated on/after today with a predicted flag', () => {
    const { result } = renderHook(() => useAvailability());
    expect(result.current.futureCms).toEqual([
      { cmNumber: 17, title: 'Virgo Cup', date: '2026-08-26', predicted: true },
    ]);
  });

  it('planCmISO resolves from the plan\'s own cmRef', () => {
    mockPlan = planWithCm(16);
    const { result } = renderHook(() => useAvailability());
    expect(result.current.planCmISO).toBe('2026-05-01');
  });

  it('planCmISO falls back to today when the plan has no matching timeline CM', () => {
    mockPlan = planWithCm(99);
    const { result } = renderHook(() => useAvailability());
    expect(result.current.planCmISO).toBe(result.current.todayISO);
  });
});
