import { describe, it, expect } from 'vitest';
import { polyline, gapCurve, vtPoints, domainOf, activationTimes, gapPoints, maxAbsL } from './geometry';
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

describe('geometry gap mapping', () => {
  const box = { w: 100, h: 80 };
  const dom = { tMax: 1, vMax: 1, distMax: 10 };

  it('gapPoints centers L=0 on the baseline (y = box.h/2)', () => {
    const pts = gapPoints([{ dist: 0, L: 0 }, { dist: 10, L: 0 }], box, dom, 5);
    expect(pts.every((p) => p.y === 40)).toBe(true);
  });

  it('gapPoints sends positive L up (y < half) and negative L down (y > half)', () => {
    const pts = gapPoints([{ dist: 5, L: 2 }, { dist: 5, L: -2 }], box, dom, 4);
    expect(pts[0]!.y).toBeLessThan(40);
    expect(pts[1]!.y).toBeGreaterThan(40);
  });

  it('maxAbsL returns the largest magnitude, floored at 0.1', () => {
    expect(maxAbsL([{ dist: 0, L: -3 }, { dist: 1, L: 1 }])).toBe(3);
    expect(maxAbsL([])).toBe(0.1);
  });

  it('polyline rounds coordinates to 2dp', () => {
    expect(polyline([{ x: 1.2345, y: 2 }])).toBe('1.23,2');
  });
});
