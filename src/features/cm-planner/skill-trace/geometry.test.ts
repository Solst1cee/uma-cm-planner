import { describe, it, expect } from 'vitest';
import { polyline, gapCurve, vtPoints, domainOf, activationTimes } from './geometry';
import type { SkillTraceRun } from '@/sim';

const run: SkillTraceRun = {
  without: [ { t: 0, v: 0, pos: 0, hp: 100 }, { t: 1, v: 10, pos: 5, hp: 90 } ],
  withSkill: [ { t: 0, v: 0, pos: 0, hp: 100 }, { t: 1, v: 12, pos: 7.5, hp: 88 } ],
  activation: [ { start: 5, end: 7.5 } ],
  L: 1,
};

describe('geometry', () => {
  it('polyline joins points as "x,y x,y"', () => {
    expect(polyline([{ x: 0, y: 1 }, { x: 2, y: 3 }])).toBe('0,1 2,3');
  });

  it('gapCurve is (posWith - posWithout)/2.5 vs distance', () => {
    const c = gapCurve(run);
    expect(c).toHaveLength(2);
    expect(c[1]).toEqual({ dist: 7.5, L: 1 }); // (7.5-5)/2.5
  });

  it('vtPoints maps t→x and v→y inside the box (y inverted)', () => {
    const d = domainOf(run);
    const pts = vtPoints(run.withSkill, { w: 100, h: 50 }, d);
    expect(pts[0]!.x).toBe(0);     // t=0 → left edge
    expect(pts[0]!.y).toBe(50);    // v=0 → bottom (inverted)
    expect(pts[1]!.x).toBe(100);   // tMax → right edge
    expect(pts[1]!.y).toBe(0);     // vMax → top
  });

  it('activationTimes maps activation positions to with-skill frame times', () => {
    expect(activationTimes(run)).toEqual([{ tStart: 1, tEnd: 1 }]);
  });
});
