/** React hook driving rankSkillChart with streaming state (M4 §1).
 *  Rows arrive in evaluation order while running; on completion `rows` is
 *  replaced with the sorted return array (L desc, na last). Default deps lazily
 *  spawn a single module-shared SimClient — never constructed under tests, which
 *  always inject `deps`. */
import { useEffect, useRef, useState } from 'react';
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';
import { SimClient } from '@/sim';
import { rankSkillChart, type SkillChartRow } from '@/core/rankSkillChart';

export interface UseSkillChartDeps {
  skillDelta: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => BashinStats | Promise<BashinStats>;
  nsamples?: number;
}

export interface SkillChartState {
  rows: SkillChartRow[];
  status: 'idle' | 'running' | 'done';
  done: number;
  total: number;
}

/** Module-shared worker-backed deps, created lazily on first real use. */
let client: SimClient | null = null;
function realDeps(): UseSkillChartDeps {
  client ??= new SimClient();
  return { skillDelta: client.skillDelta.bind(client) };
}

export function useSkillChart(
  build: SimBuild,
  race: SimRaceParams,
  skillIds: string[],
  deps?: UseSkillChartDeps,
): SkillChartState {
  const [rows, setRows] = useState<SkillChartRow[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [done, setDone] = useState(0);

  // Keep the latest deps without forcing them into the effect's key.
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const sig = JSON.stringify([
    race.courseId,
    build.strategy,
    build.stats,
    build.aptitudes,
    build.mood ?? null,
    skillIds,
    deps?.nsamples ?? null,
  ]);

  useEffect(() => {
    let cancelled = false;
    setStatus('running');
    setRows([]);
    setDone(0);

    const mergedDeps = depsRef.current ?? realDeps();
    void rankSkillChart(
      build,
      race,
      skillIds,
      { skillDelta: mergedDeps.skillDelta, nsamples: mergedDeps.nsamples },
      (row) => {
        if (!cancelled) {
          setRows((p) => [...p, row]);
          setDone((d) => d + 1);
        }
      },
    ).then((sorted) => {
      if (!cancelled) {
        setRows(sorted);
        setStatus('done');
      }
    });

    return () => {
      cancelled = true;
    };
    // sig captures every meaningful input; build/race/skillIds/deps are read fresh inside.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return { rows, status, done, total: skillIds.length };
}
