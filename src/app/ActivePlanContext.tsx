/**
 * Cross-module single source of truth (plan §10): loads the active CmPlan
 * from Dexie, creates a default one (named after the latest CM preset,
 * scenario = latest Global scenario) when none exists, and persists every
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
import type { CmPlan, CmPreset } from '@/core/types';
import { isPlanContentSaved, nextPlanNumberForContent } from '@/core/planIdentity';
import { uniquePlanName } from '@/core/planName';
import { deletePlan, getPlan, getSetting, listPlans, savePlan, setSetting } from '@/db';
import { useGameData } from '@/features/data/gameData';

const ACTIVE_PLAN_KEY = 'activePlanId';
const AUTO_SAVE_KEY = 'cmPlannerAutoSave';
const SAVE_DEBOUNCE_MS = 400;

const DATA_VERSION = '2026-06-15'; // TODO: source from a generated constant when available

function cmNumberFromName(name: string): number {
  const m = name.match(/CM\s*0*(\d+)/i);
  return m ? Number(m[1]) : 0;
}

export function makeDefaultPlan(presets: CmPreset[]): CmPlan {
  const sorted = [...presets].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  // P4: default to the latest CM that actually ran on Global; JP-history
  // presets are preview-only. Fall back to the latest overall (e.g. fixture
  // data or a dataset that predates the server tag).
  const latest = sorted.filter((p) => p.server === 'global').at(-1) ?? sorted.at(-1);
  const cmNumber = latest ? cmNumberFromName(latest.name) : 0;
  return {
    id: crypto.randomUUID(),
    name: '',
    planNumber: 1,
    cmRef: latest
      ? {
          cmId: `CM${cmNumber}`,
          cmNumber,
          courseId: latest.courseId,
          surface: latest.surface,
          distance: latest.distance,
          condition: latest.ground,
          weather: latest.weather,
          season: latest.season,
        }
      : { cmId: 'CM0', cmNumber: 0, courseId: '', surface: 'turf', distance: 1600 },
    scenarioId: 4,
    umaId: '',
    uniqueSkillId: '',
    role: 'ace',
    strategy: 'pace',
    // §5.2 auto-seed (cm_stat_targets) is deferred; start from a plausible
    // mid-game build so the §1 skill chart can sim immediately (the engine can't
    // race a 0-speed runner). Fully user-editable in the Runner panel.
    statProfile: { stats: { spd: 1000, sta: 600, pow: 600, gut: 400, wit: 400 }, mood: 2 },
    sparkGoals: { pink: [], blue: {} },
    wishlist: [],
    lockedDeckSlots: [],
    parents: {},
    patch: { version: DATA_VERSION },
    server: 'global',
    dataVersion: DATA_VERSION,
  };
}

interface ActivePlanValue {
  plan: CmPlan | null;
  savedPlans: CmPlan[];
  autoSave: boolean;
  isSaved: boolean;
  setAutoSave: (enabled: boolean) => void;
  /** Replace the active plan; persisted (debounced) on every call. */
  setPlan: (next: CmPlan) => void;
  /** Load a saved plan, make it active, and persist that active-plan choice. */
  selectPlan: (id: string) => Promise<void>;
  /** Delete a saved plan and refresh the inventory. */
  deleteSavedPlan: (id: string) => Promise<void>;
  /** Create a new draft as the active plan without immediately saving it. */
  setDraftPlan: (next: CmPlan) => void;
  /** Persist the active plan over its current id. */
  saveCurrentPlan: (next?: CmPlan) => Promise<void>;
  /** Persist the active plan as a new version with the next available plan number. */
  saveCurrentPlanAs: (next?: CmPlan) => Promise<CmPlan>;
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
  const { status, cmPresets } = useGameData();
  const [plan, setPlanState] = useState<CmPlan | null>(null);
  const [savedPlans, setSavedPlans] = useState<CmPlan[]>([]);
  const [autoSave, setAutoSaveState] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);
  const pendingSave = useRef<CmPlan | null>(null);
  const planRef = useRef<CmPlan | null>(null);
  const autoSaveRef = useRef(false);

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
      if (!loaded) {
        const fresh = makeDefaultPlan(cmPresets);
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
  }, [status, cmPresets]);

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
    const refreshedPlans = await listPlans();
    setSavedPlans(refreshedPlans);

    if (planRef.current?.id !== id) return;

    const next = refreshedPlans.at(-1) ?? makeDefaultPlan(cmPresets);
    await setSetting(ACTIVE_PLAN_KEY, next.id);
    pendingSave.current = null;
    planRef.current = next;
    setPlanState(next);
  }, [cmPresets]);

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
  }, []);

  // Flush on pagehide (tab close / mobile background-kill — plan §6 says
  // "mid-run on phone") and on unmount (quick navigation). Dexie's put is
  // async but normally completes from pagehide.
  useEffect(() => {
    const flushSync = () => {
      window.clearTimeout(saveTimer.current);
      const toSave = pendingSave.current;
      pendingSave.current = null;
      if (toSave && autoSaveRef.current) void savePlan(toSave).catch(() => undefined);
    };
    window.addEventListener('pagehide', flushSync);
    return () => {
      window.removeEventListener('pagehide', flushSync);
      flushSync(); // unmount flush
    };
  }, []);

  const isSaved = plan ? isPlanContentSaved(plan, savedPlans) : true;

  return (
    <ActivePlanContext.Provider
      value={{
        plan,
        savedPlans,
        autoSave,
        isSaved,
        setAutoSave,
        setPlan,
        selectPlan,
        deleteSavedPlan,
        setDraftPlan,
        saveCurrentPlan,
        saveCurrentPlanAs,
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
