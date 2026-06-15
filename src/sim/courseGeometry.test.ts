// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { courseGeometryFor } from './courseGeometry';

describe('courseGeometryFor', () => {
  it('projects course 10906 (CM15 Hanshin turf 2200m) to plain geometry', () => {
    const geom = courseGeometryFor('10906');
    expect(geom.distance).toBe(2200);
    expect(geom.turn).toBe(1);
    expect(geom.corners).toHaveLength(4);
    expect(geom.corners[0]).toEqual({ start: 520, length: 190 });
    expect(geom.straights.length).toBeGreaterThan(0);
    expect(geom.slopes.length).toBeGreaterThan(0);
  });

  it('throws a clear error for an unknown course', () => {
    expect(() => courseGeometryFor('99999999')).toThrow(/course/i);
  });
});
