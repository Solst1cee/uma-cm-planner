/** Right-sidebar "Race sim" card — all race-sim comparison settings (uma2 picker, Show HP,
 *  representative-run toggle) + the mean-バ身 readout. Presentational: the shared state comes
 *  from useRaceCompareController; the overlay it drives is rendered on the track (main column). */
import './race-compare.css';
import { useEffect, useRef, useState } from 'react';
import { RunChoiceToggle } from './skill-trace/SkillTraceCharts';
import { Uma2PickerPopover } from './Uma2PickerPopover';
import { Uma2Card } from './Uma2Card';
import type { RaceCompareController } from './useRaceCompareController';

export function RaceSimCard({ ctl }: { ctl: RaceCompareController }) {
  const { uma2Id, setUma2Id, showHp, setShowHp, others, state, comparing } = ctl;
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickRef = useRef<HTMLDivElement>(null);
  const uma2Plan = uma2Id ? others.find((p) => p.id === uma2Id) : undefined;

  // Close the popover on click-outside / Esc (the page stays interactive — no modal backdrop).
  useEffect(() => {
    if (!pickerOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!pickRef.current?.contains(e.target as Node)) setPickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPickerOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);
  return (
    <section className="cmp-plan-card cmp-racesim-card" aria-labelledby="cmp-racesim-h">
      <header className="cmp-plan-card-head">
        <span id="cmp-racesim-h">Race sim</span>
        {comparing && state.status === 'done' && state.meanBashin != null && (
          <span className="cmp-rc-headline">
            {state.meanBashin >= 0 ? '+' : ''}
            {state.meanBashin.toFixed(2)} バ身
          </span>
        )}
      </header>
      <div className="cmp-plan-card-body cmp-racesim-body">
        <div className="cmp-rc-field">
          <span>Compare against</span>
          <div className="cmp-rc-pick" ref={pickRef}>
            <div className="cmp-rc-pick-head">
              <span className="cmp-rc-pick-label">
                {others.length === 0
                  ? 'Save another plan to compare'
                  : uma2Plan
                    ? 'Comparing against'
                    : 'None (course only)'}
              </span>
              <button
                type="button"
                className="cmp-inventory-icon-btn cmp-rc-pick-trigger"
                aria-label="Compare against"
                aria-haspopup="dialog"
                aria-expanded={pickerOpen}
                disabled={others.length === 0}
                onClick={() => setPickerOpen((o) => !o)}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path d="M3 3h6v6H3V3Zm8 0h6v6h-6V3ZM3 11h6v6H3v-6Zm8 0h6v6h-6v-6Z" />
                </svg>
              </button>
            </div>
            {uma2Plan && <Uma2Card plan={uma2Plan} />}
            {pickerOpen && (
              <Uma2PickerPopover
                plans={others}
                selectedId={uma2Id}
                onSelect={(id) => { setUma2Id(id); setPickerOpen(false); }}
              />
            )}
          </div>
        </div>

        {comparing && (
          <label className="cmp-rc-hp">
            <input type="checkbox" checked={showHp} onChange={(e) => setShowHp(e.target.checked)} /> Show HP
          </label>
        )}
        {comparing && state.run && (
          <div className="cmp-rc-field">
            <span>Representative run</span>
            <RunChoiceToggle value={state.runChoice} onChange={state.setRunChoice} />
          </div>
        )}
        {comparing && state.status === 'running' && <span className="muted small">Simulating…</span>}
        {comparing && state.status === 'na' && <span className="muted small">Not simulatable here.</span>}
        {!comparing && (
          <p className="muted small">Pick a saved plan to overlay a head-to-head sim on the track.</p>
        )}
        {comparing && (
          <p className="cmp-rc-caveat muted small">
            Representative vacuum run — same model as umalator&apos;s main view; gap is an estimate.
          </p>
        )}
      </div>
    </section>
  );
}
