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
  const latest = [...presets].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
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

  const setPlan = useCallback((next: CmPlan) => {
    setPlanState(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      savePlan(next).catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : String(err));
      });
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Flush a pending save on unmount so a quick navigation never loses edits.
  const latest = useRef<CmPlan | null>(null);
  latest.current = plan;
  useEffect(
    () => () => {
      window.clearTimeout(saveTimer.current);
      if (latest.current) void savePlan(latest.current).catch(() => undefined);
    },
    [],
  );

  return (
    <ActivePlanContext.Provider value={{ plan, setPlan, loadError }}>
      {children}
    </ActivePlanContext.Provider>
  );
}

export function useActivePlan(): ActivePlanValue {
  const ctx = useContext(ActivePlanContext);
  if (!ctx) throw new Error('useActivePlan must be used inside <ActivePlanProvider>');
  return ctx;
}
