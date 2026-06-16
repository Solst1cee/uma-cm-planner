/**
 * Module 4 - Skill Acquisition Planner, engine-first rebuild. The root route
 * keeps the planner sidebar beside the umalator-derived track and race setup.
 */
import { useState } from 'react';
import './cm-planner.css';
import { useActivePlan } from '@/app/ActivePlanContext';
import type { CmId } from '@/core/types';
import { useGameData } from '@/features/data/gameData';
import { PlannerSidebar } from './PlannerSidebar';
import { UmaChartPanel } from './UmaChartPanel';
import { SelectedSkillProvider } from './useSelectedSkill';
import { RaceTrackView } from '@/features/planner/racetrack/RaceTrackView';
import { RaceSetup } from '@/features/planner/race-setup/RaceSetup';
import { PRESETS } from '@/features/planner/race-setup/presets';
import { presetToSelection, type RaceSelection } from '@/features/planner/race-setup/selection';

export function CmPlannerPage() {
  const { status } = useGameData();
  const { plan, setPlan, flushPendingSave, loadError } = useActivePlan();
  const [selection, setSelection] = useState<RaceSelection>(() => presetToSelection(PRESETS[0]!));

  if (loadError) {
    return (
      <p className="error" role="alert">
        Failed to load plan: {loadError}
      </p>
    );
  }
  if (status === 'loading' || plan === null) {
    return <p className="muted">Loading...</p>;
  }

  const handleRaceChange = (next: RaceSelection) => {
    setSelection(next);
    const preset = PRESETS.find((p) => p.cmId === next.presetCmId);
    const nextCmRef = {
      ...plan.cmRef,
      ...(preset ? { cmId: preset.cmId as CmId, cmNumber: preset.cmNumber } : {}),
      courseId: next.courseId,
      surface: next.surface,
      distance: next.distance,
    };
    if (
      nextCmRef.cmId === plan.cmRef.cmId &&
      nextCmRef.cmNumber === plan.cmRef.cmNumber &&
      nextCmRef.courseId === plan.cmRef.courseId &&
      nextCmRef.surface === plan.cmRef.surface &&
      nextCmRef.distance === plan.cmRef.distance
    ) {
      return;
    }
    setPlan({ ...plan, cmRef: nextCmRef });
  };

  return (
    <SelectedSkillProvider>
      <div className="cmp-page">
        <PlannerSidebar plan={plan} onChange={setPlan} onSave={flushPendingSave} />
        <div className="cmp-main">
          <RaceTrackView courseId={selection.courseId} />
          <RaceSetup onChange={handleRaceChange} />
          <UmaChartPanel
            courseId={selection.courseId}
            plan={plan}
            onSelectRunner={(umaId, uniqueSkillId) => setPlan({ ...plan, umaId, uniqueSkillId })}
          />
        </div>
      </div>
    </SelectedSkillProvider>
  );
}
