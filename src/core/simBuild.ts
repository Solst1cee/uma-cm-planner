/**
 * CmPlan → engine SimBuild (M4 §1). The skill chart measures each skill's
 * marginal L on a FIXED base build with no owned skills (vacuum), so skills:[].
 * Target aptitudes live in sparkGoals.pink (shared-data-model); default A.
 */
import type { CmPlan, Grade } from '@/core/types';
import type { SimBuild } from '@/sim';

export type AptDim = 'distance' | 'surface' | 'strategy';

export function distanceClass(distance: number): 'short' | 'mile' | 'medium' | 'long' {
  if (distance < 1400) return 'short';
  if (distance <= 1800) return 'mile';
  if (distance <= 2400) return 'medium';
  return 'long';
}

/** The AptKey used to store a plan's target aptitude for each dimension. */
function aptKeyFor(plan: CmPlan, dim: AptDim) {
  if (dim === 'distance') return { kind: 'distance' as const, key: distanceClass(plan.cmRef.distance) };
  if (dim === 'surface') return { kind: 'surface' as const, key: plan.cmRef.surface };
  return { kind: 'strategy' as const, key: plan.strategy };
}

/** Read the three SimBuild aptitude grades from sparkGoals.pink, default A. */
export function simAptitudes(plan: CmPlan): { distance: Grade; surface: Grade; strategy: Grade } {
  const read = (dim: AptDim): Grade => {
    const want = aptKeyFor(plan, dim);
    const hit = plan.sparkGoals.pink.find(
      (g) => g.aptKey.kind === want.kind && g.aptKey.key === want.key,
    );
    return hit?.target ?? 'A';
  };
  return { distance: read('distance'), surface: read('surface'), strategy: read('strategy') };
}

/** Upsert a target aptitude grade for a dimension (keyed by course/strategy). Returns a new plan. */
export function setTargetAptitude(plan: CmPlan, dim: AptDim, grade: Grade): CmPlan {
  const want = aptKeyFor(plan, dim);
  const pink = plan.sparkGoals.pink.filter(
    (g) => !(g.aptKey.kind === want.kind && g.aptKey.key === want.key),
  );
  pink.push({ aptKey: want, target: grade });
  return { ...plan, sparkGoals: { ...plan.sparkGoals, pink } };
}

export function planToSimBuild(plan: CmPlan): SimBuild {
  return {
    umaId: plan.umaId,
    stats: plan.statProfile.stats,
    strategy: plan.strategy,
    aptitudes: simAptitudes(plan),
    skills: [],
    mood: plan.statProfile.mood,
  };
}
