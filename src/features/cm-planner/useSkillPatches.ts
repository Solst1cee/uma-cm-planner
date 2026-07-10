/** Page-layer glue (availability #4b): the effective rebalance patch map for a
 *  plan at the current horizon. null plan => pin-free map (reference charts). */
import { useMemo } from 'react';
import type { CmPlan } from '@/core/types';
import type { SkillPatch } from '@/core/rebalance';
import { activePatchNotes, skillPatchMap, wishlistPins, type ActivePatchNote } from '@/core/rebalancePatches';
import { useGameData } from '@/features/data/gameData';
import { useAvailability } from '@/app/useAvailability';
import { ENGINE_DATA_DATE } from '@/sim/enginePin';

export function useSkillPatches(plan?: CmPlan | null): Record<string, SkillPatch> | undefined {
  const { skillById } = useGameData();
  const { cutoffISO, todayISO } = useAvailability();
  const wishlist = plan?.wishlist;
  return useMemo(() => {
    const pins = wishlist ? wishlistPins(wishlist, skillById) : undefined;
    return skillPatchMap({ skillById, cutoffISO, todayISO, engineDataDate: ENGINE_DATA_DATE, ...(pins ? { pins } : {}) });
  }, [skillById, cutoffISO, todayISO, wishlist]);
}

/** P3 marking data (availability #4b): which active rebalance versions a surface's sim ran
 *  with, filtered to the skill ids that surface actually sims. `relevantIds` MUST be memoized
 *  by the caller — a fresh Set every render defeats this hook's own memo. */
export function usePatchNotes(
  plan: CmPlan | null | undefined,
  relevantIds: ReadonlySet<string>,
): ActivePatchNote[] {
  const { skillById } = useGameData();
  const { cutoffISO, todayISO } = useAvailability();
  const wishlist = plan?.wishlist;
  return useMemo(() => {
    const pins = wishlist ? wishlistPins(wishlist, skillById) : undefined;
    return activePatchNotes({
      skillById,
      cutoffISO,
      todayISO,
      engineDataDate: ENGINE_DATA_DATE,
      ...(pins ? { pins } : {}),
    }).filter((n) =>
      relevantIds.has(n.skillId),
    );
  }, [skillById, cutoffISO, todayISO, wishlist, relevantIds]);
}
