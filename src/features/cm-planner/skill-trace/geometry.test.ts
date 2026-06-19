import { describe, it, expect } from 'vitest';
import {
  polyline, gapCurve, vtPoints, domainOf, activationTimes, incrementalGains, gainColumns,
  niceCeil, niceDomain, zeroLineY, distancePhaseBands, timePhaseBands, phaseBoundaryDistances,
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

  it('niceDomain auto-fits positive values from a 0 baseline', () => {
    expect(niceDomain([0, 3.2])).toEqual({ top: 5, bottom: 0 });
  });

  it('niceDomain gives a nice-rounded floor for negative values', () => {
    expect(niceDomain([-1.3, 2])).toEqual({ top: 2, bottom: -2 });
  });
});

describe('geometry gap mapping (columns)', () => {
  const box = { w: 100, h: 80 };
  const dom = { tMax: 1, vMax: 1, distMax: 10 };

  it('zeroLineY sits at the bottom for a 0-floor range, at center for a symmetric one', () => {
    expect(zeroLineY(box, { top: 5, bottom: 0 })).toBe(80);
    expect(zeroLineY(box, { top: 4, bottom: -4 })).toBe(40);
  });

  it('incrementalGains is ΔL per bucket, telescopes to the total, zero in flat regions', () => {
    // cumulative lead: 0 until 5m, +1 by 6m, +1 more by 8m, then held at 2.
    const curve = [
      { dist: 0, L: 0 }, { dist: 5, L: 0 }, { dist: 6, L: 1 }, { dist: 8, L: 2 }, { dist: 10, L: 2 },
    ];
    const gains = incrementalGains(curve, dom, 10);
    expect(gains).toHaveLength(10);
    expect(gains.reduce((s, g) => s + g.dL, 0)).toBeCloseTo(2, 5); // sum = final lead
    expect(gains[0]!.dL).toBe(0);                                  // flat early region
    expect(gains[9]!.dL).toBe(0);                                  // maintained-lead plateau
    const active = gains.filter((g) => g.dL > 0);
    expect(active.length).toBe(2);                                 // only the two rise buckets
  });

  it('gainColumns draws a bar only for non-zero buckets, growing from the baseline', () => {
    const gains = [{ d0: 0, d1: 1, dL: 0 }, { d0: 1, d1: 2, dL: 0.4 }, { d0: 2, d1: 3, dL: 0 }];
    const cols = gainColumns(gains, box, { top: 0.5, bottom: 0 });
    expect(cols).toHaveLength(1);
    expect(cols[0]!.x).toBeCloseTo(100 / 3, 5);   // bucket index 1 of 3
    expect(cols[0]!.y + cols[0]!.h).toBeCloseTo(80, 5); // grows from baseline (h)
    expect(cols[0]!.neg).toBe(false);
  });

  it('gainColumns flags a negative (lost-ground) bar', () => {
    const cols = gainColumns([{ d0: 0, d1: 1, dL: -0.3 }], box, { top: 0.5, bottom: -0.5 });
    expect(cols[0]!.neg).toBe(true);
  });

  it('polyline rounds coordinates to 2dp', () => {
    expect(polyline([{ x: 1.2345, y: 2 }])).toBe('1.23,2');
  });
});

describe('geometry phase bands', () => {
  const box = { w: 120, h: 80 };

  it('phaseBoundaryDistances returns the 1/6 and 2/3 course distances', () => {
    expect(phaseBoundaryDistances({ tMax: 1, vMax: 1, distMax: 1200 })).toEqual([200, 800]);
  });

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
