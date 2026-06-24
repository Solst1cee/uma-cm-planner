import type { CmPlan } from './types';

export function copyPlanInto(source: CmPlan, opts?: { keepName?: boolean }): CmPlan {
  const clone = structuredClone(source);
  clone.id = crypto.randomUUID();
  clone.planNumber = 1;
  if (!opts?.keepName) clone.name = '';   // caller re-names via generatePlanName
  return clone;
}
