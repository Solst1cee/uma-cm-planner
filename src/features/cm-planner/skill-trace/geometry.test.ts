import { describe, it, expect } from 'vitest';
import {
  polyline, gapCurve, vtPoints, domainOf, activationTimes, gapPoints,
  niceCeil, lDomain, zeroLineY, distancePhaseBands, timePhaseBands,
} from './geometry';
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

describe('geometry L-axis scaling', () => {
  it('niceCeil rounds up to a 1-2-5 × 10^k value', () => {
    expect(niceCeil(3.2)).toBe(5);
    expect(niceCeil(1.3)).toBe(2);
    expect(niceCeil(0.35)).toBe(0.5);
    expect(niceCeil(7)).toBe(10);
    expect(niceCeil(2)).toBe(2);
    expect(niceCeil(0)).toBe(0.5); // degenerate guard
  });

  it('lDomain auto-fits a positive curve from a 0 baseline', () => {
    expect(lDomain([{ dist: 0, L: 0 }, { dist: 10, L: 3.2 }])).toEqual({ top: 5, bottom: 0 });
  });

  it('lDomain gives a nice-rounded floor for negative dips', () => {
    expect(lDomain([{ dist: 0, L: -1.3 }, { dist: 10, L: 2 }])).toEqual({ top: 2, bottom: -2 });
  });
});

describe('geometry gap mapping', () => {
  const box = { w: 100, h: 80 };
  const dom = { tMax: 1, vMax: 1, distMax: 10 };

  it('gapPoints maps bottom→y=h and top→y=0', () => {
    const pts = gapPoints([{ dist: 0, L: 0 }, { dist: 10, L: 5 }], box, dom, { top: 5, bottom: 0 });
    expect(pts[0]!.y).toBe(80); // L=0 (bottom) → y=h
    expect(pts[1]!.y).toBe(0);  // L=top → y=0
  });

  it('zeroLineY sits at the bottom for a 0-floor range, at center for a symmetric one', () => {
    expect(zeroLineY(box, { top: 5, bottom: 0 })).toBe(80);
    expect(zeroLineY(box, { top: 4, bottom: -4 })).toBe(40);
  });

  it('gapPoints sends positive L up and negative L down relative to the zero line', () => {
    const ld = { top: 4, bottom: -4 };
    const zero = zeroLineY(box, ld); // 40
    const pts = gapPoints([{ dist: 5, L: 2 }, { dist: 5, L: -2 }], box, dom, ld);
    expect(pts[0]!.y).toBeLessThan(zero);
    expect(pts[1]!.y).toBeGreaterThan(zero);
  });

  it('polyline rounds coordinates to 2dp', () => {
    expect(polyline([{ x: 1.2345, y: 2 }])).toBe('1.23,2');
  });
});

describe('geometry phase bands', () => {
  const box = { w: 120, h: 80 };

  it('distancePhaseBands splits width at 1/6 and 2/3 into 3 phases', () => {
    const bands = distancePhaseBands(box);
    expect(bands.map((b) => b.phase)).toEqual([0, 1, 2]);
    expect(bands[0]).toEqual({ x: 0, w: 20, phase: 0 });        // 0 – 1/6 (20)
    expect(bands[1]).toEqual({ x: 20, w: 60, phase: 1 });       // 1/6 – 2/3 (20 – 80)
    expect(bands[2]).toEqual({ x: 80, w: 40, phase: 2 });       // 2/3 – end (80 – 120)
  });

  it('timePhaseBands maps the distance boundaries onto the time axis', () => {
    // withSkill reaches its full distance (distMax) at the end; with a flat run the time
    // boundaries land proportionally. Use a run whose pos is linear in t.
    const linear: SkillTraceRun = {
      withSkill: Array.from({ length: 7 }, (_, i) => ({ t: i, v: 1, pos: i * 100, hp: 1 })),
      without: [], activation: [], L: 0,
    };
    const d = domainOf(linear); // distMax = 600, tMax = 6
    const bands = timePhaseBands(linear, box, d);
    expect(bands).toHaveLength(3);
    expect(bands[0]!.x).toBe(0);
    // boundary at 1/6 distance (100m) → t=1 → x = (1/6)*120 = 20
    expect(bands[1]!.x).toBeCloseTo(20, 5);
    // boundary at 2/3 distance (400m) → t=4 → x = (4/6)*120 = 80
    expect(bands[2]!.x).toBeCloseTo(80, 5);
  });
});
