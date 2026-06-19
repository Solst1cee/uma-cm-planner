/** Run-on-demand skill-trace hook (M4 skill-detail graphs). Auto-runs the cheap
 *  velocity trace when enabled + a context is present; the position-resolved impact
 *  (length-by-activation-position + activation-frequency, both from N samples) is
 *  button-gated via computeImpact(). The activation rate is derived from the impact
 *  samples. runChoice switches between the four representative trace runs returned in
 *  one sim — no re-sim. Module-shared SimClient imported from '@/sim/client' (NOT the
 *  '@/sim' barrel) so the engine bundle stays out of this module's import graph. */
import { useEffect, useRef, useState } from 'react';
import type { RunChoice, SimBuild, SimRaceParams, SkillImpact, SkillTrace, SkillTraceRun } from '@/sim';
import { SimClient } from '@/sim/client';

export const TRACE_SAMPLES = 20;
export const IMPACT_SAMPLES = 400;

/** `buildLabel` is the honest-numbers caption for whose build the trace ran on
 *  (e.g. 'your build' from the sidebar, 'the reference' from the uma chart). */
export interface TraceContext { build: SimBuild; race: SimRaceParams; buildLabel?: string; }
export interface UseSkillTraceDeps {
  skillTrace: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => SkillTrace | Promise<SkillTrace>;
  skillImpact: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => SkillImpact | Promise<SkillImpact>;
  traceSamples?: number;
  impactSamples?: number;
}
export interface SkillTraceState {
  status: 'idle' | 'running' | 'done' | 'na';
  run: SkillTraceRun | null;
  runChoice: RunChoice;
  setRunChoice: (c: RunChoice) => void;
  impact: SkillImpact | null;
  impactStatus: 'idle' | 'running' | 'done';
  computeImpact: () => void;
  /** activation rate (発動率), derived from the impact samples; null until computed. */
  rate: number | null;
}

let client: SimClient | null = null;
function realDeps(): UseSkillTraceDeps {
  client ??= new SimClient();
  return { skillTrace: client.skillTrace.bind(client), skillImpact: client.skillImpact.bind(client) };
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
  const [impact, setImpact] = useState<SkillImpact | null>(null);
  const [impactStatus, setImpactStatus] = useState<'idle' | 'running' | 'done'>('idle');

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
    setImpact(null);
    setImpactStatus('idle');
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

  const computeImpact = () => {
    if (!ctx || impactStatus === 'running') return;
    const merged = depsRef.current ?? realDeps();
    const myToken = token.current;
    setImpactStatus('running');
    void Promise.resolve(merged.skillImpact(ctx.build, ctx.race, skillId, merged.impactSamples ?? IMPACT_SAMPLES))
      .then((r) => {
        if (token.current !== myToken) return;
        setImpact(r);
        setImpactStatus('done');
      })
      .catch(() => { if (token.current === myToken) setImpactStatus('idle'); });
  };

  const run = trace ? trace.runs[runChoice] : null;
  const rate = impact && impact.nsamples > 0 ? impact.samples.length / impact.nsamples : null;
  return { status, run, runChoice, setRunChoice, impact, impactStatus, computeImpact, rate };
}
