import { describe, it, expect } from 'vitest';
import {
  polyline, vtPoints, domainOf, activationTimes,
  lAxisDomain, zeroLineY, gridLinesX, gridLinesY,
  impactByPosition, frequencyByPosition, binColumns,
  distancePhaseBands, timePhaseBands, PHASE_FRACTIONS,
  velocityHpDomain, posPoints, activationZonesByPos, gapMagnitude, gapPoints,
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
    const pts = vtPoints(run.withSkill, { w: 100, h: 50 }, domainOf(run));
    expect(pts[0]!).toEqual({ x: 0, y: 50 });
    expect(pts[1]!).toEqual({ x: 100, y: 0 });
  });

  it('activationTimes maps activation positions to with-skill frame times', () => {
    expect(activationTimes(run)).toEqual([{ tStart: 1, tEnd: 1 }]);
  });
});

describe('geometry — axes + grid', () => {
  it('lAxisDomain gives integer-L bounds (clean 1L grid), always including 0', () => {
    expect(lAxisDomain([0, 3.2])).toEqual({ top: 4, bottom: 0 });
    expect(lAxisDomain([0, 0])).toEqual({ top: 1, bottom: 0 });
    expect(lAxisDomain([-0.3, 2])).toEqual({ top: 2, bottom: -1 });
  });

  it('zeroLineY sits at the bottom for a 0-floor range, at center for a symmetric one', () => {
    expect(zeroLineY({ w: 100, h: 80 }, { top: 5, bottom: 0 })).toBe(80);
    expect(zeroLineY({ w: 100, h: 80 }, { top: 4, bottom: -4 })).toBe(40);
  });

  it('gridLinesX places a line every step metres across [0, distance]', () => {
    const g = gridLinesX(1200, 500, { w: 120, h: 80 });
    expect(g.map((l) => l.value)).toEqual([0, 500, 1000]); // 1500 > 1200
    expect(g[1]!.x).toBeCloseTo(50, 5); // 500/1200 * 120
  });

  it('gridLinesY places a line every step across [bottom, top]', () => {
    const g = gridLinesY({ top: 3, bottom: 0 }, 1, { w: 120, h: 80 });
    expect(g.map((l) => l.value)).toEqual([0, 1, 2, 3]);
    expect(g[0]!.y).toBe(80); // value 0 → bottom
    expect(g[3]!.y).toBe(0);  // value 3 (top) → top
  });
});

describe('geometry — position-resolved charts', () => {
  // distance 1200, binMeters 400 → 3 bins
  const samples: SkillImpactSample[] = [
    { horseLength: 2, positions: [100] },
    { horseLength: 5, positions: [100, 800] },
    { horseLength: -1, positions: [100] },
    { horseLength: 3, positions: [800] },
  ];

  it('impactByPosition = max positive L among samples firing in each bin', () => {
    expect(impactByPosition(samples, 1200, 400)).toEqual([5, 0, 5]);
  });

  it('frequencyByPosition = % of all runs firing in each bin', () => {
    expect(frequencyByPosition(samples, 4, 1200, 400)).toEqual([75, 0, 50]);
  });

  it('binColumns draws a bar only for non-zero bins, growing from the baseline', () => {
    const cols = binColumns([0, 0.4, 0], { w: 90, h: 80 }, { top: 0.5, bottom: 0 });
    expect(cols).toHaveLength(1);
    expect(cols[0]!.x).toBeCloseTo(30, 5);
    expect(cols[0]!.y + cols[0]!.h).toBeCloseTo(80, 5);
  });
});

describe('geometry — four phase bands', () => {
  const box = { w: 120, h: 80 };

  it('PHASE_FRACTIONS has the three boundaries (1/6, 2/3, 5/6)', () => {
    expect([...PHASE_FRACTIONS]).toEqual([1 / 6, 2 / 3, 5 / 6]);
  });

  it('distancePhaseBands splits width into Early/Mid/Late/Last-spurt', () => {
    const bands = distancePhaseBands(box);
    expect(bands.map((b) => b.phase)).toEqual([0, 1, 2, 3]);
    expect(bands[0]).toEqual({ x: 0, w: 20, phase: 0 });   // 0 – 1/6
    expect(bands[1]).toEqual({ x: 20, w: 60, phase: 1 });  // 1/6 – 2/3
    expect(bands[2]).toEqual({ x: 80, w: 20, phase: 2 });  // 2/3 – 5/6
    expect(bands[3]).toEqual({ x: 100, w: 20, phase: 3 }); // 5/6 – end
  });

  it('timePhaseBands maps the three distance boundaries onto the time axis', () => {
    const linear: SkillTraceRun = {
      withSkill: Array.from({ length: 7 }, (_, i) => ({ t: i, v: 1, pos: i * 100, hp: 1 })),
      without: [], activation: [], L: 0,
    };
    const d = domainOf(linear); // distMax 600, tMax 6
    const bands = timePhaseBands(linear, box, d);
    expect(bands).toHaveLength(4);
    expect(bands[1]!.x).toBeCloseTo(20, 5);  // 1/6 dist (100m) → t=1
    expect(bands[2]!.x).toBeCloseTo(80, 5);  // 2/3 dist (400m) → t=4
    expect(bands[3]!.x).toBeCloseTo(100, 5); // 5/6 dist (500m) → t=5
  });
});

const f = (pos: number, v: number, hp: number) => ({ t: 0, pos, v, hp });

describe('distance-axis overlay geometry', () => {
  const box = { w: 100, h: 50 };
  it('velocityHpDomain takes the max across both runners', () => {
    expect(velocityHpDomain([f(0, 10, 100)], [f(0, 20, 50)])).toEqual({ vMax: 20, hpMax: 100 });
  });
  it('posPoints maps pos→x and inverts the picked value', () => {
    const pts = posPoints([f(600, 20, 0)], box, 1200, (fr) => fr.v, 20);
    expect(pts[0]).toEqual({ x: 50, y: 0 }); // half distance → x50; v at max → y0 (top)
  });
  it('activationZonesByPos maps start/width with a 1px floor', () => {
    expect(activationZonesByPos([{ start: 600, end: 600 }], box, 1200)).toEqual([{ x: 50, w: 1 }]);
  });
  it('gap maps to a zero-centred band, + up', () => {
    const mag = gapMagnitude([{ bashin: 2 }, { bashin: -1 }]);
    expect(mag).toBe(2);
    const pts = gapPoints([{ pos: 0, bashin: 2 }, { pos: 1200, bashin: -2 }], box, 1200, mag);
    expect(pts[0]).toEqual({ x: 0, y: 0 });   // +2 (== mag) → top
    expect(pts[1]).toEqual({ x: 100, y: 50 }); // -2 → bottom
  });
});
