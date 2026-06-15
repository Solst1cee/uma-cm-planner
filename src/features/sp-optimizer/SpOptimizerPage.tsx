import { useState } from 'react';

import { useActivePlan } from '@/app/ActivePlanContext';
import { type BuyableSkill, type CaptureBundle, parseCaptureBundle, wishlistToCandidates } from '@/core/spOptimizer';
import { useGameData } from '@/features/data/gameData';
import { BuildCards } from '@/features/sp-optimizer/BuildCards';
import { BuildContextForm } from '@/features/sp-optimizer/BuildContextForm';
import { type RankResult, rankBaskets } from '@/features/sp-optimizer/rankBaskets';
import { useCaptures } from '@/features/sp-optimizer/useCaptures';
import './sp-optimizer.css';

interface Seed { candidates: BuyableSkill[]; sp?: number; courseId?: string; }

export function SpOptimizerPage() {
  const { status, skillById } = useGameData();
  const { plan } = useActivePlan();
  const captures = useCaptures();
  const [result, setResult] = useState<RankResult | null>(null);
  const [bundle, setBundle] = useState<CaptureBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [seed, setSeed] = useState<Seed | null>(null);
  const [seedKey, setSeedKey] = useState(0);

  function applySeed(next: Seed) {
    setSeed(next);
    setSeedKey((k) => k + 1);
    setImportError(null);
  }

  async function importFile(file: File) {
    try {
      const parsed = parseCaptureBundle(JSON.parse(await file.text()));
      applySeed({ candidates: parsed.context.candidates, sp: parsed.context.spBudget, courseId: parsed.context.courseId });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }

  function copyWishlist() {
    if (!plan) return;
    applySeed({ candidates: wishlistToCandidates(plan.wishlist, skillById) });
  }

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

  const wishlistEmpty = !plan || plan.wishlist.length === 0;

  return (
    <div className="page">
      <section className="panel" aria-labelledby="sp-h">
        <h2 id="sp-h">SP Purchase Optimizer</h2>
        <p className="muted small">
          Post-run, SP-limited. Enter the skills on your purchase screen (or import / copy from your
          M4 wishlist), their on-screen costs, and your available SP. Costs are read from the screen — never calculated.
        </p>
        <p className="sp-caveat small" role="note">
          Estimates, not verdicts — the sim can't see positional chaos (P3).
        </p>
        {status === 'fixture' && (
          <p className="error" role="alert">Running on placeholder data — results are illustrative.</p>
        )}

        <div className="sp-imports">
          <label className="sp-import">
            Import capture (.json)
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); }}
            />
          </label>
          <button type="button" onClick={copyWishlist} disabled={wishlistEmpty}>
            Copy from M4 wishlist
          </button>
        </div>
        {importError && <p className="error" role="alert">Import failed: {importError}</p>}

        <BuildContextForm
          key={seedKey}
          onAnalyze={analyze}
          initialCandidates={seed?.candidates}
          initialSpBudget={seed?.sp}
          initialCourseId={seed?.courseId}
        />
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
