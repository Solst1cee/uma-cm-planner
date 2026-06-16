/**
 * Module 4 — Skill Acquisition Planner, engine-first REBUILD. New main page at /
 * (the old skill-acq/SkillAcquisitionPage is kept at /legacy as reference).
 *
 * Layout: the §0 race-track diagram on top, the race-setup chooser (preset ⇄
 * custom) below it. The chooser owns the race selection; the track renders the
 * selected course. The §1/§2/§3 sections (skill/uma charts, wishlist, sourcing)
 * land in later slices.
 */
import './cm-planner.css';
import { useState } from 'react';
import { RaceTrackView } from '@/features/planner/racetrack/RaceTrackView';
import { RaceSetup } from '@/features/planner/race-setup/RaceSetup';
import { PRESETS } from '@/features/planner/race-setup/presets';
import { presetToSelection, type RaceSelection } from '@/features/planner/race-setup/selection';
import { SelectedSkillProvider } from './useSelectedSkill';

export function CmPlannerPage() {
  const [selection, setSelection] = useState<RaceSelection>(() => presetToSelection(PRESETS[0]!));

  return (
    <SelectedSkillProvider>
      <div className="page cmp-page">
        <RaceTrackView courseId={selection.courseId} />
        <RaceSetup onChange={setSelection} />
      </div>
    </SelectedSkillProvider>
  );
}
