import type { SkillFrame, SkillTraceRun } from '@/sim';

export interface Pt { x: number; y: number; }
export interface Box { w: number; h: number; }
export interface Domain { tMax: number; vMax: number; distMax: number; }

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

/** L-vs-distance points: x = distance, y = L (inverted; zero baseline at box.h/2 handled by caller). */
export function gapPoints(curve: { dist: number; L: number }[], box: Box, d: Domain, lMax: number): Pt[] {
  const half = box.h / 2;
  return curve.map((c) => ({ x: scale(c.dist, d.distMax, box.w), y: half - (lMax > 0 ? (c.L / lMax) * half : 0) }));
}

/** Max absolute L on the gap curve (for symmetric y-scaling), min 0.1 to avoid divide-by-zero. */
export function maxAbsL(curve: { dist: number; L: number }[]): number {
  return Math.max(0.1, ...curve.map((c) => Math.abs(c.L)));
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
