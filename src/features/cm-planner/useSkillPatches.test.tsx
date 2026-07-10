import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CmPlan, RebalanceInfo, SkillRecord } from '@/core/types';
import { usePatchNotes, useSkillPatches } from './useSkillPatches';

// v2 announced + elapsed, dated AFTER the real ENGINE_DATA_DATE ('2026-07-09') so it
// still pin-lags the engine's data pin — this hook threads the real constant (not a
// test-controlled one), so the fixture date must post-date it to exercise pin-lag.
// A version dated on/before the pin is in-pin (Task 7 gate) and correctly emits nothing
// — see the dedicated 'ENGINE_DATA_DATE in-pin gate' describe block below.
const CONFIRMED: RebalanceInfo = {
  globalVer: 2,
  jpVer: 2,
  versions: [
    { ver: 1 },
    { ver: 2, jpDate: '2025-06-01', globalDate: '2026-08-01', globalArrival: '2026-08-01', modifier: 0.5, sourceUrl: 'https://x' },
  ],
};
// The real 2026-07-01 Global patch shape — on/before ENGINE_DATA_DATE, so in-pin.
const IN_PIN: RebalanceInfo = {
  globalVer: 2,
  jpVer: 2,
  versions: [
    { ver: 1 },
    { ver: 2, jpDate: '2025-01-01', globalDate: '2026-07-01', globalArrival: '2026-07-01', modifier: 0.6, sourceUrl: 'https://x' },
  ],
};

function rec(skillId: string, rebalance?: RebalanceInfo): SkillRecord {
  return {
    skillId, nameEn: `Skill ${skillId}`, nameJp: skillId, baseSpCost: 100,
    rarity: 'white', iconId: '1', conditions: 'phase>=1', server: 'global', dataVersion: 't',
    ...(rebalance ? { rebalance } : {}),
  } as SkillRecord;
}

const skillById = new Map([['300', rec('300', CONFIRMED)], ['700', rec('700', IN_PIN)]]);

vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ skillById }),
}));
// The shared app-wide horizon lens, static current-default (mirrors InheritancePage.test.tsx).
vi.mock('@/app/useAvailability', () => ({
  useAvailability: () => ({
    visible: (r: { server: string }) => r.server === 'global',
    tierOf: () => 'now' as const,
    horizon: { kind: 'current' },
    setHorizon: vi.fn(),
    cutoffISO: '2026-07-03',
    todayISO: '2026-07-03',
    planCmISO: '2026-07-03',
    futureCms: [],
  }),
}));

describe('useSkillPatches', () => {
  it('returns the pin-free horizon patch map for a confirmed rebalance', () => {
    const { result } = renderHook(() => useSkillPatches(null));
    expect(result.current).toEqual({ '300': { modifier: 0.5 } });
  });

  it('honors a wishlist pin back to the baseline version, suppressing the patch', () => {
    const plan = {
      wishlist: [{ skillId: '300', priority: 1, source: 'targeted', skillVer: 1 }],
    } as unknown as CmPlan;
    const { result } = renderHook(() => useSkillPatches(plan));
    expect(result.current).toBeUndefined();
  });

  it('Task 7: an in-pin version (on/before ENGINE_DATA_DATE) is gated out — no patch entry', () => {
    // skill 700 (IN_PIN) is confirmed 2026-07-01, which is on/before the real
    // ENGINE_DATA_DATE ('2026-07-09') — the engine already computes it natively.
    const { result } = renderHook(() => useSkillPatches(null));
    expect(result.current).not.toHaveProperty('700');
  });
});

describe('usePatchNotes', () => {
  it('returns a note for a relevant patched skill', () => {
    const { result } = renderHook(() => usePatchNotes(null, new Set(['300'])));
    expect(result.current).toEqual([
      expect.objectContaining({ skillId: '300', ver: 2, pinLag: true, pinned: false }),
    ]);
  });

  it('filters out a patched skill that is not in relevantIds', () => {
    const { result } = renderHook(() => usePatchNotes(null, new Set(['999'])));
    expect(result.current).toEqual([]);
  });

  it('reflects a wishlist pin back to baseline (no active patch, no note)', () => {
    const plan = {
      wishlist: [{ skillId: '300', priority: 1, source: 'targeted', skillVer: 1 }],
    } as unknown as CmPlan;
    const { result } = renderHook(() => usePatchNotes(plan, new Set(['300'])));
    expect(result.current).toEqual([]);
  });

  it('Task 7: an in-pin version emits no note (no "confirmed patch, engine pin pending" chip)', () => {
    const { result } = renderHook(() => usePatchNotes(null, new Set(['700'])));
    expect(result.current).toEqual([]);
  });
});
