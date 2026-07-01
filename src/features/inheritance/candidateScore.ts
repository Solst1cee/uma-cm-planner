/**
 * Heuristic pre-rank of roster parents against a plan's spark goals (P3: a
 * ranking aid, NOT a verdict). score = Σ min(parentBlueStars, goalStars) over
 * blue goals + parent pink stars where the aptitude matches a pink goal. Pink
 * plan goals store a Grade (no star) so there is no star to min against —
 * matched pink contributes the parent's own stars.
 */
import type { AptKey, CmPlan, Parent, Stat } from '@/core/types';

/** AptKey → the Parent.pinkSpark.aptitude string convention (distance short → 'sprint'). */
export function aptKeyToPinkKey(aptKey: AptKey): string {
  if (aptKey.kind === 'distance') return aptKey.key === 'short' ? 'sprint' : aptKey.key;
  return aptKey.key;
}

export function candidateScore(parent: Parent, goals: CmPlan['sparkGoals']): number {
  let score = 0;
  for (const [stat, goalStars] of Object.entries(goals.blue) as Array<[Stat, number]>) {
    if (goalStars && parent.blueSpark.stat === stat) {
      score += Math.min(parent.blueSpark.stars, goalStars);
    }
  }
  const pinkKeys = new Set(goals.pink.map((g) => aptKeyToPinkKey(g.aptKey)));
  if (pinkKeys.has(parent.pinkSpark.aptitude)) score += parent.pinkSpark.stars;
  return score;
}

export function topCandidates(
  parents: Parent[],
  goals: CmPlan['sparkGoals'],
  n = 5,
): Array<{ parent: Parent; score: number }> {
  return parents
    .map((parent) => ({ parent, score: candidateScore(parent, goals) }))
    .sort((a, b) => b.score - a.score || a.parent.id.localeCompare(b.parent.id))
    .slice(0, n);
}
