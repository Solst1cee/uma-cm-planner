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
        // surface, distance) — real cm_presets.json has 12 such collisions.
        // Exercises identity matching (name is part of the preset identity)
        // and the P4 '(JP history)' labeling.
        name: 'Old JP Cup',
        date: '2024-07-15',
        server: 'jp',
        dataVersion: 'fixture',
        courseId: FIXTURE_PLAN.cmRef.courseId,
        surface: FIXTURE_PLAN.cmRef.surface,
        distance: FIXTURE_PLAN.cmRef.distance,
      },
      {
        name: FIXTURE_PLAN.name,
        date: '2026-07',
        server: 'global',
        dataVersion: 'fixture',
        courseId: FIXTURE_PLAN.cmRef.courseId,
        surface: FIXTURE_PLAN.cmRef.surface,
        distance: FIXTURE_PLAN.cmRef.distance,
      },
    ],
    skillById: new Map(FIXTURE_SKILLS.map((s) => [s.skillId, s])),
    cardById: new Map(FIXTURE_CARDS.map((c) => [c.cardId, c])),
  };
}
