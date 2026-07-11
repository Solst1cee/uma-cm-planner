import { useMemo, useState } from 'react';

import { useActivePlan } from '@/app/ActivePlanContext';
import { parseCareerCapture } from '@/core/careerCapture';
import type { HintLevel } from '@/core/cost';
import {
  type BuildContext, type BuyableSkill, type CaptureBundle,
  parseCaptureBundle, wishlistToCandidates,
} from '@/core/spOptimizer';
import { useGameData } from '@/features/data/gameData';
import { BuildCards } from '@/features/sp-optimizer/BuildCards';
import { BuildSpCard } from '@/features/sp-optimizer/BuildSpCard';
import { BuyableSkillsTable } from '@/features/sp-optimizer/BuyableSkillsTable';
import { ComparePlaceholder } from '@/features/sp-optimizer/ComparePlaceholder';
import { ResultBanner } from '@/features/sp-optimizer/ResultBanner';
import { type RankResult, rankBasketsWithEngine } from '@/features/sp-optimizer/rankBaskets';
import { applyWorkingState, type WorkingEdits } from '@/features/sp-optimizer/optimizerState';
import { useCaptures } from '@/features/sp-optimizer/useCaptures';
import './sp-optimizer.css';

const EMPTY_EDITS = (): WorkingEdits => ({ pins: new Set(), costEdits: new Map(), hintEdits: new Map(), fastLearner: false });

export function SpOptimizerPage() {
  const { status, skillById, sparkRates } = useGameData();
  const { plan } = useActivePlan();
  const captures = useCaptures();

  const [activeTab, setActiveTab] = useState<'optimize' | 'compare'>('optimize');
  const [bundle, setBundle] = useState<CaptureBundle | null>(null);
  const [edits, setEdits] = useState<WorkingEdits>(EMPTY_EDITS);
  const [result, setResult] = useState<RankResult | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [stale, setStale] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [label, setLabel] = useState('');

  // The working bundle = the captured bundle with pins/cost/hint edits applied.
  const workingBundle = useMemo(
    () => (bundle ? applyWorkingState(bundle, edits, skillById, sparkRates) : null),
    [bundle, edits, skillById, sparkRates],
  );

  function seedBundle(next: CaptureBundle) {
    setBundle(next);
    setEdits(EMPTY_EDITS());
    setResult(null);
    setSelectedIdx(0);
    setStale(false);
    setImportError(null);
  }

  async function importFile(file: File) {
    try {
      const text = await file.text();
      let data: unknown;
      try { data = JSON.parse(text); } catch { throw new Error('Not valid JSON'); }
      const isRaw = typeof data === 'object' && data !== null && Array.isArray((data as { skills?: unknown }).skills);
      const dataVersion = skillById.values().next().value?.dataVersion ?? 'unknown';
      const parsed = isRaw
        ? parseCareerCapture(data, { skillById, courseId: plan?.cmRef.courseId ?? '10906', umaId: plan?.umaId ?? '', dataVersion })
        : parseCaptureBundle(data);
      seedBundle(parsed);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }

  function copyWishlist() {
    if (!plan) return;
    const candidates: BuyableSkill[] = wishlistToCandidates(plan.wishlist, skillById);
    const context: BuildContext = {
      umaId: plan.umaId, stats: { spd: 800, sta: 600, pow: 600, gut: 400, wit: 600 },
      aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, strategy: 'pace',
      courseId: plan.cmRef.courseId ?? '10906', spBudget: 1200, ownedSkills: [], pinned: [], candidates,
    };
    seedBundle({ schemaVersion: 1, source: 'ocr', capturedAt: '', server: 'global', dataVersion: 'unknown', context });
  }

  async function reAnalyze() {
    if (!workingBundle) return;
    setAnalyzing(true);
    try {
      const ranked = await rankBasketsWithEngine(workingBundle);
      setResult(ranked);
      setSelectedIdx(0);
      setStale(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  }

  const markStale = () => { if (result) setStale(true); };
  const togglePin = (id: string) => { setEdits((e) => { const pins = new Set(e.pins); pins.has(id) ? pins.delete(id) : pins.add(id); return { ...e, pins }; }); markStale(); };
  const editCost = (id: string, cost: number) => { setEdits((e) => ({ ...e, costEdits: new Map(e.costEdits).set(id, cost) })); markStale(); };
  const setHint = (id: string, lvl: HintLevel) => { setEdits((e) => ({ ...e, hintEdits: new Map(e.hintEdits).set(id, lvl) })); markStale(); };
  const setSp = (n: number) => { setBundle((b) => b ? { ...b, context: { ...b.context, spBudget: n } } : b); markStale(); };

  function saveCurrent() {
    if (!workingBundle) return;
    captures.save(label.trim() || 'Untitled capture', workingBundle);
    setLabel('');
  }

  if (status === 'loading') return <p className="muted">Loading…</p>;

  const rows = result?.candidates ?? (workingBundle?.context.candidates.map((c) => ({
    skillId: c.skillId, rarity: c.rarity, deltaL: 0, screenSpCost: c.screenSpCost,
    lPerSp: 0, hintLevel: c.hintLevel, prereqSkillId: c.prereqSkillId, pinned: edits.pins.has(c.skillId),
  })) ?? []);

  return (
    <div className="sp-page">
      <p className="sp-caveat small" role="note">
        Estimation, not a verdict (P3). The sim can't see positional chaos or opponent procs — treat a basket as a strong prior, then test in room matches.
      </p>

      {status === 'fixture' && (
        <p className="error" role="alert">Running on placeholder data — results are illustrative.</p>
      )}

      <div className="sp-imports">
        <label className="sp-import">
          Import capture (.json)
          <input type="file" accept="application/json,.json" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); }} />
        </label>
        <button type="button" onClick={copyWishlist} disabled={!plan || plan.wishlist.length === 0}>Copy from M4 wishlist</button>
      </div>
      {importError && <p className="error" role="alert">Import failed: {importError}</p>}

      <BuildSpCard
        context={workingBundle?.context ?? null}
        source={bundle?.source ?? 'manual'}
        onSourceChange={() => { /* import/manual/wishlist handled by the controls above (F1.5) */ }}
        onSpChange={setSp}
        onLoadPlan={() => { /* plan lock-prefill wired in the follow-up; copyWishlist covers the seed today */ }}
        plans={[]}
        matchSummary={null}
      />

      <div className="sp-tabs" role="tablist">
        <button role="tab" aria-selected={activeTab === 'optimize'} className={activeTab === 'optimize' ? 'on' : ''} onClick={() => setActiveTab('optimize')}>Optimize basket</button>
        <button role="tab" aria-selected={activeTab === 'compare'} className={activeTab === 'compare' ? 'on' : ''} onClick={() => setActiveTab('compare')}>Compare vs veteran</button>
      </div>

      {activeTab === 'compare' ? (
        <ComparePlaceholder />
      ) : (
        <>
          <div className="sp-analyze-row">
            <button type="button" className="sp-analyze" onClick={() => void reAnalyze()} disabled={!workingBundle || analyzing}>
              {analyzing ? 'Analyzing…' : result ? 'Re-analyze' : 'Analyze'}
            </button>
            {stale && <span className="sp-stale" role="status">⚠ changes detected — Re-analyze</span>}
          </div>
          {error && <p className="error" role="alert">Could not analyze: {error}</p>}

          {result && <ResultBanner result={result} selectedIdx={selectedIdx} spBudget={workingBundle?.context.spBudget ?? 0} />}

          {rows.length > 0 && (
            <BuyableSkillsTable
              result={result}
              rows={rows}
              selectedIdx={selectedIdx}
              pins={edits.pins}
              onTogglePin={togglePin}
              onEditCost={editCost}
              onSetHint={setHint}
            />
          )}

          {result && (
            <section aria-labelledby="sp-results-h">
              <h2 id="sp-results-h">Suggested baskets</h2>
              <BuildCards result={result} selectedIdx={selectedIdx} onSelect={setSelectedIdx} onCompare={() => setActiveTab('compare')} />
              <div className="sp-save">
                <label>Save as <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. CM14 ace" /></label>
                <button type="button" onClick={saveCurrent}>Save capture</button>
              </div>
            </section>
          )}
        </>
      )}

      <section aria-labelledby="sp-saved-h">
        <h2 id="sp-saved-h">Saved captures</h2>
        {captures.error !== null && <p className="error" role="alert">Captures error: {captures.error}</p>}
        {captures.items === null ? <p className="muted">Loading…</p> : captures.items.length === 0 ? (
          <p className="muted small">No saved captures yet.</p>
        ) : (
          <ul className="sp-saved">
            {captures.items.map((c) => (
              <li key={c.id}>
                <button type="button" className="sp-load" onClick={() => seedBundle(c.bundle)}>{c.label}</button>
                <button type="button" aria-label={`Delete ${c.label}`} onClick={() => captures.remove(c.id)}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
