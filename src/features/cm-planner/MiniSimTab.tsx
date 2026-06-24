/** Mini-sim tab — race-sim comparison controls (Show HP, representative-run toggle,
 *  status readout, and the mean-バ身 headline). When uma2Empty, shows a prompt to
 *  load or duplicate a uma2 build into the uma2 slot. The overlay it drives is
 *  rendered on the §0 racetrack (main column) via useRaceCompareController. */
import './race-compare.css';
import { RunChoiceToggle } from './skill-trace/SkillTraceCharts';
import type { RaceCompareController } from './useRaceCompareController';

export function MiniSimTab({ ctl }: { ctl: RaceCompareController }) {
  const { showHp, setShowHp, state, comparing, uma2Empty } = ctl;
  return (
    <div className="cmp-minisim-tab">
      {uma2Empty ? (
        <p className="muted small cmp-minisim-empty">
          Load or duplicate a uma2 into the uma2 slot to compare builds head-to-head on the track.
        </p>
      ) : (
        <>
          {comparing && state.status === 'done' && state.meanBashin != null && (
            <div className="cmp-rc-headline cmp-minisim-headline">
              {state.meanBashin >= 0 ? '+' : ''}
              {state.meanBashin.toFixed(2)} バ身
            </div>
          )}
          <label className="cmp-rc-hp">
            <input type="checkbox" checked={showHp} onChange={(e) => setShowHp(e.target.checked)} /> Show HP
          </label>
          {comparing && state.run && (
            <div className="cmp-rc-field">
              <span>Representative run</span>
              <RunChoiceToggle value={state.runChoice} onChange={state.setRunChoice} />
            </div>
          )}
          {comparing && state.status === 'running' && <span className="muted small">Simulating…</span>}
          {comparing && state.status === 'na' && <span className="muted small">Not simulatable here.</span>}
          {comparing && (
            <p className="cmp-rc-caveat muted small">
              Representative vacuum run — same model as umalator&apos;s main view; gap is an estimate.
            </p>
          )}
        </>
      )}
    </div>
  );
}
