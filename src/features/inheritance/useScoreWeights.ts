// src/features/inheritance/useScoreWeights.ts
/** M1.6 — browser-local euophrys scoring scenario (guarded localStorage, like useDeckState). */
import { useState } from 'react';
import type { UmaTiersScenario } from '@/vendor/uma-tiers/index';
import { DEFAULT_SCENARIO } from '@/core/cardScore';

const KEY = 'scb_score_weights';

function read(): UmaTiersScenario {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return DEFAULT_SCENARIO;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === DEFAULT_SCENARIO.version) return parsed as UmaTiersScenario;
    return DEFAULT_SCENARIO;
  } catch {
    return DEFAULT_SCENARIO;
  }
}

export function useScoreWeights() {
  const [scenario, setState] = useState<UmaTiersScenario>(() => read());
  const persist = (s: UmaTiersScenario) => {
    setState(s);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
  };
  return { scenario, setScenario: persist, reset: () => persist(DEFAULT_SCENARIO) };
}
