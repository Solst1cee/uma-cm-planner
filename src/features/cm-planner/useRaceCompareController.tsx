/** Shared state for the race-sim comparison: the overlay renders on the track (in the main
 *  column) while its controls live in the right sidebar — separate grid columns, so the state
 *  is lifted here and handed to both. uma1 = the active plan; uma2 = a chosen saved plan. */
import { useState } from 'react';
import type { CmPlan } from '@/core/types';
import { planToOverlayBuild } from '@/core/simBuild';
import { resolveUma2, type Uma2Source } from './resolveUma2';
import { useRaceCompare, type RaceCompareCtx, type RaceCompareState } from './useRaceCompare';

export interface RaceCompareControllerDeps {
  useRaceCompare?: (ctx: RaceCompareCtx | undefined, enabled: boolean) => RaceCompareState;
}

export interface RaceCompareController {
  uma2Id: string;
  setUma2Id: (id: string) => void;
  showHp: boolean;
  setShowHp: (v: boolean) => void;
  /** Saved plans eligible as uma2 (the active plan excluded). */
  others: CmPlan[];
  state: RaceCompareState;
  /** True once a uma2 is picked (a comparison is active). */
  comparing: boolean;
}

export function useRaceCompareController(
  plan: CmPlan | null,
  savedPlans: CmPlan[],
  courseId: string,
  deps?: RaceCompareControllerDeps,
): RaceCompareController {
  const [showHp, setShowHp] = useState(true);
  const [uma2Id, setUma2Id] = useState('');

  // Called before the page's loading guards, so `plan` may be null on the first render.
  const others = plan ? savedPlans.filter((p) => p.id !== plan.id) : [];
  const source: Uma2Source | null = uma2Id ? { kind: 'savedPlan', planId: uma2Id } : null;
  const uma2 = source && plan ? resolveUma2(source, plan, savedPlans) : null;
  const ctx: RaceCompareCtx | undefined = uma2 && plan
    ? { uma1: planToOverlayBuild(plan), uma2, race: { courseId } }
    : undefined;
  const useHook = deps?.useRaceCompare ?? useRaceCompare;
  const state = useHook(ctx, !!ctx);

  return { uma2Id, setUma2Id, showHp, setShowHp, others, state, comparing: !!ctx };
}
