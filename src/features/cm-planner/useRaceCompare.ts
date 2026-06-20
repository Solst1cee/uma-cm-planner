/** Run-on-demand two-build race-compare hook. Auto-runs when enabled + a context is
 *  present; MEMOIZED by sig (course + both builds' stats + skills) in a module LRU so
 *  swapping uma2 / re-opening is instant. runChoice switches reps with no re-sim.
 *  Shared SimClient from '@/sim/client' (NOT the '@/sim' barrel) to keep the engine lazy. */
import { useEffect, useRef, useState } from 'react';
import type { RaceCompare, RaceCompareRun, RunChoice, SimBuild, SimRaceParams } from '@/sim';
import { SimClient } from '@/sim/client';

export const RACE_COMPARE_SAMPLES = 30;
const CACHE_MAX = 20;

export interface RaceCompareCtx { uma1: SimBuild; uma2: SimBuild; race: SimRaceParams; }
export interface UseRaceCompareDeps {
  raceCompare: (u1: SimBuild, u2: SimBuild, r: SimRaceParams, n: number, seed?: number) => RaceCompare | Promise<RaceCompare>;
  samples?: number;
}
export interface RaceCompareState {
  status: 'idle' | 'running' | 'done' | 'na';
  run: RaceCompareRun | null;
  runChoice: RunChoice;
  setRunChoice: (c: RunChoice) => void;
  distance: number;
  meanBashin: number | null;
}

const cache = new Map<string, RaceCompare>();
function cacheGet(sig: string) { const v = cache.get(sig); if (v) { cache.delete(sig); cache.set(sig, v); } return v; }
function cacheSet(sig: string, v: RaceCompare) {
  cache.delete(sig); cache.set(sig, v);
  while (cache.size > CACHE_MAX) { const k = cache.keys().next().value; if (k === undefined) break; cache.delete(k); }
}
export function clearRaceCompareCache() { cache.clear(); }

let client: SimClient | null = null;
function realDeps(): UseRaceCompareDeps {
  client ??= new SimClient();
  return { raceCompare: client.raceCompare.bind(client) };
}

function buildSig(b: SimBuild): string {
  const s = b.stats;
  return `${b.umaId}/${b.strategy}/${s.spd}-${s.sta}-${s.pow}-${s.gut}-${s.wit}/${[...b.skills].sort().join(',')}`;
}

export function useRaceCompare(ctx: RaceCompareCtx | undefined, enabled: boolean, deps?: UseRaceCompareDeps): RaceCompareState {
  const [status, setStatus] = useState<RaceCompareState['status']>('idle');
  const [data, setData] = useState<RaceCompare | null>(null);
  const [runChoice, setRunChoice] = useState<RunChoice>('median');
  const depsRef = useRef(deps); depsRef.current = deps;
  const token = useRef(0);

  const dead = !!ctx && (ctx.uma1.stats.spd <= 0 || ctx.uma2.stats.spd <= 0);
  const sig = ctx && !dead ? `${ctx.race.courseId}|${buildSig(ctx.uma1)}|${buildSig(ctx.uma2)}` : null;

  useEffect(() => {
    if (!enabled || !ctx) return;
    if (dead) { setStatus('na'); setData(null); return; }
    if (sig === null) return;
    const merged = depsRef.current ?? realDeps();
    const myToken = (token.current += 1);
    const cached = cacheGet(sig);
    if (cached) { setData(cached); setStatus(cached.nsamples === 0 ? 'na' : 'done'); return; }
    setStatus('running'); setData(null);
    void Promise.resolve(merged.raceCompare(ctx.uma1, ctx.uma2, ctx.race, merged.samples ?? RACE_COMPARE_SAMPLES))
      .then((rc) => {
        if (token.current !== myToken) return;
        setData(rc); setStatus(rc.nsamples === 0 ? 'na' : 'done'); cacheSet(sig, rc);
      })
      .catch(() => { if (token.current === myToken) setStatus('na'); });
    return () => { token.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sig, dead]);

  return {
    status, run: data ? data.runs[runChoice] : null, runChoice, setRunChoice,
    distance: data?.distance ?? 0, meanBashin: data?.meanBashin ?? null,
  };
}
