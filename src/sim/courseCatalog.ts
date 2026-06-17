import { coursesService } from './vendor/umalator.bundle.mjs';
import { distanceClass } from '@/core/simBuild';

/**
 * The full course catalog, enumerated from the vendored engine at runtime
 * (coursesService.getAllEntries — no extra data file). Each entry is the raw
 * course metadata a Track→distance picker needs; geometry (corners/slopes) is
 * fetched separately via courseDataFor when a course is selected.
 *
 * Reach this via a lazy `import('@/sim/courseCatalog')` so the engine bundle
 * stays out of the initial chunk.
 */
export interface CourseCatalogEntry {
  courseId: string;
  raceTrackId: number;
  surface: 'turf' | 'dirt';
  distance: number;
  distanceClass: 'sprint' | 'mile' | 'medium' | 'long';
  /** uma-tools course layout code: 1=none, 2=inner, 3=outer, 4=outer->inner. */
  course: 1 | 2 | 3 | 4;
  /** 1 = right-handed, 2 = left-handed. */
  turn: 1 | 2;
}

const DISTANCE_TYPE_CLASS: Record<number, CourseCatalogEntry['distanceClass']> = {
  1: 'sprint',
  2: 'mile',
  3: 'medium',
  4: 'long',
  5: 'long',
};

/**
 * Fallback when distanceType is missing/unknown (a few courses have it undefined).
 * Reuses core's distance thresholds (single source of truth); the catalog uses the
 * 'sprint' display label where the aptitude class is 'short'.
 */
function classifyByDistance(distance: number): CourseCatalogEntry['distanceClass'] {
  const c = distanceClass(distance);
  return c === 'short' ? 'sprint' : c;
}

export function courseCatalog(): CourseCatalogEntry[] {
  return coursesService.getAllEntries().map(([courseId, e]) => ({
    courseId,
    raceTrackId: e.raceTrackId,
    surface: e.surface === 2 ? 'dirt' : 'turf',
    distance: e.distance,
    distanceClass: DISTANCE_TYPE_CLASS[e.distanceType] ?? classifyByDistance(e.distance),
    course: e.course === 2 || e.course === 3 || e.course === 4 ? e.course : 1,
    turn: e.turn === 2 ? 2 : 1,
  }));
}
