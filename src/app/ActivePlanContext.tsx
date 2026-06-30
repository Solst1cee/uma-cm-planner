/**
 * Cross-module single source of truth (plan §10): loads the active CmPlan
 * from Dexie, creates the planner's Kitasan baseline when none exists, and persists every
 * mutation with a short debounce.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { CmId, CmPlan, CmRefV2, TimelineEntry } from '@/core/types';
import { copyPlanInto } from '@/core/cmPlanCopy';
import { isPlanContentSaved, nextPlanNumberForContent } from '@/core/planIdentity';
import { generatePlanName, uniquePlanName } from '@/core/planName';
import { deletePlan, getPlan, getSetting, listPlans, savePlan, setSetting } from '@/db';
import { shouldDuplicateForSlot } from '@/features/cm-planner/slotLoad';
import { useGameData } from '@/features/data/gameData';
import { cmRefForEntry } from '@/features/planner/race-setup/cmRefSelection';

const ACTIVE_PLAN_KEY = 'activePlanId';
const AUTO_SAVE_KEY = 'cmPlannerAutoSave';
const SAVE_DEBOUNCE_MS = 400;

const DATA_VERSION = '2026-06-15'; // TODO: source from a generated constant when available

export function makeDefaultPlan(cmRefOverride?: CmRefV2): CmPlan {
  // First-run / post-delete default. `cmRefOverride` (the current CM, resolved by
  // the provider/page) is used when available; the CM15 Cancer fallback applies
  // before the timeline/catalog have loaded. Conditions derive from the timeline.
  const draft: CmPlan = {
    id: crypto.randomUUID(),
    name: '',
    planNumber: 1,
    cmRef: cmRefOverride ?? { kind: 'cm', cmId: 'CM15' as CmId, cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
    scenarioId: 4,
    umaId: '106801',
    uniqueSkillId: '',
    uniqueSkillLevel: 5,
    role: 'ace',
    strategy: 'front',
    // §5.2 auto-seed (cm_stat_targets) is deferred; start from a plausible
    // mid-game build so the §1 skill chart can sim immediately (the engine can't
    // race a 0-speed runner). Fully user-editable in the Runner panel.
    statProfile: { stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 }, mood: 2 },
    sparkGoals: {
      pink: [
        { aptKey: { kind: 'surface', key: 'turf' }, target: 'A' },
        { aptKey: { kind: 'distance', key: 'medium' }, target: 'S' },
        { aptKey: { kind: 'strategy', key: 'front' }, target: 'A' },
      ],
      blue: {},
    },
    wishlist: [],
    parents: {},
    patch: { version: DATA_VERSION },
    server: 'global',
    dataVersion: DATA_VERSION,
  };
  return { ...draft, name: generatePlanName(draft, 'Kitasan Black') };
}

function isLegacyStarterPlan(plan: CmPlan): boolean {
  const stats = plan.statProfile.stats;
  return (
    plan.name === '' &&
    plan.planNumber === 1 &&
    plan.umaId === '' &&
    plan.uniqueSkillId === '' &&
    plan.role === 'ace' &&
    plan.strategy === 'pace' &&
    stats.spd === 1000 &&
    stats.sta === 600 &&
    stats.pow === 600 &&
    stats.gut === 400 &&
    stats.wit === 400 &&
    plan.sparkGoals.pink.length === 0 &&
    Object.keys(plan.sparkGoals.blue).length === 0 &&
    plan.wishlist.length === 0 &&
    Object.keys(plan.parents).length === 0
  );
}

interface ActivePlanValue {
  /** @deprecated Use `uma1Plan` instead. Kept as alias so existing consumers compile. */
  plan: CmPlan | null;
  /** Primary build (blue). Persisted + restored across page loads. Never null once loaded. */
  uma1Plan: CmPlan | null;
  /** Comparison build (red). Session-scratch: starts null on every page load, never restores. */
  uma2Plan: CmPlan | null;
  /** Which slot is currently focused. Defaults to 'uma1'. */
  focused: 'uma1' | 'uma2';
  setFocused: (slot: 'uma1' | 'uma2') => void;
  /** uma1Plan when focused==='uma1', else uma2Plan. */
  focusedPlan: CmPlan | null;
  /** Routes to the focused slot's setter. */
  setFocusedPlan: (next: CmPlan) => void;
  /**
   * Set the uma2 (comparison) slot. Autosaves + autonames when non-null.
   * Never writes activePlanId. Pass null to clear the slot.
   */
  setUma2Plan: (next: CmPlan | null) => void;
  savedPlans: CmPlan[];
  autoSave: boolean;
  isSaved: boolean;
  setAutoSave: (enabled: boolean) => void;
  /** Replace the active plan; persisted (debounced) on every call. */
  setPlan: (next: CmPlan) => void;
  /** Load a saved plan, make it active, and persist that active-plan choice. */
  selectPlan: (id: string) => Promise<void>;
  /** Load a saved plan into a specific slot. Duplicates the plan when it is already
   *  loaded in the opposite slot so the two slots never share an id. */
  loadPlanIntoSlot: (id: string, slot: 'uma1' | 'uma2') => Promise<CmPlan>;
  /** Delete a saved plan and refresh the inventory. */
  deleteSavedPlan: (id: string) => Promise<void>;
  /** Add validated plan files without overwriting existing ids. */
  importSavedPlans: (plans: CmPlan[]) => Promise<number>;
  /** Delete every saved plan and leave a fresh unsaved draft active. */
  deleteAllSavedPlans: () => Promise<void>;
  /** Create a new draft as the active plan without immediately saving it. */
  setDraftPlan: (next: CmPlan) => void;
  /** Persist the active plan over its current id. */
  saveCurrentPlan: (next?: CmPlan) => Promise<void>;
  /** Persist the active plan as a new version with the next available plan number. */
  saveCurrentPlanAs: (next?: CmPlan) => Promise<CmPlan>;
  /** Persist the uma2 (comparison) plan over its current id — never writes activePlanId. */
  saveUma2Plan: (next?: CmPlan) => Promise<void>;
  /** Persist the uma2 plan as a new version (new id) and make it the uma2 slot — never writes activePlanId. */
  saveUma2PlanAs: (next?: CmPlan) => Promise<CmPlan>;
  /**
   * Persist any edit still sitting in the save debounce, immediately.
   * Await before reading Dexie directly (export) or replacing it (import) —
   * otherwise the snapshot can be up to SAVE_DEBOUNCE_MS stale.
   */
  flushPendingSave: () => Promise<void>;
  loadError: string | null;
}

const ActivePlanContext = createContext<ActivePlanValue | null>(null);

export function ActivePlanProvider({ children }: { children: ReactNode }) {
  const { status, currentCm } = useGameData();
  const [plan, setPlanState] = useState<CmPlan | null>(null);
  const [savedPlans, setSavedPlans] = useState<CmPlan[]>([]);
  const [autoSave, setAutoSaveState] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const pendingSave = useRef<CmPlan | null>(null);
  const planRef = useRef<CmPlan | null>(null);
  const autoSaveRef = useRef(false);

  // uma2: session-scratch comparison slot (never restored from settings on load)
  const [uma2Plan, setUma2PlanState] = useState<CmPlan | null>(null);
  const saveTimer2 = useRef<number | undefined>(undefined);
  const pendingSave2 = useRef<CmPlan | null>(null);

  // focused slot selector
  const [focused, setFocused] = useState<'uma1' | 'uma2'>('uma1');

  // Latest current CM (from the timeline) for the async default-creation paths.
  const currentCmRef = useRef<TimelineEntry | null>(null);
  currentCmRef.current = currentCm ?? null;
  // Resolve the current CM's cmRef (geometry from the course catalog, loaded on
  // demand). Returns undefined until they're available → makeDefaultPlan falls back.
  const resolveDefaultCmRef = useCallback(async (): Promise<CmRefV2 | undefined> => {
    const entry = currentCmRef.current;
    // No track-known current CM → keep the CM15 fallback, and skip the (heavy)
    // catalog load entirely. Geometry needs the catalog; conditions derive later.
    if (!entry?.cm?.courseId || entry.cm.cmNumber === undefined) return undefined;
    const catalog = await import('@/sim/courseCatalog').then((m) => m.courseCatalog()).catch(() => []);
    return cmRefForEntry(entry, catalog) ?? undefined;
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    let cancelled = false;
    (async () => {
      const savedId = await getSetting<string>(ACTIVE_PLAN_KEY);
      const savedAutoSave = await getSetting<boolean>(AUTO_SAVE_KEY);
      const allPlans = await listPlans();
      let loaded = savedId ? await getPlan(savedId) : undefined;
      if (!loaded) {
        loaded = allPlans.at(-1);
      }
      if (loaded && allPlans.length === 1 && isLegacyStarterPlan(loaded)) {
        await deletePlan(loaded.id);
        loaded = makeDefaultPlan(await resolveDefaultCmRef());
        await savePlan(loaded);
      }
      if (!loaded) {
        const fresh = makeDefaultPlan(await resolveDefaultCmRef());
        if (cancelled) return; // StrictMode remount guard: don't double-create
        await savePlan(fresh);
        loaded = fresh;
      }
      if (cancelled) return;
      await setSetting(ACTIVE_PLAN_KEY, loaded.id);
      if (!cancelled) {
        const refreshedPlans = await listPlans();
        setSavedPlans(refreshedPlans);
        setAutoSaveState(savedAutoSave === true);
        autoSaveRef.current = savedAutoSave === true;
        planRef.current = loaded;
        setPlanState(loaded);
      }
    })().catch((err: unknown) => {
      if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
    });
    return () => {
      cancelled = true;
    };
  }, [status, resolveDefaultCmRef]);

  const setPlan = useCallback((next: CmPlan) => {
    setPlanState(next);
    planRef.current = next;
    pendingSave.current = next;
    window.clearTimeout(saveTimer.current);
    if (!autoSaveRef.current) return;
    saveTimer.current = window.setTimeout(() => {
      pendingSave.current = null;
      savePlan(next).then(async () => {
        await setSetting(ACTIVE_PLAN_KEY, next.id);
        setSavedPlans(await listPlans());
      }).catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : String(err));
      });
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const saveCurrentPlan = useCallback(async (nextPlan?: CmPlan) => {
    window.clearTimeout(saveTimer.current);
    const toSave = nextPlan ?? pendingSave.current ?? planRef.current;
    pendingSave.current = null;
    if (!toSave) return;
    const refreshedBeforeSave = await listPlans();
    const namedPlan = {
      ...toSave,
      name: uniquePlanName(toSave.name, refreshedBeforeSave, toSave.id),
    };
    await savePlan(namedPlan);
    await setSetting(ACTIVE_PLAN_KEY, toSave.id);
    const refreshedPlans = await listPlans();
    setSavedPlans(refreshedPlans);
    planRef.current = namedPlan;
    setPlanState(namedPlan);
  }, []);

  const flushPendingSave = saveCurrentPlan;

  const saveCurrentPlanAs = useCallback(async (nextPlan?: CmPlan) => {
    window.clearTimeout(saveTimer.current);
    const draft = nextPlan ?? pendingSave.current ?? planRef.current;
    pendingSave.current = null;
    if (!draft) throw new Error('No active plan to save');

    const refreshedBeforeSave = await listPlans();
    const nextPlanNumber = nextPlanNumberForContent(draft, refreshedBeforeSave);
    const next: CmPlan = {
      ...draft,
      id: crypto.randomUUID(),
      name: uniquePlanName(draft.name, refreshedBeforeSave),
      planNumber: nextPlanNumber,
    };

    await savePlan(next);
    await setSetting(ACTIVE_PLAN_KEY, next.id);
    const refreshedPlans = await listPlans();
    setSavedPlans(refreshedPlans);
    planRef.current = next;
    setPlanState(next);
    return next;
  }, []);

  const selectPlan = useCallback(async (id: string) => {
    window.clearTimeout(saveTimer.current);
    const toSave = pendingSave.current;
    pendingSave.current = null;
    if (toSave && autoSaveRef.current) await savePlan(toSave);

    const next = await getPlan(id);
    if (!next) throw new Error(`Saved plan ${id} could not be found`);
    await setSetting(ACTIVE_PLAN_KEY, next.id);
    setSavedPlans(await listPlans());
    planRef.current = next;
    setPlanState(next);
  }, []);

  const deleteSavedPlan = useCallback(async (id: string) => {
    if (pendingSave.current?.id === id) {
      window.clearTimeout(saveTimer.current);
      pendingSave.current = null;
    }
    await deletePlan(id);
    setSavedPlans(await listPlans());
    // Never mutate the loaded slots. If the deleted record was a loaded plan's
    // source, it drops out of the saved set and `isSaved` derives to false.
  }, []);

  const importSavedPlans = useCallback(async (incomingPlans: CmPlan[]) => {
    const existing = await listPlans();
    const merged = [...existing];
    for (const incoming of incomingPlans) {
      const idCollision = merged.some((plan) => plan.id === incoming.id);
      const withIdentity = idCollision
        ? {
            ...incoming,
            id: crypto.randomUUID(),
            planNumber: nextPlanNumberForContent(incoming, merged),
          }
        : incoming;
      const next = {
        ...withIdentity,
        name: uniquePlanName(withIdentity.name, merged),
      };
      await savePlan(next);
      merged.push(next);
    }
    setSavedPlans(await listPlans());
    return incomingPlans.length;
  }, []);

  const deleteAllSavedPlans = useCallback(async () => {
    window.clearTimeout(saveTimer.current);
    pendingSave.current = null;
    const existing = await listPlans();
    await Promise.all(existing.map((savedPlan) => deletePlan(savedPlan.id)));
    const next = makeDefaultPlan(await resolveDefaultCmRef());
    await setSetting(ACTIVE_PLAN_KEY, next.id);
    setSavedPlans([]);
    planRef.current = next;
    setPlanState(next);
  }, [resolveDefaultCmRef]);

  const setDraftPlan = useCallback((next: CmPlan) => {
    window.clearTimeout(saveTimer.current);
    pendingSave.current = next;
    planRef.current = next;
    setPlanState(next);
  }, []);

  const setAutoSave = useCallback((enabled: boolean) => {
    autoSaveRef.current = enabled;
    setAutoSaveState(enabled);
    void setSetting(AUTO_SAVE_KEY, enabled).catch(() => undefined);
    if (enabled && pendingSave.current) {
      const toSave = pendingSave.current;
      window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        pendingSave.current = null;
        savePlan(toSave).then(async () => {
          await setSetting(ACTIVE_PLAN_KEY, toSave.id);
          setSavedPlans(await listPlans());
        }).catch((err: unknown) => {
          setLoadError(err instanceof Error ? err.message : String(err));
        });
      }, SAVE_DEBOUNCE_MS);
    } else {
      window.clearTimeout(saveTimer.current);
    }
    // uma2 mirrors uma1: flush its pending edit on enable, cancel on disable. Never writes activePlanId.
    if (enabled && pendingSave2.current) {
      const toSave2 = pendingSave2.current;
      window.clearTimeout(saveTimer2.current);
      saveTimer2.current = window.setTimeout(() => {
        pendingSave2.current = null;
        savePlan(toSave2).then(async () => {
          setSavedPlans(await listPlans());
        }).catch((err: unknown) => {
          setLoadError(err instanceof Error ? err.message : String(err));
        });
      }, SAVE_DEBOUNCE_MS);
    } else if (!enabled) {
      window.clearTimeout(saveTimer2.current);
    }
  }, []);

  // Flush on pagehide (tab close / mobile background-kill — plan §6 says
  // "mid-run on phone") and on unmount (quick navigation). Dexie's put is
  // async but normally completes from pagehide.
  useEffect(() => {
    const flushSync = () => {
      // uma1 flush
      window.clearTimeout(saveTimer.current);
      const toSave = pendingSave.current;
      pendingSave.current = null;
      if (toSave && autoSaveRef.current) void savePlan(toSave).catch(() => undefined);
      // uma2 flush (never writes ACTIVE_PLAN_KEY; gated on auto-save like uma1)
      window.clearTimeout(saveTimer2.current);
      const toSave2 = pendingSave2.current;
      pendingSave2.current = null;
      if (toSave2 && autoSaveRef.current) void savePlan(toSave2).catch(() => undefined);
    };
    window.addEventListener('pagehide', flushSync);
    return () => {
      window.removeEventListener('pagehide', flushSync);
      flushSync(); // unmount flush
    };
  }, []);

  const setUma2Plan = useCallback((next: CmPlan | null) => {
    if (next === null) {
      window.clearTimeout(saveTimer2.current);
      pendingSave2.current = null;
      setUma2PlanState(null);
      return;
    }
    // Ensure a name before saving (umaName unknown here — generatePlanName falls back gracefully)
    const named: CmPlan = next.name.trim()
      ? next
      : { ...next, name: generatePlanName(next, undefined) };
    setUma2PlanState(named);
    pendingSave2.current = named;
    window.clearTimeout(saveTimer2.current);
    // Mirror uma1: only auto-persist when auto-save is on (one toggle governs both builds).
    if (!autoSaveRef.current) return;
    saveTimer2.current = window.setTimeout(() => {
      pendingSave2.current = null;
      savePlan(named).then(async () => {
        // Never write ACTIVE_PLAN_KEY for uma2
        setSavedPlans(await listPlans());
      }).catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : String(err));
      });
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // uma2 manual Save / Save As — mirror uma1's saveCurrentPlan/saveCurrentPlanAs for the
  // comparison slot: persist to inventory, refresh, update the slot. They NEVER write
  // ACTIVE_PLAN_KEY (uma2 stays session-scratch — cleared on reload).
  const saveUma2Plan = useCallback(async (nextPlan?: CmPlan) => {
    window.clearTimeout(saveTimer2.current);
    const toSave = nextPlan ?? pendingSave2.current ?? uma2Plan;
    pendingSave2.current = null;
    if (!toSave) return;
    const refreshedBeforeSave = await listPlans();
    const named = { ...toSave, name: uniquePlanName(toSave.name, refreshedBeforeSave, toSave.id) };
    await savePlan(named);
    setSavedPlans(await listPlans());
    setUma2PlanState(named);
  }, [uma2Plan]);

  const saveUma2PlanAs = useCallback(async (nextPlan?: CmPlan) => {
    window.clearTimeout(saveTimer2.current);
    const draft = nextPlan ?? pendingSave2.current ?? uma2Plan;
    pendingSave2.current = null;
    if (!draft) throw new Error('No uma2 plan to save');
    const refreshedBeforeSave = await listPlans();
    const next: CmPlan = {
      ...draft,
      id: crypto.randomUUID(),
      name: uniquePlanName(draft.name, refreshedBeforeSave),
      planNumber: nextPlanNumberForContent(draft, refreshedBeforeSave),
    };
    await savePlan(next);
    setSavedPlans(await listPlans());
    setUma2PlanState(next);
    return next;
  }, [uma2Plan]);

  const loadPlanIntoSlot = useCallback(async (id: string, slot: 'uma1' | 'uma2'): Promise<CmPlan> => {
    const source = await getPlan(id);
    if (!source) throw new Error(`Saved plan ${id} could not be found`);
    const collides = shouldDuplicateForSlot(id, slot, planRef.current?.id, uma2Plan?.id);

    if (slot === 'uma2') {
      // Duplicate-on-collision is handled by copyPlanInto (fresh id). setUma2Plan
      // autonames + autosaves the scratch slot either way.
      const next = collides ? copyPlanInto(source) : source;
      setUma2Plan(next);
      return next;
    }
    // slot === 'uma1'
    if (collides) {
      // Fresh-id duplicate loaded as an unsaved draft (it is not yet in the saved set).
      const draft = copyPlanInto(source);
      const next = { ...draft, name: generatePlanName(draft, undefined) };
      setDraftPlan(next);
      return next;
    }
    await selectPlan(id);
    return source;
  }, [selectPlan, setDraftPlan, setUma2Plan, uma2Plan]);

  const focusedPlan = focused === 'uma1' ? plan : uma2Plan;

  const setFocusedPlan = useCallback((next: CmPlan) => {
    if (focused === 'uma1') {
      setPlan(next);
    } else {
      setUma2Plan(next);
    }
  }, [focused, setPlan, setUma2Plan]);

  const isSaved = focusedPlan ? isPlanContentSaved(focusedPlan, savedPlans) : true;

  return (
    <ActivePlanContext.Provider
      value={{
        plan,
        uma1Plan: plan,
        uma2Plan,
        focused,
        setFocused,
        focusedPlan,
        setFocusedPlan,
        setUma2Plan,
        savedPlans,
        autoSave,
        isSaved,
        setAutoSave,
        setPlan,
        selectPlan,
        loadPlanIntoSlot,
        deleteSavedPlan,
        importSavedPlans,
        deleteAllSavedPlans,
        setDraftPlan,
        saveCurrentPlan,
        saveCurrentPlanAs,
        saveUma2Plan,
        saveUma2PlanAs,
        flushPendingSave,
        loadError,
      }}
    >
      {children}
    </ActivePlanContext.Provider>
  );
}

export function useActivePlan(): ActivePlanValue {
  const ctx = useContext(ActivePlanContext);
  if (!ctx) throw new Error('useActivePlan must be used inside <ActivePlanProvider>');
  return ctx;
}
