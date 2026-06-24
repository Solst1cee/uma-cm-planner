/** Shared state for the race-sim comparison: the overlay renders on the track (in the main
 *  column) while its controls live in the Mini-sim tab — separate grid columns, so the state
 *  is lifted here and handed to both. uma1 = the active plan; uma2 = the uma2 plan slot. */
import { useState } from 'react';
import type { CmPlan } from '@/core/types';
import { planToOverlayBuild } from '@/core/simBuild';
import { useRaceCompare, type RaceCompareCtx, type RaceCompareState } from './useRaceCompare';

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
}

export function useRaceCompareController(
  uma1Plan: CmPlan | null,
  uma2Plan: CmPlan | null,
  courseId: string,
  deps?: RaceCompareControllerDeps,
): RaceCompareController {
  const [showHp, setShowHp] = useState(true);

  // Called before the page's loading guards, so `uma1Plan` may be null on the first render.
  const uma2 = uma2Plan ? planToOverlayBuild(uma2Plan) : null;
  const ctx: RaceCompareCtx | undefined =
    uma1Plan && uma2
      ? { uma1: planToOverlayBuild(uma1Plan), uma2, race: { courseId } }
      : undefined;
  const useHook = deps?.useRaceCompare ?? useRaceCompare;
  const state = useHook(ctx, !!ctx);

  return { showHp, setShowHp, state, comparing: !!ctx, uma2Empty: uma2Plan === null };
}
