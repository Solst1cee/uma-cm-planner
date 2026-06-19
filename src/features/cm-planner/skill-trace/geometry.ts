import type { SkillFrame, SkillTraceRun, SkillImpactSample } from '@/sim';

export interface Pt { x: number; y: number; }
export interface Box { w: number; h: number; }
export interface Domain { tMax: number; vMax: number; distMax: number; }
/** Nice-rounded y-range; always includes 0. */
export interface LDomain { top: number; bottom: number; }
/** A phase background band in viewBox pixels (phase 0=Early, 1=Mid, 2=Late). */
export interface Band { x: number; w: number; phase: 0 | 1 | 2; }
/** A column (bar) in viewBox pixels; `neg` flags a downward (lost-ground) bar. */
export interface Col { x: number; y: number; w: number; h: number; neg?: boolean; }

/** Race phase boundaries as fractions of course distance (Early|Mid at 1/6, Mid|Late at 2/3). */
export const PHASE_FRACTIONS = [1 / 6, 2 / 3] as const;

/** The course distances (metres) at the Early→Mid and Mid→Late transitions. */
export function phaseBoundaryDistances(distance: number): number[] {
  return PHASE_FRACTIONS.map((f) => f * distance);
}

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

/** Round up to a "nice" axis ceiling (1-2-5 × 10^k). x<=0 → 0.5. */
export function niceCeil(x: number): number {
  if (x <= 0) return 0.5;
  const exp = Math.floor(Math.log10(x));
  const pow = 10 ** exp;
  const base = x / pow;
  const niceBase = base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10;
  return niceBase * pow;
}

/** Auto, nice-rounded y-range for a set of values. Always includes 0 (bars read off a 0
 *  baseline); negative values get a nice-rounded floor. */
export function niceDomain(values: number[]): LDomain {
  const maxv = Math.max(0, ...values);
  const minv = Math.min(0, ...values);
  return { top: niceCeil(maxv), bottom: minv < 0 ? -niceCeil(-minv) : 0 };
}

/** y-pixel of the value=0 baseline within [bottom, top] (where bars grow from). */
export function zeroLineY(box: Box, ld: LDomain): number {
  const span = ld.top - ld.bottom || 1;
  return box.h - ((0 - ld.bottom) / span) * box.h;
}

// --- Position-resolved charts (from N Monte-Carlo samples) ---

function binCount(distance: number, binMeters: number): number {
  return Math.max(1, Math.ceil(distance / binMeters));
}
function binIndex(pos: number, distance: number, nBins: number): number {
  if (pos < 0 || distance <= 0) return -1;
  return Math.min(nBins - 1, Math.floor((pos / distance) * nBins));
}

/** Max バ身 gained among the samples that activate in each position bin (umalator's "Length
 *  Difference Impact"). Filters to positive gains; bins span [0, distance) by `binMeters`. */
export function impactByPosition(samples: SkillImpactSample[], distance: number, binMeters = 20): number[] {
  const n = binCount(distance, binMeters);
  const out = new Array<number>(n).fill(0);
  for (const s of samples) {
    if (s.horseLength <= 0) continue;
    for (const p of s.positions) {
      const b = binIndex(p, distance, n);
      if (b >= 0) out[b] = Math.max(out[b] ?? 0, s.horseLength);
    }
  }
  return out;
}

/** % of all runs whose tracked skill activates in each position bin (発動率 by position). */
export function frequencyByPosition(
  samples: SkillImpactSample[], nsamples: number, distance: number, binMeters = 20,
): number[] {
  const n = binCount(distance, binMeters);
  const count = new Array<number>(n).fill(0);
  if (nsamples <= 0) return count;
  for (const s of samples) {
    const seen = new Set<number>();
    for (const p of s.positions) {
      const b = binIndex(p, distance, n);
      if (b >= 0 && !seen.has(b)) { seen.add(b); count[b] = (count[b] ?? 0) + 1; }
    }
  }
  return count.map((c) => (c / nsamples) * 100);
}

/** Bars from a per-bin value array across the full width; skip zero bins. */
export function binColumns(values: number[], box: Box, ld: LDomain): Col[] {
  const zeroY = zeroLineY(box, ld);
  const span = ld.top - ld.bottom || 1;
  const colW = values.length ? box.w / values.length : box.w;
  const cols: Col[] = [];
  values.forEach((v, i) => {
    if (v === 0) return;
    const yV = box.h - ((v - ld.bottom) / span) * box.h;
    cols.push({ x: i * colW, y: Math.min(zeroY, yV), w: Math.max(0.5, colW - 0.4), h: Math.abs(yV - zeroY), neg: v < 0 });
  });
  return cols;
}

// --- Phase bands + activation overlay (for the velocity-vs-time chart) ---

/** Three phase bands along the distance axis (constant width fractions). */
export function distancePhaseBands(box: Box): Band[] {
  return bandsFromEdges([0, ...PHASE_FRACTIONS.map((f) => f * box.w), box.w]);
}

/** Three phase bands along the TIME axis — phase boundaries are distances, mapped to times
 *  via the with-skill run (so the bands line up with where each phase happens in time). */
export function timePhaseBands(run: SkillTraceRun, box: Box, d: Domain): Band[] {
  const edges = [
    0,
    ...PHASE_FRACTIONS.map((f) => scale(timeAtPosition(run.withSkill, f * d.distMax), d.tMax, box.w)),
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
