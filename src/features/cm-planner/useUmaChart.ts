/** Run-on-demand hook driving rankUmaChart (M4 §1 unique-skill chart) — a thin adapter over
 *  useStreamingRank (which owns the run/stop/token/streaming-sort/isStale plumbing). */
import type { SimRaceParams } from '@/sim';
import type { SkillPatch } from '@/core/rebalance';
import { rankUmaChart, compareUmaChartRows, type UmaChartCandidate, type UmaChartRow } from '@/core/rankUmaChart';
import { useStreamingRank, type StreamingRankDeps, type StreamingRankState } from './useStreamingRank';

export type UseUmaChartDeps = Partial<StreamingRankDeps> & {
  uniqueLevel?: number;
  skillPatches?: Record<string, SkillPatch>;
};
export type UmaChartState = StreamingRankState<UmaChartRow>;

function sigOf(
  courseId: string,
  candidates: UmaChartCandidate[],
  nsamples: number | undefined,
  uniqueLevel: number | undefined,
  skillPatches: Record<string, SkillPatch> | undefined,
): string {
  return JSON.stringify([courseId, candidates.map((c) => [c.outfitId, c.uniqueSkillId]), nsamples ?? null, uniqueLevel ?? null, skillPatches ?? null]);
}

export function useUmaChart(
  candidates: UmaChartCandidate[],
  race: SimRaceParams,
  deps?: UseUmaChartDeps,
): UmaChartState {
  return useStreamingRank<UmaChartRow>({
    total: candidates.length,
    sig: sigOf(race.courseId, candidates, deps?.nsamples, deps?.uniqueLevel, deps?.skillPatches),
    compare: compareUmaChartRows,
    rank: (merged, onRow, shouldContinue) =>
      rankUmaChart(
        candidates,
        race,
        { skillDelta: merged.skillDelta, nsamples: merged.nsamples, uniqueLevel: merged.uniqueLevel, skillPatches: deps?.skillPatches },
        onRow,
        shouldContinue,
      ),
    deps,
  });
}
