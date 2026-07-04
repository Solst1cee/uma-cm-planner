/** M1.8 — "Target spark" read-off (handoff §7). Consolidates the sparks to hunt
 *  for on a parent / rental to complete the plan: BLUE + PINK goals verbatim
 *  (reusing the M1.3 plan-target helpers) + WHITE = uncovered wishlist skills
 *  (fed by the M1.7 coverage matrix, family-aware ○≡◎). This builder is also
 *  the reusable seeding contract for M1.4b's rental "Load from Target spark".
 *  Pure — no providers, no side effects. */
import type { CmPlan, SkillRecord, UmaRecord } from '@/core/types';
import { blueSparkRows, pinkSparkRows, type BlueSparkRow, type PinkSparkRow } from './planTargets';

export interface WhiteSparkRow {
  id: string;
  name: string;
}

/** 'empty' = the plan has no wishlist skills, so there is nothing to cover (NOT
 *  a green "all obtainable" — that would read vacuously true); 'covered' = the
 *  wishlist is non-empty and every skill is obtainable; 'gaps' = some wishlist
 *  skills still need a spark source. */
export type TargetSparkCoverage = 'empty' | 'covered' | 'gaps';

export interface TargetSpark {
  blue: BlueSparkRow[];
  pink: PinkSparkRow[];
  white: WhiteSparkRow[];
  coverage: TargetSparkCoverage;
}

export function buildTargetSpark(
  plan: CmPlan,
  uma: UmaRecord | null,
  skillById: Map<string, SkillRecord>,
  uncoveredSkillIds: string[],
): TargetSpark {
  const blue = blueSparkRows(plan);
  const pink = pinkSparkRows(plan, uma);

  if ((plan.wishlist ?? []).length === 0) {
    return { blue, pink, white: [], coverage: 'empty' };
  }
  if (uncoveredSkillIds.length === 0) {
    return { blue, pink, white: [], coverage: 'covered' };
  }
  const white: WhiteSparkRow[] = [];
  for (const id of uncoveredSkillIds) {
    const name = skillById.get(id)?.nameEn;
    if (name !== undefined) white.push({ id, name });
  }
  return { blue, pink, white, coverage: 'gaps' };
}
