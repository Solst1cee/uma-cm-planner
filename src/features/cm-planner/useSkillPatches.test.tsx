import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CmPlan, RebalanceInfo, SkillRecord } from '@/core/types';
import { useSkillPatches } from './useSkillPatches';

// v2 announced + elapsed (live at Current), carries a modifier — same shape as
// rebalancePatches.test.ts's CONFIRMED fixture.
const CONFIRMED: RebalanceInfo = {
  globalVer: 2,
  jpVer: 2,
  versions: [
    { ver: 1 },
    { ver: 2, jpDate: '2025-01-01', globalDate: '2026-06-01', globalArrival: '2026-06-01', modifier: 0.5, sourceUrl: 'https://x' },
  ],
};

function rec(skillId: string, rebalance?: RebalanceInfo): SkillRecord {
  return {
    skillId, nameEn: `Skill ${skillId}`, nameJp: skillId, baseSpCost: 100,
    rarity: 'white', iconId: '1', conditions: 'phase>=1', server: 'global', dataVersion: 't',
    ...(rebalance ? { rebalance } : {}),
  } as SkillRecord;
}

const skillById = new Map([['300', rec('300', CONFIRMED)]]);

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
});
