/** Right-sidebar "Race sim" card — all race-sim comparison settings (uma2 picker, Show HP,
 *  representative-run toggle) + the mean-バ身 readout. Presentational: the shared state comes
 *  from useRaceCompareController; the overlay it drives is rendered on the track (main column). */
import './race-compare.css';
import { RunChoiceToggle } from './skill-trace/SkillTraceCharts';
import type { RaceCompareController } from './useRaceCompareController';

export function RaceSimCard({ ctl }: { ctl: RaceCompareController }) {
  const { uma2Id, setUma2Id, showHp, setShowHp, others, state, comparing } = ctl;
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
        <label className="cmp-rc-field">
          <span>Compare against</span>
          <select
            aria-label="Compare against"
            value={uma2Id}
            onChange={(e) => setUma2Id(e.target.value)}
            disabled={others.length === 0}
          >
            <option value="">{others.length ? '— none (course only) —' : '— save another plan to compare —'}</option>
            {others.map((p) => (
              <option key={p.id} value={p.id}>{p.name || p.id}</option>
            ))}
          </select>
        </label>

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
