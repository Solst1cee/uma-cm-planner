/** Pluggable uma2 (comparison build) source for the race-compare overlay.
 *  Ships 'savedPlan'; 'minusWishlist'/'reference' are typed follow-ups (return null). */
import type { CmPlan } from '@/core/types';
import type { SimBuild } from '@/sim';
import { planToOverlayBuild } from '@/core/simBuild';

export type Uma2Source =
  | { kind: 'savedPlan'; planId: string }
  | { kind: 'minusWishlist' }
  | { kind: 'reference' };

export function resolveUma2(source: Uma2Source, _activePlan: CmPlan, savedPlans: CmPlan[]): SimBuild | null {
  switch (source.kind) {
    case 'savedPlan': {
      const plan = savedPlans.find((p) => p.id === source.planId);
      return plan ? planToOverlayBuild(plan) : null;
    }
    case 'minusWishlist':
    case 'reference':
      return null; // follow-up (spec §5 / §12)
  }
}
