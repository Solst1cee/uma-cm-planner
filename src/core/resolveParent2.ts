/** M1.4b — resolve the Parent-2 slot (owned roster id / rental draft / recorded
 *  rental) into a concrete Parent for the affinity + coverage consumers. */
import type { CmPlan, Parent } from '@/core/types';
import { draftToSyntheticParent } from '@/core/rentalDraft';

export type ResolvedParent2 =
  | { kind: 'owned'; parent: Parent }
  | { kind: 'draft'; synthetic: Parent }
  | { kind: 'rental'; parent: Parent }
  | { kind: 'none' };

export function resolveParent2(plan: CmPlan, rosterById: Map<string, Parent>): ResolvedParent2 {
  const mode = plan.parent2Mode ?? 'owned';
  if (mode === 'draft' && plan.rentalDraft) return { kind: 'draft', synthetic: draftToSyntheticParent(plan.rentalDraft) };
  if (mode === 'rental' && plan.rentalRecorded) return { kind: 'rental', parent: plan.rentalRecorded };
  const owned = plan.parents.b ? rosterById.get(plan.parents.b) : undefined;
  return owned ? { kind: 'owned', parent: owned } : { kind: 'none' };
}
