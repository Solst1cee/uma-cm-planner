/** Run-on-demand skill-trace hook (M4 skill-detail graphs). When enabled + a context is
 *  present it auto-runs BOTH the cheap velocity trace (shows first) AND the heavier
 *  position-resolved impact (length-by-activation-position + activation-frequency, from N
 *  samples) — the two queue on the same FIFO worker so velocity paints first, then the
 *  impact charts. Results are MEMOIZED by sig (skill + build + course) in a module-level
 *  LRU, so re-opening a skill (or re-running the chart with the same build) is instant and
 *  never re-simulates. The activation rate is derived from the impact samples. runChoice
 *  switches between the four representative trace runs returned in one sim — no re-sim.
 *  Module-shared SimClient imported from '@/sim/client' (NOT the '@/sim' barrel) so the
 *  engine bundle stays out of this module's import graph. */
import { useEffect, useRef, useState } from 'react';
import type { RunChoice, SimBuild, SimRaceParams, SkillImpact, SkillTrace, SkillTraceRun } from '@/sim';
import { SimClient } from '@/sim/client';

export const TRACE_SAMPLES = 20;
export const IMPACT_SAMPLES = 400;
const CACHE_MAX = 30; // distinct skill+build+course results kept (LRU)

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
  /** activation rate (発動率), derived from the impact samples; null until the impact run resolves. */
  rate: number | null;
}

// --- module-level LRU memo of completed sims, keyed by sig ---
const cache = new Map<string, { trace?: SkillTrace; impact?: SkillImpact }>();
function cacheGet(sig: string) {
  const v = cache.get(sig);
  if (v) { cache.delete(sig); cache.set(sig, v); } // bump recency
  return v;
}
function cacheSet(sig: string, patch: { trace?: SkillTrace; impact?: SkillImpact }) {
  const next = { ...cache.get(sig), ...patch };
  cache.delete(sig);
  cache.set(sig, next);
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}
/** Clear the memo (tests; or when the underlying data version changes). */
export function clearSkillTraceCache() { cache.clear(); }

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

  // Auto-run when enabled + a context is present. Re-run on skill/course/build change.
  const sig = ctx ? `${skillId}|${ctx.race.courseId}|${ctx.build.umaId}|${ctx.build.strategy}|${ctx.build.stats.spd}/${ctx.build.stats.sta}/${ctx.build.stats.pow}/${ctx.build.stats.gut}/${ctx.build.stats.wit}` : null;
  useEffect(() => {
    if (!enabled || !ctx || sig === null) return;
    const merged = depsRef.current ?? realDeps();
    const myToken = (token.current += 1);
    const { build, race } = ctx;
    const cached = cacheGet(sig);

    // 1. Velocity trace — from cache if present, else run (20 samples) and memoize.
    if (cached?.trace) {
      setTrace(cached.trace);
      setStatus(cached.trace.nsamples === 0 ? 'na' : 'done');
    } else {
      setStatus('running');
      setTrace(null);
      void Promise.resolve(merged.skillTrace(build, race, skillId, merged.traceSamples ?? TRACE_SAMPLES))
        .then((t) => {
          if (token.current !== myToken) return;
          setTrace(t);
          setStatus(t.nsamples === 0 ? 'na' : 'done');
          cacheSet(sig, { trace: t });
        })
        .catch(() => { if (token.current === myToken) setStatus('na'); });
    }

    // 2. Position impact — from cache if present, else run (IMPACT_SAMPLES) and memoize.
    if (cached?.impact) {
      setImpact(cached.impact);
      setImpactStatus(cached.impact.nsamples === 0 ? 'idle' : 'done');
    } else {
      setImpactStatus('running');
      setImpact(null);
      void Promise.resolve(merged.skillImpact(build, race, skillId, merged.impactSamples ?? IMPACT_SAMPLES))
        .then((r) => {
          if (token.current !== myToken) return;
          setImpact(r);
          setImpactStatus(r.nsamples === 0 ? 'idle' : 'done');
          cacheSet(sig, { impact: r });
        })
        .catch(() => { if (token.current === myToken) setImpactStatus('idle'); });
    }

    return () => { token.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sig]);

  const run = trace ? trace.runs[runChoice] : null;
  const rate = impact && impact.nsamples > 0 ? impact.samples.length / impact.nsamples : null;
  return { status, run, runChoice, setRunChoice, impact, impactStatus, rate };
}
