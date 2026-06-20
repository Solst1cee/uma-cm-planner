import type { SkillFrame, SkillTraceRun, SkillImpactSample } from '@/sim';

export interface Pt { x: number; y: number; }
export interface Box { w: number; h: number; }
export interface Domain { tMax: number; vMax: number; distMax: number; }
/** A y-range; always includes 0. */
export interface LDomain { top: number; bottom: number; }
/** A phase background band in viewBox pixels (0=Early, 1=Mid, 2=Late, 3=Last spurt). */
export interface Band { x: number; w: number; phase: 0 | 1 | 2 | 3; }
/** A column (bar) in viewBox pixels; `neg` flags a downward (lost-ground) bar. */
export interface Col { x: number; y: number; w: number; h: number; neg?: boolean; }

/** Phase boundaries as fractions of course distance: Early|Mid 1/6, Mid|Late 2/3,
 *  Late|Last-spurt 5/6 — the §0 racetrack's four phases. */
export const PHASE_FRACTIONS = [1 / 6, 2 / 3, 5 / 6] as const;

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

/** Integer-L y-range for the length-impact chart (clean 1L gridlines); always includes 0. */
export function lAxisDomain(values: number[]): LDomain {
  const maxv = Math.max(0, ...values);
  const minv = Math.min(0, ...values);
  return { top: Math.max(1, Math.ceil(maxv)), bottom: minv < 0 ? Math.floor(minv) : 0 };
}

/** y-pixel of the value=0 baseline within [bottom, top] (where bars grow from). */
export function zeroLineY(box: Box, ld: LDomain): number {
  const span = ld.top - ld.bottom || 1;
  return box.h - ((0 - ld.bottom) / span) * box.h;
}

/** Vertical gridlines (+ values) at every `step` metres across [0, distance]. */
export function gridLinesX(distance: number, step: number, box: Box): { x: number; value: number }[] {
  const out: { x: number; value: number }[] = [];
  if (distance <= 0 || step <= 0) return out;
  for (let v = 0; v <= distance + 1e-6; v += step) out.push({ x: (v / distance) * box.w, value: v });
  return out;
}

/** Horizontal gridlines (+ values) at every `step` (y-domain units) across [bottom, top]. */
export function gridLinesY(ld: LDomain, step: number, box: Box): { y: number; value: number }[] {
  const out: { y: number; value: number }[] = [];
  const span = ld.top - ld.bottom || 1;
  if (step <= 0) return out;
  for (let v = Math.ceil(ld.bottom / step) * step; v <= ld.top + 1e-6; v += step) {
    out.push({ y: box.h - ((v - ld.bottom) / span) * box.h, value: Math.round(v * 1000) / 1000 });
  }
  return out;
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

/** How many times the skill fired per run, as a distribution over ALL runs — integer counts only
 *  (e.g. ×1 in 65% of runs, ×2 in 35%). Non-firing runs (count 0) are omitted; the percentages sum
 *  to the overall activation rate. Skills practically fire 1–2× (cooldown re-procs on later corners). */
export function activationCounts(samples: SkillImpactSample[], nsamples: number): { count: number; pct: number }[] {
  if (nsamples <= 0) return [];
  const byCount = new Map<number, number>();
  for (const s of samples) {
    const n = s.positions.length;
    if (n <= 0) continue;
    byCount.set(n, (byCount.get(n) ?? 0) + 1);
  }
  return [...byCount.entries()].sort((a, b) => a[0] - b[0]).map(([count, runs]) => ({ count, pct: (runs / nsamples) * 100 }));
}

/** The exact firing position (course metres) of the single highest-バ身 sample, plus that L — the
 *  run where this skill paid off most. Exact (not bin-quantised) so it lines up with the velocity
 *  chart's Best-run activation. Null when nothing activates with a positive gain. */
export function peakImpactPosition(samples: SkillImpactSample[]): { pos: number; L: number } | null {
  let best: { pos: number; L: number } | null = null;
  for (const s of samples) {
    if (s.horseLength <= 0) continue;
    const pos = s.positions[0]; // where it fired in that sample (first activation)
    if (pos === undefined) continue;
    if (best === null || s.horseLength > best.L) best = { pos: Math.round(pos), L: s.horseLength };
  }
  return best;
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

// --- Phase bands + activation overlay ---

/** Four phase bands along the distance axis (constant width fractions). */
export function distancePhaseBands(box: Box): Band[] {
  return bandsFromEdges([0, ...PHASE_FRACTIONS.map((f) => f * box.w), box.w]);
}

/** Four phase bands along the TIME axis — phase boundaries are distances, mapped to times
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
    bands.push({ x: x0, w: Math.max(0, x1 - x0), phase: i as 0 | 1 | 2 | 3 });
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

// --- Windowed velocity-vs-time (utools / kachi-uma-tools VelocityChart style): zoom the x-axis to
//     the skill activation, floor the y-axis (don't start at 0), and trim the with-skill line where
//     the two runners re-converge. Our two runners are the same build ± the one skill (runner 0 =
//     without, runner 1 = with), so the lines genuinely re-converge after the skill ends. ---

/** ±s padding around the activation window; m/s y-floor; m/s re-convergence epsilon (kachi defaults). */
export const V_WINDOW_PAD = 10;
export const V_FLOOR = 18;
const V_CONVERGE_EPS = 0.02;

export interface VWindow {
  winStart: number; winEnd: number; // visible time window (s)
  vMin: number; vMax: number;       // velocity y-range (floored — not 0-based)
  tStart: number | null;            // activation start time (where the with-skill line begins); null = skill never fired
  convergenceT: number;             // time the two runners re-converge after the skill (≤ winEnd)
}

/** Zoom window + floored y-range + convergence time for the velocity chart. Falls back to the whole
 *  race (no trim) when the tracked skill never fired in this representative run. */
export function velocityWindow(run: SkillTraceRun): VWindow {
  const all = [...run.withSkill, ...run.without];
  const tMaxAll = Math.max(1, ...all.map((f) => f.t));
  const vMaxRace = Math.max(1, ...all.map((f) => f.v));
  const vMax = Math.max(V_FLOOR, Math.ceil(vMaxRace) + 1);
  const acts = activationTimes(run);
  if (acts.length === 0) {
    const vMinRace = all.length ? Math.min(...all.map((f) => f.v)) : 0;
    return { winStart: 0, winEnd: tMaxAll, vMin: Math.min(V_FLOOR, vMinRace), vMax, tStart: null, convergenceT: tMaxAll };
  }
  const { tStart, tEnd } = acts[0]!;
  const winStart = Math.max(0, tStart - V_WINDOW_PAD);
  const winEnd = Math.min(tMaxAll, tEnd + V_WINDOW_PAD);
  const inWin = all.filter((f) => f.t >= winStart && f.t <= winEnd).map((f) => f.v);
  const vMinWin = inWin.length ? Math.min(...inWin) : 0;
  // First frame after the skill ends where with ≈ without (re-converged) — both runners share frame
  // indices (same sim), so compare by index.
  let convergenceT = winEnd;
  const n = Math.min(run.withSkill.length, run.without.length);
  for (let i = 0; i < n; i++) {
    const fw = run.withSkill[i]!, fo = run.without[i]!;
    if (fw.t >= tEnd && Math.abs(fw.v - fo.v) <= V_CONVERGE_EPS) { convergenceT = Math.min(winEnd, fw.t); break; }
  }
  return { winStart, winEnd, vMin: Math.min(V_FLOOR, vMinWin), vMax, tStart, convergenceT };
}

/** Velocity points inside the window, mapped with the floored y-range. Optionally clip to [start, end]
 *  seconds — used to trim the with-skill line to [activation start, convergence]. */
export function vtWindowPoints(frames: SkillFrame[], box: Box, w: VWindow, clip?: { start?: number; end?: number }): Pt[] {
  const tspan = (w.winEnd - w.winStart) || 1;
  const vspan = (w.vMax - w.vMin) || 1;
  const lo = Math.max(w.winStart, clip?.start ?? w.winStart);
  const hi = Math.min(w.winEnd, clip?.end ?? w.winEnd);
  return frames
    .filter((f) => f.t >= lo && f.t <= hi)
    .map((f) => ({ x: ((f.t - w.winStart) / tspan) * box.w, y: box.h - ((f.v - w.vMin) / vspan) * box.h }));
}

/** Four phase bands mapped onto the zoomed time window and clipped to it — only the phases the
 *  window actually spans appear (with their true phase index, so labels stay correct). */
export function timePhaseBandsWindowed(run: SkillTraceRun, box: Box, w: VWindow): Band[] {
  const distMax = Math.max(1, ...[...run.withSkill, ...run.without].map((f) => f.pos));
  const edges = [0, ...PHASE_FRACTIONS.map((f) => timeAtPosition(run.withSkill, f * distMax)), Infinity];
  const tspan = (w.winEnd - w.winStart) || 1;
  const bands: Band[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const t0 = Math.max(w.winStart, edges[i] ?? 0);
    const t1 = Math.min(w.winEnd, edges[i + 1] ?? w.winEnd);
    if (t1 <= t0) continue;
    bands.push({ x: ((t0 - w.winStart) / tspan) * box.w, w: ((t1 - t0) / tspan) * box.w, phase: i as 0 | 1 | 2 | 3 });
  }
  return bands;
}
