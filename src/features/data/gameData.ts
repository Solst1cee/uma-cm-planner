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
import type { CmPreset, SkillRecord, SparkRates, SupportCardRecord, UmaRecord } from '@/core/types';
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
  /**
   * Playable-uma picker data (Phase 2, parents entry). The provider ALWAYS
   * populates these (empty array when umas.json is missing/broken — that
   * failure alone never flips the provider to fixture mode, see loadDatasets).
   * Typed optional only so pre-Phase-2 GameData literals (e.g. the shared
   * test fixture helper) keep compiling — consumers should `?? []`.
   * TODO(phase2-cleanup): make required once fixtureGameData.ts gains umas.
   */
  umas?: UmaRecord[];
  skillById: Map<string, SkillRecord>;
  cardById: Map<string, SupportCardRecord>;
  umaById?: Map<string, UmaRecord>;
}

/** fixtures.ts has no CM-preset fixture; derive one from the fixture plan. */
const FIXTURE_CM_PRESETS: CmPreset[] = [
  {
    name: FIXTURE_PLAN.name,
    date: FIXTURE_PLAN.month,
    server: 'global',
    dataVersion: 'fixture',
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
  umas: UmaRecord[];
}

const FIXTURE_DATASETS: Datasets = {
  skills: FIXTURE_SKILLS,
  cards: FIXTURE_CARDS,
  sparkRates: FIXTURE_SPARK_RATES,
  cmPresets: FIXTURE_CM_PRESETS,
  // fixtures.ts is frozen and has no uma fixture; in fixture mode the parent
  // pickers degrade to raw ids, same as a missing umas.json.
  umas: [],
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
  // umas.json ships with Phase 2 (parents entry) and may lag the other four
  // datasets on older deploys. Its failure degrades to an empty uma list with
  // a console warning — it must NOT throw into the whole-set fixture fallback
  // below: the four core datasets are still real, so the fixture banner (P3)
  // must stay off and real numbers must keep flowing.
  const umas: UmaRecord[] = await fetchJson<UmaRecord[]>('umas.json').catch((err: unknown) => {
    console.warn('[gameData] umas.json unavailable — parent pickers fall back to raw ids.', err);
    return [];
  });
  return { skills, cards, sparkRates, cmPresets, umas };
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
    const { skills, cards, sparkRates, cmPresets, umas } = state.data;
    return {
      status: state.status,
      skills,
      cards,
      sparkRates,
      cmPresets,
      umas,
      skillById: new Map(skills.map((s) => [s.skillId, s])),
      cardById: new Map(cards.map((c) => [c.cardId, c])),
      umaById: new Map(umas.map((u) => [u.umaId, u])),
    };
  }, [state]);

  return createElement(GameDataContext.Provider, { value }, children);
}

export function useGameData(): GameData {
  const ctx = useContext(GameDataContext);
  if (!ctx) throw new Error('useGameData must be used inside <GameDataProvider>');
  return ctx;
}
