/**
 * CmPlan → engine SimBuild (M4 §1). The skill chart measures each skill's
 * marginal L on a FIXED base build with no owned skills (vacuum), so skills:[].
 * Target aptitudes live in sparkGoals.pink (shared-data-model); default A.
 */
import type { AptKey, CmPlan, Grade, SkillRecord, Strategy } from '@/core/types';
import type { SimBuild } from '@/sim';
import { wishlistSkillId } from '@/features/skill-planner/skillFamilies';

export type AptDim = 'distance' | 'surface' | 'strategy';

export function distanceClass(distance: number): 'short' | 'mile' | 'medium' | 'long' {
  if (distance < 1400) return 'short';
  if (distance <= 1800) return 'mile';
  if (distance <= 2400) return 'medium';
  return 'long';
}

function sameAptKey(a: AptKey, b: AptKey): boolean {
  return a.kind === b.kind && a.key === b.key;
}

/** The AptKey used to store a plan's active target aptitude for each dimension. */
function aptKeyFor(plan: CmPlan, dim: AptDim): AptKey {
  if (dim === 'distance') return { kind: 'distance' as const, key: distanceClass(plan.cmRef.distance) };
  if (dim === 'surface') return { kind: 'surface' as const, key: plan.cmRef.surface };
  return { kind: 'strategy' as const, key: plan.strategy };
}

export function currentAptitudeKeys(plan: CmPlan): { distance: AptKey; surface: AptKey; strategy: AptKey } {
  return {
    distance: aptKeyFor(plan, 'distance'),
    surface: aptKeyFor(plan, 'surface'),
    strategy: aptKeyFor(plan, 'strategy'),
  };
}

export function isCurrentAptitude(plan: CmPlan, aptKey: AptKey): boolean {
  return Object.values(currentAptitudeKeys(plan)).some((current) => sameAptKey(current, aptKey));
}

function storedTargetAptitude(plan: CmPlan, aptKey: AptKey): Grade | undefined {
  return plan.sparkGoals.pink.find((goal) => sameAptKey(goal.aptKey, aptKey))?.target;
}

/**
 * Default target shown before the user edits sparkGoals.pink. The active distance
 * defaults to S (displayed as A/S in the UI) because S requires pink inheritance;
 * the active surface and strategy default to A.
 */
function defaultTargetAptitude(plan: CmPlan, aptKey: AptKey): Grade | undefined {
  const current = currentAptitudeKeys(plan);
  if (sameAptKey(aptKey, current.distance)) return 'S';
  if (sameAptKey(aptKey, current.surface)) return 'A';
  if (sameAptKey(aptKey, current.strategy)) return 'A';
  return undefined;
}

export function targetAptitude(plan: CmPlan, aptKey: AptKey): Grade | undefined {
  return storedTargetAptitude(plan, aptKey) ?? defaultTargetAptitude(plan, aptKey);
}

export function setTargetAptitudeByKey(plan: CmPlan, aptKey: AptKey, grade: Grade | ''): CmPlan {
  const pink = plan.sparkGoals.pink.filter((goal) => !sameAptKey(goal.aptKey, aptKey));
  if (grade !== '') pink.push({ aptKey, target: grade });
  return { ...plan, sparkGoals: { ...plan.sparkGoals, pink } };
}

export function setStrategyTargetAptitude(
  plan: CmPlan,
  strategy: Strategy,
  grade: Grade | '',
): CmPlan {
  const pink = plan.sparkGoals.pink.filter((goal) => goal.aptKey.kind !== 'strategy');
  if (grade !== '') {
    pink.push({ aptKey: { kind: 'strategy', key: strategy }, target: grade });
  }
  return { ...plan, strategy, sparkGoals: { ...plan.sparkGoals, pink } };
}

/** Upsert a target aptitude grade for a dimension (keyed by course/strategy). Returns a new plan. */
export function setTargetAptitude(plan: CmPlan, dim: AptDim, grade: Grade): CmPlan {
  return setTargetAptitudeByKey(plan, aptKeyFor(plan, dim), grade);
}

/** Read the three SimBuild aptitude grades from sparkGoals.pink and active defaults. */
export function simAptitudes(plan: CmPlan): { distance: Grade; surface: Grade; strategy: Grade } {
  const current = currentAptitudeKeys(plan);
  return {
    distance: targetAptitude(plan, current.distance) ?? 'A',
    surface: targetAptitude(plan, current.surface) ?? 'A',
    strategy: targetAptitude(plan, current.strategy) ?? 'A',
  };
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

/** Build with the plan's skills ACTIVE (unique + wishlist) — for full-race sims
 *  (umalator-style overlay). Unlike planToSimBuild (vacuum, skills:[]). Dedup
 *  preserves order: unique first, then wishlist. Engine layer filters to simulatable. */
export function planToOverlayBuild(plan: CmPlan): SimBuild {
  const ids = [plan.uniqueSkillId, ...plan.wishlist.map((w) => w.skillId)].filter(Boolean);
  return { ...planToSimBuild(plan), skills: [...new Set(ids)] };
}

/**
 * Chart baseline: the vacuum build PLUS the user's already-targeted wishlist skills,
 * so each ranked candidate's L is its marginal value on top of what's already picked
 * (recovery → re-run → speed skills show their true value). Resolves each wishlist id
 * to its engine id; the engine-side `simulatableBase` filter later drops any the engine
 * can't simulate (e.g. inherited-unique 9… ids). Empty wishlist ⇒ today's vacuum.
 */
export function chartBaselineBuild(
  plan: CmPlan,
  skillById: ReadonlyMap<string, SkillRecord>,
): SimBuild {
  const skills = [...new Set(plan.wishlist.map((it) => wishlistSkillId(it.skillId, skillById)))];
  return { ...planToSimBuild(plan), skills };
}
