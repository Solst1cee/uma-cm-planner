import type { CmRefV2 } from '@/core/types';

/** Two race refs point at different courses (the only thing the §0 track + race-setup care about). */
export function tracksDiffer(a: CmRefV2, b: CmRefV2): boolean {
  return a.courseId !== b.courseId;
}

/** Whether an inventory load into the focused slot — or a uma1/uma2 flip — should
 *  pop the "change track?" confirmation: only when auto-apply is on, a prior track
 *  already exists, and the course actually changes. */
export function trackChangeNeedsConfirm(args: {
  autoApply: boolean;
  hadPriorTrack: boolean;
  prevCourseId: string;
  nextCourseId: string;
}): boolean {
  return args.autoApply && args.hadPriorTrack && args.prevCourseId !== args.nextCourseId;
}
