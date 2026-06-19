import type { Grade } from '@/core/types';

const GRADE_RANK: Record<Grade, number> = { G: 0, F: 1, E: 2, D: 3, C: 4, B: 5, A: 6, S: 7 };
const RANK_GRADE: Grade[] = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'];
const CAREER_START_CAP: Grade = 'A';
const PINK_STAR_STEP_THRESHOLDS = [1, 4, 7, 10] as const;

export interface PinkAptitudeRequirement {
  /** Cumulative pink stars needed across lineage for the required career-start steps. */
  stars: number;
  /** Number of career-start rank steps being requested, capped to the inheritance maximum. */
  steps: number;
  /** Resulting grade after career-start inheritance is applied. */
  careerStartGrade?: Grade;
  /** False when later in-run pink procs are still needed to reach the requested target. */
  reachesTargetAtCareerStart: boolean;
  /** Additional one-rank in-run pink procs needed after career-start inheritance. */
  inRunStepsNeeded: number;
}

/**
 * Pink aptitude inheritance uses cumulative star thresholds:
 * 1/4/7/10 stars => +1/+2/+3/+4 ranks, max +4, capped at A at career start.
 * Remaining ranks need later in-run pink procs, including A -> S.
 */
export function pinkAptitudeRequirement(
  base: Grade | undefined,
  target: Grade | undefined,
): PinkAptitudeRequirement {
  if (!base || !target) {
    return { stars: 0, steps: 0, reachesTargetAtCareerStart: true, inRunStepsNeeded: 0 };
  }

  const baseRank = GRADE_RANK[base];
  const targetRank = GRADE_RANK[target];
  const capRank = GRADE_RANK[CAREER_START_CAP];
  if (baseRank >= targetRank) {
    return {
      stars: 0,
      steps: 0,
      careerStartGrade: base,
      reachesTargetAtCareerStart: true,
      inRunStepsNeeded: 0,
    };
  }

  const careerStartTargetRank = Math.min(targetRank, capRank);
  const requiredCareerStartSteps = Math.max(0, careerStartTargetRank - baseRank);
  const careerStartSteps = Math.min(requiredCareerStartSteps, PINK_STAR_STEP_THRESHOLDS.length);
  const careerStartRank = Math.min(baseRank + careerStartSteps, capRank);
  const inRunStepsNeeded = Math.max(0, targetRank - careerStartRank);
  const stars = careerStartSteps > 0
    ? PINK_STAR_STEP_THRESHOLDS[careerStartSteps - 1] ?? 0
    : inRunStepsNeeded > 0
      ? PINK_STAR_STEP_THRESHOLDS[0]
      : 0;

  return {
    stars,
    steps: careerStartSteps,
    careerStartGrade: RANK_GRADE[careerStartRank],
    reachesTargetAtCareerStart: inRunStepsNeeded === 0,
    inRunStepsNeeded,
  };
}
