/** Run-on-demand hook driving rankSkillChart (M4 §1 acquirable-skill chart) — a thin adapter over
 *  useStreamingRank (which owns the run/stop/token/streaming-sort/isStale plumbing). */
import type { SimBuild, SimRaceParams } from '@/sim';
import { rankSkillChart, compareSkillChartRows, type SkillChartRow } from '@/core/rankSkillChart';
import { useStreamingRank, type StreamingRankDeps, type StreamingRankState } from './useStreamingRank';

export type UseSkillRankDeps = StreamingRankDeps;
export type SkillRankState = StreamingRankState<SkillChartRow>;

function sigOf(build: SimBuild, courseId: string, skillIds: string[], nsamples: number | undefined): string {
  // Includes build.skills so a baseline change (e.g. targeting a wishlist skill that isn't a
  // ranked candidate) still flips isStale and prompts a re-run — the candidate ids alone miss it.
  return JSON.stringify([courseId, build.strategy, build.stats, build.aptitudes, build.mood ?? null, build.skills, skillIds, nsamples ?? null]);
}

export function useSkillRank(
  build: SimBuild,
  race: SimRaceParams,
  skillIds: string[],
  deps?: UseSkillRankDeps,
): SkillRankState {
  return useStreamingRank<SkillChartRow>({
    total: skillIds.length,
    sig: sigOf(build, race.courseId, skillIds, deps?.nsamples),
    compare: compareSkillChartRows,
    rank: (merged, onRow, shouldContinue) =>
      rankSkillChart(build, race, skillIds, { skillDelta: merged.skillDelta, nsamples: merged.nsamples }, onRow, shouldContinue),
    deps,
  });
}
