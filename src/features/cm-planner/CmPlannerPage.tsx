/**
 * Module 4 — Skill Acquisition Planner, engine-first REBUILD. This is the new
 * main page we grow the full app from (the old `skill-acq/SkillAcquisitionPage`
 * is kept at /legacy as reference, unedited).
 *
 * Slice scope: the §0 race-setup bar (CM15 is the only preset for now) + the
 * always-on track diagram. Track/time/ground/weather/season customization and
 * the §1/§2/§3 sections land in later parts.
 */
import './cm-planner.css';
import { useActivePlan } from '@/app/ActivePlanContext';
import { useGameData } from '@/features/data/gameData';
import { SelectedSkillProvider } from './useSelectedSkill';
import { TrackDiagramPanel } from './TrackDiagramPanel';

export function CmPlannerPage() {
  const { status } = useGameData();
  const { plan, loadError } = useActivePlan();

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
    <SelectedSkillProvider>
      <div className="page cmp-page">
        <section className="panel cmp-setup" aria-labelledby="setup-h">
          <h2 id="setup-h">Race setup</h2>
          <div className="cmp-setupbar">
            <label className="cmp-field">
              <span className="cmp-field-label">Preset</span>
              <select aria-label="CM preset" value="cm15" onChange={() => {}}>
                <option value="cm15">CM15 — Cancer Cup</option>
              </select>
            </label>
            <div className="cmp-field">
              <span className="cmp-field-label">Track</span>
              <span className="cmp-field-value">
                {cmRef.distance}m · {cmRef.surface}
              </span>
            </div>
          </div>
          <p className="muted small">
            CM15 is the only preset for now — track / time of day / ground / weather / season
            customization comes next.
          </p>
        </section>

        <TrackDiagramPanel plan={plan} />
      </div>
    </SelectedSkillProvider>
  );
}
