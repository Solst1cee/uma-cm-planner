/**
 * Module 4 page (slice 1): a 2-column VFalator-style shell. The left rail
 * carries the plan header + runner config (sticky); the right column carries
 * the §0 race summary, the engine-driven skill chart, and the sourcing panel.
 * Replaces the old coverage-matrix SkillPlannerPage at the root route.
 */
import './skill-acq.css';
import { useActivePlan } from '@/app/ActivePlanContext';
import { useGameData } from '@/features/data/gameData';
import { PlanHeaderPanel } from '@/features/skill-planner/PlanHeaderPanel';
import { RunnerConfigPanel } from '@/features/skill-acq/RunnerConfigPanel';
import { SkillChartPanel } from '@/features/skill-acq/SkillChartPanel';
import { SourcingPanel } from '@/features/skill-acq/SourcingPanel';

export function SkillAcquisitionPage() {
  const { status } = useGameData();
  const { plan, setPlan, loadError } = useActivePlan();

  if (loadError) {
    return (
      <p className="error" role="alert">
        Failed to load plan: {loadError}
      </p>
    );
  }
  if (status === 'loading' || plan === null) {
    return <p className="muted">Loading…</p>;
  }

  const { cmRef } = plan;

  return (
    <div className="page m4-grid">
      <aside className="m4-left">
        <PlanHeaderPanel plan={plan} onChange={setPlan} />
        <RunnerConfigPanel plan={plan} onChange={setPlan} />
      </aside>
      <div className="m4-right">
        <section className="panel" aria-labelledby="race-h">
          <h2 id="race-h">Race</h2>
          <p>
            CM{cmRef.cmNumber} · course {cmRef.courseId}
          </p>
          <p>
            {cmRef.surface} · {cmRef.distance}m
          </p>
          {cmRef.condition && <p>Condition: {cmRef.condition}</p>}
          {cmRef.season && <p>Season: {cmRef.season}</p>}
        </section>
        <SkillChartPanel plan={plan} onChange={setPlan} />
        <SourcingPanel plan={plan} />
      </div>
    </div>
  );
}
