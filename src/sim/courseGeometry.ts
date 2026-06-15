import { resolveCourse } from './adapter';
// Type-only import (erased at runtime) — no sim→core runtime dependency / cycle.
import type { CourseGeometry } from '@/core/track';

/**
 * Project the engine's CourseData to the pure `CourseGeometry` our §0 track core
 * (`src/core/track.ts`) consumes. The geometry already lives in the vendored
 * bundle, so this is a runtime lookup with no extra `public/data/` file.
 * Throws on an unknown course (via `resolveCourse`).
 *
 * NOTE: `resolveCourse` pulls the ~5 MB engine bundle, so callers on the main
 * thread should reach this via a lazy `import('@/sim/courseGeometry')` to keep
 * it out of the initial chunk.
 */
export function courseGeometryFor(courseId: string): CourseGeometry {
  const c = resolveCourse(courseId);
  return {
    distance: c.distance,
    turn: c.turn,
    corners: c.corners.map((x) => ({ start: x.start, length: x.length })),
    straights: c.straights.map((x) => ({ start: x.start, end: x.end })),
    slopes: c.slopes.map((x) => ({ start: x.start, length: x.length, slope: x.slope })),
  };
}
