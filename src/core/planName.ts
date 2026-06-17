import type { CmPlan } from '@/core/types';

function displayToken(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function generatePlanName(plan: CmPlan, umaName: string | undefined, raceNameLabel?: string): string {
  const parts = [
    raceNameLabel ?? (plan.cmRef.cmNumber > 0 ? `CM${plan.cmRef.cmNumber}` : plan.cmRef.cmId),
    umaName ?? (plan.umaId ? `Uma ${plan.umaId}` : 'No Uma'),
    displayToken(plan.role),
    displayToken(plan.strategy),
    plan.remark?.trim(),
  ];
  return parts.filter((part): part is string => part !== undefined && part !== '').join(' / ');
}

export function uniquePlanName(
  desiredName: string,
  plans: readonly CmPlan[],
  excludePlanId?: string,
): string {
  const desired = desiredName.trim() || 'Untitled Plan';
  const usedNames = new Set(
    plans
      .filter((plan) => plan.id !== excludePlanId)
      .map((plan) => plan.name.trim())
      .filter((name) => name.length > 0),
  );

  if (!usedNames.has(desired)) return desired;

  const baseName = desired.replace(/\s+\(\d+\)$/, '').trim() || desired;
  let suffix = 1;
  let candidate = `${baseName} (${suffix})`;
  while (usedNames.has(candidate)) {
    suffix += 1;
    candidate = `${baseName} (${suffix})`;
  }
  return candidate;
}
