/** Local-first (P2) stamina targets for the Stamina Calculator + the skill-chart banner.
 *  Two independent 0–1 fractions persisted under their own localStorage keys, each
 *  clamped + default-guarded so a hand-edited / corrupt value can never break a chart:
 *   - warn threshold = the STAMINA SURVIVAL target (drives the accel/skill stamina-out banner)
 *   - spurt target   = the FULL SPURT RATE target (drives the full-spurt required-stamina readout)
 */
import { useState } from 'react';

export const DEFAULT_STAMINA_WARN_THRESHOLD = 0.95; // survival / warn target
export const DEFAULT_STAMINA_SPURT_TARGET = 0.95; // full-spurt-rate target
const WARN_KEY = 'cmp.staminaWarnThreshold';
const SPURT_KEY = 'cmp.staminaSpurtTarget';

export function clampThreshold(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_STAMINA_WARN_THRESHOLD;
  return Math.min(1, Math.max(0, n));
}

function read(key: string, dflt: number): number {
  try {
    const raw = localStorage.getItem(key);
    // null = nothing stored; blank = Number('')===0 would silently disable the target.
    if (raw == null || raw.trim() === '') return dflt;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : dflt;
  } catch {
    return dflt;
  }
}

function useStoredFraction(key: string, dflt: number): [number, (n: number) => void] {
  const [value, setValue] = useState<number>(() => read(key, dflt));
  const set = (n: number) => {
    const c = Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : dflt;
    setValue(c);
    try { localStorage.setItem(key, String(c)); } catch { /* storage unavailable */ }
  };
  return [value, set];
}

/** Stamina-survival target (0–1) — drives the accel/skill stamina-out warning. */
export function useStaminaWarnThreshold(): [number, (n: number) => void] {
  return useStoredFraction(WARN_KEY, DEFAULT_STAMINA_WARN_THRESHOLD);
}

/** Full-spurt-rate target (0–1) — drives the full-spurt required-stamina readout. */
export function useStaminaSpurtTarget(): [number, (n: number) => void] {
  return useStoredFraction(SPURT_KEY, DEFAULT_STAMINA_SPURT_TARGET);
}
