/** Shared engine for the run-on-demand, streaming-sorted chart rankers (acquirable-skill chart +
 *  unique-skill chart). Nothing simulates until run(); rows stream in kept-sorted, then are replaced
 *  by the final sorted result; isStale flags that the inputs changed since the last run (so the panel
 *  can prompt a re-run without recomputing); stop() cancels the in-flight stream and keeps the rows
 *  ranked so far. The default deps reuse a module-shared SimClient imported from '@/sim/client' (NOT
 *  the '@/sim' barrel) so the engine bundle stays out of this module's import graph. */
import { useEffect, useRef, useState } from 'react';
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';
import { SimClient } from '@/sim/client';

export interface StreamingRankDeps {
  skillDelta: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => BashinStats | Promise<BashinStats>;
  nsamples?: number;
  uniqueLevel?: number;
}

export interface StreamingRankState<Row> {
  rows: Row[];
  status: 'idle' | 'running' | 'done';
  done: number;
  total: number;
  isStale: boolean;
  run: () => void;
  /** Force-stop an in-flight run: cancels remaining sims and keeps the rows ranked so far. */
  stop: () => void;
}

let sharedClient: SimClient | null = null;
/** Returns the module-shared skillDelta bound to the lazy SimClient. Callers that need a skillDelta
 *  dep (e.g. useUniqueSkillL) can use this to reuse the single worker rather than spawning another. */
export function sharedSkillDelta(): StreamingRankDeps['skillDelta'] {
  sharedClient ??= new SimClient();
  return sharedClient.skillDelta.bind(sharedClient);
}
function sharedDeps(): StreamingRankDeps {
  return { skillDelta: sharedSkillDelta() };
}

export function useStreamingRank<Row>({ total, sig, compare, rank, deps }: {
  /** Number of candidates this run will evaluate. */
  total: number;
  /** Current input signature (recomputed each render); snapshotted at run() to drive isStale. */
  sig: string;
  /** Streamed-sort + final-order comparator. */
  compare: (a: Row, b: Row) => number;
  /** Runs the rank, streaming each row via onRow until shouldContinue() goes false. */
  rank: (deps: StreamingRankDeps, onRow: (row: Row) => void, shouldContinue: () => boolean) => Promise<Row[]>;
  deps?: Partial<StreamingRankDeps>;
}): StreamingRankState<Row> {
  const [rows, setRows] = useState<Row[]>([]);
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
    const provided = depsRef.current;
    const merged: StreamingRankDeps = provided?.skillDelta
      ? (provided as StreamingRankDeps)
      : { ...sharedDeps(), ...provided };
    setStatus('running');
    setRows([]);
    setDone(0);
    setRunSig(sig);
    void rank(
      merged,
      (row) => {
        if (runToken.current === token) {
          setRows((p) => [...p, row].sort(compare));
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

  // Force-stop: bump the token so the in-flight stream's guards (onRow + the final resolve) all
  // no-op, and settle to 'done' so the already-ranked rows stay visible.
  const stop = () => {
    runToken.current += 1;
    setStatus((s) => (s === 'running' ? 'done' : s));
  };

  const isStale = status !== 'idle' && runSig !== null && sig !== runSig;
  return { rows, status, done, total, isStale, run, stop };
}
