/** Shared state for the race-sim comparison: the overlay renders on the track (in the main
 *  column) while its controls live in the Mini-sim tab — separate grid columns, so the state
 *  is lifted here and handed to both. uma1 = the active plan; uma2 = the uma2 plan slot. */
import { useMemo, useState } from 'react';
import type { CmPlan } from '@/core/types';
import { planToOverlayBuild } from '@/core/simBuild';
import { withSkillPatches, type ActivePatchNote } from '@/core/rebalancePatches';
import { useRaceCompare, type RaceCompareCtx, type RaceCompareState } from './useRaceCompare';
import { usePatchNotes, useSkillPatches } from './useSkillPatches';

export interface RaceCompareControllerDeps {
  useRaceCompare?: (ctx: RaceCompareCtx | undefined, enabled: boolean) => RaceCompareState;
}

export interface RaceCompareController {
  showHp: boolean;
  setShowHp: (v: boolean) => void;
  state: RaceCompareState;
  /** True once uma1 is present and uma2Plan is non-null (a comparison is active). */
  comparing: boolean;
  /** True when uma2Plan is null (the slot is empty). */
  uma2Empty: boolean;
  /** P3 post-patch-values markers (availability #4b) for the union of both overlay builds'
   *  skills — each plan's own wishlist pins resolve its own notes. */
  patchNotes: ActivePatchNote[];
}

export function useRaceCompareController(
  uma1Plan: CmPlan | null,
  uma2Plan: CmPlan | null,
  courseId: string,
  deps?: RaceCompareControllerDeps,
): RaceCompareController {
  const [showHp, setShowHp] = useState(true);

  // Both plans' pins are independent — resolve each build's patches from its own wishlist.
  const uma1Patches = useSkillPatches(uma1Plan);
  const uma2Patches = useSkillPatches(uma2Plan);

  // Called before the page's loading guards, so `uma1Plan` may be null on the first render.
  const uma2 = uma2Plan ? withSkillPatches(planToOverlayBuild(uma2Plan), uma2Patches) : null;
  const ctx: RaceCompareCtx | undefined =
    uma1Plan && uma2
      ? { uma1: withSkillPatches(planToOverlayBuild(uma1Plan), uma1Patches), uma2, race: { courseId } }
      : undefined;
  const useHook = deps?.useRaceCompare ?? useRaceCompare;
  const state = useHook(ctx, !!ctx);

  // Each plan resolves its own notes against its own skill set — a shared union set would
  // mislabel a skill only present in one build with the other plan's pin resolution.
  const uma1SkillsKey = ctx ? [...ctx.uma1.skills].sort().join(',') : '';
  const uma2SkillsKey = ctx ? [...ctx.uma2.skills].sort().join(',') : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const uma1SkillIds = useMemo(() => new Set(ctx?.uma1.skills ?? []), [uma1SkillsKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const uma2SkillIds = useMemo(() => new Set(ctx?.uma2.skills ?? []), [uma2SkillsKey]);
  const uma1Notes = usePatchNotes(uma1Plan, uma1SkillIds);
  const uma2Notes = usePatchNotes(uma2Plan, uma2SkillIds);
  const patchNotes = useMemo(() => {
    const bySkillId = new Map<string, ActivePatchNote>();
    for (const n of [...uma1Notes, ...uma2Notes]) bySkillId.set(n.skillId, n);
    return [...bySkillId.values()].sort((a, b) => (a.skillId < b.skillId ? -1 : a.skillId > b.skillId ? 1 : 0));
  }, [uma1Notes, uma2Notes]);

  return { showHp, setShowHp, state, comparing: !!ctx, uma2Empty: uma2Plan === null, patchNotes };
}
