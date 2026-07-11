import { coursesService } from './vendor/umalator-wasm.bundle.mjs';
import type { CourseData } from './vendor/umalator-wasm.bundle.mjs';

/** Resolve our string courseId to the v0.27.0 engine's CourseData geometry. Throws
 *  if unknown. (Formerly `adapter.resolveCourse` against the old TS bundle; moved
 *  here — its only consumer — when the old bundle was deleted so `adapter.ts` can
 *  stay a pure, engine-free module. `wasmAdapter.resolveWasmCourse` resolves the
 *  same catalog for the worker path.) */
function resolveCourse(courseId: string): CourseData {
  const numeric = Number(courseId);
  const course = coursesService.getSimCourse(numeric);
  if (!course || typeof course.distance !== 'number') {
    throw new Error(`Unknown course: ${courseId}`);
  }
  return course;
}

/**
 * Raw engine CourseData (distance + corners/straights/slopes/turn) for a course id.
 * Callers on the main thread should reach this via a lazy `import('@/sim/courseData')`
 * so the engine bundle stays out of the initial chunk. Throws on an unknown course.
 */
export function courseDataFor(courseId: string): CourseData {
  return resolveCourse(courseId);
}
