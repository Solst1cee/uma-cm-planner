/** Page-layer glue (availability #4b): the effective rebalance patch map for a
 *  plan at the current horizon. null plan => pin-free map (reference charts). */
import { useMemo } from 'react';
import type { CmPlan } from '@/core/types';
import type { SkillPatch } from '@/core/rebalance';
import { skillPatchMap, wishlistPins } from '@/core/rebalancePatches';
import { useGameData } from '@/features/data/gameData';
import { useAvailability } from '@/app/useAvailability';

export function useSkillPatches(plan?: CmPlan | null): Record<string, SkillPatch> | undefined {
  const { skillById } = useGameData();
  const { cutoffISO, todayISO } = useAvailability();
  const wishlist = plan?.wishlist;
  return useMemo(() => {
    const pins = wishlist ? wishlistPins(wishlist, skillById) : undefined;
    return skillPatchMap({ skillById, cutoffISO, todayISO, ...(pins ? { pins } : {}) });
  }, [skillById, cutoffISO, todayISO, wishlist]);
}
