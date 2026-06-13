/**
 * Test-only: GameData for parents-feature tests — shared fixtures plus uma
 * records (fixtures.ts is frozen and has no umas; these live here instead).
 */
import type { UmaRecord } from '@/core/types';
import type { GameData } from '@/features/data/gameData';
import { FIXTURE_CARDS, FIXTURE_SKILLS, FIXTURE_SPARK_RATES } from '@/core/fixtures';

export const TEST_UMAS: UmaRecord[] = [
  {
    umaId: '100201',
    charaId: '1002',
    nameEn: 'Silence Suzuka',
    epithet: 'Silent Innocence',
    server: 'global',
    dataVersion: 'fixture',
  },
  {
    umaId: '100101',
    charaId: '1001',
    nameEn: 'Special Week',
    epithet: 'Special Dreamer',
    server: 'global',
    dataVersion: 'fixture',
  },
  {
    // Must never be offered by pickers for a Global plan (P4).
    umaId: '109901',
    charaId: '1099',
    nameEn: 'JP-Only Uma',
    server: 'jp',
    dataVersion: 'fixture',
  },
];

export function parentsTestGameData(): GameData {
  return {
    status: 'ready',
    skills: FIXTURE_SKILLS,
    cards: FIXTURE_CARDS,
    sparkRates: FIXTURE_SPARK_RATES,
    cmPresets: [],
    umas: TEST_UMAS,
    skillById: new Map(FIXTURE_SKILLS.map((s) => [s.skillId, s])),
    cardById: new Map(FIXTURE_CARDS.map((c) => [c.cardId, c])),
    umaById: new Map(TEST_UMAS.map((u) => [u.umaId, u])),
  };
}
