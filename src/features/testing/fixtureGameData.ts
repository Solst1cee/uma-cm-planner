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
        // JP-history preset sharing the fixture plan's race key (courseId,
        // surface, distance) but an earlier month — real cm_presets.json has
        // 12 such collisions. Exercises identity matching (month is part of
        // the preset identity) and the P4 '(JP history)' labeling.
        name: 'Old JP Cup',
        date: '2024-07-15',
        server: 'jp',
        dataVersion: 'fixture',
        courseId: FIXTURE_PLAN.race.courseId,
        surface: FIXTURE_PLAN.race.surface,
        distance: FIXTURE_PLAN.race.distance,
      },
      {
        name: FIXTURE_PLAN.name,
        date: FIXTURE_PLAN.month,
        server: 'global',
        dataVersion: 'fixture',
        courseId: FIXTURE_PLAN.race.courseId,
        surface: FIXTURE_PLAN.race.surface,
        distance: FIXTURE_PLAN.race.distance,
      },
    ],
    skillById: new Map(FIXTURE_SKILLS.map((s) => [s.skillId, s])),
    cardById: new Map(FIXTURE_CARDS.map((c) => [c.cardId, c])),
  };
}
