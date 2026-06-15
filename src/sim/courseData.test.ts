// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { courseDataFor } from './courseData';

describe('courseDataFor', () => {
  it('returns the real engine CourseData for course 10906 (CM15 Hanshin 2200m)', () => {
    const c = courseDataFor('10906');
    expect(c.distance).toBe(2200);
    expect(c.turn).toBe(1);
    expect(c.corners.length).toBe(4);
    expect(c.straights.length).toBeGreaterThan(0);
    expect(c.slopes.length).toBeGreaterThan(0);
  });
  it('throws for an unknown course', () => {
    expect(() => courseDataFor('99999999')).toThrow(/course/i);
  });
});
