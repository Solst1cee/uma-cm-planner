// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { courseCatalog } from './courseCatalog';

describe('courseCatalog', () => {
  const all = courseCatalog();

  it('enumerates the full engine course catalog (100+ courses)', () => {
    expect(all.length).toBeGreaterThan(100);
  });

  it('includes CM15 Hanshin turf 2200m (courseId 10906) as medium / right-handed', () => {
    const c = all.find((e) => e.courseId === '10906');
    expect(c).toBeDefined();
    expect(c).toMatchObject({
      raceTrackId: 10009,
      surface: 'turf',
      distance: 2200,
      distanceClass: 'medium',
      turn: 1,
    });
  });

  it('includes CM16 Nakayama turf 1200m (courseId 10501) as sprint / right-handed', () => {
    const c = all.find((e) => e.courseId === '10501');
    expect(c).toMatchObject({
      raceTrackId: 10005,
      surface: 'turf',
      distance: 1200,
      distanceClass: 'sprint',
      turn: 1,
    });
  });

  it('includes Ooi (NAR, raceTrackId 10101) dirt courses', () => {
    const ooi = all.filter((e) => e.raceTrackId === 10101);
    expect(ooi.length).toBeGreaterThan(0);
    expect(ooi.every((e) => e.surface === 'dirt')).toBe(true);
  });
});
