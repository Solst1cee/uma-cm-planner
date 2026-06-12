/** Test-only: a ready-status GameData built from the shared fixtures. */
import type { GameData } from '@/features/data/gameData';
import { FIXTURE_CARDS, FIXTURE_PLAN, FIXTURE_SKILLS, FIXTURE_SPARK_RATES } from '@/core/fixtures';

export function fixtureGameData(): GameData {
  return {
    status: 'ready',
    skills: FIXTURE_SKILLS,
    cards: FIXTURE_CARDS,
    sparkRates: FIXTURE_SPARK_RATES,
    cmPresets: [
      {
        name: FIXTURE_PLAN.name,
        date: FIXTURE_PLAN.month,
        courseId: FIXTURE_PLAN.race.courseId,
        surface: FIXTURE_PLAN.race.surface,
        distance: FIXTURE_PLAN.race.distance,
      },
    ],
    skillById: new Map(FIXTURE_SKILLS.map((s) => [s.skillId, s])),
    cardById: new Map(FIXTURE_CARDS.map((c) => [c.cardId, c])),
  };
}
