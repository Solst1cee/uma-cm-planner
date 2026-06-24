/**
 * Module 4 - Skill Acquisition Planner, engine-first rebuild. The root route
 * keeps the planner sidebar beside the umalator-derived track and race setup.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import './cm-planner.css';
import { makeDefaultPlan, useActivePlan } from '@/app/ActivePlanContext';
import { getSetting, setSetting } from '@/db';
import { copyPlanInto } from '@/core/cmPlanCopy';
import { generatePlanName } from '@/core/planName';
import { nextPlanNumberForContent } from '@/core/planIdentity';
import { distanceClass } from '@/core/simBuild';
import { cmRaceOptions } from '@/core/cmRace';
import type { CmPlan, CmRefV2 } from '@/core/types';
import { useGameData } from '@/features/data/gameData';
import { PlannerSidebar } from './PlannerSidebar';
import { SkillChartPanel } from './SkillChartPanel';
import { UmaChartPanel } from './UmaChartPanel';
import { SelectedSkillProvider } from './useSelectedSkill';
import { RaceTrackView } from '@/features/planner/racetrack/RaceTrackView';
import { MiniSimTab } from './MiniSimTab';
import { useRaceCompareController } from './useRaceCompareController';
import { RaceSetup } from '@/features/planner/race-setup/RaceSetup';
import {
  describeSelection,
  formatCourseLabel,
  type RaceSelection,
} from '@/features/planner/race-setup/selection';
import { cmRefForEntry, cmRefToSelection, selectionToCmRef } from '@/features/planner/race-setup/cmRefSelection';
import { WorkingTabs } from './WorkingTabs';
import { PlanInventoryCard } from './PlanInventoryCard';
import { StaminaCheckerTab } from './StaminaCheckerTab';
import { AccelCheckerTab } from './AccelCheckerTab';
import { trackChangeNeedsConfirm, tracksDiffer } from './trackChange';
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
    loadPlanIntoSlot,
    deleteSavedPlan,
    importSavedPlans,
    deleteAllSavedPlans,
    setDraftPlan,
    saveCurrentPlan,
    saveCurrentPlanAs,
    saveUma2Plan,
    saveUma2PlanAs,
    loadError,
  } = useActivePlan();
  const [courseCatalog, setCourseCatalog] = useState<CourseCatalogEntry[]>([]);
  const [autoApplyInventoryTrack, setAutoApplyInventoryTrack] = useState<boolean | null>(null);
  const autoApplyOn = autoApplyInventoryTrack ?? true;
  const [invCollapsed, setInvCollapsed] = useState<boolean>(false);
  const [collapseSkillSignal, setCollapseSkillSignal] = useState(0);
  const [trackOverrideRef, setTrackOverrideRef] = useState<CmRefV2 | null>(null);
  const [trackConfirmOpen, setTrackConfirmOpen] = useState(false);
  const [trackChanged, setTrackChanged] = useState(false);
  const trackChangedTimer = useRef<number | undefined>(undefined);
  const flashTrackChanged = () => {
    setTrackChanged(true);
    window.clearTimeout(trackChangedTimer.current);
    trackChangedTimer.current = window.setTimeout(() => setTrackChanged(false), 3000);
  };
  useEffect(() => () => window.clearTimeout(trackChangedTimer.current), []);

  const options = useMemo(() => cmRaceOptions(timeline ?? []), [timeline]);
  // Single source of truth: the race view is DERIVED from a cmRef (no local
  // selection state). When auto-apply is ON and a non-null focusedPlan is
  // available (guard: uma2-blank → always fall back to uma1), the track follows
  // the focused build; otherwise it always follows uma1 (plan.cmRef).
  // `trackOverrideRef` pins the displayed track during a pending confirm, masking
  // the auto-follow until the user confirms or cancels.
  const autoFollowRef = useMemo(() => {
    if (
      autoApplyOn &&
      !(focused === 'uma2' && uma2Plan === null) &&
      focusedPlan !== null
    ) {
      return focusedPlan.cmRef;
    }
    return plan?.cmRef ?? null;
  }, [autoApplyOn, focused, uma2Plan, focusedPlan, plan]);
  const trackCmRef = trackOverrideRef ?? autoFollowRef;
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

  // Race-sim comparison state (overlay on the track ← controls in the Mini-sim tab).
  // Called before the loading guards, so it tolerates a null plan/selection.
  const raceSim = useRaceCompareController(plan, uma2Plan, selection?.courseId ?? '');

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
    setTrackOverrideRef(null); // a manual race edit must show immediately, not stay masked
    const updated = selectionToCmRef(next, options);
    if (focused === 'uma2' && focusedPlan !== null) {
      setFocusedPlan({ ...focusedPlan, cmRef: updated });
    } else {
      setPlan({ ...plan, cmRef: updated });
    }
  };

  // Determines whether a flip or load should show the confirm bar or just apply.
  // Uses `autoApplyOn` (null → true) so that a pending settings load defaults to auto-apply ON.
  const applyTrackTransition = (nextFollowRef: CmRefV2 | null) => {
    const prev = trackCmRef;
    const autoApply = autoApplyOn;
    if (
      prev && nextFollowRef &&
      trackChangeNeedsConfirm({
        autoApply,
        hadPriorTrack: true,
        prevCourseId: prev.courseId,
        nextCourseId: nextFollowRef.courseId,
      })
    ) {
      setTrackOverrideRef(prev); // pin old so the track doesn't jump until confirmed
      setTrackConfirmOpen(true);
    } else {
      // No confirm needed (same course, auto-apply off, or first track): resume
      // auto-follow. A course change under auto-apply always takes the confirm
      // branch above, so the only "Track changed!" flash fires from Confirm.
      setTrackOverrideRef(null);
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
  const trackMismatchLabel =
    uma2Plan && plan && tracksDiffer(plan.cmRef, uma2Plan.cmRef)
      ? `⚠ Different track from uma${focused === 'uma1' ? '2' : '1'}`
      : undefined;
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
    // Confirm only when uma2 already holds a build (the blank-face duplicate has nothing to overwrite).
    if (uma2Plan && !window.confirm('Overwrite uma2 with a copy of uma1?')) return;
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
          focused={focused}
          uma1PlanId={plan.id}
          uma2PlanId={uma2Plan?.id}
          onLoadPlanIntoSlot={async (id, slot) => {
            const keepTrackRef = slot === 'uma1' && !autoApplyOn ? plan.cmRef : null;
            await loadPlanIntoSlot(id, slot);
            setCollapseSkillSignal((signal) => signal + 1);
            // auto-apply OFF: keep the race you're viewing by overriding the loaded
            // uma1 plan's cmRef (preserves the long-standing behavior).
            if (keepTrackRef) {
              const loaded = savedPlans.find((p) => p.id === id);
              if (loaded) setPlan({ ...loaded, cmRef: keepTrackRef });
            }
            if (slot === focused) {
              const loaded = savedPlans.find((p) => p.id === id);
              if (loaded) applyTrackTransition(loaded.cmRef);
            }
          }}
        />
        <PlannerSidebar
          plan={focusedPlan ?? plan}
          autoSave={autoSave}
          isSaved={isSaved}
          onAutoSaveChange={setAutoSave}
          onChange={setFocusedPlan}
          // Save / Save As route to the focused slot. uma2's variants persist to
          // inventory but never write activePlanId (it stays session-scratch).
          onSave={(next) =>
            focused === 'uma1'
              ? saveCurrentPlan(planWithFallbackName(next))
              : saveUma2Plan(planWithFallbackName(next))
          }
          onSaveAs={(next) =>
            focused === 'uma1'
              ? saveCurrentPlanAs(planWithFallbackName(next)).then(() => undefined)
              : saveUma2PlanAs(planWithFallbackName(next)).then(() => undefined)
          }
          onNew={() => { if (focused === 'uma1') setDraftPlan(newDefaultPlan()); else setUma2Plan(null); }}
          raceNameLabel={raceNameLabel}
          trackMismatchLabel={trackMismatchLabel}
          collapseSkillSignal={collapseSkillSignal}
          focused={focused}
          onFocusChange={(slot) => {
            if (slot === focused) return;
            setFocused(slot);
            const nextFocused = slot === 'uma1' ? plan : uma2Plan;
            applyTrackTransition(
              autoApplyOn && !(slot === 'uma2' && uma2Plan === null) && nextFocused
                ? nextFocused.cmRef
                : null,
            );
          }}
          uma2Empty={uma2Plan === null}
          onDuplicateUma1ToUma2={onDuplicateUma1ToUma2}
          onReplicateUma2ToUma1={onReplicateUma2ToUma1}
        />
        <div className="cmp-main">
          <section className="cmp-plan-card cmp-track-card">
            <header className="cmp-plan-card-head cmp-track-head">
              <span>{trackTitle}</span>
              {trackChanged && <span className="cmp-track-changed">Track changed!</span>}
              {trackConfirmOpen && (
                <span className="cmp-track-confirm" role="group" aria-label="Confirm track change">
                  <span className="cmp-track-confirm-text">Change track to the loaded plan?</span>
                  <button
                    type="button"
                    className="cmp-track-confirm-cancel"
                    onClick={() => setTrackConfirmOpen(false)}
                  >
                    Keep current track
                  </button>
                  <button
                    type="button"
                    className="cmp-track-confirm-ok"
                    onClick={() => { setTrackOverrideRef(null); setTrackConfirmOpen(false); flashTrackChanged(); }}
                  >
                    Change track
                  </button>
                </span>
              )}
            </header>
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
          <WorkingTabs
            initial="unique"
            tabs={[
              {
                key: 'unique',
                label: 'Unique',
                node: (
                  <UmaChartPanel
                    courseId={selection.courseId}
                    plan={focusedPlan ?? plan}
                    collapseSkillSignal={collapseSkillSignal}
                    onSelectRunner={(umaId, uniqueSkillId) =>
                      setFocusedPlan({ ...(focusedPlan ?? plan), umaId, uniqueSkillId })
                    }
                  />
                ),
              },
              {
                key: 'stamina',
                label: 'Stamina',
                node: <StaminaCheckerTab plan={focusedPlan ?? plan} />,
              },
              {
                key: 'accel',
                label: 'Accel',
                node: <AccelCheckerTab plan={focusedPlan ?? plan} />,
              },
              {
                key: 'skills',
                label: 'Skills',
                node: (
                  <SkillChartPanel
                    courseId={selection.courseId}
                    plan={focusedPlan ?? plan}
                    collapseSkillSignal={collapseSkillSignal}
                    onChange={setFocusedPlan}
                  />
                ),
              },
              {
                key: 'minisim',
                label: 'Mini-sim',
                node: <MiniSimTab ctl={raceSim} />,
              },
            ]}
          />
        </div>
      </div>
    </SelectedSkillProvider>
  );
}
