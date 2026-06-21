/** Run-on-demand hook driving rankUmaChart (M4 §1 unique-skill chart) — a thin adapter over
 *  useStreamingRank (which owns the run/stop/token/streaming-sort/isStale plumbing). */
import type { SimRaceParams } from '@/sim';
import { rankUmaChart, compareUmaChartRows, type UmaChartCandidate, type UmaChartRow } from '@/core/rankUmaChart';
import { useStreamingRank, type StreamingRankDeps, type StreamingRankState } from './useStreamingRank';

export type UseUmaChartDeps = StreamingRankDeps;
export type UmaChartState = StreamingRankState<UmaChartRow>;

function sigOf(courseId: string, candidates: UmaChartCandidate[], nsamples: number | undefined): string {
  return JSON.stringify([courseId, candidates.map((c) => [c.outfitId, c.uniqueSkillId]), nsamples ?? null]);
}

export function useUmaChart(
  candidates: UmaChartCandidate[],
  race: SimRaceParams,
  deps?: UseUmaChartDeps,
): UmaChartState {
  return useStreamingRank<UmaChartRow>({
    total: candidates.length,
    sig: sigOf(race.courseId, candidates, deps?.nsamples),
    compare: compareUmaChartRows,
    rank: (merged, onRow, shouldContinue) =>
      rankUmaChart(candidates, race, { skillDelta: merged.skillDelta, nsamples: merged.nsamples }, onRow, shouldContinue),
    deps,
  });
}
