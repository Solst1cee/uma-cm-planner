import { describe, it, expect } from 'vitest';
import {
  polyline, vtPoints, domainOf, activationTimes,
  niceCeil, niceDomain, zeroLineY,
  impactByPosition, frequencyByPosition, binColumns,
  distancePhaseBands, timePhaseBands, phaseBoundaryDistances,
} from './geometry';
import type { SkillTraceRun, SkillImpactSample } from '@/sim';

const run: SkillTraceRun = {
  without: [ { t: 0, v: 0, pos: 0, hp: 100 }, { t: 1, v: 10, pos: 5, hp: 90 } ],
  withSkill: [ { t: 0, v: 0, pos: 0, hp: 100 }, { t: 1, v: 12, pos: 7.5, hp: 88 } ],
  activation: [ { start: 5, end: 7.5 } ],
  L: 1,
};

describe('geometry — velocity/time', () => {
  it('polyline joins points as "x,y x,y"', () => {
    expect(polyline([{ x: 0, y: 1 }, { x: 2, y: 3 }])).toBe('0,1 2,3');
  });

  it('vtPoints maps t→x and v→y inside the box (y inverted)', () => {
    const d = domainOf(run);
    const pts = vtPoints(run.withSkill, { w: 100, h: 50 }, d);
    expect(pts[0]!).toEqual({ x: 0, y: 50 });   // t=0,v=0 → bottom-left
    expect(pts[1]!).toEqual({ x: 100, y: 0 });  // tMax,vMax → top-right
  });

  it('activationTimes maps activation positions to with-skill frame times', () => {
    expect(activationTimes(run)).toEqual([{ tStart: 1, tEnd: 1 }]);
  });
});

describe('geometry — axis scaling', () => {
  it('niceCeil rounds up to a 1-2-5 × 10^k value', () => {
    expect(niceCeil(3.2)).toBe(5);
    expect(niceCeil(1.3)).toBe(2);
    expect(niceCeil(0.35)).toBe(0.5);
    expect(niceCeil(7)).toBe(10);
    expect(niceCeil(0)).toBe(0.5);
  });

  it('niceDomain auto-fits values from a 0 baseline; negative gets a nice floor', () => {
    expect(niceDomain([0, 3.2])).toEqual({ top: 5, bottom: 0 });
    expect(niceDomain([-1.3, 2])).toEqual({ top: 2, bottom: -2 });
  });

  it('zeroLineY sits at the bottom for a 0-floor range, at center for a symmetric one', () => {
    expect(zeroLineY({ w: 100, h: 80 }, { top: 5, bottom: 0 })).toBe(80);
    expect(zeroLineY({ w: 100, h: 80 }, { top: 4, bottom: -4 })).toBe(40);
  });
});

describe('geometry — position-resolved charts', () => {
  // distance 1200, binMeters 400 → 3 bins: [0,400) [400,800) [800,1200)
  const samples: SkillImpactSample[] = [
    { horseLength: 2, positions: [100] },
    { horseLength: 5, positions: [100, 800] },
    { horseLength: -1, positions: [100] }, // negative gain (filtered from impact, counted in frequency)
    { horseLength: 3, positions: [800] },
  ];

  it('impactByPosition = max positive バ身 among samples firing in each position bin', () => {
    expect(impactByPosition(samples, 1200, 400)).toEqual([5, 0, 5]);
  });

  it('frequencyByPosition = % of all runs firing in each position bin', () => {
    expect(frequencyByPosition(samples, 4, 1200, 400)).toEqual([75, 0, 50]);
  });

  it('binColumns draws a bar only for non-zero bins, growing from the baseline', () => {
    const cols = binColumns([0, 0.4, 0], { w: 90, h: 80 }, { top: 0.5, bottom: 0 });
    expect(cols).toHaveLength(1);
    expect(cols[0]!.x).toBeCloseTo(30, 5);              // bin index 1 of 3
    expect(cols[0]!.y + cols[0]!.h).toBeCloseTo(80, 5); // grows from baseline
    expect(cols[0]!.neg).toBe(false);
  });
});

describe('geometry — phase bands', () => {
  const box = { w: 120, h: 80 };

  it('phaseBoundaryDistances returns the 1/6 and 2/3 course distances', () => {
    expect(phaseBoundaryDistances(1200)).toEqual([200, 800]);
  });

  it('distancePhaseBands splits width at 1/6 and 2/3 into 3 phases', () => {
    const bands = distancePhaseBands(box);
    expect(bands.map((b) => b.phase)).toEqual([0, 1, 2]);
    expect(bands[0]).toEqual({ x: 0, w: 20, phase: 0 });
    expect(bands[1]).toEqual({ x: 20, w: 60, phase: 1 });
    expect(bands[2]).toEqual({ x: 80, w: 40, phase: 2 });
  });

  it('timePhaseBands maps the distance boundaries onto the time axis', () => {
    const linear: SkillTraceRun = {
      withSkill: Array.from({ length: 7 }, (_, i) => ({ t: i, v: 1, pos: i * 100, hp: 1 })),
      without: [], activation: [], L: 0,
    };
    const d = domainOf(linear); // distMax 600, tMax 6
    const bands = timePhaseBands(linear, box, d);
    expect(bands[1]!.x).toBeCloseTo(20, 5); // 1/6 dist (100m) → t=1 → (1/6)*120
    expect(bands[2]!.x).toBeCloseTo(80, 5); // 2/3 dist (400m) → t=4 → (4/6)*120
  });
});
