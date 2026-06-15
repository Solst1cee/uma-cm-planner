export type { BashinStats, Grade, SimBuild, SimRaceParams, Strategy, VacuumResult } from './types';
export type { CourseData } from './vendor/umalator.bundle.mjs';
export { evalSkillDelta, runVacuumCompare, runPlannerCompare } from './run';
export { simCacheKey, makeDeltaCache } from './cache';
export { SimClient } from './client';
// courseGeometryFor / courseDataFor are intentionally NOT re-exported here: they pull
// the engine bundle, so the §0 track panel reaches them via lazy dynamic imports.
