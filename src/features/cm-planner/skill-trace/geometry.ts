import type { SkillFrame, SkillTraceRun } from '@/sim';

export interface Pt { x: number; y: number; }
export interface Box { w: number; h: number; }
export interface Domain { tMax: number; vMax: number; distMax: number; }
/** Nice-rounded y-range for the L curve; always includes 0. */
export interface LDomain { top: number; bottom: number; }
/** A phase background band in viewBox pixels (phase 0=Early, 1=Mid, 2=Late). */
export interface Band { x: number; w: number; phase: 0 | 1 | 2; }

/** Race phase boundaries as fractions of course distance (Early | Mid | Late). */
const PHASE_BOUNDS = [1 / 6, 2 / 3];

/** SVG points attribute: "x,y x,y ..." (rounded to 2dp to keep the DOM small). */
export function polyline(points: Pt[]): string {
  return points.map((p) => `${round(p.x)},${round(p.y)}`).join(' ');
}
function round(n: number): number { return Math.round(n * 100) / 100; }

function scale(value: number, domainMax: number, range: number): number {
  if (domainMax <= 0) return 0;
  return (value / domainMax) * range;
}

/** Axis domains for a run (max time, max velocity across both lines, max distance). */
export function domainOf(run: SkillTraceRun): Domain {
  const all = [...run.withSkill, ...run.without];
  const tMax = Math.max(1, ...all.map((f) => f.t));
  const vMax = Math.max(1, ...all.map((f) => f.v));
  const distMax = Math.max(1, ...all.map((f) => f.pos));
  return { tMax, vMax, distMax };
}

/** Velocity-vs-time: x = t, y = v (inverted so up = faster). */
export function vtPoints(frames: SkillFrame[], box: Box, d: Domain): Pt[] {
  return frames.map((f) => ({ x: scale(f.t, d.tMax, box.w), y: box.h - scale(f.v, d.vMax, box.h) }));
}

/** Bashin lead the skill buys, sampled per frame: (posWith - posWithout)/2.5 vs distance. */
export function gapCurve(run: SkillTraceRun): { dist: number; L: number }[] {
  const a = run.without, b = run.withSkill;
  const n = Math.min(a.length, b.length);
  const out: { dist: number; L: number }[] = [];
  for (let i = 0; i < n; i++) {
    const bi = b[i], ai = a[i];
    if (!bi || !ai) continue;
    // x = the with-skill runner's distance (it's ahead); y = バ身 lead = (posWith - posWithout) / 2.5.
    out.push({ dist: bi.pos, L: (bi.pos - ai.pos) / 2.5 });
  }
  return out;
}

/** Round up to a "nice" axis ceiling (1-2-5 × 10^k). x<=0 → 0.5. */
export function niceCeil(x: number): number {
  if (x <= 0) return 0.5;
  const exp = Math.floor(Math.log10(x));
  const pow = 10 ** exp;
  const base = x / pow;
  const niceBase = base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10;
  return niceBase * pow;
}

/** Auto, nice-rounded y-range for the L curve. Always includes 0 (gains read off a 0 baseline);
 *  negative dips get a nice-rounded floor. */
export function lDomain(curve: { dist: number; L: number }[]): LDomain {
  const ls = curve.map((c) => c.L);
  const maxL = Math.max(0, ...ls);
  const minL = Math.min(0, ...ls);
  return { top: niceCeil(maxL), bottom: minL < 0 ? -niceCeil(-minL) : 0 };
}

/** L-vs-distance points mapped over [bottom, top]: bottom→y=box.h, top→y=0. */
export function gapPoints(curve: { dist: number; L: number }[], box: Box, d: Domain, ld: LDomain): Pt[] {
  const span = ld.top - ld.bottom || 1;
  return curve.map((c) => ({ x: scale(c.dist, d.distMax, box.w), y: box.h - ((c.L - ld.bottom) / span) * box.h }));
}

/** y-pixel of the L=0 baseline within [bottom, top] (where the gain curve starts from). */
export function zeroLineY(box: Box, ld: LDomain): number {
  const span = ld.top - ld.bottom || 1;
  return box.h - ((0 - ld.bottom) / span) * box.h;
}

/** Three phase bands along the distance axis (constant width fractions). */
export function distancePhaseBands(box: Box): Band[] {
  return bandsFromEdges([0, ...PHASE_BOUNDS.map((f) => f * box.w), box.w]);
}

/** Three phase bands along the TIME axis — phase boundaries are distances, mapped to times
 *  via the with-skill run (so the bands line up with where each phase actually happens in time). */
export function timePhaseBands(run: SkillTraceRun, box: Box, d: Domain): Band[] {
  const edges = [
    0,
    ...PHASE_BOUNDS.map((f) => scale(timeAtPosition(run.withSkill, f * d.distMax), d.tMax, box.w)),
    box.w,
  ];
  return bandsFromEdges(edges);
}

function bandsFromEdges(edges: number[]): Band[] {
  const bands: Band[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const x0 = edges[i] ?? 0, x1 = edges[i + 1] ?? x0;
    bands.push({ x: x0, w: Math.max(0, x1 - x0), phase: i as 0 | 1 | 2 });
  }
  return bands;
}

/** Map each activation region's start/end position to the with-skill timeline (for v-t shading). */
export function activationTimes(run: SkillTraceRun): { tStart: number; tEnd: number }[] {
  return run.activation.map(({ start, end }) => ({
    tStart: timeAtPosition(run.withSkill, start),
    tEnd: timeAtPosition(run.withSkill, end),
  }));
}
function timeAtPosition(frames: SkillFrame[], pos: number): number {
  for (const f of frames) if (f.pos >= pos) return f.t;
  const last = frames[frames.length - 1];
  return last ? last.t : 0;
}
