/** M4 — the §0 track card IS the umalator main view. uma1 = the active plan; pick uma2
 *  (a saved plan) right on the track and the velocity/HP + activation markers + バ身-gap
 *  overlay renders on the track itself (no separate card). With no uma2 picked it shows the
 *  plain course. Honest: a single representative vacuum run, gap is an estimate (P3). */
import './race-compare.css';
import { useState } from 'react';
import type { CmPlan } from '@/core/types';
import { planToOverlayBuild } from '@/core/simBuild';
import { resolveUma2, type Uma2Source } from './resolveUma2';
import { useRaceCompare, type RaceCompareCtx, type RaceCompareState } from './useRaceCompare';
import { RaceTrackView } from '@/features/planner/racetrack/RaceTrackView';
import { RunChoiceToggle } from './skill-trace/SkillTraceCharts';

export interface TrackComparePanelDeps {
  useRaceCompare?: (ctx: RaceCompareCtx | undefined, enabled: boolean) => RaceCompareState;
}

export function TrackComparePanel({
  plan, savedPlans, courseId, trackTitle, conditionChips, skillName, deps,
}: {
  plan: CmPlan;
  savedPlans: CmPlan[];
  courseId: string;
  trackTitle: string;
  conditionChips: string[];
  skillName: (id: string) => string;
  deps?: TrackComparePanelDeps;
}) {
  const [showHp, setShowHp] = useState(true);
  const [uma2Id, setUma2Id] = useState('');

  const others = savedPlans.filter((p) => p.id !== plan.id);
  const source: Uma2Source | null = uma2Id ? { kind: 'savedPlan', planId: uma2Id } : null;
  const uma2 = source ? resolveUma2(source, plan, savedPlans) : null;
  const ctx: RaceCompareCtx | undefined = uma2
    ? { uma1: planToOverlayBuild(plan), uma2, race: { courseId } }
    : undefined;
  const useHook = deps?.useRaceCompare ?? useRaceCompare;
  const state = useHook(ctx, !!ctx);
  const comparing = !!ctx;

  return (
    <section className="cmp-plan-card cmp-track-card">
      <header className="cmp-plan-card-head cmp-track-head">
        <span className="cmp-track-title">{trackTitle}</span>
        {comparing && state.status === 'done' && state.meanBashin != null && (
          <span className="cmp-rc-headline">
            {state.meanBashin >= 0 ? '+' : ''}
            {state.meanBashin.toFixed(2)} バ身
          </span>
        )}
      </header>
      <div className="cmp-plan-card-body cmp-track-body">
        <div className="cmp-rc-controls">
          <label>
            Compare against:{' '}
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
              <input type="checkbox" checked={showHp} onChange={(e) => setShowHp(e.target.checked)} /> HP
            </label>
          )}
          {comparing && state.run && <RunChoiceToggle value={state.runChoice} onChange={state.setRunChoice} />}
          {comparing && state.status === 'running' && <span className="muted small">Simulating…</span>}
          {comparing && state.status === 'na' && <span className="muted small">Not simulatable here.</span>}
        </div>
        <RaceTrackView
          courseId={courseId}
          trace={comparing ? state.run ?? undefined : undefined}
          traceDistance={state.distance}
          showHp={showHp}
          skillName={skillName}
        />
        <div className="cmp-conditions" aria-label="Race conditions">
          {conditionChips.map((chip) => (
            <span key={chip} className="cmp-chip">{chip}</span>
          ))}
        </div>
        {comparing && (
          <p className="cmp-rc-caveat muted small">
            Representative vacuum run — same model as umalator&apos;s main view; gap is an estimate.
          </p>
        )}
      </div>
    </section>
  );
}
