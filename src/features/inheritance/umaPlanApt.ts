/** The pink aptitude chips shown on the M1 "Uma plan" card (handoff README
 *  §"1. Your uma plan panel"): the plan's own pink spark goals rendered as
 *  aptitude + target-grade, e.g. "Long A" / "Turf A" / "Late A". This is the
 *  plan's targeted pink sparks — it follows the selected plan, NOT the uma's
 *  innate aptitudes. */
import type { CmPlan, Grade } from '@/core/types';
import { cap } from './labels';

export interface AptChip {
  label: string;
  grade: Grade;
}

export function umaPlanAptChips(plan: CmPlan): AptChip[] {
  return plan.sparkGoals.pink.map((goal) => ({
    label: cap(goal.aptKey.key),
    grade: goal.target,
  }));
}
