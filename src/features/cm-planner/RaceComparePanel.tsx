/** M4 — two-build race-sim comparison panel (umalator main view). uma1 = active plan;
 *  uma2 = a chosen saved plan (pluggable via resolveUma2). Auto-runs runRaceCompare and
 *  overlays velocity/HP + activation markers + バ身-gap on the §0 track. Honest: a single
 *  representative vacuum run, gap is an estimate (P3). */
import './race-compare.css';
import { useEffect, useRef, useState } from 'react';
import type { CmPlan } from '@/core/types';
import { planToOverlayBuild } from '@/core/simBuild';
import { resolveUma2, type Uma2Source } from './resolveUma2';
import { useRaceCompare, type RaceCompareCtx, type RaceCompareState } from './useRaceCompare';
import { RaceTrackView } from '@/features/planner/racetrack/RaceTrackView';
import { RunChoiceToggle } from './skill-trace/SkillTraceCharts';

export interface RaceComparePanelDeps {
  useRaceCompare?: (ctx: RaceCompareCtx | undefined, enabled: boolean) => RaceCompareState;
}

export function RaceComparePanel({ plan, savedPlans, courseId, collapseSkillSignal, skillName, deps }: {
  plan: CmPlan; savedPlans: CmPlan[]; courseId: string; collapseSkillSignal: number;
  skillName: (id: string) => string; deps?: RaceComparePanelDeps;
}) {
  const [open, setOpen] = useState(true);
  const [showHp, setShowHp] = useState(true);
  const [uma2Id, setUma2Id] = useState<string>('');

  // Collapse on a SUBSEQUENT collapseSkillSignal change (plan loaded → comparison is stale),
  // skipping the initial render.
  const firstSignal = useRef(true);
  useEffect(() => {
    if (firstSignal.current) { firstSignal.current = false; return; }
    setOpen(false);
  }, [collapseSkillSignal]);

  const options = savedPlans.filter((p) => p.id !== plan.id);
  const source: Uma2Source | null = uma2Id ? { kind: 'savedPlan', planId: uma2Id } : null;
  const uma2 = source ? resolveUma2(source, plan, savedPlans) : null;
  const ctx: RaceCompareCtx | undefined = uma2
    ? { uma1: planToOverlayBuild(plan), uma2, race: { courseId } }
    : undefined;

  const useHook = deps?.useRaceCompare ?? useRaceCompare;
  const state = useHook(ctx, open && !!ctx);

  return (
    <section className="cmp-plan-card cmp-race-compare">
      <header className="cmp-plan-card-head cmp-collapse-head" data-open={open} onClick={() => setOpen((o) => !o)}>
        <span className="cmp-collapse-caret" aria-hidden>▸</span>
        Race comparison
        {state.meanBashin != null && state.status === 'done' && (
          <span className="cmp-rc-headline">{state.meanBashin >= 0 ? '+' : ''}{state.meanBashin.toFixed(2)} バ身</span>
        )}
      </header>
      {open && (
        <div className="cmp-plan-card-body">
          <div className="cmp-rc-controls" onClick={(e) => e.stopPropagation()}>
            <label>
              Compare against:{' '}
              <select value={uma2Id} onChange={(e) => setUma2Id(e.target.value)}>
                <option value="">— pick a saved plan —</option>
                {options.map((p) => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
              </select>
            </label>
            <label><input type="checkbox" checked={showHp} onChange={(e) => setShowHp(e.target.checked)} /> HP</label>
            {state.run && <RunChoiceToggle value={state.runChoice} onChange={state.setRunChoice} />}
          </div>
          {!ctx && <p className="muted small">Pick a second plan to compare two builds head-to-head.</p>}
          {ctx && state.status === 'running' && <p className="muted small">Simulating…</p>}
          {ctx && state.status === 'na' && <p className="muted small">Not simulatable on this track.</p>}
          {ctx && (
            <RaceTrackView
              courseId={courseId}
              trace={state.run ?? undefined}
              traceDistance={state.distance}
              showHp={showHp}
              skillName={skillName}
            />
          )}
          <p className="cmp-rc-caveat muted small">
            Representative vacuum run — same model as umalator&apos;s main view; gap is an estimate.
          </p>
        </div>
      )}
    </section>
  );
}
