/** Local-first (P2) warn-threshold for the skill-chart stamina banner. Stored as a
 *  0–1 survival fraction under one localStorage key; clamped + default-guarded so a
 *  hand-edited / corrupt value can never break the chart. */
import { useState } from 'react';

export const DEFAULT_STAMINA_WARN_THRESHOLD = 0.95;
const STORAGE_KEY = 'cmp.staminaWarnThreshold';

export function clampThreshold(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_STAMINA_WARN_THRESHOLD;
  return Math.min(1, Math.max(0, n));
}

function read(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return DEFAULT_STAMINA_WARN_THRESHOLD;
    const n = Number(raw);
    return Number.isFinite(n) ? clampThreshold(n) : DEFAULT_STAMINA_WARN_THRESHOLD;
  } catch {
    return DEFAULT_STAMINA_WARN_THRESHOLD;
  }
}

export function useStaminaWarnThreshold(): [number, (n: number) => void] {
  const [value, setValue] = useState<number>(read);
  const set = (n: number) => {
    const c = clampThreshold(n);
    setValue(c);
    try { localStorage.setItem(STORAGE_KEY, String(c)); } catch { /* storage unavailable */ }
  };
  return [value, set];
}
