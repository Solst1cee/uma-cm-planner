/**
 * Shims for the two umalator engine imports the vendored racetrack layers use:
 * the CourseData type and CourseService.phaseStart. CourseData is our widened
 * bundle type; phaseStart is the engine's phase-boundary math (verified: phase
 * boundaries at 0, 1/6, 2/3, 5/6 of the course distance).
 */
import type { CourseData } from '@/sim';

export type { CourseData };

export const CourseService = {
  phaseStart(distance: number, phase: number): number {
    switch (phase) {
      case 1:
        return distance / 6;
      case 2:
        return (distance * 2) / 3;
      case 3:
        return (distance * 5) / 6;
      default:
        return 0;
    }
  },
};
