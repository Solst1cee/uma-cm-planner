# M4 Two-build race-sim comparison on the §0 racetrack — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overlay two builds' velocity + HP curves, skill-activation markers, and a バ身-gap-vs-distance curve on the M4 §0 racetrack, computed by a full-race `runComparison(uma1, uma2)` sim.

**Architecture:** A new `runRaceCompare` engine wrapper reuses the vendored `runComparison` (two independent vacuum runs — verified faithful to umalator's main view) and maps the per-frame `runData` it currently discards into a typed `RaceCompare`. A `useRaceCompare` hook auto-runs it (LRU-memoized) over a worker; new SVG overlay layers draw onto the existing `RaceTrackView` on its distance→x scale; a `RaceComparePanel` hosts the uma2 picker + toggles on `CmPlannerPage`.

**Tech Stack:** TypeScript, React 19, Vite, Vitest (jsdom + node), vendored umalator engine (`src/sim/vendor/umalator.bundle.mjs`), Web Worker (`?worker`).

**Spec:** [docs/superpowers/specs/2026-06-20-m4-two-build-race-compare-track-overlay-design.md](../specs/2026-06-20-m4-two-build-race-compare-track-overlay-design.md)

## Global Constraints

- **Reuse-first (P1):** wrap the vendored `runComparison`; do NOT add a new engine entry or run `pnpm sim:build`.
- **Honest numbers (P3):** label output as a single representative vacuum run; gap is an estimate.
- **Lazy engine:** import the shared worker client from `@/sim/client`, never the `@/sim` barrel, in feature code. Engine data via lazy `import('@/sim/...')`.
- **No 0-speed builds to the engine:** guard `stats.spd > 0` for both umas before simulating.
- **Card grammar:** new panels use `cmp-plan-card` + `cmp-collapse-head` + caret; interactive controls inside a collapse header call `stopPropagation`.
- **jsdom gotcha:** any test rendering a component that constructs a real `SimClient` must `vi.mock` the hook — a real Worker crashes jsdom.
- **Verify with `pnpm typecheck` + `pnpm build`**, not a dev-server-concurrent vitest run. Single test file: `pnpm vitest run <path>`.
- **Commits:** end every commit message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## File Structure

| File | Responsibility |
|---|---|
| `src/core/simBuild.ts` (modify) | + `planToOverlayBuild` — build with unique + wishlist skills active |
| `src/sim/types.ts` (modify) | + `RaceActivation`/`GapPoint`/`RaceCompareRun`/`RaceCompare`; + `raceCompare` req/resp |
| `src/sim/run.ts` (modify) | + `runRaceCompare` + activation/gap mappers |
| `src/sim/engine.worker.ts` (modify) | + `case 'raceCompare'` |
| `src/sim/client.ts` (modify) | + `SimClient.raceCompare` |
| `src/features/cm-planner/skill-trace/geometry.ts` (modify) | + distance-axis + gap helpers (time helpers untouched) |
| `src/features/cm-planner/resolveUma2.ts` (create) | `Uma2Source` seam + `resolveUma2` |
| `src/features/cm-planner/useRaceCompare.ts` (create) | auto-run + LRU hook |
| `src/features/planner/racetrack/vendor/types.ts` (modify) | bump `ViewHeight`, + overlay-band constants |
| `src/features/planner/racetrack/overlay/RaceOverlay.tsx` (create) | the 3 overlay layers (velocity/HP, markers, gap) |
| `src/features/planner/racetrack/RaceTrackView.tsx` (modify) | optional `trace` props → render `RaceOverlay` |
| `src/features/cm-planner/RaceComparePanel.tsx` (create) | panel: uma2 picker, toggles, status, mounts track |
| `src/features/cm-planner/CmPlannerPage.tsx` (modify) | mount `RaceComparePanel` |

Dependency order: 1 → 2 → 3 → 4 (engine) ; 5, 6 (pure helpers, parallel-safe) ; 7 (hook, needs 3/4) ; 8 → 9 (render, needs 5) ; 10 (panel, needs 1/6/7/9) ; 11 (page, needs 10) ; 12 (integration).

---

### Task 1: `planToOverlayBuild` — build with skills active

**Files:**
- Modify: `src/core/simBuild.ts` (add after `planToSimBuild`, ~line 104)
- Test: `src/core/simBuild.test.ts` (add a `describe`)

**Interfaces:**
- Consumes: `planToSimBuild(plan)` (existing), `CmPlan` (`uniqueSkillId: string`, `wishlist: { skillId: string }[]`).
- Produces: `planToOverlayBuild(plan: CmPlan): SimBuild` — same as `planToSimBuild` but `skills = [uniqueSkillId, ...wishlist skillIds]`, deduped, empty/falsy ids dropped. (Simulatable-filtering happens in the engine layer via `isSimulatable`, so this stays dependency-free and pure.)

- [ ] **Step 1: Write the failing test**

Add to `src/core/simBuild.test.ts`:

```ts
import { planToOverlayBuild } from './simBuild';

describe('planToOverlayBuild', () => {
  it('includes the unique skill and every wishlist skill, deduped', () => {
    const plan = { ...makeDefaultPlan(), uniqueSkillId: 'U1',
      wishlist: [
        { skillId: 'S1', priority: 1, source: 'targeted' },
        { skillId: 'S2', priority: 3, source: 'targeted' },
        { skillId: 'U1', priority: 3, source: 'targeted' }, // dup of unique
      ] } as CmPlan;
    const build = planToOverlayBuild(plan);
    expect(build.skills).toEqual(['U1', 'S1', 'S2']);
    expect(build.stats).toEqual(plan.statProfile.stats);
    expect(build.strategy).toBe(plan.strategy);
  });

  it('drops empty ids and a missing unique', () => {
    const plan = { ...makeDefaultPlan(), uniqueSkillId: '',
      wishlist: [{ skillId: 'S1', priority: 1, source: 'targeted' }] } as CmPlan;
    expect(planToOverlayBuild(plan).skills).toEqual(['S1']);
  });
});
```

Ensure the file imports `makeDefaultPlan` and `CmPlan` as the existing tests do (check the top of `simBuild.test.ts`; reuse its imports — add `makeDefaultPlan` from `@/app/ActivePlanContext` and `CmPlan` from `@/core/types` if not already imported).

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/core/simBuild.test.ts`
Expected: FAIL — `planToOverlayBuild is not a function`.

- [ ] **Step 3: Implement**

Add to `src/core/simBuild.ts`:

```ts
/** Build with the plan's skills ACTIVE (unique + wishlist) — for full-race sims
 *  (umalator-style overlay). Unlike planToSimBuild (vacuum, skills:[]). Dedup
 *  preserves order: unique first, then wishlist. Engine layer filters to simulatable. */
export function planToOverlayBuild(plan: CmPlan): SimBuild {
  const ids = [plan.uniqueSkillId, ...plan.wishlist.map((w) => w.skillId)].filter(Boolean);
  return { ...planToSimBuild(plan), skills: [...new Set(ids)] };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/core/simBuild.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/simBuild.ts src/core/simBuild.test.ts
git commit -m "feat(sim): planToOverlayBuild — build with unique + wishlist skills active

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `RaceCompare` types + worker req/resp variants

**Files:**
- Modify: `src/sim/types.ts` (add interfaces after `SkillImpact` ~line 89; extend `SimRequest` ~line 97 and `SimResponse` ~line 112)

**Interfaces:**
- Produces (consumed by Tasks 3, 4, 7, 8–10):
  - `RaceActivation { skillId: string; start: number; end: number }`
  - `GapPoint { pos: number; bashin: number }`
  - `RaceCompareRun { uma1Frames: SkillFrame[]; uma2Frames: SkillFrame[]; uma1Acts: RaceActivation[]; uma2Acts: RaceActivation[]; gap: GapPoint[] }`
  - `RaceCompare { runs: Record<RunChoice, RaceCompareRun>; distance: number; nsamples: number; meanBashin: number }`
  - `SimRequest` gains `{ id; kind: 'raceCompare'; uma1: SimBuild; uma2: SimBuild; race: SimRaceParams; nsamples: number; seed? }`
  - `SimResponse` gains `{ id; ok: true; kind: 'raceCompare'; result: RaceCompare }`

This task is type-only; it is verified by `pnpm typecheck` at the end of Task 3 (the first consumer). No standalone test.

- [ ] **Step 1: Add the data interfaces**

In `src/sim/types.ts`, after the `SkillImpact` interface:

```ts
/** One skill activation region on a full-race run (course metres), with its skill id. */
export interface RaceActivation { skillId: string; start: number; end: number; }

/** バ身 gap of uma1 over uma2 at uma1's course position (positive = uma1 ahead). */
export interface GapPoint { pos: number; bashin: number; }

/** One representative full-race run comparing two builds (umalator main view). */
export interface RaceCompareRun {
  uma1Frames: SkillFrame[];
  uma2Frames: SkillFrame[];
  uma1Acts: RaceActivation[];
  uma2Acts: RaceActivation[];
  gap: GapPoint[];
}

/** Two-build race comparison: 4 representative runs + summary, from one sim. */
export interface RaceCompare {
  runs: Record<RunChoice, RaceCompareRun>;
  distance: number;     // course metres (x-axis domain)
  nsamples: number;
  meanBashin: number;   // mean バ身 gap of uma1 over uma2
}
```

- [ ] **Step 2: Extend the request union**

Append to the `SimRequest` union (before the closing `;`):

```ts
  | { id: number; kind: 'raceCompare'; uma1: SimBuild; uma2: SimBuild; race: SimRaceParams; nsamples: number; seed?: number };
```

- [ ] **Step 3: Extend the response union**

Add to the `SimResponse` union (before the `ok: false` arm):

```ts
  | { id: number; ok: true; kind: 'raceCompare'; result: RaceCompare }
```

- [ ] **Step 4: Verify it compiles**

Run: `pnpm typecheck`
Expected: PASS (no new usage yet; just confirms the unions are well-formed).

- [ ] **Step 5: Commit**

```bash
git add src/sim/types.ts
git commit -m "feat(sim): RaceCompare types + raceCompare worker req/resp variants

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `runRaceCompare` engine wrapper

**Files:**
- Modify: `src/sim/run.ts` (add mappers + `runRaceCompare` after `runSkillTrace`, ~line 159)
- Test: `src/sim/run.test.ts` (add a `describe`, real engine — node env, like the existing tests)

**Interfaces:**
- Consumes: `runComparison` (already imported), `SimulationRun`, `resolveCourse`, `toRunnerState`, `toRaceDef`, `zipFrames`, `_mean` (all in `run.ts`); `RaceCompare`/`RaceCompareRun`/`RaceActivation`/`GapPoint` (Task 2).
- Produces: `runRaceCompare(uma1: SimBuild, uma2: SimBuild, race: SimRaceParams, nsamples: number, seed?: number): RaceCompare`.

- [ ] **Step 1: Write the failing test**

Add to `src/sim/run.test.ts`:

```ts
import { runRaceCompare } from './run';

describe('runRaceCompare', () => {
  const uma1: SimBuild = { ...build, skills: ['200332'] };       // Corner Adept ○
  const uma2: SimBuild = { ...buildB, skills: [] };

  it('maps both runners + gap over a real run', () => {
    const rc = runRaceCompare(uma1, uma2, { courseId: '10101' }, 20, 42);
    expect(rc.nsamples).toBe(20);
    expect(rc.distance).toBeGreaterThan(0);
    expect(Number.isFinite(rc.meanBashin)).toBe(true);
    const m = rc.runs.median;
    expect(m.uma1Frames.length).toBeGreaterThan(0);
    expect(m.uma2Frames.length).toBeGreaterThan(0);
    // gap is computed at uma1 positions, value = (pos1 - pos2)/2.5
    expect(m.gap.length).toBe(m.uma1Frames.length);
    expect(m.gap[0]!.pos).toBeCloseTo(m.uma1Frames[0]!.pos, 5);
    // uma1 has a skill → at least one activation region somewhere across the reps
    const anyAct = Object.values(rc.runs).some((r) => r.uma1Acts.length > 0);
    expect(anyAct).toBe(true);
  });

  it('is deterministic for a fixed seed', () => {
    const a = runRaceCompare(uma1, uma2, { courseId: '10101' }, 15, 7);
    const b = runRaceCompare(uma1, uma2, { courseId: '10101' }, 15, 7);
    expect(b.meanBashin).toBe(a.meanBashin);
    expect(b.runs.median.gap.map((g) => g.bashin)).toEqual(a.runs.median.gap.map((g) => g.bashin));
  });

  it('guards 0-speed and nsamples<1 (empty, no crash)', () => {
    const dead: SimBuild = { ...uma1, stats: { spd: 0, sta: 0, pow: 0, gut: 0, wit: 0 } };
    expect(runRaceCompare(dead, uma2, { courseId: '10101' }, 10, 1).nsamples).toBe(0);
    expect(runRaceCompare(uma1, uma2, { courseId: '10101' }, 0, 1).nsamples).toBe(0);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm vitest run src/sim/run.test.ts`
Expected: FAIL — `runRaceCompare is not a function`.

- [ ] **Step 3: Implement**

Add imports to the existing `import type { ... } from './types'` line in `run.ts`: `RaceCompare, RaceCompareRun, RaceActivation, GapPoint`. Then add `SimulationRun` is already imported. Append:

```ts
function allActivationRegions(run: SimulationRun, runner: 0 | 1): RaceActivation[] {
  const acts = run.skillActivations[runner] ?? {};
  const out: RaceActivation[] = [];
  for (const [skillId, logs] of Object.entries(acts)) {
    for (const l of logs) out.push({ skillId, start: l.start, end: l.end });
  }
  return out;
}

function gapCurve(run: SimulationRun): GapPoint[] {
  const p1 = run.position[0], p2 = run.position[1];
  const n = Math.min(p1.length, p2.length);
  const out: GapPoint[] = [];
  for (let i = 0; i < n; i++) {
    const a = p1[i] ?? 0, b = p2[i] ?? 0;
    out.push({ pos: a, bashin: (a - b) / 2.5 });
  }
  return out;
}

function mapCompareRun(run: SimulationRun): RaceCompareRun {
  return {
    uma1Frames: zipFrames(run, 0),
    uma2Frames: zipFrames(run, 1),
    uma1Acts: allActivationRegions(run, 0),
    uma2Acts: allActivationRegions(run, 1),
    gap: gapCurve(run),
  };
}

function emptyCompareRun(): RaceCompareRun {
  return { uma1Frames: [], uma2Frames: [], uma1Acts: [], uma2Acts: [], gap: [] };
}
const EMPTY_RACE_COMPARE: RaceCompare = {
  runs: { min: emptyCompareRun(), max: emptyCompareRun(), mean: emptyCompareRun(), median: emptyCompareRun() },
  distance: 0, nsamples: 0, meanBashin: 0,
};

/** Full-race two-build comparison (umalator main view): both runners' per-frame
 *  trace + all-skill activations + バ身-gap curve, from one runComparison sim. */
export function runRaceCompare(
  uma1: SimBuild, uma2: SimBuild, race: SimRaceParams, nsamples: number, seed = 0,
): RaceCompare {
  if (nsamples < 1 || uma1.stats.spd <= 0 || uma2.stats.spd <= 0) return EMPTY_RACE_COMPARE;
  const course = resolveCourse(race.courseId);
  const r = runComparison({
    nsamples, course, racedef: toRaceDef(race),
    uma1: toRunnerState(uma1), uma2: toRunnerState(uma2),
    options: { seed, ignoreStaminaConsumption: false },
  });
  return {
    runs: {
      min: mapCompareRun(r.runData.minrun),
      max: mapCompareRun(r.runData.maxrun),
      mean: mapCompareRun(r.runData.meanrun),
      median: mapCompareRun(r.runData.medianrun),
    },
    distance: typeof course.distance === 'number' ? course.distance : 0,
    nsamples: r.results.length,
    meanBashin: _mean(r.results),
  };
}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `pnpm vitest run src/sim/run.test.ts`
Expected: PASS (all describes incl. the existing ones).

- [ ] **Step 5: Commit**

```bash
git add src/sim/run.ts src/sim/run.test.ts
git commit -m "feat(sim): runRaceCompare — two-build full-race trace + gap curve

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Worker `case` + `SimClient.raceCompare`

**Files:**
- Modify: `src/sim/engine.worker.ts` (import + `case`)
- Modify: `src/sim/client.ts` (method)
- Test: `src/sim/worker-core.test.ts` (add a case) and `src/sim/client.test.ts` (add a case) — follow the existing patterns in those files.

**Interfaces:**
- Consumes: `runRaceCompare` (Task 3), the `raceCompare` req/resp (Task 2).
- Produces: `SimClient.raceCompare(uma1: SimBuild, uma2: SimBuild, race: SimRaceParams, nsamples: number, seed?: number): Promise<RaceCompare>`.

- [ ] **Step 1: Write the failing client test**

Open `src/sim/client.test.ts`, read how it fakes the worker (a fake `Worker` factory that resolves responses). Add a test mirroring the existing ones:

```ts
it('raceCompare posts kind:raceCompare and resolves result', async () => {
  const fake = makeFakeWorker((req) => ({ id: req.id, ok: true, kind: 'raceCompare',
    result: { runs: { min: r, max: r, mean: r, median: r }, distance: 1200, nsamples: 20, meanBashin: 1.5 } }));
  const client = new SimClient(() => fake);
  const out = await client.raceCompare(buildA, buildB, { courseId: '10101' }, 20, 1);
  expect(out.distance).toBe(1200);
  expect(out.meanBashin).toBe(1.5);
});
```

Reuse the file's existing fake-worker helper and `buildA`/`r` fixtures (define `const r = { uma1Frames: [], uma2Frames: [], uma1Acts: [], uma2Acts: [], gap: [] };` if not present, and `buildB` like the existing build fixture). Match the existing test's exact helper names.

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm vitest run src/sim/client.test.ts`
Expected: FAIL — `client.raceCompare is not a function`.

- [ ] **Step 3: Implement client method**

In `src/sim/client.ts`, add `RaceCompare` to the type import from `./types`, and add the method after `skillImpact`:

```ts
  async raceCompare(uma1: SimBuild, uma2: SimBuild, race: SimRaceParams, nsamples: number, seed?: number): Promise<RaceCompare> {
    const id = ++this.seq;
    const res = await this.send({ id, kind: 'raceCompare', uma1, uma2, race, nsamples, seed });
    if (!res.ok) throw new Error(res.error);
    if (res.kind !== 'raceCompare') throw new Error(`unexpected response kind: ${res.kind}`);
    return res.result;
  }
```

- [ ] **Step 4: Implement worker case**

In `src/sim/engine.worker.ts`, add `runRaceCompare` to the import from `./run`, and add the case:

```ts
      case 'raceCompare':
        return { id: req.id, ok: true, kind: 'raceCompare', result: runRaceCompare(req.uma1, req.uma2, req.race, req.nsamples, req.seed) };
```

- [ ] **Step 5: Add the worker-core test**

In `src/sim/worker-core.test.ts`, add a case mirroring the existing `skillTrace`/`vacuum` ones, e.g.:

```ts
it('handles raceCompare', () => {
  const res = handle({ id: 9, kind: 'raceCompare', uma1: build, uma2: buildB, race: { courseId: '10101' }, nsamples: 8, seed: 1 });
  expect(res.ok).toBe(true);
  if (res.ok && res.kind === 'raceCompare') expect(res.result.nsamples).toBe(8);
});
```

Use the file's existing `handle`/`build` helpers and add a `buildB` fixture if needed (copy the existing build with different stats).

- [ ] **Step 6: Run both tests, verify they pass**

Run: `pnpm vitest run src/sim/client.test.ts src/sim/worker-core.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/sim/engine.worker.ts src/sim/client.ts src/sim/client.test.ts src/sim/worker-core.test.ts
git commit -m "feat(sim): wire raceCompare through worker + SimClient

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Distance-axis + gap geometry helpers

**Files:**
- Modify: `src/features/cm-planner/skill-trace/geometry.ts` (add at end; do NOT touch the time-axis helpers)
- Test: `src/features/cm-planner/skill-trace/geometry.test.ts` (add a `describe`)

**Interfaces:**
- Consumes: `Pt`, `Box`, the private `scale` (same module), `SkillFrame`.
- Produces:
  - `velocityHpDomain(a: SkillFrame[], b: SkillFrame[]): { vMax: number; hpMax: number }`
  - `posPoints(frames: SkillFrame[], box: Box, distance: number, pick: (f: SkillFrame) => number, max: number): Pt[]`
  - `activationZonesByPos(acts: { start: number; end: number }[], box: Box, distance: number): { x: number; w: number }[]`
  - `gapMagnitude(gap: { bashin: number }[]): number`
  - `gapPoints(gap: { pos: number; bashin: number }[], box: Box, distance: number, mag: number): Pt[]` (zero baseline at `box.h/2`, + = up)

- [ ] **Step 1: Write the failing test**

Add to `geometry.test.ts`:

```ts
import { velocityHpDomain, posPoints, activationZonesByPos, gapMagnitude, gapPoints } from './geometry';

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
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm vitest run src/features/cm-planner/skill-trace/geometry.test.ts`
Expected: FAIL — exports not found.

- [ ] **Step 3: Implement**

Append to `geometry.ts`:

```ts
// --- Distance-axis overlay (umalator main view): velocity/HP/gap vs course position ---

/** Max velocity + max HP across BOTH runners (overlay y-domains). */
export function velocityHpDomain(a: SkillFrame[], b: SkillFrame[]): { vMax: number; hpMax: number } {
  const all = [...a, ...b];
  return { vMax: Math.max(1, ...all.map((f) => f.v)), hpMax: Math.max(1, ...all.map((f) => f.hp)) };
}

/** Per-frame series vs course position: x = pos/distance, y = pick(f)/max inverted (up = larger). */
export function posPoints(frames: SkillFrame[], box: Box, distance: number, pick: (f: SkillFrame) => number, max: number): Pt[] {
  return frames.map((f) => ({ x: scale(f.pos, distance, box.w), y: box.h - scale(pick(f), max, box.h) }));
}

/** Activation regions (metres) → x/width boxes on the distance axis (1px min width). */
export function activationZonesByPos(acts: { start: number; end: number }[], box: Box, distance: number): { x: number; w: number }[] {
  return acts.map(({ start, end }) => ({ x: scale(start, distance, box.w), w: Math.max(1, scale(end - start, distance, box.w)) }));
}

/** Largest absolute バ身 gap (symmetric y-domain; always ≥1). */
export function gapMagnitude(gap: { bashin: number }[]): number {
  return Math.max(1, ...gap.map((g) => Math.abs(g.bashin)));
}

/** Gap curve on a zero-centred band: y = h/2 − (bashin/mag)·(h/2). + = uma1 ahead = up. */
export function gapPoints(gap: { pos: number; bashin: number }[], box: Box, distance: number, mag: number): Pt[] {
  const half = box.h / 2;
  return gap.map((g) => ({ x: scale(g.pos, distance, box.w), y: half - (g.bashin / mag) * half }));
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `pnpm vitest run src/features/cm-planner/skill-trace/geometry.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/cm-planner/skill-trace/geometry.ts src/features/cm-planner/skill-trace/geometry.test.ts
git commit -m "feat(m4): distance-axis + gap geometry helpers for the track overlay

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `resolveUma2` source seam

**Files:**
- Create: `src/features/cm-planner/resolveUma2.ts`
- Test: `src/features/cm-planner/resolveUma2.test.ts`

**Interfaces:**
- Consumes: `planToOverlayBuild` (Task 1), `CmPlan`, `SimBuild`.
- Produces:
  - `type Uma2Source = { kind: 'savedPlan'; planId: string } | { kind: 'minusWishlist' } | { kind: 'reference' }`
  - `resolveUma2(source: Uma2Source, activePlan: CmPlan, savedPlans: CmPlan[]): SimBuild | null`

- [ ] **Step 1: Write the failing test**

```ts
import { resolveUma2 } from './resolveUma2';
import { planToOverlayBuild } from '@/core/simBuild';
import { makeDefaultPlan } from '@/app/ActivePlanContext';

describe('resolveUma2', () => {
  const active = { ...makeDefaultPlan(), id: 'A' };
  const other = { ...makeDefaultPlan(), id: 'B', uniqueSkillId: 'U2' };

  it('savedPlan → that plan as an overlay build', () => {
    expect(resolveUma2({ kind: 'savedPlan', planId: 'B' }, active, [active, other]))
      .toEqual(planToOverlayBuild(other));
  });
  it('savedPlan with unknown id → null', () => {
    expect(resolveUma2({ kind: 'savedPlan', planId: 'X' }, active, [active])).toBeNull();
  });
  it('unimplemented sources → null (follow-up)', () => {
    expect(resolveUma2({ kind: 'minusWishlist' }, active, [])).toBeNull();
    expect(resolveUma2({ kind: 'reference' }, active, [])).toBeNull();
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm vitest run src/features/cm-planner/resolveUma2.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
/** Pluggable uma2 (comparison build) source for the race-compare overlay.
 *  Ships 'savedPlan'; 'minusWishlist'/'reference' are typed follow-ups (return null). */
import type { CmPlan } from '@/core/types';
import type { SimBuild } from '@/sim';
import { planToOverlayBuild } from '@/core/simBuild';

export type Uma2Source =
  | { kind: 'savedPlan'; planId: string }
  | { kind: 'minusWishlist' }
  | { kind: 'reference' };

export function resolveUma2(source: Uma2Source, _activePlan: CmPlan, savedPlans: CmPlan[]): SimBuild | null {
  switch (source.kind) {
    case 'savedPlan': {
      const plan = savedPlans.find((p) => p.id === source.planId);
      return plan ? planToOverlayBuild(plan) : null;
    }
    case 'minusWishlist':
    case 'reference':
      return null; // follow-up (spec §5 / §12)
  }
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `pnpm vitest run src/features/cm-planner/resolveUma2.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/cm-planner/resolveUma2.ts src/features/cm-planner/resolveUma2.test.ts
git commit -m "feat(m4): resolveUma2 — pluggable comparison-build source seam

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `useRaceCompare` hook (auto-run + LRU)

**Files:**
- Create: `src/features/cm-planner/useRaceCompare.ts`
- Test: `src/features/cm-planner/useRaceCompare.test.tsx`

**Interfaces:**
- Consumes: `SimClient` (`@/sim/client`), `RaceCompare`, `RaceCompareRun`, `RunChoice`, `SimBuild`, `SimRaceParams`.
- Produces:
  - `interface RaceCompareCtx { uma1: SimBuild; uma2: SimBuild; race: SimRaceParams }`
  - `interface UseRaceCompareDeps { raceCompare: (u1, u2, r, n, seed?) => RaceCompare | Promise<RaceCompare>; samples?: number }`
  - `interface RaceCompareState { status: 'idle'|'running'|'done'|'na'; run: RaceCompareRun | null; runChoice: RunChoice; setRunChoice: (c: RunChoice) => void; distance: number; meanBashin: number | null }`
  - `useRaceCompare(ctx: RaceCompareCtx | undefined, enabled: boolean, deps?: UseRaceCompareDeps): RaceCompareState`
  - `clearRaceCompareCache(): void`
  - `const RACE_COMPARE_SAMPLES = 30`

- [ ] **Step 1: Write the failing test**

```tsx
import { renderHook, waitFor, act } from '@testing-library/react';
import { useRaceCompare, clearRaceCompareCache, type RaceCompareCtx } from './useRaceCompare';
import type { RaceCompare, SimBuild } from '@/sim';

const b = (spd: number, skills: string[] = []): SimBuild =>
  ({ umaId: 'u', stats: { spd, sta: 800, pow: 1000, gut: 500, wit: 850 }, strategy: 'pace',
     aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, skills });
const emptyRun = { uma1Frames: [], uma2Frames: [], uma1Acts: [], uma2Acts: [], gap: [] };
const fake = (meanBashin: number): RaceCompare =>
  ({ runs: { min: emptyRun, max: emptyRun, mean: emptyRun, median: emptyRun }, distance: 1200, nsamples: 30, meanBashin });

beforeEach(() => clearRaceCompareCache());

it('auto-runs and resolves done with the chosen run', async () => {
  const raceCompare = vi.fn(async () => fake(1.5));
  const ctx: RaceCompareCtx = { uma1: b(1150), uma2: b(1100), race: { courseId: '10101' } };
  const { result } = renderHook(() => useRaceCompare(ctx, true, { raceCompare }));
  await waitFor(() => expect(result.current.status).toBe('done'));
  expect(result.current.meanBashin).toBe(1.5);
  expect(result.current.distance).toBe(1200);
  expect(raceCompare).toHaveBeenCalledTimes(1);
});

it('memoizes identical sigs (no second sim)', async () => {
  const raceCompare = vi.fn(async () => fake(1));
  const ctx: RaceCompareCtx = { uma1: b(1150), uma2: b(1100), race: { courseId: '10101' } };
  const a = renderHook(() => useRaceCompare(ctx, true, { raceCompare }));
  await waitFor(() => expect(a.result.current.status).toBe('done'));
  renderHook(() => useRaceCompare(ctx, true, { raceCompare }));
  await waitFor(() => expect(raceCompare).toHaveBeenCalledTimes(1));
});

it('na when a build has 0 speed', async () => {
  const raceCompare = vi.fn(async () => fake(0));
  const ctx: RaceCompareCtx = { uma1: b(0), uma2: b(1100), race: { courseId: '10101' } };
  const { result } = renderHook(() => useRaceCompare(ctx, true, { raceCompare }));
  await waitFor(() => expect(result.current.status).toBe('na'));
  expect(raceCompare).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm vitest run src/features/cm-planner/useRaceCompare.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
/** Run-on-demand two-build race-compare hook. Auto-runs when enabled + a context is
 *  present; MEMOIZED by sig (course + both builds' stats + skills) in a module LRU so
 *  swapping uma2 / re-opening is instant. runChoice switches reps with no re-sim.
 *  Shared SimClient from '@/sim/client' (NOT the '@/sim' barrel) to keep the engine lazy. */
import { useEffect, useRef, useState } from 'react';
import type { RaceCompare, RaceCompareRun, RunChoice, SimBuild, SimRaceParams } from '@/sim';
import { SimClient } from '@/sim/client';

export const RACE_COMPARE_SAMPLES = 30;
const CACHE_MAX = 20;

export interface RaceCompareCtx { uma1: SimBuild; uma2: SimBuild; race: SimRaceParams; }
export interface UseRaceCompareDeps {
  raceCompare: (u1: SimBuild, u2: SimBuild, r: SimRaceParams, n: number, seed?: number) => RaceCompare | Promise<RaceCompare>;
  samples?: number;
}
export interface RaceCompareState {
  status: 'idle' | 'running' | 'done' | 'na';
  run: RaceCompareRun | null;
  runChoice: RunChoice;
  setRunChoice: (c: RunChoice) => void;
  distance: number;
  meanBashin: number | null;
}

const cache = new Map<string, RaceCompare>();
function cacheGet(sig: string) { const v = cache.get(sig); if (v) { cache.delete(sig); cache.set(sig, v); } return v; }
function cacheSet(sig: string, v: RaceCompare) {
  cache.delete(sig); cache.set(sig, v);
  while (cache.size > CACHE_MAX) { const k = cache.keys().next().value; if (k === undefined) break; cache.delete(k); }
}
export function clearRaceCompareCache() { cache.clear(); }

let client: SimClient | null = null;
function realDeps(): UseRaceCompareDeps {
  client ??= new SimClient();
  return { raceCompare: client.raceCompare.bind(client) };
}

function buildSig(b: SimBuild): string {
  const s = b.stats;
  return `${b.umaId}/${b.strategy}/${s.spd}-${s.sta}-${s.pow}-${s.gut}-${s.wit}/${[...b.skills].sort().join(',')}`;
}

export function useRaceCompare(ctx: RaceCompareCtx | undefined, enabled: boolean, deps?: UseRaceCompareDeps): RaceCompareState {
  const [status, setStatus] = useState<RaceCompareState['status']>('idle');
  const [data, setData] = useState<RaceCompare | null>(null);
  const [runChoice, setRunChoice] = useState<RunChoice>('median');
  const depsRef = useRef(deps); depsRef.current = deps;
  const token = useRef(0);

  const dead = !!ctx && (ctx.uma1.stats.spd <= 0 || ctx.uma2.stats.spd <= 0);
  const sig = ctx && !dead ? `${ctx.race.courseId}|${buildSig(ctx.uma1)}|${buildSig(ctx.uma2)}` : null;

  useEffect(() => {
    if (!enabled || !ctx) return;
    if (dead) { setStatus('na'); setData(null); return; }
    if (sig === null) return;
    const merged = depsRef.current ?? realDeps();
    const myToken = (token.current += 1);
    const cached = cacheGet(sig);
    if (cached) { setData(cached); setStatus(cached.nsamples === 0 ? 'na' : 'done'); return; }
    setStatus('running'); setData(null);
    void Promise.resolve(merged.raceCompare(ctx.uma1, ctx.uma2, ctx.race, merged.samples ?? RACE_COMPARE_SAMPLES))
      .then((rc) => {
        if (token.current !== myToken) return;
        setData(rc); setStatus(rc.nsamples === 0 ? 'na' : 'done'); cacheSet(sig, rc);
      })
      .catch(() => { if (token.current === myToken) setStatus('na'); });
    return () => { token.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sig, dead]);

  return {
    status, run: data ? data.runs[runChoice] : null, runChoice, setRunChoice,
    distance: data?.distance ?? 0, meanBashin: data?.meanBashin ?? null,
  };
}
```

- [ ] **Step 4: Run, verify it passes**

Run: `pnpm vitest run src/features/cm-planner/useRaceCompare.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/cm-planner/useRaceCompare.ts src/features/cm-planner/useRaceCompare.test.tsx
git commit -m "feat(m4): useRaceCompare hook — auto-run + LRU memo

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Track overlay-band dimensions + `RaceOverlay` layers

**Files:**
- Modify: `src/features/planner/racetrack/vendor/types.ts` (bump `ViewHeight`, add overlay-band constants)
- Create: `src/features/planner/racetrack/overlay/RaceOverlay.tsx`
- Create: `src/features/planner/racetrack/overlay/race-overlay.css`
- Test: `src/features/planner/racetrack/overlay/RaceOverlay.test.tsx`

**Interfaces:**
- Consumes: `RaceCompareRun` (Task 2), the geometry helpers (Task 5), `RaceTrackDimensions`.
- Produces: `RaceOverlay({ run, distance, showHp, skillName }: { run: RaceCompareRun; distance: number; showHp: boolean; skillName: (id: string) => string }): JSX.Element` — an SVG `<g>` group of velocity/HP lines + per-uma activation markers + gap sub-band, sized to the overlay band and translated into place. Plus exported `OVERLAY_VELO_BOX`, `OVERLAY_GAP_BOX` Boxes (for tests + reuse).

**Dimension change rationale:** the vendored bands are anchored bottom-up from `xAxisY = ViewHeight − xAxisHeight`. Increasing `ViewHeight` by `OverlayBandHeight` shifts every band down, opening exactly `OverlayBandHeight` of new space at the top between `marginTop` and `SlopeVisualizationY`. No other constant needs editing.

- [ ] **Step 1: Add the dimension constants**

In `src/features/planner/racetrack/vendor/types.ts`, inside `namespace RaceTrackDimensions`, change `ViewHeight` and add overlay constants. Replace the `ViewHeight` line:

```ts
  export const OverlayBandHeight = 132; // local mod: space at top for the race-compare overlay
  export const ViewHeight = 240 + OverlayBandHeight; // was 240; overlay band added above the slope viz
```

Then, AFTER the existing `SlopeVisualizationY` declaration, add:

```ts
  // Race-compare overlay band: the new top space [marginTop, SlopeVisualizationY].
  export const OverlayBandY = marginTop;
  export const OverlayBandRenderHeight = SlopeVisualizationY - marginTop;
  export const OverlayGapHeight = 34;                                  // bottom strip = バ身 gap
  export const OverlayVeloHeight = OverlayBandRenderHeight - OverlayGapHeight - 6; // top = velocity/HP
```

- [ ] **Step 2: Write the failing render test**

`src/features/planner/racetrack/overlay/RaceOverlay.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { RaceOverlay } from './RaceOverlay';
import type { RaceCompareRun } from '@/sim';

const run: RaceCompareRun = {
  uma1Frames: [{ t: 0, pos: 0, v: 18, hp: 100 }, { t: 1, pos: 600, v: 20, hp: 60 }, { t: 2, pos: 1200, v: 16, hp: 10 }],
  uma2Frames: [{ t: 0, pos: 0, v: 17, hp: 100 }, { t: 1, pos: 580, v: 19, hp: 65 }, { t: 2, pos: 1180, v: 15, hp: 20 }],
  uma1Acts: [{ skillId: 'S1', start: 600, end: 650 }],   // duration → zone
  uma2Acts: [{ skillId: 'S2', start: 300, end: 300 }],   // instant → marker
  gap: [{ pos: 0, bashin: 0 }, { pos: 600, bashin: 1.2 }, { pos: 1200, bashin: -0.4 }],
};

it('renders both velocity lines, hp lines (when showHp), markers and gap', () => {
  const { container } = render(
    <svg><RaceOverlay run={run} distance={1200} showHp skillName={(id) => id} /></svg>,
  );
  expect(container.querySelectorAll('.ro-velo.is-uma1, .ro-velo.is-uma2').length).toBe(2);
  expect(container.querySelectorAll('.ro-hp').length).toBe(2);
  expect(container.querySelector('.ro-zone')).toBeTruthy();   // S1 duration
  expect(container.querySelector('.ro-marker')).toBeTruthy(); // S2 instant
  expect(container.querySelector('.ro-gap')).toBeTruthy();
});

it('omits hp lines when showHp is false', () => {
  const { container } = render(<svg><RaceOverlay run={run} distance={1200} showHp={false} skillName={(id) => id} /></svg>);
  expect(container.querySelectorAll('.ro-hp').length).toBe(0);
});
```

- [ ] **Step 3: Run, verify it fails**

Run: `pnpm vitest run src/features/planner/racetrack/overlay/RaceOverlay.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `RaceOverlay`**

`src/features/planner/racetrack/overlay/RaceOverlay.tsx`:

```tsx
import './race-overlay.css';
import type { RaceCompareRun, RaceActivation } from '@/sim';
import {
  polyline, posPoints, activationZonesByPos, velocityHpDomain, gapMagnitude, gapPoints, type Box,
} from '@/features/cm-planner/skill-trace/geometry';
import { RaceTrackDimensions as D } from '../vendor/types';

export const OVERLAY_VELO_BOX: Box = { w: D.RenderWidth, h: D.OverlayVeloHeight };
export const OVERLAY_GAP_BOX: Box = { w: D.RenderWidth, h: D.OverlayGapHeight };

function MarkerLane({ acts, distance, box, cls, skillName, dy }: {
  acts: RaceActivation[]; distance: number; box: Box; cls: string; skillName: (id: string) => string; dy: number;
}) {
  const zones = activationZonesByPos(acts, box, distance);
  return (
    <g transform={`translate(0, ${dy})`}>
      {acts.map((a, i) => {
        const z = zones[i]!;
        const duration = a.end - a.start > 1;
        return duration ? (
          <rect key={i} className={`ro-zone ${cls}`} x={z.x} y={0} width={z.w} height={box.h} />
        ) : (
          <g key={i} className={`ro-marker ${cls}`} transform={`translate(${z.x}, 0)`}>
            <line x1={0} x2={0} y1={0} y2={box.h} />
            <circle cx={0} cy={0} r={2} />
            <title>{skillName(a.skillId)}</title>
          </g>
        );
      })}
    </g>
  );
}

/** SVG overlay group for the race-compare view: two velocity lines + two HP lines (toggle) +
 *  per-uma activation lanes + バ身-gap sub-band, drawn on the track's distance→x scale. */
export function RaceOverlay({ run, distance, showHp, skillName }: {
  run: RaceCompareRun; distance: number; showHp: boolean; skillName: (id: string) => string;
}) {
  const velo = OVERLAY_VELO_BOX, gapBox = OVERLAY_GAP_BOX;
  const { vMax, hpMax } = velocityHpDomain(run.uma1Frames, run.uma2Frames);
  const v1 = polyline(posPoints(run.uma1Frames, velo, distance, (f) => f.v, vMax));
  const v2 = polyline(posPoints(run.uma2Frames, velo, distance, (f) => f.v, vMax));
  const h1 = polyline(posPoints(run.uma1Frames, velo, distance, (f) => f.hp, hpMax));
  const h2 = polyline(posPoints(run.uma2Frames, velo, distance, (f) => f.hp, hpMax));
  const mag = gapMagnitude(run.gap);
  const gapLine = polyline(gapPoints(run.gap, gapBox, distance, mag));
  const gapY = D.OverlayBandY + D.OverlayVeloHeight + 6;
  return (
    <g className="race-overlay" transform={`translate(${D.marginLeft}, ${D.OverlayBandY})`}>
      {/* velocity + HP */}
      <g>
        {showHp && <polyline className="ro-hp is-uma1" points={h1} fill="none" />}
        {showHp && <polyline className="ro-hp is-uma2" points={h2} fill="none" />}
        <polyline className="ro-velo is-uma2" points={v2} fill="none" />
        <polyline className="ro-velo is-uma1" points={v1} fill="none" />
      </g>
      {/* activation lanes just below the velocity area */}
      <MarkerLane acts={run.uma1Acts} distance={distance} box={{ w: velo.w, h: 8 }} cls="is-uma1" skillName={skillName} dy={velo.h - 8} />
      <MarkerLane acts={run.uma2Acts} distance={distance} box={{ w: velo.w, h: 8 }} cls="is-uma2" skillName={skillName} dy={velo.h} />
      {/* gap sub-band (translate back to band-local coords: this group is already at OverlayBandY) */}
      <g transform={`translate(0, ${D.OverlayVeloHeight + 6})`}>
        <line className="ro-gap-zero" x1={0} y1={gapBox.h / 2} x2={gapBox.w} y2={gapBox.h / 2} />
        <polyline className="ro-gap" points={gapLine} fill="none" />
      </g>
    </g>
  );
}
```

(`gapY` is computed for clarity/reuse; the gap group is positioned via the inner translate. Remove the unused `gapY` const if the linter flags it.)

- [ ] **Step 5: Add CSS**

`src/features/planner/racetrack/overlay/race-overlay.css`:

```css
.race-overlay .ro-velo { stroke-width: 1.4; }
.race-overlay .ro-velo.is-uma1 { stroke: #2f6fed; }
.race-overlay .ro-velo.is-uma2 { stroke: #e0823d; }
.race-overlay .ro-hp { stroke-width: 1; stroke-dasharray: 3 2; opacity: 0.8; }
.race-overlay .ro-hp.is-uma1 { stroke: #7c4dff; }
.race-overlay .ro-hp.is-uma2 { stroke: #b06bd9; }
.race-overlay .ro-zone { opacity: 0.16; }
.race-overlay .ro-zone.is-uma1, .race-overlay .ro-marker.is-uma1 line, .race-overlay .ro-marker.is-uma1 circle { stroke: #2f6fed; fill: #2f6fed; }
.race-overlay .ro-zone.is-uma2, .race-overlay .ro-marker.is-uma2 line, .race-overlay .ro-marker.is-uma2 circle { stroke: #e0823d; fill: #e0823d; }
.race-overlay .ro-zone.is-uma1 { fill: #2f6fed; }
.race-overlay .ro-zone.is-uma2 { fill: #e0823d; }
.race-overlay .ro-marker line { stroke-width: 1; }
.race-overlay .ro-gap { stroke: #1f9d6b; stroke-width: 1.3; }
.race-overlay .ro-gap-zero { stroke: var(--color-foreground, #888); opacity: 0.35; stroke-dasharray: 2 2; }
```

- [ ] **Step 6: Run, verify it passes**

Run: `pnpm vitest run src/features/planner/racetrack/overlay/RaceOverlay.test.tsx`
Expected: PASS (both cases).

- [ ] **Step 7: Commit**

```bash
git add src/features/planner/racetrack/vendor/types.ts src/features/planner/racetrack/overlay/
git commit -m "feat(m4): race-compare overlay layers + track overlay-band dimensions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Wire `RaceOverlay` into `RaceTrackView`

**Files:**
- Modify: `src/features/planner/racetrack/RaceTrackView.tsx`
- Test: `src/features/planner/racetrack/RaceTrackView.test.tsx` (add cases)

**Interfaces:**
- Consumes: `RaceOverlay` (Task 8), `RaceCompareRun`.
- Produces: `RaceTrackView` gains optional props `trace?: RaceCompareRun`, `traceDistance?: number`, `showHp?: boolean`, `skillName?: (id: string) => string`. When `trace` is set, it renders `<RaceOverlay>` inside the SVG; when unset, output is unchanged (existing tests stay green).

- [ ] **Step 1: Write the failing test**

Add to `RaceTrackView.test.tsx` (reuse the file's existing `loadCourse` stub deps so no engine loads):

```tsx
import type { RaceCompareRun } from '@/sim';
const traceRun: RaceCompareRun = {
  uma1Frames: [{ t: 0, pos: 0, v: 18, hp: 100 }, { t: 1, pos: 1200, v: 16, hp: 10 }],
  uma2Frames: [{ t: 0, pos: 0, v: 17, hp: 100 }, { t: 1, pos: 1180, v: 15, hp: 20 }],
  uma1Acts: [], uma2Acts: [], gap: [{ pos: 0, bashin: 0 }, { pos: 1200, bashin: 1 }],
};

it('renders the overlay when a trace is supplied', async () => {
  const { container, findByLabelText } = render(
    <RaceTrackView courseId="10101" deps={fakeDeps} trace={traceRun} traceDistance={1200} showHp />,
  );
  await findByLabelText(/./); // wait for the track to load (reuse existing wait pattern in the file)
  expect(container.querySelector('.race-overlay')).toBeTruthy();
  expect(container.querySelectorAll('.ro-velo').length).toBe(2);
});

it('renders no overlay without a trace', async () => {
  const { container } = render(<RaceTrackView courseId="10101" deps={fakeDeps} />);
  // existing "loading"/loaded assertions still hold; overlay absent
  await waitFor(() => expect(container.querySelector('.racetrackView')).toBeTruthy());
  expect(container.querySelector('.race-overlay')).toBeNull();
});
```

Match the file's existing fake-course `deps` and async-wait helper (read the top of `RaceTrackView.test.tsx` and reuse `fakeDeps`/`waitFor` exactly as it already does).

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm vitest run src/features/planner/racetrack/RaceTrackView.test.tsx`
Expected: FAIL — `.race-overlay` not found / prop not accepted.

- [ ] **Step 3: Implement**

In `RaceTrackView.tsx`, extend the props interface and render the overlay inside the `<svg>` after `<XAxis>`:

```tsx
import type { RaceCompareRun } from '@/sim';
import { RaceOverlay } from './overlay/RaceOverlay';

interface RaceTrackViewProps {
  courseId: string;
  deps?: { loadCourse: (courseId: string) => Promise<CourseData> };
  trace?: RaceCompareRun;
  traceDistance?: number;
  showHp?: boolean;
  skillName?: (id: string) => string;
}
```

Destructure the new props (`trace`, `traceDistance`, `showHp = true`, `skillName`) in the component signature, and inside the `<svg>` add, right after `<XAxis courseDistance={course.distance} />`:

```tsx
        {trace && (
          <RaceOverlay
            run={trace}
            distance={traceDistance ?? course.distance}
            showHp={showHp}
            skillName={skillName ?? ((id) => id)}
          />
        )}
```

- [ ] **Step 4: Run, verify it passes**

Run: `pnpm vitest run src/features/planner/racetrack/RaceTrackView.test.tsx`
Expected: PASS (new + existing cases).

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/racetrack/RaceTrackView.tsx src/features/planner/racetrack/RaceTrackView.test.tsx
git commit -m "feat(m4): RaceTrackView renders the race-compare overlay when given a trace

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: `RaceComparePanel`

**Files:**
- Create: `src/features/cm-planner/RaceComparePanel.tsx`
- Create: `src/features/cm-planner/race-compare.css`
- Test: `src/features/cm-planner/RaceComparePanel.test.tsx`

**Interfaces:**
- Consumes: `planToOverlayBuild` (1), `resolveUma2`/`Uma2Source` (6), `useRaceCompare`/`RaceCompareCtx` (7), `RaceTrackView` (9), `RunChoiceToggle` (existing, `./skill-trace/SkillTraceCharts`), `CmPlan`.
- Produces: `RaceComparePanel({ plan, savedPlans, courseId, collapseSkillSignal, skillName, deps }): JSX.Element`. `deps?: { useRaceCompare?: typeof useRaceCompare }` injection for tests.

- [ ] **Step 1: Write the failing test (mock the hook — jsdom gotcha)**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { RaceComparePanel } from './RaceComparePanel';
import { makeDefaultPlan } from '@/app/ActivePlanContext';
import type { RaceCompareState } from './useRaceCompare';

vi.mock('@/features/planner/racetrack/RaceTrackView', () => ({
  RaceTrackView: (p: { trace?: unknown }) => <div data-testid="track" data-has-trace={p.trace ? '1' : '0'} />,
}));

const active = { ...makeDefaultPlan(), id: 'A', name: 'Active' };
const other = { ...makeDefaultPlan(), id: 'B', name: 'Rival B' };
const stubState = (over: Partial<RaceCompareState> = {}): RaceCompareState => ({
  status: 'done', run: { uma1Frames: [], uma2Frames: [], uma1Acts: [], uma2Acts: [], gap: [] },
  runChoice: 'median', setRunChoice: vi.fn(), distance: 1200, meanBashin: 1.3, ...over,
});

it('lists saved plans (excluding the active one) as uma2 options', () => {
  render(<RaceComparePanel plan={active} savedPlans={[active, other]} courseId="10101"
    collapseSkillSignal={0} skillName={(id) => id} deps={{ useRaceCompare: () => stubState() }} />);
  const select = screen.getByLabelText(/compare against/i) as HTMLSelectElement;
  const values = Array.from(select.options).map((o) => o.textContent);
  expect(values).toContain('Rival B');
  expect(values).not.toContain('Active');
});

it('shows the mean バ身 headline when done', () => {
  render(<RaceComparePanel plan={active} savedPlans={[active, other]} courseId="10101"
    collapseSkillSignal={0} skillName={(id) => id} deps={{ useRaceCompare: () => stubState({ meanBashin: 2.5 }) }} />);
  expect(screen.getByText(/2\.5/)).toBeTruthy();
});

it('passes the trace to the track once a uma2 is picked', () => {
  render(<RaceComparePanel plan={active} savedPlans={[active, other]} courseId="10101"
    collapseSkillSignal={0} skillName={(id) => id} deps={{ useRaceCompare: () => stubState() }} />);
  fireEvent.change(screen.getByLabelText(/compare against/i), { target: { value: 'B' } });
  expect(screen.getByTestId('track').getAttribute('data-has-trace')).toBe('1');
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm vitest run src/features/cm-planner/RaceComparePanel.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
/** M4 — two-build race-sim comparison panel (umalator main view). uma1 = active plan;
 *  uma2 = a chosen saved plan (pluggable via resolveUma2). Auto-runs runRaceCompare and
 *  overlays velocity/HP + activation markers + バ身-gap on the §0 track. Honest: a single
 *  representative vacuum run, gap is an estimate (P3). */
import './race-compare.css';
import { useMemo, useState } from 'react';
import type { CmPlan } from '@/core/types';
import { planToOverlayBuild } from '@/core/simBuild';
import { resolveUma2, type Uma2Source } from './resolveUma2';
import { useRaceCompare, type RaceCompareCtx, type RaceCompareState } from './useRaceCompare';
import { RaceTrackView } from '@/features/planner/racetrack/RaceTrackView';
import { RunChoiceToggle } from './skill-trace/SkillTraceCharts';

export interface RaceComparePanelDeps {
  useRaceCompare?: (ctx: RaceCompareCtx | undefined, enabled: boolean) => RaceCompareState;
}

export function RaceComparePanel({ plan, savedPlans, courseId, collapseSkillSignal, skillName, deps }: {
  plan: CmPlan; savedPlans: CmPlan[]; courseId: string; collapseSkillSignal: number;
  skillName: (id: string) => string; deps?: RaceComparePanelDeps;
}) {
  const [open, setOpen] = useState(false);
  const [showHp, setShowHp] = useState(true);
  const [uma2Id, setUma2Id] = useState<string>('');
  // collapse when the inventory signals a plan load (parity with the other panels)
  useMemo(() => { setOpen(false); }, [collapseSkillSignal]);

  const options = savedPlans.filter((p) => p.id !== plan.id);
  const source: Uma2Source | null = uma2Id ? { kind: 'savedPlan', planId: uma2Id } : null;
  const uma2 = source ? resolveUma2(source, plan, savedPlans) : null;
  const ctx: RaceCompareCtx | undefined = uma2
    ? { uma1: planToOverlayBuild(plan), uma2, race: { courseId } }
    : undefined;

  const useHook = deps?.useRaceCompare ?? useRaceCompare;
  const state = useHook(ctx, open && !!ctx);

  return (
    <section className="cmp-plan-card cmp-race-compare">
      <header className="cmp-plan-card-head cmp-collapse-head" data-open={open} onClick={() => setOpen((o) => !o)}>
        <span className="cmp-collapse-caret" aria-hidden>▸</span>
        Race comparison
        {state.meanBashin != null && state.status === 'done' && (
          <span className="cmp-rc-headline">{state.meanBashin >= 0 ? '+' : ''}{state.meanBashin.toFixed(2)} バ身</span>
        )}
      </header>
      {open && (
        <div className="cmp-plan-card-body">
          <div className="cmp-rc-controls" onClick={(e) => e.stopPropagation()}>
            <label>
              Compare against:{' '}
              <select value={uma2Id} onChange={(e) => setUma2Id(e.target.value)}>
                <option value="">— pick a saved plan —</option>
                {options.map((p) => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
              </select>
            </label>
            <label><input type="checkbox" checked={showHp} onChange={(e) => setShowHp(e.target.checked)} /> HP</label>
            {state.run && <RunChoiceToggle value={state.runChoice} onChange={state.setRunChoice} />}
          </div>
          {!ctx && <p className="muted small">Pick a second plan to compare two builds head-to-head.</p>}
          {ctx && state.status === 'running' && <p className="muted small">Simulating…</p>}
          {ctx && state.status === 'na' && <p className="muted small">Not simulatable on this track.</p>}
          {ctx && (
            <RaceTrackView
              courseId={courseId}
              trace={state.run ?? undefined}
              traceDistance={state.distance}
              showHp={showHp}
              skillName={skillName}
            />
          )}
          <p className="cmp-rc-caveat muted small">
            Representative vacuum run — same model as umalator's main view; gap is an estimate.
          </p>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Add minimal CSS**

`src/features/cm-planner/race-compare.css`:

```css
.cmp-race-compare .cmp-rc-headline { margin-left: auto; font-weight: 600; }
.cmp-race-compare .cmp-rc-controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
.cmp-race-compare .cmp-rc-caveat { margin-top: 6px; }
```

- [ ] **Step 5: Run, verify it passes**

Run: `pnpm vitest run src/features/cm-planner/RaceComparePanel.test.tsx`
Expected: PASS (all three cases).

- [ ] **Step 6: Commit**

```bash
git add src/features/cm-planner/RaceComparePanel.tsx src/features/cm-planner/race-compare.css src/features/cm-planner/RaceComparePanel.test.tsx
git commit -m "feat(m4): RaceComparePanel — uma2 picker + overlay + mean バ身 headline

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Mount the panel on `CmPlannerPage`

**Files:**
- Modify: `src/features/cm-planner/CmPlannerPage.tsx`
- Test: `src/features/cm-planner/CmPlannerPage.test.tsx` (add an assertion)

**Interfaces:**
- Consumes: `RaceComparePanel` (Task 10). A `skillName` resolver from game data (`useGameData`) — fall back to the id.

- [ ] **Step 1: Write the failing test**

Read `CmPlannerPage.test.tsx` to see how it renders the page (it already mocks game data / engine panels). Add an assertion that the Race comparison header appears:

```tsx
it('renders the Race comparison panel', async () => {
  renderCmPlannerPage(); // reuse the file's existing render helper
  expect(await screen.findByText(/Race comparison/i)).toBeTruthy();
});
```

If the existing tests mock the chart panels to avoid the engine, add `RaceComparePanel` to that same mock list using a lightweight stub, OR render it real (it constructs no engine until `open && ctx`). Prefer reusing the file's established mocking approach; if it mocks `UmaChartPanel`/`SkillChartPanel`, mock `RaceComparePanel` the same way and assert the stub renders.

- [ ] **Step 2: Run, verify it fails**

Run: `pnpm vitest run src/features/cm-planner/CmPlannerPage.test.tsx`
Expected: FAIL — text not found.

- [ ] **Step 3: Implement**

In `CmPlannerPage.tsx`: import the panel and a skill-name source. Add near the other imports:

```tsx
import { RaceComparePanel } from './RaceComparePanel';
```

Build a `skillName` resolver from game data. `useGameData()` is already destructured as `{ status, umaById }`; extend it to also pull a skill lookup if available (check `gameData`'s exports — if it provides `skillById`/`skillsById`, use `(id) => skillById?.get(id)?.nameEn ?? id`; otherwise pass `(id) => id` and leave a `// TODO: resolve skill names` — labels still work via id). Then add the panel inside `.cmp-main`, after `<SkillChartPanel … />`:

```tsx
          <RaceComparePanel
            plan={plan}
            savedPlans={savedPlans}
            courseId={selection.courseId}
            collapseSkillSignal={collapseSkillSignal}
            skillName={(id) => id}
          />
```

(If a real skill-name map is readily available from `useGameData`, wire it; otherwise the id fallback is acceptable for this slice — markers still render with the id in their tooltip.)

- [ ] **Step 4: Run, verify it passes**

Run: `pnpm vitest run src/features/cm-planner/CmPlannerPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/cm-planner/CmPlannerPage.tsx src/features/cm-planner/CmPlannerPage.test.tsx
git commit -m "feat(m4): mount RaceComparePanel on the planner page

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Integration — full verify, manual check, docs

**Files:**
- Modify: `CLAUDE.md` (M4 status line + mark the racetrack-overlay item done)
- Modify: `docs/modules/module-4-skill-acquisition.md` (add a short section)

- [ ] **Step 1: Full typecheck + build (race-free)**

Run: `pnpm typecheck && pnpm build`
Expected: both PASS, no errors.

- [ ] **Step 2: Full test suite**

Run: `pnpm test`
Expected: all pass (≥ 648 prior + the new tests), 0 failures. If any UI file flakes with a React-null error, re-run that single file (CLAUDE.md vitest-flake note).

- [ ] **Step 3: Manual smoke (real app)**

Run: `pnpm dev`, open the planner, ensure ≥2 saved plans exist, expand **Race comparison**, pick a second plan. Confirm: two velocity lines + HP lines on the track, activation markers, the gap curve, the mean バ身 headline, and the Best/Typical/Worst toggle switches the curves without a re-sim. Surface the tailnet URL `http://<TAILNET_HOST>:5177/` from `.env.local`. Stop the dev server before any further vitest run.

- [ ] **Step 4: Update docs**

In `CLAUDE.md`, update the M4 status to note the two-build race-compare overlay shipped, and change the "**HP / velocity / skill-activation zones overlaid on the racetrack**" open item to DONE (link this plan + the spec). In `docs/modules/module-4-skill-acquisition.md`, add a short subsection describing `runRaceCompare` / `useRaceCompare` / `RaceComparePanel` and the pluggable `Uma2Source` (savedPlan shipped; minusWishlist/reference follow-ups).

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md docs/modules/module-4-skill-acquisition.md
git commit -m "docs(m4): two-build race-compare overlay shipped; mark racetrack overlay done

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §2 prior-tool faithfulness → Task 3 wraps `runComparison`, reads both runners + all activations. ✅
- §4.1 `planToOverlayBuild` → Task 1. ✅
- §4.2 `runRaceCompare` (both runners, all-skill activations, gap curve, guards) → Task 3. ✅
- §4.3 worker/client/types plumbing → Tasks 2, 4. ✅
- §5 pluggable uma2 (savedPlan shipped) → Task 6 + Task 10 picker. ✅
- §6 `useRaceCompare` (auto-run, LRU, run-choice, lazy client) → Task 7. ✅
- §7 distance-axis + gap geometry; time helpers untouched → Task 5. ✅
- §8 unified band (ViewHeight bump, velocity/HP + markers + gap sub-band, zero-regression) → Tasks 8, 9. ✅
- §9 panel + page wiring → Tasks 10, 11. ✅
- §10 honesty labeling → Task 10 caveat + headline. ✅
- §11 testing → each task is TDD; render tests mock the hook/engine. ✅
- §13 file-change summary → matches the File Structure table. ✅

**Placeholder scan:** Task 11 leaves the `skillName` resolver as an id-fallback with a note — this is a deliberate, working slice (tooltips show the id; precise names are a low-risk follow-up if `useGameData` exposes no skill map), not an unspecified blank. All code steps contain complete code. No "TBD"/"similar to". ✅

**Type consistency:** `RaceCompare`/`RaceCompareRun`/`RaceActivation`/`GapPoint` defined in Task 2, consumed unchanged in 3/4/7/8/9/10. Hook returns `RaceCompareState` (Task 7), consumed in Task 10 (`stubState`, `meanBashin`, `run`, `runChoice`). Geometry signatures (Task 5) match `RaceOverlay` calls (Task 8). `RaceTrackView` props (Task 9) match the panel's usage (Task 10). `Uma2Source` (Task 6) matches the panel's `{ kind: 'savedPlan', planId }`. ✅
