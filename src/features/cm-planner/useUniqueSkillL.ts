import { useEffect, useRef, useState } from 'react';
import { referenceBuild } from '@/core/rankUmaChart';
import type { SimBuild, SimRaceParams } from '@/sim/types';
import type { BashinStats } from '@/sim/types';
import type { Strategy } from '@/core/types';

export interface UniqueSkillLDeps {
  skillDelta: (build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed?: number) => Promise<BashinStats>;
  nsamples?: number;
  seed?: number;
}

export interface UseUniqueSkillLArgs {
  outfitId: string;
  uniqueSkillId: string;
  strategy: Strategy;
  level: number;
  race: SimRaceParams;
  deps: UniqueSkillLDeps;
}

const NS = 200;

export function useUniqueSkillL(args: UseUniqueSkillLArgs): { L: number | null; loading: boolean } {
  const { outfitId, uniqueSkillId, strategy, level, race, deps } = args;
  const [state, setState] = useState<{ L: number | null; loading: boolean }>({ L: null, loading: false });
  // Recompute key: only these inputs change the result (matches the chart's reference build).
  const key = `${outfitId}|${uniqueSkillId}|${strategy}|${level}|${race.courseId}`;
  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    if (!uniqueSkillId || !outfitId) {
      setState({ L: null, loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ L: s.L, loading: true }));
    const build: SimBuild = { ...referenceBuild(outfitId, strategy), skillLevels: { [uniqueSkillId]: level } };
    depsRef.current
      .skillDelta(build, race, uniqueSkillId, depsRef.current.nsamples ?? NS, depsRef.current.seed)
      .then((s) => { if (!cancelled) setState({ L: s.nsamples > 0 ? s.mean : null, loading: false }); })
      .catch(() => { if (!cancelled) setState({ L: null, loading: false }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
