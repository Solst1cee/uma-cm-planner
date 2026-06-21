/** One-shot stamina probe for the skill chart. Runs the baseline build vs itself and
 *  reads the engine's authoritative survival rate (aStaminaSurvival, 0–1). Without
 *  injected deps it lazily builds a SimClient; if that throws (jsdom has no Worker)
 *  it no-ops so component tests never spawn a real worker. */
import { useRef, useState } from 'react';
import type { SimBuild, SimRaceParams, VacuumResult } from '@/sim';
import { SimClient } from '@/sim/client';

export const PROBE_NSAMPLES = 30;

export interface UseStaminaProbeDeps {
  vacuum: (a: SimBuild, b: SimBuild, race: SimRaceParams, n: number, seed?: number)
    => VacuumResult | Promise<VacuumResult>;
  nsamples?: number;
}
export interface StaminaProbeState {
  survival: number | null;
  status: 'idle' | 'running' | 'done';
  probe: () => void;
}

let client: SimClient | null = null;
function realDeps(): UseStaminaProbeDeps {
  client ??= new SimClient();
  return { vacuum: client.vacuum.bind(client) };
}

export function useStaminaProbe(
  build: SimBuild,
  race: SimRaceParams,
  deps?: UseStaminaProbeDeps,
): StaminaProbeState {
  const [survival, setSurvival] = useState<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const depsRef = useRef(deps);
  depsRef.current = deps;
  const token = useRef(0);

  const probe = () => {
    const t = (token.current += 1);
    let d: UseStaminaProbeDeps;
    try {
      d = depsRef.current ?? realDeps();
    } catch {
      return; // no worker (jsdom) — leave survival null, no banner
    }
    setStatus('running');
    Promise.resolve(d.vacuum(build, build, race, d.nsamples ?? PROBE_NSAMPLES, undefined))
      .then((r) => {
        if (token.current === t) { setSurvival(r.aStaminaSurvival); setStatus('done'); }
      })
      .catch(() => { if (token.current === t) setStatus('idle'); });
  };

  return { survival, status, probe };
}
