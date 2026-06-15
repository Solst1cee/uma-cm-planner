import { useState } from 'react';

import type { CaptureBundle } from '@/core/spOptimizer';
import { useGameData } from '@/features/data/gameData';
import { BuildCards } from '@/features/sp-optimizer/BuildCards';
import { BuildContextForm } from '@/features/sp-optimizer/BuildContextForm';
import { type RankResult, rankBaskets } from '@/features/sp-optimizer/rankBaskets';
import './sp-optimizer.css';

export function SpOptimizerPage() {
  const { status } = useGameData();
  const [result, setResult] = useState<RankResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function analyze(bundle: CaptureBundle) {
    try {
      setResult(rankBaskets(bundle));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    }
  }

  if (status === 'loading') {
    return <p className="muted">Loading…</p>;
  }

  return (
    <div className="page">
      <section className="panel" aria-labelledby="sp-h">
        <h2 id="sp-h">SP Purchase Optimizer</h2>
        <p className="muted small">
          Post-run, SP-limited. Enter the skills on your purchase screen, their on-screen costs, and
          your available SP. Costs are read from the screen — never calculated.
        </p>
        <p className="sp-caveat small" role="note">
          Estimates, not verdicts — the sim can't see positional chaos (P3).
        </p>
        {status === 'fixture' && (
          <p className="error" role="alert">Running on placeholder data — results are illustrative.</p>
        )}
        <BuildContextForm onAnalyze={analyze} />
        {error && <p className="error" role="alert">Could not analyze: {error}</p>}
      </section>

      {result && (
        <section className="panel" aria-labelledby="sp-results-h">
          <h2 id="sp-results-h">Suggested baskets</h2>
          <BuildCards result={result} />
        </section>
      )}
    </div>
  );
}
