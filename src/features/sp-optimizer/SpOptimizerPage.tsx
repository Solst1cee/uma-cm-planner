import { useMemo, useRef, useState } from 'react';

import { useActivePlan } from '@/app/ActivePlanContext';
import { parseCareerCapture } from '@/core/careerCapture';
import type { HintLevel } from '@/core/cost';
import {
  type BuildContext, type BuyableSkill, type CaptureBundle,
  parseCaptureBundle, wishlistToCandidates,
} from '@/core/spOptimizer';
import type { CmPlan } from '@/core/types';
import { HeaderHelp } from '@/features/cm-planner/HeaderHelp';
import { PlanInventoryCard } from '@/features/cm-planner/PlanInventoryCard';
import { useDismissOnOutside } from '@/features/cm-planner/useDismissOnOutside';
import { useGameData } from '@/features/data/gameData';
import { BuildCards } from '@/features/sp-optimizer/BuildCards';
import { BuildSpCard, type MatchSummary } from '@/features/sp-optimizer/BuildSpCard';
import { BuyableSkillsTable } from '@/features/sp-optimizer/BuyableSkillsTable';
import { ComparePlaceholder } from '@/features/sp-optimizer/ComparePlaceholder';
import { ResultBanner } from '@/features/sp-optimizer/ResultBanner';
import { type CandidateRow, type RankResult, rankBasketsWithEngine } from '@/features/sp-optimizer/rankBaskets';
import { applyWorkingState, cycleLockState, mergedCandidates, planMatch, type WorkingEdits } from '@/features/sp-optimizer/optimizerState';
import { useCaptures } from '@/features/sp-optimizer/useCaptures';
// PlanInventoryCard's cmp-* styles live in cm-planner.css, which only the `/`
// chunk pulls in — a cold /sp-optimizer load (deep link / refresh) would render
// the popover unstyled without this (same class of bug as M1.4b's InheritancePage).
import '@/features/cm-planner/cm-planner.css';
import './sp-optimizer.css';

const EMPTY_EDITS = (): WorkingEdits => ({ pins: new Set(), excluded: new Set(), hintEdits: new Map(), fastLearner: false });

export function SpOptimizerPage() {
  const { status, skillById, sparkRates } = useGameData();
  const { plan, savedPlans, deleteSavedPlan, deleteAllSavedPlans, importSavedPlans } = useActivePlan();
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
  const [invOpen, setInvOpen] = useState(false);
  const [loadedPlan, setLoadedPlan] = useState<{ id: string; name: string } | null>(null);
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);
  const invRef = useRef<HTMLSpanElement>(null);
  useDismissOnOutside(invRef, invOpen, () => setInvOpen(false), { esc: true });

  // The working bundle = the captured bundle with pins/cost/hint edits applied.
  const workingBundle = useMemo(
    () => (bundle ? applyWorkingState(bundle, edits, sparkRates) : null),
    [bundle, edits, skillById, sparkRates],
  );

  function seedBundle(next: CaptureBundle) {
    setBundle(next);
    setEdits(EMPTY_EDITS());
    setResult(null);
    setSelectedIdx(0);
    setStale(false);
    setImportError(null);
    setError(null);
    setLoadedPlan(null);
    setMatchSummary(null);
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

  /** Seed the working set from a planner plan: its wishlist becomes the
   *  candidate list, its target stats + strategy fill the context. SP and
   *  aptitudes have no plan-side source — placeholder until the user edits. */
  function seedFromPlan(p: CmPlan) {
    const candidates: BuyableSkill[] = wishlistToCandidates(p.wishlist, skillById);
    const context: BuildContext = {
      umaId: p.umaId, stats: { ...p.statProfile.stats },
      aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, strategy: p.strategy,
      courseId: p.cmRef.courseId ?? '10906', spBudget: 1200, ownedSkills: [], pinned: [], candidates,
    };
    seedBundle({ schemaVersion: 1, source: 'ocr', capturedAt: '', server: 'global', dataVersion: 'unknown', context });
  }

  function copyWishlist() {
    if (plan) seedFromPlan(plan);
  }

  /** Handoff "Load uma plan": prefill the picked plan's wishlist as 🔒 locks on
   *  the CURRENT capture's table — the imported build itself is untouched. */
  function overlayPlan(picked: CmPlan) {
    if (!bundle) return;
    const m = planMatch(picked.wishlist, bundle.context.candidates, skillById);
    setEdits((e) => {
      const pins = new Set(e.pins);
      const excluded = new Set(e.excluded);
      for (const id of m.lockedIds) { pins.add(id); excluded.delete(id); }
      return { ...e, pins, excluded };
    });
    setMatchSummary({ locked: m.lockedNames, matched: m.matched, notBuyable: m.notBuyable });
    setLoadedPlan({ id: picked.id, name: picked.name });
    markStale();
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
  const cycleLock = (id: string) => { setEdits((e) => cycleLockState(e, id, bundle?.context.candidates ?? [])); markStale(); };
  const setHint = (id: string, lvl: HintLevel) => { setEdits((e) => ({ ...e, hintEdits: new Map(e.hintEdits).set(id, lvl) })); markStale(); };
  const setFastLearner = (v: boolean) => { setEdits((e) => ({ ...e, fastLearner: v })); markStale(); };
  const setSp = (n: number) => { setBundle((b) => b ? { ...b, context: { ...b.context, spBudget: n } } : b); markStale(); };

  function saveCurrent() {
    if (!workingBundle) return;
    captures.save(label.trim() || 'Untitled capture', workingBundle);
    setLabel('');
  }

  if (status === 'loading') return <p className="muted">Loading…</p>;

  // Editable fields (cost, hint, pin) come from the LIVE merged candidates so a
  // controlled input never fights a stale analyzed snapshot; analysis-derived
  // fields (deltaL, lPerSp, baseSpCost) merge in from `result` by skillId when
  // present. mergedCandidates (not workingBundle) so excluded rows stay visible
  // in the table even though analysis drops them. Without a bundle, nothing to show.
  const analyzedById = new Map((result?.candidates ?? []).map((c) => [c.skillId, c]));
  const rows: CandidateRow[] = bundle
    ? mergedCandidates(bundle, edits, sparkRates).map((c, i) => {
        const a = analyzedById.get(c.skillId);
        // mergedCandidates is 1:1 in-order with the raw candidates, so index i
        // is the captured row — a working hint that differs from it means the
        // shown cost is a projection, not the captured screen truth.
        const captured = bundle.context.candidates[i];
        return {
          skillId: c.skillId,
          rarity: c.rarity,
          deltaL: a?.deltaL ?? 0,
          screenSpCost: c.screenSpCost,
          baseSpCost: a?.baseSpCost,
          lPerSp: a?.lPerSp ?? 0,
          hintLevel: c.hintLevel,
          hintEdited: (c.hintLevel ?? 0) !== (captured?.hintLevel ?? 0),
          prereqSkillId: c.prereqSkillId,
          pinned: edits.pins.has(c.skillId),
        };
      })
    : [];

  return (
    <div className="sp-page">
      <p className="sp-caveat small" role="note">
        Estimation, not a verdict (P3). The sim can't see positional chaos or opponent procs — treat a basket as a strong prior, then test in room matches.{' '}
        <HeaderHelp label="How this simulation works">
          <p><b>Δ L</b> — each skill is simulated in <b>200 solo races</b> on the CM course: your build with the skill vs. without it (owned skills as the base). Δ L is the average バ身 gained; baskets are then re-simulated as full builds.</p>
          <p><b>No opponents in the sim.</b> Debuffs and position-dependent skills (pace-chaser targets, surrounded, order conditions…) can't show their real value here — they read as ≈ 0. Their true worth needs a contested race, which this tool doesn't simulate yet.</p>
          <p><b>Noise floor.</b> Δ L is the difference of two 200-race averages, so values within about ±0.1 of zero are random wobble, not a real penalty — a small negative on a debuff or Wit passive means "no measurable effect", and it will shift between Re-analyzes.</p>
          <p><b>Costs.</b> An untouched row shows the exact captured screen cost. Stepping the hint (or Fast Learner) reprices from that screen cost's implied base; <span style={{ color: 'var(--danger, #c0392b)' }}>red</span> marks a projection that no longer matches your capture.</p>
          <p><b>Lock cycle.</b> Blank → 🔒 forced into every basket (a ◎/gold locks its base skill too) → ✕ removed from the analysis (anything needing it follows) → blank.</p>
        </HeaderHelp>
      </p>

      {status === 'fixture' && (
        <p className="error" role="alert">Running on placeholder data — results are illustrative.</p>
      )}

      <BuildSpCard
        context={workingBundle?.context ?? null}
        source={bundle?.source ?? 'manual'}
        onImportFile={(f) => void importFile(f)}
        onCarryFromM4={copyWishlist}
        carryDisabled={!plan || plan.wishlist.length === 0}
        onSpChange={setSp}
        fastLearner={edits.fastLearner}
        onFastLearnerChange={setFastLearner}
        loadPlan={
          /* Shared planner inventory as a dismiss-on-outside popover (M1.2
             pattern); picking a row prefills locks on the current build — it
             never replaces the capture or switches the app-wide active plan. */
          <span className="sp-loadplan-anchor" ref={invRef}>
            <button
              type="button"
              className="sp-loadplan-btn"
              aria-expanded={invOpen}
              disabled={!plan || !bundle}
              title={bundle ? 'Lock a plan’s wishlist skills in the table below' : 'Import or seed a build first'}
              onClick={() => setInvOpen((v) => !v)}
            >
              📋 {loadedPlan?.name ?? 'choose…'} ▾
            </button>
            {invOpen && plan && (
              <div className="sp-loadplan-pop">
                <PlanInventoryCard
                  activePlan={plan}
                  autoApplyTrack={false}
                  plans={savedPlans}
                  focused="uma1"
                  uma1PlanId={loadedPlan?.id}
                  hideSlotBadges
                  hideSettings
                  onAutoApplyTrackChange={() => {}}
                  onDeletePlan={deleteSavedPlan}
                  onDeleteAllPlans={deleteAllSavedPlans}
                  onImportPlans={importSavedPlans}
                  onLoadPlanIntoSlot={(id) => {
                    const picked = savedPlans.find((p) => p.id === id);
                    if (picked) overlayPlan(picked);
                    setInvOpen(false);
                  }}
                />
              </div>
            )}
          </span>
        }
        matchSummary={matchSummary}
      />
      {importError && <p className="error" role="alert">Import failed: {importError}</p>}

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
              excluded={edits.excluded}
              onCycleLock={cycleLock}
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
