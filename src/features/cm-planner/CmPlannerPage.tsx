/**
 * Module 4 - Skill Acquisition Planner, engine-first rebuild. The root route
 * keeps the planner sidebar beside the umalator-derived track and race setup.
 */
import { useEffect, useState } from 'react';
import './cm-planner.css';
import { makeDefaultPlan, useActivePlan } from '@/app/ActivePlanContext';
import { getSetting, setSetting } from '@/db';
import { generatePlanName } from '@/core/planName';
import { nextPlanNumberForContent } from '@/core/planIdentity';
import { distanceClass } from '@/core/simBuild';
import type { CmId, CmPlan } from '@/core/types';
import { useGameData } from '@/features/data/gameData';
import { PlannerSidebar } from './PlannerSidebar';
import { SkillChartPanel } from './SkillChartPanel';
import { UmaChartPanel } from './UmaChartPanel';
import { SelectedSkillProvider } from './useSelectedSkill';
import { RaceTrackView } from '@/features/planner/racetrack/RaceTrackView';
import { RaceSetup } from '@/features/planner/race-setup/RaceSetup';
import { PRESETS, type Ground, type Season, type Weather } from '@/features/planner/race-setup/presets';
import {
  courseToSelection,
  describeSelection,
  formatCourseLabel,
  presetToSelection,
  type RaceSelection,
} from '@/features/planner/race-setup/selection';
import { PlanInventoryCard } from './PlanInventoryCard';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';

const AUTO_APPLY_INVENTORY_TRACK_KEY = 'cmPlannerInventoryAutoApplyTrack';

function isGround(value: string | undefined): value is Ground {
  return value === 'firm' || value === 'good' || value === 'soft' || value === 'heavy';
}

function isSeason(value: string | undefined): value is Season {
  return value === 'spring' || value === 'summer' || value === 'fall' || value === 'winter';
}

function isWeather(value: string | undefined): value is Weather {
  return value === 'sunny' || value === 'cloudy' || value === 'rainy' || value === 'snowy';
}

export function CmPlannerPage() {
  const { status, umaById } = useGameData();
  const {
    plan,
    savedPlans,
    autoSave,
    isSaved,
    setAutoSave,
    setPlan,
    selectPlan,
    deleteSavedPlan,
    importSavedPlans,
    deleteAllSavedPlans,
    setDraftPlan,
    saveCurrentPlan,
    saveCurrentPlanAs,
    loadError,
  } = useActivePlan();
  const [selection, setSelection] = useState<RaceSelection>(() => presetToSelection(PRESETS[0]!));
  const [courseCatalog, setCourseCatalog] = useState<CourseCatalogEntry[]>([]);
  const [autoApplyInventoryTrack, setAutoApplyInventoryTrack] = useState<boolean | null>(null);
  const [collapseSkillSignal, setCollapseSkillSignal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void getSetting<boolean>(AUTO_APPLY_INVENTORY_TRACK_KEY)
      .then((saved) => {
        if (!cancelled) setAutoApplyInventoryTrack(saved ?? true);
      })
      .catch(() => {
        if (!cancelled) setAutoApplyInventoryTrack(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void import('@/sim/courseCatalog')
      .then(({ courseCatalog: loadCourseCatalog }) => loadCourseCatalog())
      .then((courses) => {
        if (!cancelled) setCourseCatalog(courses);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const applyPlanTrackSetup = (loadedPlan: CmPlan) => {
    const course = courseCatalog.find((entry) => entry.courseId === loadedPlan.cmRef.courseId);
    if (!course) return;
    const preset = PRESETS.find((entry) => entry.cmId === loadedPlan.cmRef.cmId);
    setSelection((current) => {
      const next = courseToSelection(course, {
        ground: isGround(loadedPlan.cmRef.condition) ? loadedPlan.cmRef.condition : preset?.ground ?? current.ground,
        weather: isWeather(loadedPlan.cmRef.weather) ? loadedPlan.cmRef.weather : preset?.weather ?? current.weather,
        season: isSeason(loadedPlan.cmRef.season) ? loadedPlan.cmRef.season : preset?.season ?? current.season,
      });
      if (
        preset &&
        preset.courseId === next.courseId &&
        preset.ground === next.ground &&
        preset.weather === next.weather &&
        preset.season === next.season
      ) {
        next.presetCmId = preset.cmId;
      }
      return next;
    });
  };

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
      ...(preset ? { cmId: preset.cmId as CmId, cmNumber: preset.cmNumber } : { cmId: 'CM0' as CmId, cmNumber: 0 }),
      courseId: next.courseId,
      surface: next.surface,
      distance: next.distance,
      condition: next.ground,
      weather: next.weather,
      season: next.season,
    };
    if (
      nextCmRef.cmId === plan.cmRef.cmId &&
      nextCmRef.cmNumber === plan.cmRef.cmNumber &&
      nextCmRef.courseId === plan.cmRef.courseId &&
      nextCmRef.surface === plan.cmRef.surface &&
      nextCmRef.distance === plan.cmRef.distance &&
      nextCmRef.condition === plan.cmRef.condition &&
      nextCmRef.weather === plan.cmRef.weather &&
      nextCmRef.season === plan.cmRef.season
    ) {
      return;
    }
    setPlan({ ...plan, cmRef: nextCmRef });
  };

  const racePreset = PRESETS.find((p) => p.cmId === selection.presetCmId);
  const trackTitle = racePreset
    ? racePreset.label
    : formatCourseLabel(selection);
  const raceNameLabel = racePreset ? undefined : formatCourseLabel(selection);
  const planWithFallbackName = (next: CmPlan): CmPlan => {
    if (next.name.trim()) return next;
    const umaName = umaById?.get(next.umaId)?.nameEn;
    return {
      ...next,
      name: generatePlanName(next, umaName, raceNameLabel),
    };
  };
  const newDefaultPlan = (): CmPlan => {
    const distanceKey = distanceClass(selection.distance);
    const baseline = makeDefaultPlan();
    const draft: CmPlan = {
      ...baseline,
      id: crypto.randomUUID(),
      name: '',
      notes: '',
      planNumber: 1,
      scenarioId: plan.scenarioId,
      cmRef: {
        ...plan.cmRef,
        ...(racePreset ? { cmId: racePreset.cmId as CmId, cmNumber: racePreset.cmNumber } : { cmId: 'CM0' as CmId, cmNumber: 0 }),
        courseId: selection.courseId,
        surface: selection.surface,
        distance: selection.distance,
        condition: selection.ground,
        weather: selection.weather,
        season: selection.season,
      },
      sparkGoals: {
        pink: [
          { aptKey: { kind: 'surface', key: 'turf' }, target: 'A' },
          { aptKey: { kind: 'distance', key: distanceKey }, target: 'S' },
          { aptKey: { kind: 'strategy', key: 'front' }, target: 'A' },
        ],
        blue: {},
      },
      patch: plan.patch,
      server: plan.server,
      dataVersion: plan.dataVersion,
    };
    const planNumber = nextPlanNumberForContent(draft, savedPlans);
    const numberedDraft = { ...draft, planNumber };
    return {
      ...numberedDraft,
      name: generatePlanName(numberedDraft, 'Kitasan Black', raceNameLabel),
    };
  };

  return (
    <SelectedSkillProvider>
      <div className="cmp-page">
        <PlanInventoryCard
          activePlan={plan}
          autoApplyTrack={autoApplyInventoryTrack ?? true}
          plans={savedPlans}
          onAutoApplyTrackChange={(enabled) => {
            setAutoApplyInventoryTrack(enabled);
            void setSetting(AUTO_APPLY_INVENTORY_TRACK_KEY, enabled);
          }}
          onDeletePlan={deleteSavedPlan}
          onDeleteAllPlans={deleteAllSavedPlans}
          onImportPlans={importSavedPlans}
          onSelectPlan={async (id) => {
            const loadedPlan = savedPlans.find((savedPlan) => savedPlan.id === id);
            await selectPlan(id);
            setCollapseSkillSignal((signal) => signal + 1);
            if (autoApplyInventoryTrack === true && loadedPlan) {
              applyPlanTrackSetup(loadedPlan);
            }
          }}
        />
        <PlannerSidebar
          plan={plan}
          autoSave={autoSave}
          isSaved={isSaved}
          onAutoSaveChange={setAutoSave}
          onChange={setPlan}
          onSave={(next) => saveCurrentPlan(planWithFallbackName(next))}
          onSaveAs={(next) => saveCurrentPlanAs(planWithFallbackName(next)).then(() => undefined)}
          onNew={() => setDraftPlan(newDefaultPlan())}
          raceNameLabel={raceNameLabel}
          collapseSkillSignal={collapseSkillSignal}
        />
        <div className="cmp-main">
          <section className="cmp-plan-card cmp-track-card">
            <header className="cmp-plan-card-head cmp-track-head">{trackTitle}</header>
            <div className="cmp-plan-card-body cmp-track-body">
              <RaceTrackView courseId={selection.courseId} />
              <div className="cmp-conditions" aria-label="Race conditions">
                {describeSelection(selection).map((chip) => (
                  <span key={chip} className="cmp-chip">
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </section>
          <RaceSetup selection={selection} onChange={handleRaceChange} />
          <UmaChartPanel
            courseId={selection.courseId}
            plan={plan}
            collapseSkillSignal={collapseSkillSignal}
            onSelectRunner={(umaId, uniqueSkillId) => setPlan({ ...plan, umaId, uniqueSkillId })}
          />
          <SkillChartPanel
            courseId={selection.courseId}
            plan={plan}
            collapseSkillSignal={collapseSkillSignal}
            onChange={setPlan}
          />
        </div>
      </div>
    </SelectedSkillProvider>
  );
}
