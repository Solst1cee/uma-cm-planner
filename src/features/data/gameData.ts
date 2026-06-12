/**
 * Runtime game-data loader: fetches the four baked datasets from
 * `public/data/` and exposes them via React context. If any fetch fails
 * (e.g. pipeline output not built yet), falls back to FIXTURE_* data and
 * flags `status: 'fixture'` so the shell can show a visible banner (P3 —
 * never silently present synthetic numbers as real).
 *
 * No JSX here on purpose — keeps the loader a plain .ts module.
 */
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CmPreset, SkillRecord, SparkRates, SupportCardRecord } from '@/core/types';
import {
  FIXTURE_CARDS,
  FIXTURE_PLAN,
  FIXTURE_SKILLS,
  FIXTURE_SPARK_RATES,
} from '@/core/fixtures';

export type GameDataStatus = 'loading' | 'ready' | 'fixture';

export interface GameData {
  status: GameDataStatus;
  skills: SkillRecord[];
  cards: SupportCardRecord[];
  sparkRates: SparkRates;
  cmPresets: CmPreset[];
  skillById: Map<string, SkillRecord>;
  cardById: Map<string, SupportCardRecord>;
}

/** fixtures.ts has no CM-preset fixture; derive one from the fixture plan. */
const FIXTURE_CM_PRESETS: CmPreset[] = [
  {
    name: FIXTURE_PLAN.name,
    date: FIXTURE_PLAN.month,
    courseId: FIXTURE_PLAN.race.courseId,
    surface: FIXTURE_PLAN.race.surface,
    distance: FIXTURE_PLAN.race.distance,
  },
];

interface Datasets {
  skills: SkillRecord[];
  cards: SupportCardRecord[];
  sparkRates: SparkRates;
  cmPresets: CmPreset[];
}

const FIXTURE_DATASETS: Datasets = {
  skills: FIXTURE_SKILLS,
  cards: FIXTURE_CARDS,
  sparkRates: FIXTURE_SPARK_RATES,
  cmPresets: FIXTURE_CM_PRESETS,
};

async function fetchJson<T>(file: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}`);
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function loadDatasets(): Promise<Datasets> {
  const [skills, cards, sparkRates, cmPresets] = await Promise.all([
    fetchJson<SkillRecord[]>('skills.json'),
    fetchJson<SupportCardRecord[]>('support_cards.json'),
    fetchJson<SparkRates>('spark_rates.json'),
    fetchJson<CmPreset[]>('cm_presets.json'),
  ]);
  return { skills, cards, sparkRates, cmPresets };
}

const GameDataContext = createContext<GameData | null>(null);

export function GameDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ status: GameDataStatus; data: Datasets }>({
    status: 'loading',
    data: FIXTURE_DATASETS, // placeholder while loading; gated by status
  });

  useEffect(() => {
    let cancelled = false;
    loadDatasets()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch(() => {
        // Any failure (404 / network / bad JSON) → whole-set fixture fallback;
        // never mix real and synthetic datasets.
        if (!cancelled) setState({ status: 'fixture', data: FIXTURE_DATASETS });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<GameData>(() => {
    const { skills, cards, sparkRates, cmPresets } = state.data;
    return {
      status: state.status,
      skills,
      cards,
      sparkRates,
      cmPresets,
      skillById: new Map(skills.map((s) => [s.skillId, s])),
      cardById: new Map(cards.map((c) => [c.cardId, c])),
    };
  }, [state]);

  return createElement(GameDataContext.Provider, { value }, children);
}

export function useGameData(): GameData {
  const ctx = useContext(GameDataContext);
  if (!ctx) throw new Error('useGameData must be used inside <GameDataProvider>');
  return ctx;
}
