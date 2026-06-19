import type { AptKey, CmPlan, Stat } from '@/core/types';
import { distanceClass, targetAptitude } from '@/core/simBuild';

const STATS: Stat[] = ['spd', 'sta', 'pow', 'gut', 'wit'];

function aptKeyToken(aptKey: AptKey): string {
  return `${aptKey.kind}:${aptKey.key}`;
}

function contentAptitudeKeys(plan: CmPlan): AptKey[] {
  return [
    { kind: 'surface', key: 'turf' },
    { kind: 'surface', key: 'dirt' },
    { kind: 'distance', key: 'short' },
    { kind: 'distance', key: 'mile' },
    { kind: 'distance', key: 'medium' },
    { kind: 'distance', key: 'long' },
    { kind: 'strategy', key: plan.strategy },
  ];
}

export function planContentKey(plan: CmPlan): string {
  const aptitudes = contentAptitudeKeys(plan)
    .map((aptKey) => `${aptKeyToken(aptKey)}=${targetAptitude(plan, aptKey) ?? ''}`)
    .sort();
  const skills = plan.wishlist.map((item) => item.skillId).sort();
  const stats = STATS.map((stat) => `${stat}:${plan.statProfile.stats[stat] ?? 0}`);

  return JSON.stringify({
    umaId: plan.umaId,
    track: {
      courseId: plan.cmRef.courseId,
      surface: plan.cmRef.surface,
      distance: plan.cmRef.distance,
      distanceClass: distanceClass(plan.cmRef.distance),
    },
    stats,
    aptitudes,
    skills,
  });
}

export function isSamePlanContent(a: CmPlan, b: CmPlan): boolean {
  return planContentKey(a) === planContentKey(b);
}

export function planVersionGroupKey(plan: CmPlan): string {
  return JSON.stringify({
    umaId: plan.umaId,
    track: {
      courseId: plan.cmRef.courseId,
      surface: plan.cmRef.surface,
      distance: plan.cmRef.distance,
      distanceClass: distanceClass(plan.cmRef.distance),
    },
  });
}

export function isSamePlanVersionGroup(a: CmPlan, b: CmPlan): boolean {
  return planVersionGroupKey(a) === planVersionGroupKey(b);
}

function generatedNameParts(name: string): { planNumber: number; suffix: string } | null {
  const match = name.match(/^Plan\s+(\d+)\s*\/\s*(.+)$/i);
  if (!match) return null;
  const planNumber = Number(match[1]);
  const suffix = match[2]?.trim();
  if (!Number.isInteger(planNumber) || planNumber <= 0 || !suffix) return null;
  return { planNumber, suffix };
}

function planNumberForVersion(candidate: CmPlan): number | null {
  if (Number.isInteger(candidate.planNumber) && candidate.planNumber > 0) {
    return candidate.planNumber;
  }
  return generatedNameParts(candidate.name)?.planNumber ?? null;
}

export function nextPlanNumberForContent(plan: CmPlan, plans: readonly CmPlan[]): number {
  const used = new Set(
    plans
      .filter((candidate) => isSamePlanVersionGroup(plan, candidate))
      .map((candidate) => planNumberForVersion(candidate))
      .filter((planNumber): planNumber is number => planNumber !== null),
  );

  let next = 1;
  while (used.has(next)) next += 1;
  return next;
}

export function isPlanContentSaved(plan: CmPlan, plans: readonly CmPlan[]): boolean {
  return plans.some((candidate) => isSamePlanContent(plan, candidate));
}
