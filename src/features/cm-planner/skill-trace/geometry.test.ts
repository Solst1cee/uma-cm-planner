import { describe, it, expect } from 'vitest';
import {
  polyline, activationTimes,
  lAxisDomain, zeroLineY, gridLinesX, gridLinesY,
  impactByPosition, frequencyByPosition, binColumns, peakImpactPosition, activationCounts,
  distancePhaseBands, PHASE_FRACTIONS,
  velocityHpDomain, posPoints, gapMagnitude, gapPoints,
  velocityWindow, vtWindowPoints, timePhaseBandsWindowed,
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

  it('activationCounts = integer fire-count distribution over all runs (non-firing omitted)', () => {
    const xs: SkillImpactSample[] = [
      { horseLength: 1, positions: [800] },       // ×1
      { horseLength: 1, positions: [820] },       // ×1
      { horseLength: 2, positions: [400, 1100] }, // ×2
      { horseLength: 0, positions: [] },          // didn't fire → omitted
    ];
    expect(activationCounts(xs, 8)).toEqual([{ count: 1, pct: 25 }, { count: 2, pct: 12.5 }]);
  });

  it('peakImpactPosition = exact firing position + L of the highest-バ身 sample', () => {
    // max positive horseLength is 5 (fires at 100 & 800) → its first position, 100 m
    expect(peakImpactPosition(samples)).toEqual({ pos: 100, L: 5 });
  });

  it('peakImpactPosition is null when nothing activates with a positive gain', () => {
    expect(peakImpactPosition([{ horseLength: 0, positions: [100] }, { horseLength: -1, positions: [200] }])).toBeNull();
    expect(peakImpactPosition([])).toBeNull();
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
  it('gap maps to a zero-centred band, + up', () => {
    const mag = gapMagnitude([{ bashin: 2 }, { bashin: -1 }]);
    expect(mag).toBe(2);
    const pts = gapPoints([{ pos: 0, bashin: 2 }, { pos: 1200, bashin: -2 }], box, 1200, mag);
    expect(pts[0]).toEqual({ x: 0, y: 0 });   // +2 (== mag) → top
    expect(pts[1]).toEqual({ x: 100, y: 50 }); // -2 → bottom
  });
});

describe('geometry — windowed velocity (zoom + floor + convergence)', () => {
  // 30 s race; same build ± one skill. Skill fires pos 150–160 (t 15–16), bumping v 20 → 25,
  // then the two runners re-converge at t 17.
  const wrun: SkillTraceRun = {
    without: Array.from({ length: 31 }, (_, i) => ({ t: i, v: 20, pos: i * 10, hp: 100 })),
    withSkill: Array.from({ length: 31 }, (_, i) => ({ t: i, v: i >= 15 && i <= 16 ? 25 : 20, pos: i * 10, hp: 100 })),
    activation: [{ start: 150, end: 160 }],
    L: 1,
  };

  it('velocityWindow zooms ±10 s around the activation, floors y, finds the re-convergence', () => {
    const w = velocityWindow(wrun);
    expect(w.winStart).toBe(5);          // 15 − 10
    expect(w.winEnd).toBe(26);           // 16 + 10
    expect(w.vMin).toBe(18);             // floored, not 0
    expect(w.vMax).toBe(26);             // ceil(25) + 1
    expect(w.tStart).toBe(15);
    expect(w.convergenceT).toBe(17);     // first frame after the skill ends where with ≈ without
  });

  it('velocityWindow falls back to the whole race when the skill never fired', () => {
    const noAct: SkillTraceRun = { ...wrun, withSkill: wrun.without, activation: [] };
    const w = velocityWindow(noAct);
    expect(w.winStart).toBe(0);
    expect(w.winEnd).toBe(30);
    expect(w.tStart).toBeNull();
  });

  it('convergenceT falls through to winEnd when the runners never re-converge in the window', () => {
    // withSkill stays elevated (v=25) through the window end — no frame returns within eps of without.
    const noConverge: SkillTraceRun = {
      without: Array.from({ length: 31 }, (_, i) => ({ t: i, v: 20, pos: i * 10, hp: 100 })),
      withSkill: Array.from({ length: 31 }, (_, i) => ({ t: i, v: i >= 15 ? 25 : 20, pos: i * 10, hp: 100 })),
      activation: [{ start: 150, end: 160 }],
      L: 1,
    };
    const w = velocityWindow(noConverge);
    expect(w.convergenceT).toBe(w.winEnd);   // not trimmed early — the with-line runs to the window edge
    expect(w.winEnd).toBe(26);
  });

  it('vtWindowPoints maps the window to the box and can clip the with-skill line to the divergence', () => {
    const w = velocityWindow(wrun);
    const box = { w: 100, h: 50 };
    const base = vtWindowPoints(wrun.without, box, w);
    expect(base[0]!.x).toBe(0);                       // first in-window frame (t=5) → left edge
    expect(base[base.length - 1]!.x).toBeCloseTo(100, 5); // last (t=26) → right edge
    expect(base[0]!.y).toBeCloseTo(37.5, 5);          // v=20 in [18,26]: 50 − (2/8)*50
    const withClipped = vtWindowPoints(wrun.withSkill, box, w, { start: w.tStart!, end: w.convergenceT });
    expect(withClipped).toHaveLength(3);              // only t = 15, 16, 17
  });

  it('timePhaseBandsWindowed shows only the phases the window spans, with true phase indices', () => {
    const w = velocityWindow(wrun);
    const bands = timePhaseBandsWindowed(wrun, { w: 100, h: 50 }, w);
    expect(bands.map((b) => b.phase)).toEqual([1, 2, 3]); // window [5,26] skips Early (ends t5)
    expect(bands[0]!.x).toBeCloseTo(0, 5);
  });
});
