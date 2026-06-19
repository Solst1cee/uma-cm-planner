/** Run-on-demand hook driving rankSkillChart (M4 §1 acquirable-skill chart).
 *  Nothing simulates until run(); rows stream in kept-sorted, then are replaced by
 *  the sorted result. isStale flags that the build/course changed since the last run
 *  (so the panel can prompt a re-run without recomputing). Default deps reuse a
 *  module-shared SimClient imported from '@/sim/client' (NOT the '@/sim' barrel) so
 *  the engine bundle stays out of this module's import graph. */
import { useEffect, useRef, useState } from 'react';
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';
import { SimClient } from '@/sim/client';
import { rankSkillChart, compareSkillChartRows, type SkillChartRow } from '@/core/rankSkillChart';

export interface UseSkillRankDeps {
  skillDelta: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => BashinStats | Promise<BashinStats>;
  nsamples?: number;
}
export interface SkillRankState {
  rows: SkillChartRow[];
  status: 'idle' | 'running' | 'done';
  done: number;
  total: number;
  isStale: boolean;
  run: () => void;
  /** Force-stop an in-flight run: cancels remaining sims and keeps the rows ranked so far. */
  stop: () => void;
}

let client: SimClient | null = null;
function realDeps(): UseSkillRankDeps {
  client ??= new SimClient();
  return { skillDelta: client.skillDelta.bind(client) };
}

function sigOf(build: SimBuild, courseId: string, skillIds: string[], nsamples: number | undefined): string {
  return JSON.stringify([courseId, build.strategy, build.stats, build.aptitudes, build.mood ?? null, skillIds, nsamples ?? null]);
}

export function useSkillRank(
  build: SimBuild,
  race: SimRaceParams,
  skillIds: string[],
  deps?: UseSkillRankDeps,
): SkillRankState {
  const [rows, setRows] = useState<SkillChartRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [done, setDone] = useState(0);
  const [runSig, setRunSig] = useState<string | null>(null);

  const depsRef = useRef(deps);
  depsRef.current = deps;
  const runToken = useRef(0);

  // Cancel any in-flight run if the component unmounts.
  useEffect(() => () => { runToken.current += 1; }, []);

  const run = () => {
    const token = (runToken.current += 1);
    const merged = depsRef.current ?? realDeps();
    setStatus('running');
    setRows([]);
    setDone(0);
    setRunSig(sigOf(build, race.courseId, skillIds, depsRef.current?.nsamples));
    void rankSkillChart(
      build,
      race,
      skillIds,
      { skillDelta: merged.skillDelta, nsamples: merged.nsamples },
      (row) => {
        if (runToken.current === token) {
          setRows((p) => [...p, row].sort(compareSkillChartRows));
          setDone((d) => d + 1);
        }
      },
      () => runToken.current === token,
    ).then((sorted) => {
      if (runToken.current === token) {
        setRows(sorted);
        setStatus('done');
      }
    });
  };

  // Force-stop: bump the token so the in-flight stream's guards (onRow + the final
  // resolve) all no-op, and settle to 'done' so the already-ranked rows stay visible.
  const stop = () => {
    runToken.current += 1;
    setStatus((s) => (s === 'running' ? 'done' : s));
  };

  const currentSig = sigOf(build, race.courseId, skillIds, depsRef.current?.nsamples);
  const isStale = status !== 'idle' && runSig !== null && currentSig !== runSig;

  return { rows, status, done, total: skillIds.length, isStale, run, stop };
}
