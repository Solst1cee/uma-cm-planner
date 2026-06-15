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
import type { CmPreset, CmScheduleRow, SkillRecord, SparkRates, SupportCardRecord, TimelineEntry, UmaRecord } from '@/core/types';
import type { IconManifest } from '@/core/icons';
import { projectCmSchedule } from '@/core/timeline';
import {
  FIXTURE_CARDS,
  FIXTURE_PLAN,
  FIXTURE_SKILLS,
  FIXTURE_SPARK_RATES,
} from '@/core/fixtures';

/**
 * App base path (Vite injects '/' in dev, '/<repo>/' on Pages, '/' under
 * Vitest). Components build a full icon src as `BASE_URL + relativePath`,
 * mirroring the loader's own fetch base.
 */
export const BASE_URL: string = import.meta.env.BASE_URL;

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
  /**
   * Bundled-icon manifest (plan §4). `null` when icon-manifest.json is
   * missing/broken — like umas.json, that failure alone NEVER flips the
   * provider to fixture mode (icons augment the text UI; their absence just
   * means GameIcon degrades to its placeholder). Optional in the type so
   * pre-icon GameData literals (test fixtures) keep compiling — consumers
   * should treat `undefined`/`null` the same (no icons).
   */
  iconManifest?: IconManifest | null;
  /**
   * M3 timeline entries (plan §3). Loaded from timeline.json; optional so
   * pre-M3 GameData literals (test fixtures) keep compiling — consumers
   * should `?? []`. Failure degrades to empty (never flips to fixture mode).
   */
  timeline?: TimelineEntry[];
  /**
   * M3→M4 CM schedule: timeline entries with a cmNumber projected to CmScheduleRow.
   * Derived from `timeline` via `projectCmSchedule`. Optional for the same
   * reason as `timeline` — consumers should `?? []`.
   */
  cmSchedule?: CmScheduleRow[];
  skillById: Map<string, SkillRecord>;
  cardById: Map<string, SupportCardRecord>;
  umaById?: Map<string, UmaRecord>;
}

/** fixtures.ts has no CM-preset fixture; derive one from the fixture plan. */
const FIXTURE_CM_PRESETS: CmPreset[] = [
  {
    name: FIXTURE_PLAN.name,
    date: '2026-07',
    server: 'global',
    dataVersion: 'fixture',
    courseId: FIXTURE_PLAN.cmRef.courseId,
    surface: FIXTURE_PLAN.cmRef.surface,
    distance: FIXTURE_PLAN.cmRef.distance,
  },
];

interface Datasets {
  skills: SkillRecord[];
  cards: SupportCardRecord[];
  sparkRates: SparkRates;
  cmPresets: CmPreset[];
  umas: UmaRecord[];
  iconManifest: IconManifest | null;
  timeline: TimelineEntry[];
}

const FIXTURE_DATASETS: Datasets = {
  skills: FIXTURE_SKILLS,
  cards: FIXTURE_CARDS,
  sparkRates: FIXTURE_SPARK_RATES,
  cmPresets: FIXTURE_CM_PRESETS,
  // fixtures.ts is frozen and has no uma fixture; in fixture mode the parent
  // pickers degrade to raw ids, same as a missing umas.json.
  umas: [],
  // No bundled icons in fixture mode — GameIcon falls back to its placeholder.
  iconManifest: null,
  // No timeline in fixture mode — M3 views degrade to empty.
  timeline: [],
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
  // icon-manifest.json is an optional augmentation (plan §4). Like umas.json it
  // must NOT throw into the whole-set fixture fallback: a missing/broken
  // manifest only means GameIcon renders its placeholder. `data/icons/...` not
  // `data/...`, so fetch the nested path directly rather than via fetchJson.
  const iconManifest: IconManifest | null = await fetchJson<IconManifest>(
    'icons/icon-manifest.json',
  ).catch((err: unknown) => {
    console.warn('[gameData] icon-manifest.json unavailable — icons fall back to text.', err);
    return null;
  });
  // timeline.json ships with M3. Like umas.json, its failure must NOT flip the
  // whole provider to fixture mode — M3 views simply degrade to an empty timeline.
  const timelineJson = await fetchJson<{ entries: TimelineEntry[] }>('timeline.json').catch(
    (err: unknown) => {
      console.warn('[gameData] timeline.json unavailable — M3 timeline degrades to empty.', err);
      return { entries: [] as TimelineEntry[] };
    },
  );
  const timeline = timelineJson.entries;
  return { skills, cards, sparkRates, cmPresets, umas, iconManifest, timeline };
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
    const { skills, cards, sparkRates, cmPresets, umas, iconManifest, timeline } = state.data;
    return {
      status: state.status,
      skills,
      cards,
      sparkRates,
      cmPresets,
      umas,
      iconManifest,
      timeline,
      cmSchedule: projectCmSchedule(timeline),
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
