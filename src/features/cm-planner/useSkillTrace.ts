/** Run-on-demand skill-trace hook (M4 skill-detail graphs). Auto-runs the cheap
 *  trace (curves) when enabled + a context is present; the activation rate is
 *  button-gated via computeRate(). runChoice switches between the four
 *  representative runs returned in one sim — no re-sim. Module-shared SimClient
 *  imported from '@/sim/client' (NOT the '@/sim' barrel) so the engine bundle
 *  stays out of this module's import graph. */
import { useEffect, useRef, useState } from 'react';
import type { RunChoice, SimBuild, SimRaceParams, SkillRate, SkillTrace, SkillTraceRun } from '@/sim';
import { SimClient } from '@/sim/client';

export const TRACE_SAMPLES = 20;
export const RATE_SAMPLES = 400;

/** `buildLabel` is the honest-numbers caption for whose build the trace ran on
 *  (e.g. 'your build' from the sidebar, 'the reference' from the uma chart). */
export interface TraceContext { build: SimBuild; race: SimRaceParams; buildLabel?: string; }
export interface UseSkillTraceDeps {
  skillTrace: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => SkillTrace | Promise<SkillTrace>;
  skillRate: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => SkillRate | Promise<SkillRate>;
  traceSamples?: number;
  rateSamples?: number;
}
export interface SkillTraceState {
  status: 'idle' | 'running' | 'done' | 'na';
  run: SkillTraceRun | null;
  runChoice: RunChoice;
  setRunChoice: (c: RunChoice) => void;
  rate: number | null;
  rateStatus: 'idle' | 'running' | 'done';
  computeRate: () => void;
}

let client: SimClient | null = null;
function realDeps(): UseSkillTraceDeps {
  client ??= new SimClient();
  return { skillTrace: client.skillTrace.bind(client), skillRate: client.skillRate.bind(client) };
}

export function useSkillTrace(
  skillId: string,
  ctx: TraceContext | undefined,
  enabled: boolean,
  deps?: UseSkillTraceDeps,
): SkillTraceState {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'na'>('idle');
  const [trace, setTrace] = useState<SkillTrace | null>(null);
  const [runChoice, setRunChoice] = useState<RunChoice>('median');
  const [rate, setRate] = useState<number | null>(null);
  const [rateStatus, setRateStatus] = useState<'idle' | 'running' | 'done'>('idle');

  const depsRef = useRef(deps);
  depsRef.current = deps;
  const token = useRef(0);

  // Auto-run the trace when enabled + a context is present. Re-run on skill/course/build change.
  const sig = ctx ? `${skillId}|${ctx.race.courseId}|${ctx.build.umaId}|${ctx.build.strategy}|${ctx.build.stats.spd}/${ctx.build.stats.sta}/${ctx.build.stats.pow}/${ctx.build.stats.gut}/${ctx.build.stats.wit}` : null;
  useEffect(() => {
    if (!enabled || !ctx || sig === null) return;
    const merged = depsRef.current ?? realDeps();
    const myToken = (token.current += 1);
    setStatus('running');
    setTrace(null);
    setRate(null);
    setRateStatus('idle');
    void Promise.resolve(merged.skillTrace(ctx.build, ctx.race, skillId, merged.traceSamples ?? TRACE_SAMPLES))
      .then((t) => {
        if (token.current !== myToken) return;
        setTrace(t);
        setStatus(t.nsamples === 0 ? 'na' : 'done');
      })
      .catch(() => { if (token.current === myToken) setStatus('na'); });
    return () => { token.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sig]);

  const computeRate = () => {
    if (!ctx || rateStatus === 'running') return;
    const merged = depsRef.current ?? realDeps();
    const myToken = token.current;
    setRateStatus('running');
    void Promise.resolve(merged.skillRate(ctx.build, ctx.race, skillId, merged.rateSamples ?? RATE_SAMPLES))
      .then((r) => {
        if (token.current !== myToken) return;
        setRate(r.rate);
        setRateStatus('done');
      })
      .catch(() => { if (token.current === myToken) setRateStatus('idle'); });
  };

  const run = trace ? trace.runs[runChoice] : null;
  return { status, run, runChoice, setRunChoice, rate, rateStatus, computeRate };
}
