export type { BashinStats, Grade, SimBuild, SimRaceParams, Strategy, VacuumResult } from './types';
export { evalSkillDelta, runVacuumCompare, runPlannerCompare } from './run';
export { simCacheKey, makeDeltaCache } from './cache';
export { SimClient } from './client';
// courseGeometryFor is intentionally NOT re-exported here: it pulls the engine
// bundle, so the §0 track panel reaches it via a lazy `import('@/sim/courseGeometry')`.
