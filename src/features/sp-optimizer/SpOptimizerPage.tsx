import { useState } from 'react';

import type { CaptureBundle } from '@/core/spOptimizer';
import { useGameData } from '@/features/data/gameData';
import { BuildCards } from '@/features/sp-optimizer/BuildCards';
import { BuildContextForm } from '@/features/sp-optimizer/BuildContextForm';
import { type RankResult, rankBaskets } from '@/features/sp-optimizer/rankBaskets';
import { useCaptures } from '@/features/sp-optimizer/useCaptures';
import './sp-optimizer.css';

export function SpOptimizerPage() {
  const { status } = useGameData();
  const captures = useCaptures();
  const [result, setResult] = useState<RankResult | null>(null);
  const [bundle, setBundle] = useState<CaptureBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');

  function analyze(b: CaptureBundle) {
    setBundle(b);
    try {
      setResult(rankBaskets(b));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    }
  }

  function saveCurrent() {
    if (!bundle) return;
    captures.save(label.trim() || 'Untitled capture', bundle);
    setLabel('');
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
          <div className="sp-save">
            <label>
              Save as
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. CM14 ace" />
            </label>
            <button type="button" onClick={saveCurrent}>Save capture</button>
          </div>
        </section>
      )}

      <section className="panel" aria-labelledby="sp-saved-h">
        <h2 id="sp-saved-h">Saved captures</h2>
        {captures.error !== null && <p className="error" role="alert">Captures error: {captures.error}</p>}
        {captures.items === null ? (
          <p className="muted">Loading…</p>
        ) : captures.items.length === 0 ? (
          <p className="muted small">No saved captures yet.</p>
        ) : (
          <ul className="sp-saved">
            {captures.items.map((c) => (
              <li key={c.id}>
                <button type="button" className="sp-load" onClick={() => analyze(c.bundle)}>{c.label}</button>
                <button type="button" aria-label={`Delete ${c.label}`} onClick={() => captures.remove(c.id)}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
