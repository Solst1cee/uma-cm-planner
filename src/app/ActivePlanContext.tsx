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
import { getPlan, getSetting, listPlans, savePlan, setSetting } from '@/db';
import { useGameData } from '@/features/data/gameData';

const ACTIVE_PLAN_KEY = 'activePlanId';
const SAVE_DEBOUNCE_MS = 400;

export function makeDefaultPlan(presets: CmPreset[]): CmPlan {
  // Code-point sort (not localeCompare) — deterministic on ISO dates.
  const sorted = [...presets].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  // P4: default to the latest CM that actually ran on Global; JP-history
  // presets are preview-only. Fall back to the latest overall (e.g. fixture
  // data or a dataset that predates the server tag).
  const latest = sorted.filter((p) => p.server === 'global').at(-1) ?? sorted.at(-1);
  return {
    id: crypto.randomUUID(),
    name: latest ? latest.name : 'New CM Plan',
    month: latest ? latest.date.slice(0, 7) : new Date().toISOString().slice(0, 7),
    // id 4 = Trackblazer, the latest Global scenario (provenance §3.1);
    // isDefault marks "following the app-level latest-scenario default".
    scenario: { id: 4, isDefault: true },
    race: latest
      ? {
          courseId: latest.courseId,
          surface: latest.surface,
          distance: latest.distance,
          season: latest.season,
          condition: latest.ground,
        }
      : { courseId: '', surface: 'turf', distance: 1600 },
    requiredAptitudes: [],
    targetSkills: [],
    lockedDeckSlots: [],
    chosenParents: [undefined, undefined],
  };
}

interface ActivePlanValue {
  plan: CmPlan | null;
  /** Replace the active plan; persisted (debounced) on every call. */
  setPlan: (next: CmPlan) => void;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const saveTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (status === 'loading') return;
    let cancelled = false;
    (async () => {
      const savedId = await getSetting<string>(ACTIVE_PLAN_KEY);
      let loaded = savedId ? await getPlan(savedId) : undefined;
      if (!loaded) {
        const all = await listPlans();
        loaded = all.at(-1);
      }
      if (!loaded) {
        const fresh = makeDefaultPlan(cmPresets);
        if (cancelled) return; // StrictMode remount guard: don't double-create
        await savePlan(fresh);
        loaded = fresh;
      }
      if (cancelled) return;
      await setSetting(ACTIVE_PLAN_KEY, loaded.id);
      if (!cancelled) setPlanState(loaded);
    })().catch((err: unknown) => {
      if (!cancelled) setLoadError(err instanceof Error ? err.message : String(err));
    });
    return () => {
      cancelled = true;
    };
  }, [status, cmPresets]);

  // The edit not yet persisted (null = Dexie is up to date). Single source
  // for every flush path: explicit flush, pagehide, unmount.
  const pendingSave = useRef<CmPlan | null>(null);

  const setPlan = useCallback((next: CmPlan) => {
    setPlanState(next);
    pendingSave.current = next;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      pendingSave.current = null;
      savePlan(next).catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : String(err));
      });
    }, SAVE_DEBOUNCE_MS);
  }, []);

  const flushPendingSave = useCallback(async () => {
    window.clearTimeout(saveTimer.current);
    const toSave = pendingSave.current;
    pendingSave.current = null;
    if (toSave) await savePlan(toSave);
  }, []);

  // Flush on pagehide (tab close / mobile background-kill — plan §6 says
  // "mid-run on phone") and on unmount (quick navigation). Dexie's put is
  // async but normally completes from pagehide.
  useEffect(() => {
    const flushSync = () => {
      window.clearTimeout(saveTimer.current);
      const toSave = pendingSave.current;
      pendingSave.current = null;
      if (toSave) void savePlan(toSave).catch(() => undefined);
    };
    window.addEventListener('pagehide', flushSync);
    return () => {
      window.removeEventListener('pagehide', flushSync);
      flushSync(); // unmount flush
    };
  }, []);

  return (
    <ActivePlanContext.Provider value={{ plan, setPlan, flushPendingSave, loadError }}>
      {children}
    </ActivePlanContext.Provider>
  );
}

export function useActivePlan(): ActivePlanValue {
  const ctx = useContext(ActivePlanContext);
  if (!ctx) throw new Error('useActivePlan must be used inside <ActivePlanProvider>');
  return ctx;
}
