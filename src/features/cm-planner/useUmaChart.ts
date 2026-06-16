/** Run-on-demand hook driving rankUmaChart (M4 §1). Nothing simulates until run();
 *  rows stream in evaluation order, then are replaced by the sorted result. isStale
 *  flags that the course changed since the last run (so the panel can prompt a re-run
 *  without recomputing). Default worker deps reuse a module-shared SimClient — imported
 *  from '@/sim/client' (not the '@/sim' barrel) so the engine bundle stays out of this
 *  module's import graph (it only loads in the worker when run() actually sims). */
import { useEffect, useRef, useState } from 'react';
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';
import { SimClient } from '@/sim/client';
import { rankUmaChart, type UmaChartCandidate, type UmaChartRow } from '@/core/rankUmaChart';

export interface UseUmaChartDeps {
  skillDelta: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => BashinStats | Promise<BashinStats>;
  nsamples?: number;
}
export interface UmaChartState {
  rows: UmaChartRow[];
  status: 'idle' | 'running' | 'done';
  done: number;
  total: number;
  isStale: boolean;
  run: () => void;
}

let client: SimClient | null = null;
function realDeps(): UseUmaChartDeps {
  client ??= new SimClient();
  return { skillDelta: client.skillDelta.bind(client) };
}

function sigOf(courseId: string, candidates: UmaChartCandidate[], nsamples: number | undefined): string {
  return JSON.stringify([courseId, candidates.map((c) => [c.outfitId, c.uniqueSkillId]), nsamples ?? null]);
}

export function useUmaChart(
  candidates: UmaChartCandidate[],
  race: SimRaceParams,
  deps?: UseUmaChartDeps,
): UmaChartState {
  const [rows, setRows] = useState<UmaChartRow[]>([]);
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
    setRunSig(sigOf(race.courseId, candidates, merged.nsamples));
    void rankUmaChart(
      candidates,
      race,
      { skillDelta: merged.skillDelta, nsamples: merged.nsamples },
      (row) => {
        if (runToken.current === token) {
          setRows((p) => [...p, row]);
          setDone((d) => d + 1);
        }
      },
    ).then((sorted) => {
      if (runToken.current === token) {
        setRows(sorted);
        setStatus('done');
      }
    });
  };

  const currentSig = sigOf(race.courseId, candidates, depsRef.current?.nsamples);
  const isStale = status !== 'idle' && runSig !== null && currentSig !== runSig;

  return { rows, status, done, total: candidates.length, isStale, run };
}
