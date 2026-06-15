import { resolveCourse } from './adapter';
import type { CourseData } from './vendor/umalator.bundle.mjs';

/**
 * Raw engine CourseData (distance + corners/straights/slopes/turn) for a course id.
 * Reuses the adapter's resolveCourse; callers on the main thread should reach this
 * via a lazy `import('@/sim/courseData')` so the engine bundle stays out of the
 * initial chunk. Throws on an unknown course.
 */
export function courseDataFor(courseId: string): CourseData {
  return resolveCourse(courseId);
}
