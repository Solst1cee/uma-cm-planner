# M4 Skill-detail graphs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add velocity-vs-time + L-vs-distance curves and a button-gated activation rate (発動率) inside `SkillDetailDisclosure`, simulated per-call-site against the caller's build + course, using the per-frame trace the vendored umalator engine already computes.

**Architecture:** Two new engine wrappers expose data we currently discard — `runSkillTrace` (from `runComparison`'s `runData` per-frame trace) and `skillActivationRate` (from `runSkillComparison`'s `skillActivations` count). A worker request kind + `SimClient` method per wrapper. A run-on-demand `useSkillTrace` hook (mirrors `useUmaChart`) feeds pure hand-rolled SVG charts. `SkillDetailDisclosure` gains an optional `traceContext` prop and controlled-open props; the sidebar passes the player's plan build, the uma chart passes the fixed reference build and enforces one-open-at-a-time.

**Tech Stack:** TypeScript, React 19, Vitest (jsdom + node env), hand-rolled SVG (no chart library), vendored umalator engine v0.14.2 via Web Worker.

## Global Constraints

- Engine is **lazy**: reach it only via `@/sim/client` (the `SimClient` worker) or lazy imports — never the `@/sim` barrel in UI modules (the barrel pulls the ~5 MB bundle synchronously).
- Never sim a zero-speed build: every engine wrapper guards `build.stats.spd > 0` (the `firstPositionInLateRace` throw) and `skillsService.isSimulatable(skillId)`.
- `noUncheckedIndexedAccess` is on — array indexing yields `T | undefined`; guard or coalesce, do not assume.
- `1 バ身 (horse length) = 2.5 m`.
- Honest numbers (P3): label curves as a single representative run; always show the rate alongside.
- Test-flake guard: do NOT run `pnpm dev` during tests; trust `pnpm build` / `pnpm typecheck`; re-run a failing UI test file once before treating it as real (the React-null HMR race).
- Spec: `docs/superpowers/specs/2026-06-17-m4-skill-detail-graphs-design.md`.

---

## File structure

| File | Responsibility |
|---|---|
| `src/sim/vendor/umalator.bundle.d.mts` (modify) | Type the engine's `runData` trace (`SimulationRun`) + `skillActivations` arrays. |
| `src/sim/types.ts` (modify) | `SkillFrame`/`SkillTraceRun`/`SkillTrace`/`SkillRate`/`RunChoice` + worker request/response members. |
| `src/sim/run.ts` (modify) | `runSkillTrace` + `skillActivationRate` wrappers. |
| `src/sim/engine.worker.ts` (modify) | Dispatch the two new request kinds. |
| `src/sim/client.ts` (modify) | `skillTrace` / `skillRate` client methods. |
| `src/features/cm-planner/skill-trace/geometry.ts` (new) | Pure data→SVG geometry (scaling, polyline, gap curve, activation→time). |
| `src/features/cm-planner/skill-trace/SkillTraceCharts.tsx` (new) | `VelocityTimeChart`, `LengthDistanceChart`, `ActivationRateBadge`, `RunChoiceToggle`. |
| `src/features/cm-planner/skill-trace/skill-trace.css` (new) | Chart styling (matches `cmp-plan-card` grammar). |
| `src/features/cm-planner/useSkillTrace.ts` (new) | Run-on-demand hook: auto curves, button-gated rate, run-choice switch. |
| `src/features/cm-planner/SkillTraceSection.tsx` (new) | Glue: hook + charts; mounted only when expanded + context present. |
| `src/features/cm-planner/SkillDetailDisclosure.tsx` (modify) | `traceContext` prop + controlled-open props; render the section. |
| `src/features/cm-planner/UmaChartPanel.tsx` (modify) | Accordion (one open) + per-row reference `traceContext`. |
| `src/features/cm-planner/PlannerSidebar.tsx` (modify) | Plan-build `traceContext` on unique + wishlist disclosures. |
| `src/core/rankUmaChart.ts` (modify) | Export `referenceBuild` for the chart's `traceContext`. |

---

### Task 1: Engine — `runSkillTrace` + trace types

**Files:**
- Modify: `src/sim/vendor/umalator.bundle.d.mts` (add `SimulationRun`/`ActivationLog`; type `CompareResult.runData`)
- Modify: `src/sim/types.ts` (add `SkillFrame`/`SkillTraceRun`/`SkillTrace`/`RunChoice`)
- Modify: `src/sim/run.ts` (add `runSkillTrace`)
- Test: `src/sim/run.test.ts`

**Interfaces:**
- Consumes: `runComparison` (engine), `toRunnerState`/`toRaceDef`/`resolveCourse` (adapter), `_mean`/`_median` (run.ts private helpers).
- Produces: `runSkillTrace(build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed?: number): SkillTrace` and the `SkillTrace`/`SkillTraceRun`/`SkillFrame`/`RunChoice` types.

- [ ] **Step 1: Widen the engine `.d.mts` to type the trace**

In `src/sim/vendor/umalator.bundle.d.mts`, add these interfaces just above `export interface CompareResult` (around line 66):

```ts
/** One recorded skill activation in a run (positions are course metres). */
export interface ActivationLog {
  skillId: string;
  start: number;
  end: number;
  [key: string]: unknown;
}
/** A full per-frame run trace. Each tuple is [runnerA, runnerB]. */
export interface SimulationRun {
  time: [number[], number[]];
  position: [number[], number[]];
  velocity: [number[], number[]];
  hp: [number[], number[]];
  skillActivations: [Record<string, ActivationLog[]>, Record<string, ActivationLog[]>];
  [key: string]: unknown;
}
export interface RunDataBundle {
  minrun: SimulationRun;
  maxrun: SimulationRun;
  meanrun: SimulationRun;
  medianrun: SimulationRun;
}
```

Then change `CompareResult.runData` from `unknown` to `RunDataBundle`, and change `SkillComparisonResult.skillActivations` from `Record<string, unknown>` to `Record<string, unknown[]>` (so `.length` is available for the rate in Task 2):

```ts
export interface SkillComparisonResult {
  results: number[];
  skillActivations: Record<string, unknown[]>;
  runData: unknown;
  min: number; max: number; mean: number; median: number;
}
export interface CompareResult {
  results: number[];
  runData: RunDataBundle;
  rushedStats: unknown;
  leadCompetitionStats: unknown;
  spurtInfo: null;
  staminaStats: { uma1: { staminaSurvivalRate: number; fullSpurtRate: number }; uma2: { staminaSurvivalRate: number; fullSpurtRate: number } };
  firstUmaStats: { uma1: { firstPlaceRate: number }; uma2: { firstPlaceRate: number } };
}
```

- [ ] **Step 2: Add trace types to `src/sim/types.ts`**

Append after `BashinStats` (around line 42):

```ts
/** Which representative run (by bashin L) the charts read. */
export type RunChoice = 'min' | 'max' | 'mean' | 'median';

/** One per-frame sample of a run. */
export interface SkillFrame {
  t: number;    // seconds
  v: number;    // m/s
  pos: number;  // course metres
  hp: number;
}

/** A single representative run mapped to clean arrays. */
export interface SkillTraceRun {
  withSkill: SkillFrame[];
  without: SkillFrame[];
  activation: { start: number; end: number }[]; // tracked-skill regions, course metres
  L: number;                                     // bashin for this run
}

/** The four representative runs + summary; min/max/mean/median come back in one sim. */
export interface SkillTrace {
  runs: Record<RunChoice, SkillTraceRun>;
  meanL: number;
  nsamples: number;
}
```

- [ ] **Step 3: Write the failing test for `runSkillTrace`**

Append to `src/sim/run.test.ts`:

```ts
import { runSkillTrace } from './run';

describe('runSkillTrace', () => {
  it('returns per-frame with/without traces and a finite L', () => {
    const t = runSkillTrace(build, { courseId: '10101' }, '200332', 20, 42);
    expect(t.nsamples).toBe(20);
    expect(t.runs.median.withSkill.length).toBeGreaterThan(0);
    expect(t.runs.median.without.length).toBeGreaterThan(0);
    const f = t.runs.median.withSkill[0]!;
    expect(Number.isFinite(f.t)).toBe(true);
    expect(Number.isFinite(f.v)).toBe(true);
    expect(Number.isFinite(t.meanL)).toBe(true);
  });

  it('is empty (no throw) for a non-simulatable skill', () => {
    const t = runSkillTrace(build, { courseId: '10101' }, '000000', 10, 1);
    expect(t.nsamples).toBe(0);
    expect(t.runs.median.withSkill).toHaveLength(0);
  });

  it('is empty for a zero-speed build (guards firstPositionInLateRace)', () => {
    const zero = { ...build, stats: { ...build.stats, spd: 0 } };
    const t = runSkillTrace(zero, { courseId: '10101' }, '200332', 10, 1);
    expect(t.nsamples).toBe(0);
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm vitest run src/sim/run.test.ts -t runSkillTrace`
Expected: FAIL — `runSkillTrace` is not exported.

- [ ] **Step 5: Implement `runSkillTrace`**

In `src/sim/run.ts`, extend the engine import on line 1 and the type import on line 3, then add the helpers + function. First update imports:

```ts
import { runSkillComparison, skillsService, runComparison, runPlannerComparison } from '@/sim/vendor/umalator.bundle.mjs';
import type { SimulationRun } from '@/sim/vendor/umalator.bundle.mjs';
import { toRunnerState, toRaceDef, resolveCourse, bashinStatsFrom } from './adapter';
import type { SimBuild, SimRaceParams, BashinStats, VacuumResult, SkillTrace, SkillTraceRun, SkillFrame } from './types';
```

Add before the closing `_mean`/`_median` helpers:

```ts
function emptyRun(): SkillTraceRun {
  return { withSkill: [], without: [], activation: [], L: 0 };
}
const EMPTY_TRACE: SkillTrace = {
  runs: { min: emptyRun(), max: emptyRun(), mean: emptyRun(), median: emptyRun() },
  meanL: 0,
  nsamples: 0,
};

function zipFrames(run: SimulationRun, runner: 0 | 1): SkillFrame[] {
  const t = run.time[runner], v = run.velocity[runner], pos = run.position[runner], hp = run.hp[runner];
  const n = Math.min(t.length, v.length, pos.length, hp.length);
  const out: SkillFrame[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ t: t[i] ?? 0, v: v[i] ?? 0, pos: pos[i] ?? 0, hp: hp[i] ?? 0 });
  }
  return out;
}

function activationRegions(run: SimulationRun, skillId: string): { start: number; end: number }[] {
  const logs = run.skillActivations[1]?.[skillId] ?? [];
  return logs.map((l) => ({ start: l.start, end: l.end }));
}

function mapRun(run: SimulationRun, skillId: string, L: number): SkillTraceRun {
  return { withSkill: zipFrames(run, 1), without: zipFrames(run, 0), activation: activationRegions(run, skillId), L };
}

/** Per-frame with-vs-without trace for adding `skillId` to `build` (curves + activation zones). */
export function runSkillTrace(
  build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed = 0,
): SkillTrace {
  if (nsamples < 1 || build.stats.spd <= 0) return EMPTY_TRACE;
  if (!skillsService.isSimulatable(skillId)) return EMPTY_TRACE;
  const r = runComparison({
    nsamples,
    course: resolveCourse(race.courseId),
    racedef: toRaceDef(race),
    uma1: toRunnerState(build),
    uma2: toRunnerState({ ...build, skills: [...build.skills, skillId] }),
    options: { seed, ignoreStaminaConsumption: false },
  });
  const results = r.results; // engine returns these sorted ascending
  const min = results[0] ?? 0;
  const max = results[results.length - 1] ?? 0;
  return {
    runs: {
      min: mapRun(r.runData.minrun, skillId, min),
      max: mapRun(r.runData.maxrun, skillId, max),
      mean: mapRun(r.runData.meanrun, skillId, _mean(results)),
      median: mapRun(r.runData.medianrun, skillId, _median(results)),
    },
    meanL: _mean(results),
    nsamples: results.length,
  };
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm vitest run src/sim/run.test.ts -t runSkillTrace`
Expected: PASS (3 tests).

- [ ] **Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/sim/vendor/umalator.bundle.d.mts src/sim/types.ts src/sim/run.ts src/sim/run.test.ts
git commit -m "feat(sim): runSkillTrace — expose per-frame with/without trace from runComparison"
```

---

### Task 2: Engine — `skillActivationRate`

**Files:**
- Modify: `src/sim/types.ts` (add `SkillRate`)
- Modify: `src/sim/run.ts` (add `skillActivationRate`)
- Test: `src/sim/run.test.ts`

**Interfaces:**
- Consumes: `runSkillComparison` (engine), adapter helpers.
- Produces: `skillActivationRate(build, race, skillId, nsamples, seed?): SkillRate` and `SkillRate`.

- [ ] **Step 1: Add `SkillRate` to `src/sim/types.ts`**

After `SkillTrace`:

```ts
/** Fraction of sampled runs in which the tracked skill actually procs (発動率). */
export interface SkillRate {
  rate: number;     // 0..1
  nsamples: number;
}
```

- [ ] **Step 2: Write the failing test**

Append to `src/sim/run.test.ts`:

```ts
import { skillActivationRate } from './run';

describe('skillActivationRate', () => {
  it('returns a rate in [0,1] over nsamples for a real skill', () => {
    const r = skillActivationRate(build, { courseId: '10101' }, '200332', 50, 5);
    expect(r.nsamples).toBe(50);
    expect(r.rate).toBeGreaterThanOrEqual(0);
    expect(r.rate).toBeLessThanOrEqual(1);
  });

  it('returns rate 0 / nsamples 0 for a non-simulatable skill', () => {
    const r = skillActivationRate(build, { courseId: '10101' }, '000000', 20, 1);
    expect(r).toEqual({ rate: 0, nsamples: 0 });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run src/sim/run.test.ts -t skillActivationRate`
Expected: FAIL — not exported.

- [ ] **Step 4: Implement `skillActivationRate`**

Add `SkillRate` to the type import in `src/sim/run.ts` (line 3), then add:

```ts
/** Activation rate (発動率): fraction of samples in which `skillId` procs. */
export function skillActivationRate(
  build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed = 0,
): SkillRate {
  if (nsamples < 1 || build.stats.spd <= 0) return { rate: 0, nsamples: 0 };
  if (!skillsService.isSimulatable(skillId)) return { rate: 0, nsamples: 0 };
  const r = runSkillComparison({
    trackedSkillId: skillId,
    nsamples,
    course: resolveCourse(race.courseId),
    racedef: toRaceDef(race),
    runnerA: toRunnerState(build),
    runnerB: toRunnerState({ ...build, skills: [...build.skills, skillId] }),
    options: { seed, ignoreStaminaConsumption: false },
  });
  const activations = r.skillActivations[skillId]?.length ?? 0;
  const rate = Math.min(1, Math.max(0, activations / nsamples));
  return { rate, nsamples };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/sim/run.test.ts -t skillActivationRate`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/sim/types.ts src/sim/run.ts src/sim/run.test.ts
git commit -m "feat(sim): skillActivationRate — 発動率 from runSkillComparison sample count"
```

---

### Task 3: Worker + client wiring

**Files:**
- Modify: `src/sim/types.ts` (request/response union members)
- Modify: `src/sim/engine.worker.ts` (dispatch)
- Modify: `src/sim/client.ts` (methods)
- Test: `src/sim/worker-core.test.ts`

**Interfaces:**
- Consumes: `runSkillTrace`/`skillActivationRate` (Tasks 1–2), `handleSimRequest`.
- Produces: `SimClient.skillTrace(build, race, skillId, nsamples, seed?): Promise<SkillTrace>` and `SimClient.skillRate(...): Promise<SkillRate>`.

- [ ] **Step 1: Extend the request/response unions in `src/sim/types.ts`**

Add two members to `SimRequest` (after the `planner` member):

```ts
  | { id: number; kind: 'skillTrace'; build: SimBuild; race: SimRaceParams; skillId: string; nsamples: number; seed?: number }
  | { id: number; kind: 'skillRate'; build: SimBuild; race: SimRaceParams; skillId: string; nsamples: number; seed?: number };
```

Add two members to `SimResponse` (after the `vacuum` ok member):

```ts
  | { id: number; ok: true; kind: 'skillTrace'; trace: SkillTrace }
  | { id: number; ok: true; kind: 'skillRate'; rate: SkillRate }
```

- [ ] **Step 2: Write the failing test**

Append to `src/sim/worker-core.test.ts` (node env; follow the file's existing import/build style):

```ts
import { runSkillTrace, skillActivationRate } from './run';

describe('handleSimRequest — skillTrace / skillRate', () => {
  const b = {
    umaId: '', stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
    strategy: 'pace' as const, aptitudes: { distance: 'A' as const, surface: 'A' as const, strategy: 'A' as const }, skills: [],
  };
  it('dispatches skillTrace', () => {
    const res = handleSimRequest({ id: 1, kind: 'skillTrace', build: b, race: { courseId: '10101' }, skillId: '200332', nsamples: 10, seed: 1 });
    expect(res.ok).toBe(true);
    if (res.ok && res.kind === 'skillTrace') expect(res.trace.nsamples).toBe(10);
  });
  it('dispatches skillRate', () => {
    const res = handleSimRequest({ id: 2, kind: 'skillRate', build: b, race: { courseId: '10101' }, skillId: '200332', nsamples: 10, seed: 1 });
    expect(res.ok).toBe(true);
    if (res.ok && res.kind === 'skillRate') expect(res.rate.nsamples).toBe(10);
  });
});
```

> If `worker-core.test.ts` does not already import `handleSimRequest`, add `import { handleSimRequest } from './engine.worker';` at the top.

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run src/sim/worker-core.test.ts -t "skillTrace / skillRate"`
Expected: FAIL — `handleSimRequest` does not handle the new kinds (TS narrowing / missing cases).

- [ ] **Step 4: Implement the dispatch**

In `src/sim/engine.worker.ts`, extend the import on line 1 and add two cases in the switch:

```ts
import { evalSkillDelta, runVacuumCompare, runPlannerCompare, runSkillTrace, skillActivationRate } from './run';
```

```ts
      case 'skillTrace':
        return { id: req.id, ok: true, kind: 'skillTrace', trace: runSkillTrace(req.build, req.race, req.skillId, req.nsamples, req.seed) };
      case 'skillRate':
        return { id: req.id, ok: true, kind: 'skillRate', rate: skillActivationRate(req.build, req.race, req.skillId, req.nsamples, req.seed) };
```

- [ ] **Step 5: Add the client methods**

In `src/sim/client.ts`, extend the type import on line 2 and add two methods before `dispose()`:

```ts
import type { SimBuild, SimRaceParams, SimRequest, SimResponse, BashinStats, VacuumResult, SkillTrace, SkillRate } from './types';
```

```ts
  async skillTrace(build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed?: number): Promise<SkillTrace> {
    const id = ++this.seq;
    const res = await this.send({ id, kind: 'skillTrace', build, race, skillId, nsamples, seed });
    if (!res.ok) throw new Error(res.error);
    return res.trace as SkillTrace;
  }

  async skillRate(build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed?: number): Promise<SkillRate> {
    const id = ++this.seq;
    const res = await this.send({ id, kind: 'skillRate', build, race, skillId, nsamples, seed });
    if (!res.ok) throw new Error(res.error);
    return res.rate as SkillRate;
  }
```

- [ ] **Step 6: Export the new types from the `@/sim` barrel**

Confirm `src/sim/index.ts` re-exports the `types.ts` types (it already exports `SimBuild`/`BashinStats`). If it uses an explicit list, add `SkillTrace`, `SkillTraceRun`, `SkillFrame`, `SkillRate`, `RunChoice` to it. (Hooks import these from `@/sim` for types only — type-only imports do not pull the engine bundle.)

- [ ] **Step 7: Run the test + typecheck**

Run: `pnpm vitest run src/sim/worker-core.test.ts` then `pnpm typecheck`
Expected: PASS; no type errors.

- [ ] **Step 8: Commit**

```bash
git add src/sim/types.ts src/sim/engine.worker.ts src/sim/client.ts src/sim/index.ts src/sim/worker-core.test.ts
git commit -m "feat(sim): worker + client wiring for skillTrace / skillRate"
```

---

### Task 4: Pure chart geometry

**Files:**
- Create: `src/features/cm-planner/skill-trace/geometry.ts`
- Test: `src/features/cm-planner/skill-trace/geometry.test.ts`

**Interfaces:**
- Consumes: `SkillTraceRun`, `SkillFrame` (types only, from `@/sim`).
- Produces: `polyline(points)`, `vtPoints(frames, box, domain)`, `gapCurve(run)`, `gapPoints(curve, box, domain)`, `domainOf(run)`, `activationTimes(run)`, `Box`/`Domain`/`Pt` types.

- [ ] **Step 1: Write the failing tests**

Create `src/features/cm-planner/skill-trace/geometry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { polyline, gapCurve, vtPoints, domainOf, activationTimes } from './geometry';
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/skill-trace/geometry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `geometry.ts`**

Create `src/features/cm-planner/skill-trace/geometry.ts`:

```ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/features/cm-planner/skill-trace/geometry.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/cm-planner/skill-trace/geometry.ts src/features/cm-planner/skill-trace/geometry.test.ts
git commit -m "feat(m4): pure SVG geometry for skill-trace charts"
```

---

### Task 5: Presentational chart components + CSS

**Files:**
- Create: `src/features/cm-planner/skill-trace/SkillTraceCharts.tsx`
- Create: `src/features/cm-planner/skill-trace/skill-trace.css`
- Test: `src/features/cm-planner/skill-trace/SkillTraceCharts.test.tsx`

**Interfaces:**
- Consumes: geometry (Task 4), `SkillTraceRun`/`RunChoice` (types).
- Produces (pure components): `VelocityTimeChart({ run })`, `LengthDistanceChart({ run })`, `ActivationRateBadge({ status, rate, onCompute })`, `RunChoiceToggle({ value, onChange })`.

- [ ] **Step 1: Write the failing test**

Create `src/features/cm-planner/skill-trace/SkillTraceCharts.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VelocityTimeChart, LengthDistanceChart, ActivationRateBadge, RunChoiceToggle } from './SkillTraceCharts';
import type { SkillTraceRun } from '@/sim';

const run: SkillTraceRun = {
  without: [ { t: 0, v: 0, pos: 0, hp: 100 }, { t: 1, v: 10, pos: 5, hp: 90 } ],
  withSkill: [ { t: 0, v: 0, pos: 0, hp: 100 }, { t: 1, v: 12, pos: 7.5, hp: 88 } ],
  activation: [ { start: 5, end: 7.5 } ],
  L: 1,
};

describe('SkillTraceCharts', () => {
  it('VelocityTimeChart renders two polylines (with + without)', () => {
    const { container } = render(<VelocityTimeChart run={run} />);
    expect(container.querySelectorAll('polyline').length).toBe(2);
  });

  it('LengthDistanceChart renders the gain polyline', () => {
    const { container } = render(<LengthDistanceChart run={run} />);
    expect(container.querySelector('polyline')).not.toBeNull();
  });

  it('ActivationRateBadge shows a Compute button when idle, fires onCompute', async () => {
    const onCompute = vi.fn();
    render(<ActivationRateBadge status="idle" rate={null} onCompute={onCompute} />);
    screen.getByRole('button', { name: /activation rate/i }).click();
    expect(onCompute).toHaveBeenCalled();
  });

  it('ActivationRateBadge shows a percentage when done', () => {
    render(<ActivationRateBadge status="done" rate={0.73} onCompute={() => {}} />);
    expect(screen.getByText('73%')).toBeInTheDocument();
  });

  it('RunChoiceToggle reports the chosen run', () => {
    const onChange = vi.fn();
    render(<RunChoiceToggle value="median" onChange={onChange} />);
    screen.getByRole('button', { name: /best/i }).click();
    expect(onChange).toHaveBeenCalledWith('max');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/skill-trace/SkillTraceCharts.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `SkillTraceCharts.tsx`**

Create `src/features/cm-planner/skill-trace/SkillTraceCharts.tsx`:

```tsx
import './skill-trace.css';
import type { RunChoice, SkillTraceRun } from '@/sim';
import { vtPoints, gapCurve, gapPoints, maxAbsL, polyline, domainOf, activationTimes, type Box } from './geometry';

const BOX: Box = { w: 280, h: 96 };

export function VelocityTimeChart({ run }: { run: SkillTraceRun }) {
  const d = domainOf(run);
  const withPts = polyline(vtPoints(run.withSkill, BOX, d));
  const withoutPts = polyline(vtPoints(run.without, BOX, d));
  const zones = activationTimes(run).map(({ tStart, tEnd }) => ({
    x: (tStart / d.tMax) * BOX.w,
    w: Math.max(1, ((tEnd - tStart) / d.tMax) * BOX.w),
  }));
  return (
    <figure className="cmp-trace-chart">
      <figcaption>Velocity vs time <small>(m/s)</small></figcaption>
      <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} role="img" aria-label="Velocity over time, with and without the skill" preserveAspectRatio="none">
        {zones.map((z, i) => <rect key={i} className="cmp-trace-zone" x={z.x} y={0} width={z.w} height={BOX.h} />)}
        <polyline className="cmp-trace-line is-without" points={withoutPts} fill="none" />
        <polyline className="cmp-trace-line is-with" points={withPts} fill="none" />
      </svg>
    </figure>
  );
}

export function LengthDistanceChart({ run }: { run: SkillTraceRun }) {
  const d = domainOf(run);
  const curve = gapCurve(run);
  const pts = polyline(gapPoints(curve, BOX, d, maxAbsL(curve)));
  return (
    <figure className="cmp-trace-chart">
      <figcaption>Length gained vs distance <small>(バ身)</small></figcaption>
      <svg viewBox={`0 0 ${BOX.w} ${BOX.h}`} role="img" aria-label="Length advantage over race distance" preserveAspectRatio="none">
        <line className="cmp-trace-baseline" x1={0} y1={BOX.h / 2} x2={BOX.w} y2={BOX.h / 2} />
        <polyline className="cmp-trace-line is-gain" points={pts} fill="none" />
      </svg>
    </figure>
  );
}

export function ActivationRateBadge({
  status, rate, onCompute,
}: { status: 'idle' | 'running' | 'done'; rate: number | null; onCompute: () => void }) {
  if (status === 'done' && rate !== null) {
    const pct = `${Math.round(rate * 100)}%`;
    return (
      <div className="cmp-trace-rate is-done">
        <span className="cmp-trace-rate-label">Activation rate</span>
        <span className="cmp-trace-rate-bar"><span style={{ width: pct }} /></span>
        <strong>{pct}</strong>
      </div>
    );
  }
  return (
    <button type="button" className="cmp-trace-rate-btn" disabled={status === 'running'} onClick={onCompute}>
      {status === 'running' ? 'Measuring activation rate…' : 'Compute activation rate'}
    </button>
  );
}

const CHOICES: { label: string; value: RunChoice }[] = [
  { label: 'Worst', value: 'min' },
  { label: 'Typical', value: 'median' },
  { label: 'Best', value: 'max' },
];

export function RunChoiceToggle({ value, onChange }: { value: RunChoice; onChange: (c: RunChoice) => void }) {
  return (
    <div className="cmp-trace-choice" role="group" aria-label="Representative run">
      {CHOICES.map((c) => (
        <button
          key={c.value}
          type="button"
          className={`cmp-trace-choice-btn ${value === c.value ? 'is-active' : ''}`.trim()}
          aria-pressed={value === c.value}
          onClick={() => onChange(c.value)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `skill-trace.css`**

Create `src/features/cm-planner/skill-trace/skill-trace.css`:

```css
.cmp-trace { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.cmp-trace-charts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
@media (max-width: 640px) { .cmp-trace-charts { grid-template-columns: 1fr; } }
.cmp-trace-chart { margin: 0; }
.cmp-trace-chart figcaption { font-size: 11px; color: var(--muted, #9aa0a6); margin-bottom: 2px; }
.cmp-trace-chart svg { width: 100%; height: 96px; background: var(--bg-2, #1b1d22); border-radius: 8px; }
.cmp-trace-line { stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.cmp-trace-line.is-with { stroke: var(--accent, #ffcf4a); }
.cmp-trace-line.is-without { stroke: #6b7077; stroke-dasharray: 3 3; }
.cmp-trace-line.is-gain { stroke: var(--accent, #ffcf4a); }
.cmp-trace-baseline { stroke: #3a3d44; stroke-width: 1; vector-effect: non-scaling-stroke; }
.cmp-trace-zone { fill: rgba(255, 207, 74, 0.12); }
.cmp-trace-choice { display: inline-flex; gap: 2px; }
.cmp-trace-choice-btn { font-size: 11px; padding: 2px 8px; background: var(--bg-2, #1b1d22); border: 1px solid #34373d; color: var(--muted, #9aa0a6); cursor: pointer; }
.cmp-trace-choice-btn:first-child { border-radius: 6px 0 0 6px; }
.cmp-trace-choice-btn:last-child { border-radius: 0 6px 6px 0; }
.cmp-trace-choice-btn.is-active { background: var(--accent, #ffcf4a); color: #1b1d22; border-color: var(--accent, #ffcf4a); }
.cmp-trace-rate, .cmp-trace-rate-btn { font-size: 12px; }
.cmp-trace-rate { display: flex; align-items: center; gap: 8px; }
.cmp-trace-rate-bar { flex: 1; height: 6px; background: var(--bg-2, #1b1d22); border-radius: 3px; overflow: hidden; }
.cmp-trace-rate-bar > span { display: block; height: 100%; background: var(--accent, #ffcf4a); }
.cmp-trace-rate-btn { padding: 4px 10px; background: var(--bg-2, #1b1d22); border: 1px solid #34373d; border-radius: 6px; color: var(--text, #e8e6e3); cursor: pointer; }
.cmp-trace-rate-btn:disabled { opacity: 0.6; cursor: default; }
.cmp-trace-note { font-size: 10px; color: var(--muted, #9aa0a6); }
```

> Reuse existing CSS custom properties if the design system defines them; the fallbacks above keep it self-contained.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/features/cm-planner/skill-trace/SkillTraceCharts.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/features/cm-planner/skill-trace/SkillTraceCharts.tsx src/features/cm-planner/skill-trace/skill-trace.css src/features/cm-planner/skill-trace/SkillTraceCharts.test.tsx
git commit -m "feat(m4): hand-rolled SVG skill-trace charts (v-t, L-vs-distance, rate, run-choice)"
```

---

### Task 6: `useSkillTrace` hook

**Files:**
- Create: `src/features/cm-planner/useSkillTrace.ts`
- Test: `src/features/cm-planner/useSkillTrace.test.tsx`

**Interfaces:**
- Consumes: `SimClient.skillTrace`/`skillRate` (Task 3), `SkillTrace`/`SkillRate`/`RunChoice`/`SimBuild`/`SimRaceParams` (types).
- Produces:
  ```ts
  interface TraceContext { build: SimBuild; race: SimRaceParams; }
  interface UseSkillTraceDeps {
    skillTrace: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => SkillTrace | Promise<SkillTrace>;
    skillRate: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => SkillRate | Promise<SkillRate>;
    traceSamples?: number; rateSamples?: number;
  }
  interface SkillTraceState {
    status: 'idle' | 'running' | 'done' | 'na';
    run: SkillTraceRun | null; runChoice: RunChoice; setRunChoice: (c: RunChoice) => void;
    rate: number | null; rateStatus: 'idle' | 'running' | 'done'; computeRate: () => void;
  }
  function useSkillTrace(skillId: string, ctx: TraceContext | undefined, enabled: boolean, deps?: UseSkillTraceDeps): SkillTraceState;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/features/cm-planner/useSkillTrace.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { SkillTrace, SkillRate, SkillTraceRun } from '@/sim';
import { useSkillTrace } from './useSkillTrace';

const oneRun: SkillTraceRun = { withSkill: [{ t: 0, v: 1, pos: 0, hp: 1 }], without: [{ t: 0, v: 1, pos: 0, hp: 1 }], activation: [], L: 2 };
const trace: SkillTrace = { runs: { min: oneRun, max: oneRun, mean: oneRun, median: oneRun }, meanL: 2, nsamples: 20 };
const ctx = { build: { umaId: 'x', stats: { spd: 1000, sta: 1, pow: 1, gut: 1, wit: 1 }, strategy: 'pace' as const, aptitudes: { distance: 'A' as const, surface: 'A' as const, strategy: 'A' as const }, skills: [] }, race: { courseId: '10101' } };

describe('useSkillTrace', () => {
  it('does not simulate while disabled', () => {
    const skillTrace = vi.fn(async () => trace);
    const skillRate = vi.fn(async () => ({ rate: 0.5, nsamples: 400 } as SkillRate));
    renderHook(() => useSkillTrace('200332', ctx, false, { skillTrace, skillRate }));
    expect(skillTrace).not.toHaveBeenCalled();
  });

  it('auto-runs the trace when enabled and reaches done', async () => {
    const skillTrace = vi.fn(async () => trace);
    const skillRate = vi.fn(async () => ({ rate: 0.5, nsamples: 400 } as SkillRate));
    const { result } = renderHook(() => useSkillTrace('200332', ctx, true, { skillTrace, skillRate }));
    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.run?.L).toBe(2);
    expect(skillRate).not.toHaveBeenCalled(); // rate is button-gated
  });

  it('computeRate runs the rate sim on demand', async () => {
    const skillTrace = vi.fn(async () => trace);
    const skillRate = vi.fn(async () => ({ rate: 0.42, nsamples: 400 } as SkillRate));
    const { result } = renderHook(() => useSkillTrace('200332', ctx, true, { skillTrace, skillRate }));
    await waitFor(() => expect(result.current.status).toBe('done'));
    act(() => result.current.computeRate());
    await waitFor(() => expect(result.current.rateStatus).toBe('done'));
    expect(result.current.rate).toBe(0.42);
  });

  it('na when the build has zero speed', async () => {
    const skillTrace = vi.fn(async () => ({ ...trace, nsamples: 0 }));
    const skillRate = vi.fn(async () => ({ rate: 0, nsamples: 0 } as SkillRate));
    const dead = { ...ctx, build: { ...ctx.build, stats: { ...ctx.build.stats, spd: 0 } } };
    const { result } = renderHook(() => useSkillTrace('200332', dead, true, { skillTrace, skillRate }));
    await waitFor(() => expect(result.current.status).toBe('na'));
  });

  it('setRunChoice switches the displayed run without re-simulating', async () => {
    const max: SkillTraceRun = { ...oneRun, L: 9 };
    const skillTrace = vi.fn(async () => ({ ...trace, runs: { ...trace.runs, max } }));
    const skillRate = vi.fn(async () => ({ rate: 0, nsamples: 0 } as SkillRate));
    const { result } = renderHook(() => useSkillTrace('200332', ctx, true, { skillTrace, skillRate }));
    await waitFor(() => expect(result.current.status).toBe('done'));
    const calls = skillTrace.mock.calls.length;
    act(() => result.current.setRunChoice('max'));
    expect(result.current.run?.L).toBe(9);
    expect(skillTrace.mock.calls.length).toBe(calls); // no re-sim
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/useSkillTrace.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `useSkillTrace.ts`**

Create `src/features/cm-planner/useSkillTrace.ts`:

```ts
/** Run-on-demand skill-trace hook (M4 skill-detail graphs). Auto-runs the cheap
 *  trace (curves) when enabled + a context is present; the activation rate is
 *  button-gated via computeRate(). runChoice switches between the four
 *  representative runs returned in one sim — no re-sim. Module-shared SimClient
 *  imported from '@/sim/client' (NOT the '@/sim' barrel) so the engine bundle
 *  stays out of this module's import graph. */
import { useEffect, useRef, useState } from 'react';
import type { RunChoice, SimBuild, SimRaceParams, SkillRate, SkillTrace, SkillTraceRun } from '@/sim';
import { SimClient } from '@/sim/client';

const TRACE_SAMPLES = 20;
const RATE_SAMPLES = 400;

export interface TraceContext { build: SimBuild; race: SimRaceParams; }
export interface UseSkillTraceDeps {
  skillTrace: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => SkillTrace | Promise<SkillTrace>;
  skillRate: (b: SimBuild, r: SimRaceParams, id: string, n: number, seed?: number) => SkillRate | Promise<SkillRate>;
  traceSamples?: number;
  rateSamples?: number;
}
export interface SkillTraceState {
  status: 'idle' | 'running' | 'done' | 'na';
  run: SkillTraceRun | null;
  runChoice: RunChoice;
  setRunChoice: (c: RunChoice) => void;
  rate: number | null;
  rateStatus: 'idle' | 'running' | 'done';
  computeRate: () => void;
}

let client: SimClient | null = null;
function realDeps(): UseSkillTraceDeps {
  client ??= new SimClient();
  return { skillTrace: client.skillTrace.bind(client), skillRate: client.skillRate.bind(client) };
}

export function useSkillTrace(
  skillId: string,
  ctx: TraceContext | undefined,
  enabled: boolean,
  deps?: UseSkillTraceDeps,
): SkillTraceState {
  const [status, setStatus] = useState<'idle' | 'running' | 'done' | 'na'>('idle');
  const [trace, setTrace] = useState<SkillTrace | null>(null);
  const [runChoice, setRunChoice] = useState<RunChoice>('median');
  const [rate, setRate] = useState<number | null>(null);
  const [rateStatus, setRateStatus] = useState<'idle' | 'running' | 'done'>('idle');

  const depsRef = useRef(deps);
  depsRef.current = deps;
  const token = useRef(0);

  // Auto-run the trace when enabled + a context is present. Re-run on skill/course/build change.
  const sig = ctx ? `${skillId}|${ctx.race.courseId}|${ctx.build.umaId}|${ctx.build.strategy}|${ctx.build.stats.spd}` : null;
  useEffect(() => {
    if (!enabled || !ctx || sig === null) return;
    const merged = depsRef.current ?? realDeps();
    const myToken = (token.current += 1);
    setStatus('running');
    setTrace(null);
    setRate(null);
    setRateStatus('idle');
    void Promise.resolve(merged.skillTrace(ctx.build, ctx.race, skillId, merged.traceSamples ?? TRACE_SAMPLES))
      .then((t) => {
        if (token.current !== myToken) return;
        setTrace(t);
        setStatus(t.nsamples === 0 ? 'na' : 'done');
      })
      .catch(() => { if (token.current === myToken) setStatus('na'); });
    return () => { token.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sig]);

  const computeRate = () => {
    if (!ctx || rateStatus === 'running') return;
    const merged = depsRef.current ?? realDeps();
    const myToken = token.current;
    setRateStatus('running');
    void Promise.resolve(merged.skillRate(ctx.build, ctx.race, skillId, merged.rateSamples ?? RATE_SAMPLES))
      .then((r) => {
        if (token.current !== myToken) return;
        setRate(r.rate);
        setRateStatus('done');
      })
      .catch(() => { if (token.current === myToken) setRateStatus('idle'); });
  };

  const run = trace ? trace.runs[runChoice] : null;
  return { status, run, runChoice, setRunChoice, rate, rateStatus, computeRate };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/features/cm-planner/useSkillTrace.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/cm-planner/useSkillTrace.ts src/features/cm-planner/useSkillTrace.test.tsx
git commit -m "feat(m4): useSkillTrace hook — auto curves, button-gated rate, run-choice switch"
```

---

### Task 7: `SkillTraceSection` + integrate into `SkillDetailDisclosure`

**Files:**
- Create: `src/features/cm-planner/SkillTraceSection.tsx`
- Modify: `src/features/cm-planner/SkillDetailDisclosure.tsx`
- Test: `src/features/cm-planner/SkillDetailDisclosure.test.tsx` (create if absent)

**Interfaces:**
- Consumes: `useSkillTrace` + `TraceContext` (Task 6), charts (Task 5).
- Produces: `SkillTraceSection({ skillId, ctx, enabled })`; new `SkillDetailDisclosure` props `traceContext?: TraceContext`, `open?: boolean`, `onOpenChange?: (open: boolean) => void`.

- [ ] **Step 1: Implement `SkillTraceSection.tsx`**

Create `src/features/cm-planner/SkillTraceSection.tsx`:

```tsx
import './skill-trace/skill-trace.css';
import { useSkillTrace, type TraceContext } from './useSkillTrace';
import { VelocityTimeChart, LengthDistanceChart, ActivationRateBadge, RunChoiceToggle } from './skill-trace/SkillTraceCharts';

const RUN_LABEL: Record<string, string> = { min: 'worst', median: 'typical', mean: 'mean', max: 'best' };

export function SkillTraceSection({ skillId, ctx, enabled }: { skillId: string; ctx: TraceContext; enabled: boolean }) {
  const s = useSkillTrace(skillId, ctx, enabled);

  if (s.status === 'na') {
    return <p className="muted small cmp-trace-note">No simulated trace for this skill on this build/course.</p>;
  }
  if (s.status === 'running' || s.run === null) {
    return <p className="muted small">Simulating trace…</p>;
  }
  return (
    <div className="cmp-trace">
      <div className="cmp-trace-charts">
        <VelocityTimeChart run={s.run} />
        <LengthDistanceChart run={s.run} />
      </div>
      <div className="cmp-trace-controls">
        <RunChoiceToggle value={s.runChoice} onChange={s.setRunChoice} />
        <ActivationRateBadge status={s.rateStatus} rate={s.rate} onCompute={s.computeRate} />
      </div>
      <p className="cmp-trace-note">
        Single {RUN_LABEL[s.runChoice]} run of {ctx.build.umaId ? 'your build' : 'the reference'} — an estimate (P3), not a guarantee.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Write the failing test for disclosure integration**

Create (or extend) `src/features/cm-planner/SkillDetailDisclosure.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SkillDetailDisclosure } from './SkillDetailDisclosure';
import type { SkillSummary } from './skillTechnicalDetails';

vi.mock('@/features/data/GameIcon', () => ({ GameIcon: () => null }));
vi.mock('./skillTechnicalDetails', async (orig) => ({
  ...(await orig<typeof import('./skillTechnicalDetails')>()),
  loadSkillTechnicalDetail: async () => null,
}));

const skill: SkillSummary = { skillId: '200332', nameEn: 'Corner Adept', iconId: '1', rarity: 1, baseSpCost: 120 };

describe('SkillDetailDisclosure controlled open', () => {
  it('is controlled when open + onOpenChange are passed', () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<SkillDetailDisclosure skill={skill} open={false} onOpenChange={onOpenChange} />);
    const details = screen.getByRole('group', { hidden: true }) as HTMLDetailsElement | null;
    // The <details> reflects the controlled prop:
    rerender(<SkillDetailDisclosure skill={skill} open onOpenChange={onOpenChange} />);
    expect(document.querySelector('details')?.open).toBe(true);
  });

  it('does not render a trace section without traceContext', () => {
    render(<SkillDetailDisclosure skill={skill} open onOpenChange={() => {}} />);
    expect(screen.queryByText(/Velocity vs time/i)).not.toBeInTheDocument();
  });
});
```

> Adjust the `SkillSummary` literal to match the real type (check `skillTechnicalDetails.ts`); include any required fields.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/SkillDetailDisclosure.test.tsx`
Expected: FAIL — `open`/`onOpenChange` props not supported; controlled `details` not reflecting.

- [ ] **Step 4: Make open controllable + render the trace section**

In `src/features/cm-planner/SkillDetailDisclosure.tsx`:

1. Add imports near the top:
   ```ts
   import { SkillTraceSection } from './SkillTraceSection';
   import type { TraceContext } from './useSkillTrace';
   ```

2. Extend the component props:
   ```ts
   export function SkillDetailDisclosure({
     skill,
     className,
     side,
     technicalHeaderSide,
     showCost = true,
     traceContext,
     open: openProp,
     onOpenChange,
   }: {
     skill: SkillSummary;
     className?: string;
     side?: ReactNode;
     technicalHeaderSide?: ReactNode;
     showCost?: boolean;
     traceContext?: TraceContext;
     open?: boolean;
     onOpenChange?: (open: boolean) => void;
   }) {
   ```

3. Replace the internal open state with a controlled/uncontrolled hybrid:
   ```ts
   const [openState, setOpenState] = useState(false);
   const isControlled = openProp !== undefined;
   const open = isControlled ? openProp : openState;
   const setOpen = (next: boolean) => {
     if (!isControlled) setOpenState(next);
     onOpenChange?.(next);
   };
   ```

4. Update the `<details>` toggle handler to avoid redundant calls:
   ```tsx
   <details
     className={`cmp-skill-detail cmp-skill-rarity-${skill.rarity} ${className ?? ''}`.trim()}
     open={open}
     onToggle={(e) => { if (e.currentTarget.open !== open) setOpen(e.currentTarget.open); }}
   >
   ```

5. After the existing `cmp-alt-list` block, before the closing `</div>` of `cmp-skill-tech`, add:
   ```tsx
   {traceContext !== undefined && (
     <SkillTraceSection skillId={skill.skillId} ctx={traceContext} enabled={open} />
   )}
   ```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run src/features/cm-planner/SkillDetailDisclosure.test.tsx`
Expected: PASS. If the `getByRole('group')` query is brittle in jsdom, assert via `document.querySelector('details')?.open` only (already used) and drop the role query.

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck`

```bash
git add src/features/cm-planner/SkillTraceSection.tsx src/features/cm-planner/SkillDetailDisclosure.tsx src/features/cm-planner/SkillDetailDisclosure.test.tsx
git commit -m "feat(m4): SkillTraceSection + traceContext/controlled-open in SkillDetailDisclosure"
```

---

### Task 8: Wire call sites — sidebar context + chart accordion + reference context

**Files:**
- Modify: `src/core/rankUmaChart.ts` (export `referenceBuild`)
- Modify: `src/features/cm-planner/UmaChartPanel.tsx` (accordion + reference `traceContext`)
- Modify: `src/features/cm-planner/PlannerSidebar.tsx` (plan `traceContext`)
- Test: `src/features/cm-planner/UmaChartPanel.test.tsx`

**Interfaces:**
- Consumes: `planToSimBuild` (`@/core/simBuild`), `referenceBuild` (`@/core/rankUmaChart`), `SkillDetailDisclosure` props (Task 7).
- Produces: one-open-at-a-time chart rows; `traceContext` supplied at all three disclosure call sites.

- [ ] **Step 1: Export `referenceBuild` from `rankUmaChart.ts`**

Change `function referenceBuild(` (line 58) to `export function referenceBuild(`.

- [ ] **Step 2: Write the failing accordion test**

In `src/features/cm-planner/UmaChartPanel.test.tsx`, add a test asserting at most one disclosure is open. Use the existing test's render setup (deps injection); after running the chart, open two rows' `<summary>` elements and assert only one `<details open>` remains:

```tsx
it('keeps only one skill disclosure open at a time (accordion)', async () => {
  // ...render UmaChartPanel with injected deps and run() as existing tests do...
  const summaries = await screen.findAllByText(/./, { selector: 'details.cmp-uma-plate summary' });
  summaries[0]!.click();
  summaries[1]!.click();
  expect(document.querySelectorAll('details.cmp-uma-plate[open]').length).toBe(1);
});
```

> Mirror the existing `UmaChartPanel.test.tsx` harness (deps, fake `loadUniqueByUmaId`, `skillDelta`); reuse its setup rather than inventing a new one.

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/UmaChartPanel.test.tsx -t accordion`
Expected: FAIL — both rows open (independent `<details>` state).

- [ ] **Step 4: Implement the accordion + reference context in `UmaChartPanel.tsx`**

1. Add imports:
   ```ts
   import { referenceBuild } from '@/core/rankUmaChart';
   import type { TraceContext } from './useSkillTrace';
   ```

2. In `UmaChartPanel`, add open-row state near the other `useState`s:
   ```ts
   const [openOutfitId, setOpenOutfitId] = useState<string | null>(null);
   ```

3. Thread `openOutfitId` + `setOpenOutfitId` + `race` into `UmaRow` via props. Extend `UmaRow`'s signature:
   ```ts
   function UmaRow({ row, eff, umaName, unique, isRunner, sortMetric, onStyle, onSelect, isOpen, onOpenChange, race }: {
     // ...existing props...
     isOpen: boolean;
     onOpenChange: (open: boolean) => void;
     race: SimRaceParams;
   }) {
   ```

4. In `UmaRow`, build the per-row reference `traceContext` from the row's effective style and pass it + controlled-open to the disclosure:
   ```tsx
   const traceCtx: TraceContext | undefined =
     unique && eff ? { build: referenceBuild(row.outfitId, eff.strategy), race } : undefined;
   ```
   ```tsx
   {unique ? (
     <SkillDetailDisclosure
       skill={unique}
       showCost={false}
       className="cmp-uma-plate"
       traceContext={traceCtx}
       open={isOpen}
       onOpenChange={onOpenChange}
     />
   ) : (
     <span className="cmp-missing-skill cmp-uma-plate">No unique-skill data</span>
   )}
   ```

5. In the `visible.map(...)` render, pass the new props:
   ```tsx
   <UmaRow
     key={row.outfitId}
     row={row}
     eff={eff}
     umaName={umaById?.get(row.outfitId)?.nameEn ?? `Uma ${row.outfitId}`}
     unique={uniqueByUmaId?.get(row.outfitId) ?? null}
     isRunner={plan.umaId === row.outfitId}
     sortMetric={sortMetric}
     onStyle={onStyle}
     onSelect={onSelectRunner}
     race={race}
     isOpen={openOutfitId === row.outfitId}
     onOpenChange={(o) => setOpenOutfitId(o ? row.outfitId : null)}
   />
   ```

- [ ] **Step 5: Run the accordion test to verify it passes**

Run: `pnpm vitest run src/features/cm-planner/UmaChartPanel.test.tsx`
Expected: PASS (accordion + existing tests).

- [ ] **Step 6: Wire the sidebar `traceContext`**

In `src/features/cm-planner/PlannerSidebar.tsx`:

1. Add imports:
   ```ts
   import { planToSimBuild } from '@/core/simBuild';
   import type { TraceContext } from './useSkillTrace';
   ```

2. Inside the component (where `plan` is in scope), memoize the plan trace context:
   ```ts
   const traceCtx = useMemo<TraceContext>(
     () => ({ build: planToSimBuild(plan), race: { courseId: plan.cmRef.courseId } }),
     [plan],
   );
   ```
   (`useMemo` is already imported. Confirm the course id path: `plan.cmRef.courseId` is what `CmPlannerPage` feeds the chart as `selection.courseId`; if the plan stores it elsewhere, use that field.)

3. Pass `traceContext={traceCtx}` to BOTH the unique-skill disclosure (≈ line 422) and the wishlist disclosure (≈ line 638):
   ```tsx
   <SkillDetailDisclosure skill={uniqueSkill} showCost={false} traceContext={traceCtx} />
   ```
   ```tsx
   <SkillDetailDisclosure
     skill={summary}
     traceContext={traceCtx}
     side={ /* ...existing projectedL badge... */ }
     technicalHeaderSide={ /* ...existing... */ }
   />
   ```
   (Leave the wishlist list's open behaviour uncontrolled — accordion stays scoped to the chart.)

- [ ] **Step 7: Full typecheck + targeted tests**

Run: `pnpm typecheck` then `pnpm vitest run src/features/cm-planner`
Expected: no type errors; cm-planner suite green. (If a UI file flakes with a React-null error, re-run that single file once — known HMR race; do not "fix" it.)

- [ ] **Step 8: Commit**

```bash
git add src/core/rankUmaChart.ts src/features/cm-planner/UmaChartPanel.tsx src/features/cm-planner/UmaChartPanel.test.tsx src/features/cm-planner/PlannerSidebar.tsx
git commit -m "feat(m4): wire skill-trace graphs into chart (accordion + reference) and sidebar (plan build)"
```

---

### Task 9: Docs + full verification

**Files:**
- Modify: `docs/modules/module-4-skill-acquisition.md`
- Modify: `CLAUDE.md` (status lines + gotcha if any)
- Modify: `uma-cm-planner-plan.md` test count (if the project tracks it)

**Interfaces:** none (documentation + verification).

- [ ] **Step 1: Update the module doc**

In `docs/modules/module-4-skill-acquisition.md`, add a short subsection documenting: the two engine wrappers (`runSkillTrace` from `runComparison.runData`, `skillActivationRate` from `runSkillComparison.skillActivations`), the `useSkillTrace` hook, the `skill-trace/` chart components, the `traceContext`/controlled-open props on `SkillDetailDisclosure`, the accordion on `UmaChartPanel`, and the `~20`/`~400` sample constants. Note the key insight: VFalator is an umalator fork, so no external data was needed.

- [ ] **Step 2: Update `CLAUDE.md`**

Update the M4 status line and "Next up" to reflect that skill-detail graphs (velocity / length / activation rate) are done. Add a gotcha if one surfaced during implementation (e.g. "`runComparison` returns no `mean/median` — derive from sorted `results`"; "trace `runData` carries both runners, skill-comparison `runData` carries only `sk` activation logs").

- [ ] **Step 3: Full verification**

Run: `pnpm build` (typecheck + vite) and `pnpm test`
Expected: typecheck clean, build succeeds, full suite green (≈ 480 + new tests). Record the final count.

- [ ] **Step 4: Commit**

```bash
git add docs/modules/module-4-skill-acquisition.md CLAUDE.md uma-cm-planner-plan.md
git commit -m "docs(m4): record skill-detail graphs (trace/rate/charts) + engine gotchas"
```

---

## Self-review

**Spec coverage:**
- Velocity-vs-time → Task 5 `VelocityTimeChart`, geometry Task 4 `vtPoints`. ✓
- L-vs-distance + activation zone → Task 5 `LengthDistanceChart`, Task 4 `gapCurve`/`activationTimes`. ✓
- Activation rate (button-gated) → Task 2 engine, Task 6 `computeRate`, Task 5 `ActivationRateBadge`. ✓
- Option A per-call-site context → Task 7 `traceContext` prop; Task 8 sidebar (plan build) + chart (reference build). ✓
- Auto curves / button rate triggers → Task 6 hook (auto effect vs `computeRate`). ✓
- Representative-run choice (Typical default, Best/Worst) → Task 1 returns all four; Task 5 `RunChoiceToggle`; Task 6 `setRunChoice` (no re-sim). ✓
- Accordion on the uma chart → Task 8 `openOutfitId`. ✓
- Hand-rolled SVG, no chart lib → Tasks 4–5. ✓
- Engine lazy / spd>0 / isSimulatable guards → Tasks 1–2 + hook deps from `@/sim/client`. ✓
- Honesty labelling → Task 7 `SkillTraceSection` note. ✓
- Out-of-scope items (racetrack zones, duration graphs, caching, wishlist accordion) → not planned. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full code. The two `// ...existing...` markers in Task 8 reference verbatim-unchanged existing JSX (the `projectedL` badge), not new logic. ✓

**Type consistency:** `SkillTrace.runs: Record<RunChoice,…>` (Task 1) consumed by `trace.runs[runChoice]` (Task 6) and `RunChoiceToggle` values `min|median|max` (Task 5) — all `RunChoice`. `TraceContext` defined once in Task 6, imported by Tasks 7–8. `runSkillTrace`/`skillActivationRate` signatures identical across run.ts (Tasks 1–2), worker/client (Task 3), hook deps (Task 6). `referenceBuild(outfitId, strategy)` (Task 8) matches `rankUmaChart.ts` signature. ✓
