/**
 * Module 4 - Skill Acquisition Planner, engine-first rebuild. The root route
 * keeps the planner sidebar beside the umalator-derived track and race setup.
 */
import { useEffect, useMemo, useState } from 'react';
import './cm-planner.css';
import { makeDefaultPlan, useActivePlan } from '@/app/ActivePlanContext';
import { getSetting, setSetting } from '@/db';
import { copyPlanInto } from '@/core/cmPlanCopy';
import { generatePlanName } from '@/core/planName';
import { nextPlanNumberForContent } from '@/core/planIdentity';
import { distanceClass } from '@/core/simBuild';
import { cmRaceOptions } from '@/core/cmRace';
import type { CmPlan } from '@/core/types';
import { useGameData } from '@/features/data/gameData';
import { PlannerSidebar } from './PlannerSidebar';
import { SkillChartPanel } from './SkillChartPanel';
import { UmaChartPanel } from './UmaChartPanel';
import { SelectedSkillProvider } from './useSelectedSkill';
import { RaceTrackView } from '@/features/planner/racetrack/RaceTrackView';
import { RaceSimCard } from './RaceSimCard';
import { useRaceCompareController } from './useRaceCompareController';
import { RaceSetup } from '@/features/planner/race-setup/RaceSetup';
import {
  describeSelection,
  formatCourseLabel,
  type RaceSelection,
} from '@/features/planner/race-setup/selection';
import { cmRefForEntry, cmRefToSelection, selectionToCmRef } from '@/features/planner/race-setup/cmRefSelection';
import { PlanInventoryCard } from './PlanInventoryCard';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';

const AUTO_APPLY_INVENTORY_TRACK_KEY = 'cmPlannerInventoryAutoApplyTrack';
const INVENTORY_COLLAPSED_KEY = 'cmPlannerInventoryCollapsed';

export function CmPlannerPage() {
  const { status, umaById, skillById, timeline, currentCm } = useGameData();
  const {
    plan,
    uma2Plan,
    focused,
    setFocused,
    focusedPlan,
    setFocusedPlan,
    savedPlans,
    autoSave,
    isSaved,
    setAutoSave,
    setPlan,
    setUma2Plan,
    selectPlan,
    deleteSavedPlan,
    importSavedPlans,
    deleteAllSavedPlans,
    setDraftPlan,
    saveCurrentPlan,
    saveCurrentPlanAs,
    loadError,
  } = useActivePlan();
  const [courseCatalog, setCourseCatalog] = useState<CourseCatalogEntry[]>([]);
  const [autoApplyInventoryTrack, setAutoApplyInventoryTrack] = useState<boolean | null>(null);
  const [invCollapsed, setInvCollapsed] = useState<boolean>(false);
  const [collapseSkillSignal, setCollapseSkillSignal] = useState(0);

  const options = useMemo(() => cmRaceOptions(timeline ?? []), [timeline]);
  // Single source of truth: the race view is DERIVED from a cmRef (no local
  // selection state). When auto-apply is ON and a non-null focusedPlan is
  // available (guard: uma2-blank → always fall back to uma1), the track follows
  // the focused build; otherwise it always follows uma1 (plan.cmRef).
  const trackCmRef = useMemo(() => {
    if (
      autoApplyInventoryTrack === true &&
      !(focused === 'uma2' && uma2Plan === null) &&
      focusedPlan !== null
    ) {
      return focusedPlan.cmRef;
    }
    return plan?.cmRef ?? null;
  }, [autoApplyInventoryTrack, focused, uma2Plan, focusedPlan, plan]);
  const selection: RaceSelection | null = useMemo(
    () => (trackCmRef ? cmRefToSelection(trackCmRef, courseCatalog, timeline ?? []) : null),
    [trackCmRef, courseCatalog, timeline],
  );

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
    void getSetting<boolean>(INVENTORY_COLLAPSED_KEY)
      .then((saved) => {
        if (!cancelled) setInvCollapsed(saved ?? false);
      })
      .catch(() => {
        if (!cancelled) setInvCollapsed(false);
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

  // Race-sim comparison state (overlay on the track ← controls in the right sidebar).
  // Called before the loading guards, so it tolerates a null plan/selection.
  const raceSim = useRaceCompareController(plan, savedPlans, selection?.courseId ?? '');

  if (loadError) {
    return (
      <p className="error" role="alert">
        Failed to load plan: {loadError}
      </p>
    );
  }
  if (status === 'loading' || plan === null || selection === null) {
    return <p className="muted">Loading...</p>;
  }

  // Editing the race writes back into the focused build's cmRef (single source of
  // truth). When uma2 is focused + non-null, edits apply to uma2Plan via
  // setFocusedPlan; otherwise they go to uma1 (plan) via setPlan.
  const handleRaceChange = (next: RaceSelection) => {
    const updated = selectionToCmRef(next, options);
    if (focused === 'uma2' && focusedPlan !== null) {
      setFocusedPlan({ ...focusedPlan, cmRef: updated });
    } else {
      setPlan({ ...plan, cmRef: updated });
    }
  };

  // The race title/name: CM plans show "CM<n>[ — Name]"; custom shows the course.
  // titleCmRef follows the focused build (same as the track selection) so the card
  // header stays consistent with what's drawn on the track.
  const cmRef = plan.cmRef;
  const titleCmRef = trackCmRef ?? plan.cmRef;
  const cmOption = titleCmRef.kind === 'cm' ? options.find((o) => o.cmNumber === titleCmRef.cmNumber) : undefined;
  const trackTitle =
    titleCmRef.kind === 'cm'
      ? cmOption
        ? `CM${cmOption.cmNumber} — ${cmOption.name}`
        : `CM${titleCmRef.cmNumber}`
      : formatCourseLabel(selection);
  const raceNameLabel = cmRef.kind === 'cm' ? undefined : formatCourseLabel(selection);
  const planWithFallbackName = (next: CmPlan): CmPlan => {
    if (next.name.trim()) return next;
    const umaName = umaById?.get(next.umaId)?.nameEn;
    return {
      ...next,
      name: generatePlanName(next, umaName, raceNameLabel),
    };
  };
  const newDefaultPlan = (): CmPlan => {
    const baseline = makeDefaultPlan();
    // Default a new plan to the CURRENT CM (fall back to the race you're viewing
    // until the timeline/catalog have loaded).
    const cmRef = cmRefForEntry(currentCm, courseCatalog) ?? plan.cmRef;
    const distanceKey = distanceClass(cmRef.distance);
    const draft: CmPlan = {
      ...baseline,
      id: crypto.randomUUID(),
      name: '',
      notes: '',
      planNumber: 1,
      scenarioId: plan.scenarioId,
      cmRef,
      sparkGoals: {
        pink: [
          { aptKey: { kind: 'surface', key: cmRef.surface }, target: 'A' },
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

  const onDuplicateUma1ToUma2 = () => {
    const draft = copyPlanInto(plan);
    draft.name = generatePlanName(draft, umaById?.get(draft.umaId)?.nameEn, raceNameLabel);
    setUma2Plan(draft);
    setFocused('uma2');
  };

  const onReplicateUma2ToUma1 = () => {
    if (!uma2Plan) return;
    if (!window.confirm("Overwrite uma1 with uma2's build?")) return;
    const draft = copyPlanInto(uma2Plan, { keepName: false });
    draft.name = generatePlanName(draft, umaById?.get(draft.umaId)?.nameEn, raceNameLabel);
    setPlan({ ...draft, id: plan.id, planNumber: plan.planNumber });
  };

  return (
    <SelectedSkillProvider>
      <div className="cmp-page" data-inv-collapsed={String(invCollapsed)}>
        <PlanInventoryCard
          activePlan={plan}
          autoApplyTrack={autoApplyInventoryTrack ?? true}
          plans={savedPlans}
          collapsed={invCollapsed}
          onCollapsedChange={(v) => {
            setInvCollapsed(v);
            void setSetting(INVENTORY_COLLAPSED_KEY, v);
          }}
          onAutoApplyTrackChange={(enabled) => {
            setAutoApplyInventoryTrack(enabled);
            void setSetting(AUTO_APPLY_INVENTORY_TRACK_KEY, enabled);
          }}
          onDeletePlan={deleteSavedPlan}
          onDeleteAllPlans={deleteAllSavedPlans}
          onImportPlans={importSavedPlans}
          onSelectPlan={async (id) => {
            // Auto-apply ON: load the plan as-is (its cmRef re-derives the track).
            // OFF: load the build but keep the race you're currently viewing.
            const currentCmRef = plan.cmRef;
            const loadedPlan = savedPlans.find((savedPlan) => savedPlan.id === id);
            await selectPlan(id);
            setCollapseSkillSignal((signal) => signal + 1);
            if (autoApplyInventoryTrack !== true && loadedPlan) {
              setPlan({ ...loadedPlan, cmRef: currentCmRef });
            }
          }}
        />
        <PlannerSidebar
          plan={focusedPlan ?? plan}
          autoSave={autoSave}
          isSaved={isSaved}
          onAutoSaveChange={setAutoSave}
          onChange={setFocusedPlan}
          // uma2 save/new are intentional no-ops here — uma2 autosaves via its own
          // debounce path (which correctly skips ACTIVE_PLAN_KEY). Proper uma2
          // copy/save actions land in Task 6.
          onSave={(next) =>
            focused === 'uma1' ? saveCurrentPlan(planWithFallbackName(next)) : Promise.resolve()
          }
          onSaveAs={(next) =>
            focused === 'uma1'
              ? saveCurrentPlanAs(planWithFallbackName(next)).then(() => undefined)
              : Promise.resolve()
          }
          onNew={() => { if (focused === 'uma1') setDraftPlan(newDefaultPlan()); }}
          raceNameLabel={raceNameLabel}
          collapseSkillSignal={collapseSkillSignal}
          focused={focused}
          onFocusChange={setFocused}
          uma2Empty={uma2Plan === null}
          onDuplicateUma1ToUma2={onDuplicateUma1ToUma2}
          onReplicateUma2ToUma1={onReplicateUma2ToUma1}
        />
        <div className="cmp-main">
          <section className="cmp-plan-card cmp-track-card">
            <header className="cmp-plan-card-head cmp-track-head">{trackTitle}</header>
            <div className="cmp-plan-card-body cmp-track-body">
              <RaceTrackView
                courseId={selection.courseId}
                trace={raceSim.comparing ? raceSim.state.run ?? undefined : undefined}
                traceDistance={raceSim.state.distance}
                showHp={raceSim.showHp}
                skillName={(id) => skillById?.get(id)?.nameEn ?? id}
              />
              <div className="cmp-conditions" aria-label="Race conditions">
                {describeSelection(selection).map((chip) => (
                  <span key={chip} className="cmp-chip">
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          </section>
          <RaceSetup options={options} selection={selection} onChange={handleRaceChange} />
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
          <RaceSimCard ctl={raceSim} />
        </div>
      </div>
    </SelectedSkillProvider>
  );
}
