/** Pure helpers for the M1 "Plan targets" card (handoff README §"2. Plan
 *  targets panel"): blue stat-spark rows (editable star goals on
 *  `sparkGoals.blue`), and the skill wishlist rows + SP summary. Pink sparks
 *  reuse `umaPlanAptChips` (aptitude + target grade). */
import type { AptKey, CmPlan, Grade, SkillRecord, Stat, Strategy, UmaRecord } from '@/core/types';
import { pinkAptitudeRequirement } from '@/core/aptitudeInheritance';
import { targetAptitude } from '@/core/simBuild';
import { STAT_LABEL } from '@/features/parents/sparkMeta';
import { wishlistSkillRecord } from '@/features/skill-planner/skillFamilies';

const STAT_ORDER: readonly Stat[] = ['spd', 'sta', 'pow', 'gut', 'wit'];
export const BLUE_MIN = 0;
/** Total blue-spark stars a lineage can supply across ALL stats (not per stat). */
export const BLUE_TOTAL_MAX = 18;
/** Same total budget for pink sparks; derived (a bad plan can exceed it → warn). */
export const PINK_TOTAL_MAX = 18;

/** Sum of all blue-spark star goals on the plan. */
export function blueTotal(plan: CmPlan): number {
  return (Object.values(plan.sparkGoals.blue) as Array<number | undefined>).reduce<number>(
    (sum, v) => sum + (v ?? 0),
    0,
  );
}

export interface BlueSparkRow {
  stat: Stat;
  label: string;
  stars: number;
}

/** Blue stat-spark goals present on the plan, in canonical stat order. */
export function blueSparkRows(plan: CmPlan): BlueSparkRow[] {
  const rows: BlueSparkRow[] = [];
  for (const stat of STAT_ORDER) {
    const stars = plan.sparkGoals.blue[stat];
    if (stars !== undefined) rows.push({ stat, label: STAT_LABEL[stat], stars });
  }
  return rows;
}

/** Stats not yet given a blue goal (for the "add" control), in stat order. */
export function availableBlueStats(plan: CmPlan): Array<{ stat: Stat; label: string }> {
  return STAT_ORDER.filter((s) => plan.sparkGoals.blue[s] === undefined).map((stat) => ({
    stat,
    label: STAT_LABEL[stat],
  }));
}

function withBlue(plan: CmPlan, blue: Partial<Record<Stat, number>>): CmPlan {
  return { ...plan, sparkGoals: { ...plan.sparkGoals, blue } };
}

/** Set a blue goal's star count, clamped so the TOTAL across all stats ≤ BLUE_TOTAL_MAX. */
export function setBlueStars(plan: CmPlan, stat: Stat, stars: number): CmPlan {
  const others = blueTotal(plan) - (plan.sparkGoals.blue[stat] ?? 0);
  const max = Math.max(BLUE_MIN, BLUE_TOTAL_MAX - others);
  const clamped = Math.max(BLUE_MIN, Math.min(max, Math.round(stars)));
  return withBlue(plan, { ...plan.sparkGoals.blue, [stat]: clamped });
}

/** Add a blue goal for a stat (default 1★); no-op if it exists or the budget is full. */
export function addBlueSpark(plan: CmPlan, stat: Stat, stars = 1): CmPlan {
  if (plan.sparkGoals.blue[stat] !== undefined) return plan;
  if (blueTotal(plan) >= BLUE_TOTAL_MAX) return plan;
  return setBlueStars(plan, stat, stars);
}

/** Remove a stat's blue goal. */
export function deleteBlueSpark(plan: CmPlan, stat: Stat): CmPlan {
  const blue = { ...plan.sparkGoals.blue };
  delete blue[stat];
  return withBlue(plan, blue);
}

// --- Pink sparks (aptitude / style · from plan): required career-start stars ---

const STRATEGY_FULL: Record<Strategy, string> = {
  front: 'Front Runner',
  pace: 'Pace Chaser',
  late: 'Late Surger',
  end: 'End Closer',
};
const DISTANCE_LABEL: Record<'short' | 'mile' | 'medium' | 'long', string> = {
  short: 'Sprint',
  mile: 'Mile',
  medium: 'Medium',
  long: 'Long',
};

function aptFullLabel(key: AptKey): string {
  if (key.kind === 'strategy') return STRATEGY_FULL[key.key];
  if (key.kind === 'distance') return DISTANCE_LABEL[key.key];
  return key.key === 'dirt' ? 'Dirt' : 'Turf';
}

function baseGradeFor(uma: UmaRecord, key: AptKey): Grade | undefined {
  const apt = uma.baseAptitudes;
  if (!apt) return undefined;
  if (key.kind === 'surface') return apt.surface[key.key];
  if (key.kind === 'distance') return apt.distance[key.key];
  return apt.strategy[key.key];
}

const SURFACE_KEYS: AptKey[] = [
  { kind: 'surface', key: 'turf' },
  { kind: 'surface', key: 'dirt' },
];
const DISTANCE_KEYS: AptKey[] = [
  { kind: 'distance', key: 'short' },
  { kind: 'distance', key: 'mile' },
  { kind: 'distance', key: 'medium' },
  { kind: 'distance', key: 'long' },
];

/**
 * Every aptitude a plan can carry a pink target on, in the planner sidebar's
 * order: all surfaces, all distances, then the active strategy. `targetAptitude`
 * yields a stored goal where set, the active-key default otherwise, and undefined
 * for untargeted off-race aptitudes (→ 0 stars, dropped). This is why the card
 * must scan ALL keys — the user can target distances the race isn't run at.
 */
function planAptKeys(plan: CmPlan): AptKey[] {
  return [...SURFACE_KEYS, ...DISTANCE_KEYS, { kind: 'strategy', key: plan.strategy }];
}

export interface PinkSparkRow {
  label: string;
  stars: number;
}

/**
 * The plan's pink targets as required-star chips, mirroring the planner sidebar:
 * required career-start pink stars to lift the uma's base aptitude to each target,
 * over EVERY targeted aptitude (not just the race's active surface/distance/style).
 * Only entries that actually need a spark (stars > 0) are returned; empty when no
 * uma is resolved.
 */
export function pinkSparkRows(plan: CmPlan, uma: UmaRecord | null): PinkSparkRow[] {
  if (!uma?.baseAptitudes) return [];
  return planAptKeys(plan)
    .map((key) => ({
      label: aptFullLabel(key),
      stars: pinkAptitudeRequirement(baseGradeFor(uma, key), targetAptitude(plan, key)).stars,
    }))
    .filter((row) => row.stars > 0);
}

/** Total required pink stars across the plan's aptitudes (vs PINK_TOTAL_MAX). */
export function pinkSparkTotal(plan: CmPlan, uma: UmaRecord | null): number {
  return pinkSparkRows(plan, uma).reduce((sum, row) => sum + row.stars, 0);
}

export interface MidRunSparkRow {
  label: string;
  steps: number;
}

/**
 * Aptitudes that still need in-run pink procs AFTER career-start inheritance is
 * maxed out — the planner sidebar's "mid-run spark" readout. Matches the planner
 * filter exactly: career-start used all 4 steps and the target is still short.
 */
export function midRunSparkRows(plan: CmPlan, uma: UmaRecord | null): MidRunSparkRow[] {
  if (!uma?.baseAptitudes) return [];
  return planAptKeys(plan)
    .map((key) => ({
      label: aptFullLabel(key),
      req: pinkAptitudeRequirement(baseGradeFor(uma, key), targetAptitude(plan, key)),
    }))
    .filter((row) => row.req.steps === 4 && row.req.inRunStepsNeeded > 0)
    .map((row) => ({ label: row.label, steps: row.req.inRunStepsNeeded }));
}

export interface WishlistRow {
  skillId: string;
  name: string;
  sp: number;
  gold: boolean;
}

/** Wishlist skills resolved to display name + SP cost + gold-rarity flag. */
export function wishlistRows(plan: CmPlan, skillById: Map<string, SkillRecord>): WishlistRow[] {
  return plan.wishlist.map((item) => {
    const skill = wishlistSkillRecord(item.skillId, skillById);
    return {
      skillId: item.skillId,
      name: skill?.nameEn ?? `Skill ${item.skillId}`,
      sp: skill?.baseSpCost ?? 0,
      gold: skill?.rarity === 'gold',
    };
  });
}

/** Wishlist headline: skill count + summed SP cost. */
export function wishlistSummary(
  plan: CmPlan,
  skillById: Map<string, SkillRecord>,
): { count: number; totalSp: number } {
  const rows = wishlistRows(plan, skillById);
  return { count: rows.length, totalSp: rows.reduce((sum, r) => sum + r.sp, 0) };
}
