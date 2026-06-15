# Engine Vendoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vendor the `jalbarrang/umalator-global` race-simulation engine (pinned v0.14.2, commit `c1fa2107`) into `src/sim/` as a callable, deterministic, validated bashin-delta API — the engine-first foundation that M1 (uma-vs-uma), M2 (skill-delta + multi-candidate + compare), and M3 phase-2 all build on.

**Architecture:** The engine is GPL-3.0-only (compatible with this GPL-3.0-only repo). Rather than copy thousands of engine source files (with their `@/` aliasing) into `src/`, we **vendor a prebuilt ESM bundle**: an esbuild step (the proven headless config from the engine's own spikes) compiles the three public simulators + their data services into one self-contained `src/sim/vendor/umalator.bundle.mjs`, with game data (courses, skills) baked in. We **do not patch the physics** — our mechanics corrections (additive Fast Learner, gold premium) live in `src/core`, never in the engine — so an opaque, pinned bundle is the right trade-off (reproducible, isolates the dependency, no `@/`-alias churn). A thin pure-function **adapter** maps our domain types to the engine's `IRunnerState`/`racedef`; a **Web Worker** runs the heavy Monte-Carlo off the main thread; an **L-cache** memoizes deltas by the shared-data-model key. The engine already proved it runs headless under Node/tsx and inside Web Workers, and it consumes **our exact** master.mdb skill IDs, condition DSL, and courseIds — so there is near-zero data transformation.

**Tech Stack:** TypeScript, Vite 7 (`?worker` convention, `worker.format: 'es'`), React 19, Vitest (jsdom default; `// @vitest-environment node` for sim tests), esbuild (build-time bundler, already a transitive dep via Vite — install explicitly), the vendored engine in `spikes/repos/umalator-global` (gitignored source; the built bundle is committed).

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/build-sim.mjs` | **Create.** esbuild build: engine entry → `src/sim/vendor/umalator.bundle.mjs`. Documents the pin. Run via `pnpm sim:build`. |
| `src/sim/vendor/umalator.bundle.mjs` | **Generated, committed.** The self-contained ESM engine bundle (3 simulators + data services + baked JSON). Never hand-edited. |
| `src/sim/vendor/umalator.bundle.d.ts` | **Create, hand-written.** TypeScript surface for the bundle's exports (the 3 fns + `IRunnerState`/`CourseData`/result types + services). |
| `src/sim/vendor/README.md` | **Create.** Vendoring provenance: pin, license, rebuild command, "do not edit." |
| `src/sim/types.ts` | **Create.** Our typed sim contract: `SimBuild`, `BashinStats`, `SimRaceParams`, worker request/response unions. |
| `src/sim/adapter.ts` | **Create.** Pure mappers: `toRunnerState(build)`, `toRaceParams(race)`, `resolveCourse(courseId)`, `bashinStatsFrom(result)`. |
| `src/sim/run.ts` | **Create.** Headless (no-worker) engine calls: `evalSkillDelta`, `runVacuumCompare`, `runPlannerCompare`. The pure core the worker wraps. |
| `src/sim/cache.ts` | **Create.** `simCacheKey(...)` (shared-data-model §7) + `memoizeDelta`. |
| `src/sim/engine.worker.ts` | **Create.** Web Worker: `onmessage` → `handleSimRequest` (pure, exported) → `postMessage`. |
| `src/sim/client.ts` | **Create.** Promise API over the worker (`SimClient`) with a main-thread fallback for tests/SSR. |
| `src/sim/index.ts` | **Create.** Public barrel: re-exports the typed API used by features. |
| `src/sim/*.test.ts` | **Create.** Co-located unit tests (node environment). |
| `NOTICE.md` | **Modify.** Add the vendored-engine attribution entry. |
| `package.json` | **Modify.** Add `esbuild` devDep + `sim:build` script. |
| `vite.config.ts` | **Modify.** Add `optimizeDeps.exclude` for the bundle (avoid pre-bundling the 5 MB artifact). |

---

## Task 1: Scaffold `src/sim/`, dependency, attribution

**Files:**
- Create: `src/sim/vendor/README.md`
- Modify: `package.json` (add `esbuild` devDependency + `sim:build` script)
- Modify: `NOTICE.md` (attribution)

- [ ] **Step 1: Install esbuild as a dev dependency**

Run: `pnpm add -D esbuild`
Expected: `esbuild` appears under `devDependencies` in `package.json`.

- [ ] **Step 2: Add the build script alias to `package.json`**

In `package.json`, inside `"scripts"`, add:

```json
"sim:build": "node scripts/build-sim.mjs"
```

- [ ] **Step 3: Create the vendor provenance README**

Create `src/sim/vendor/README.md`:

```markdown
# Vendored engine bundle

`umalator.bundle.mjs` is a **generated, committed** artifact — do not hand-edit.

- **Source:** jalbarrang/umalator-global, pinned **v0.14.2** (commit `c1fa2107`), GPL-3.0-only.
- **Clone location (gitignored):** `spikes/repos/umalator-global`.
- **Rebuild:** `pnpm sim:build` (runs `scripts/build-sim.mjs`).
- **Contents:** the three public simulators (`runSkillComparison`, `runComparison`,
  `runPlannerComparison`) + the engine's `coursesService`/`skillsService` with course &
  skill JSON baked in. We do NOT patch the physics; our mechanics corrections live in `src/core`.
- **License:** GPL-3.0-only (same as this repo). See `NOTICE.md`.
```

- [ ] **Step 4: Add the attribution entry to `NOTICE.md`**

Append to `NOTICE.md`:

```markdown
## Vendored simulation engine

`src/sim/vendor/umalator.bundle.mjs` is built from **jalbarrang/umalator-global**
v0.14.2 (commit `c1fa2107`), licensed **GPL-3.0-only**. It is bundled (not modified)
from the pinned source in `spikes/repos/umalator-global` via `scripts/build-sim.mjs`.
Corresponding source is the pinned commit; rebuild with `pnpm sim:build`.
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml src/sim/vendor/README.md NOTICE.md
git commit -m "chore(sim): scaffold src/sim vendor dir, esbuild dep, engine attribution"
```

---

## Task 2: Build the engine bundle

**Files:**
- Create: `scripts/build-sim.mjs`
- Generated: `src/sim/vendor/umalator.bundle.mjs` (committed)

- [ ] **Step 1: Write a failing import smoke (proves the bundle is missing)**

Create `scripts/sim-bundle-smoke.mjs`:

```js
// Throwaway: confirms the vendored bundle exists and exports the 3 simulators.
import * as sim from '../src/sim/vendor/umalator.bundle.mjs';
const need = ['runSkillComparison', 'runComparison', 'runPlannerComparison', 'coursesService', 'skillsService'];
const missing = need.filter((k) => typeof sim[k] === 'undefined');
if (missing.length) { console.error('MISSING exports:', missing); process.exit(1); }
const course = sim.coursesService.getSimCourse(10101);
const r = sim.runSkillComparison({
  trackedSkillId: '200332', nsamples: 10, course,
  racedef: { ground: 1, weather: 1, season: 3, time: 2, grade: 100 },
  runnerA: { outfitId: '', speed: 1150, stamina: 800, power: 1000, guts: 500, wisdom: 850, strategy: 'Pace Chaser', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2, skills: [] },
  runnerB: { outfitId: '', speed: 1150, stamina: 800, power: 1000, guts: 500, wisdom: 850, strategy: 'Pace Chaser', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2, skills: ['200332'] },
  options: { seed: 12345, ignoreStaminaConsumption: true },
});
if (r.results.length !== 10 || !Number.isFinite(r.mean)) { console.error('bad result', r); process.exit(1); }
console.log('BUNDLE SMOKE PASS mean=', r.mean.toFixed(4));
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/sim-bundle-smoke.mjs`
Expected: FAIL — `Cannot find module '../src/sim/vendor/umalator.bundle.mjs'`.

- [ ] **Step 3: Write the build script**

Create `scripts/build-sim.mjs`:

```js
// Builds the vendored umalator engine into one self-contained ESM bundle.
// Source: spikes/repos/umalator-global @ v0.14.2 (c1fa2107), GPL-3.0-only.
// The engine runs headless given the import.meta.env define (proven by its own
// adversarial-smoke). We re-export only the surface src/sim needs.
import { build } from 'esbuild';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = path.join(ROOT, 'spikes/repos/umalator-global');
const ENTRY = path.join(ENGINE, '__sim_entry.ts'); // temp entry inside engine (for @/ + node_modules resolution)
const OUT = path.join(ROOT, 'src/sim/vendor/umalator.bundle.mjs');

const entrySource = [
  "import '@/polyfills';",
  "export { runSkillComparison } from '@/modules/simulation/simulators/skill-compare';",
  "export { runComparison } from '@/modules/simulation/simulators/vacuum-compare';",
  "export { runPlannerComparison } from '@/modules/simulation/simulators/skill-planner-compare';",
  "export { coursesService } from '@/modules/data/services/CourseService';",
  "export { skillsService } from '@/modules/data/services/SkillService';",
].join('\n');

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(ENTRY, entrySource);
try {
  await build({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    outfile: OUT,
    absWorkingDir: ENGINE,                       // resolve node_modules + alias against the engine
    alias: { '@': path.join(ENGINE, 'src') },    // the engine's @/* → its src
    define: { 'import.meta.env': '{"DEV":false}', 'import.meta.main': 'false' },
    loader: { '.json': 'json' },
    legalComments: 'none',
    logLevel: 'info',
  });
  console.log('[build-sim] wrote', path.relative(ROOT, OUT));
} finally {
  rmSync(ENTRY, { force: true });
}
```

- [ ] **Step 4: Build the bundle**

Run: `pnpm sim:build`
Expected: `[build-sim] wrote src/sim/vendor/umalator.bundle.mjs` (a multi-MB file).

- [ ] **Step 5: Run the smoke to verify the bundle works**

Run: `node scripts/sim-bundle-smoke.mjs`
Expected: PASS — `BUNDLE SMOKE PASS mean=<number>`. If it errors on `import.meta` or a missing browser global, the `define` or `absWorkingDir` is wrong — fix before continuing.

- [ ] **Step 6: Remove the throwaway smoke; commit the bundle + build script**

```bash
rm scripts/sim-bundle-smoke.mjs
git add scripts/build-sim.mjs src/sim/vendor/umalator.bundle.mjs
git commit -m "feat(sim): vendor umalator v0.14.2 as a built ESM bundle"
```

---

## Task 3: Type the bundle surface

**Files:**
- Create: `src/sim/vendor/umalator.bundle.d.ts`
- Modify: `vite.config.ts` (exclude bundle from dep optimization)

- [ ] **Step 1: Hand-write the bundle's type declarations**

Create `src/sim/vendor/umalator.bundle.d.ts` (shapes verified from the engine source via recon):

```ts
// Types for the generated umalator.bundle.mjs (hand-written; the bundle ships no .d.ts).
// Source shapes: jalbarrang/umalator-global v0.14.2.

/** Engine runner input. Strategy + aptitudes are STRING labels; mood is -2..2. */
export interface IRunnerState {
  outfitId: string;
  speed: number;
  stamina: number;
  power: number;
  guts: number;
  wisdom: number;
  strategy: 'Front Runner' | 'Pace Chaser' | 'Late Surger' | 'End Closer' | 'Runaway';
  distanceAptitude: string; // 'S'|'A'|'B'|'C'|'D'|'E'|'F'|'G'
  surfaceAptitude: string;
  strategyAptitude: string;
  mood: -2 | -1 | 0 | 1 | 2;
  skills: string[];
  randomMobId?: number;
  linkedRunnerId?: string;
}

/** Opaque course geometry; only ever produced by coursesService.getSimCourse. */
export interface CourseData {
  readonly courseId: number;
  readonly distance: number;
  readonly surface: number; // 1=Turf, 2=Dirt
  readonly [key: string]: unknown;
}

/** Race conditions (engine accepts plain numbers; see adversarial-smoke). */
export interface RaceDef {
  ground: number;  // 1=firm
  weather: number; // 1=sunny
  season: number;
  time: number;
  grade: number;   // 100=G1
  [key: string]: unknown;
}

export interface SimOptions {
  seed?: number;
  ignoreStaminaConsumption?: boolean;
  [key: string]: unknown;
}

export interface SkillComparisonResult {
  results: number[];
  skillActivations: Record<string, unknown>;
  runData: unknown;
  min: number; max: number; mean: number; median: number;
}
export interface PlannerCompareResult {
  results: number[];
  skillActivations: Record<string, unknown>;
  min: number; max: number; mean: number; median: number;
}
export interface CompareResult {
  results: number[];
  runData: unknown;
  rushedStats: unknown;
  leadCompetitionStats: unknown;
  spurtInfo: null;
  staminaStats: { uma1: { staminaSurvivalRate: number; fullSpurtRate: number }; uma2: { staminaSurvivalRate: number; fullSpurtRate: number } };
  firstUmaStats: { uma1: { firstPlaceRate: number }; uma2: { firstPlaceRate: number } };
}

export function runSkillComparison(params: {
  trackedSkillId: string; nsamples: number; course: CourseData; racedef: RaceDef;
  runnerA: IRunnerState; runnerB: IRunnerState; options: SimOptions;
}): SkillComparisonResult;

export function runComparison(params: {
  nsamples: number; course: CourseData; racedef: RaceDef;
  uma1: IRunnerState; uma2: IRunnerState; options: SimOptions;
}): CompareResult;

export function runPlannerComparison(params: {
  nsamples: number; course: CourseData; racedef: RaceDef;
  runnerA: IRunnerState; runnerB: IRunnerState; candidateSkills: string[];
  ignoreStaminaConsumption: boolean; options: SimOptions;
}): PlannerCompareResult;

export const coursesService: { getSimCourse(courseId: number): CourseData };
export const skillsService: {
  getById(skillId: string): { name?: string } | undefined;
  isSimulatable(skillId: string): boolean;
};
```

- [ ] **Step 2: Exclude the bundle from Vite dep optimization**

In `vite.config.ts`, add (inside the config object):

```ts
optimizeDeps: {
  exclude: ['@/sim/vendor/umalator.bundle.mjs'],
},
```

- [ ] **Step 3: Verify typecheck resolves the bundle**

Create a temporary `src/sim/_typecheck.ts`:

```ts
import { runSkillComparison, coursesService } from '@/sim/vendor/umalator.bundle.mjs';
const c = coursesService.getSimCourse(10101);
export const _ok: number = runSkillComparison({
  trackedSkillId: '200332', nsamples: 1, course: c,
  racedef: { ground: 1, weather: 1, season: 3, time: 2, grade: 100 },
  runnerA: { outfitId: '', speed: 1, stamina: 1, power: 1, guts: 1, wisdom: 1, strategy: 'Pace Chaser', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2, skills: [] },
  runnerB: { outfitId: '', speed: 1, stamina: 1, power: 1, guts: 1, wisdom: 1, strategy: 'Pace Chaser', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2, skills: ['200332'] },
  options: { seed: 1 },
}).mean;
```

Run: `pnpm typecheck`
Expected: PASS (no errors). Then delete the probe: `rm src/sim/_typecheck.ts`.

- [ ] **Step 4: Commit**

```bash
git add src/sim/vendor/umalator.bundle.d.ts vite.config.ts
git commit -m "feat(sim): hand-written types for the vendored engine bundle"
```

---

## Task 4: The sim contract types

**Files:**
- Create: `src/sim/types.ts`

- [ ] **Step 1: Write the contract types**

Create `src/sim/types.ts`:

```ts
// The typed contract between src/sim and its callers (features/core).
import type { Stat } from '@/core/types';

/** Our strategy labels (shared-data-model §2). */
export type Strategy = 'front' | 'pace' | 'late' | 'end';

/** A runner build expressed in OUR domain terms. */
export interface SimBuild {
  umaId: string;
  stats: Record<Stat, number>;        // spd/sta/pow/gut/wit
  strategy: Strategy;
  /** Aptitude grades as letters, e.g. { distance: 'A', surface: 'A', strategy: 'A' }. */
  aptitudes: { distance: string; surface: string; strategy: string };
  /** Owned/learned skill ids (master.mdb string ids — same as the engine's). */
  skills: string[];
  /** -2..2; defaults to 2 (Great) at the adapter. */
  mood?: -2 | -1 | 0 | 1 | 2;
}

/** Race conditions in OUR terms; the adapter maps to the engine's numeric racedef. */
export interface SimRaceParams {
  courseId: string;            // matches CmPlan.race.courseId
  ground?: number;             // default 1 (firm)
  weather?: number;            // default 1 (sunny)
  season?: number;             // default 3
  time?: number;               // default 2
  grade?: number;              // default 100 (G1)
}

/** Bashin (horse-length) summary — the honest-numbers output (P3). */
export interface BashinStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  nsamples: number;
  /** Full per-sample distribution (for histograms / convergence display). */
  results: number[];
}

/** Worker request/response unions. */
export type SimRequest =
  | { id: number; kind: 'skillDelta'; build: SimBuild; race: SimRaceParams; skillId: string; nsamples: number; seed?: number }
  | { id: number; kind: 'vacuum'; a: SimBuild; b: SimBuild; race: SimRaceParams; nsamples: number; seed?: number }
  | { id: number; kind: 'planner'; build: SimBuild; race: SimRaceParams; candidateSkills: string[]; nsamples: number; seed?: number };

export interface VacuumResult extends BashinStats {
  /** Win-rate of A vs B and stamina survival, for the M2 compare panel. */
  aFirstPlaceRate: number;
  bFirstPlaceRate: number;
  aStaminaSurvival: number;
  bStaminaSurvival: number;
}

export type SimResponse =
  | { id: number; ok: true; kind: 'skillDelta' | 'planner'; stats: BashinStats }
  | { id: number; ok: true; kind: 'vacuum'; stats: VacuumResult }
  | { id: number; ok: false; error: string };
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/sim/types.ts
git commit -m "feat(sim): typed sim contract (SimBuild, BashinStats, request/response)"
```

---

## Task 5: Adapter — runner mapping

**Files:**
- Create: `src/sim/adapter.ts`
- Test: `src/sim/adapter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/sim/adapter.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { toRunnerState, STRATEGY_LABEL } from './adapter';
import type { SimBuild } from './types';

const build: SimBuild = {
  umaId: '100201',
  stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
  strategy: 'pace',
  aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
  skills: ['200332'],
};

describe('toRunnerState', () => {
  it('maps our stat keys to engine fields (wit -> wisdom)', () => {
    const r = toRunnerState(build);
    expect(r.speed).toBe(1150);
    expect(r.stamina).toBe(800);
    expect(r.power).toBe(1000);
    expect(r.guts).toBe(500);
    expect(r.wisdom).toBe(850); // 'wit' maps to engine 'wisdom'
  });

  it('maps strategy label and passes aptitudes + skills through', () => {
    const r = toRunnerState(build);
    expect(r.strategy).toBe('Pace Chaser');
    expect(r.distanceAptitude).toBe('A');
    expect(r.skills).toEqual(['200332']);
    expect(r.outfitId).toBe('100201');
    expect(r.mood).toBe(2); // default Great
  });

  it('STRATEGY_LABEL covers all four of our strategies', () => {
    expect(STRATEGY_LABEL).toEqual({ front: 'Front Runner', pace: 'Pace Chaser', late: 'Late Surger', end: 'End Closer' });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/sim/adapter.test.ts`
Expected: FAIL — `Cannot find module './adapter'`.

- [ ] **Step 3: Implement `toRunnerState`**

Create `src/sim/adapter.ts`:

```ts
import type { IRunnerState } from '@/sim/vendor/umalator.bundle.mjs';
import type { SimBuild, Strategy } from './types';

export const STRATEGY_LABEL: Record<Strategy, IRunnerState['strategy']> = {
  front: 'Front Runner',
  pace: 'Pace Chaser',
  late: 'Late Surger',
  end: 'End Closer',
};

/** Map OUR build to the engine's IRunnerState. Note: our 'wit' -> engine 'wisdom'. */
export function toRunnerState(build: SimBuild): IRunnerState {
  return {
    outfitId: build.umaId,
    speed: build.stats.spd,
    stamina: build.stats.sta,
    power: build.stats.pow,
    guts: build.stats.gut,
    wisdom: build.stats.wit,
    strategy: STRATEGY_LABEL[build.strategy],
    distanceAptitude: build.aptitudes.distance,
    surfaceAptitude: build.aptitudes.surface,
    strategyAptitude: build.aptitudes.strategy,
    mood: build.mood ?? 2,
    skills: [...build.skills],
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/sim/adapter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sim/adapter.ts src/sim/adapter.test.ts
git commit -m "feat(sim): adapter toRunnerState (our build -> engine IRunnerState)"
```

---

## Task 6: Adapter — race params, course resolution, result extraction

**Files:**
- Modify: `src/sim/adapter.ts`
- Modify: `src/sim/adapter.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `src/sim/adapter.test.ts`:

```ts
import { toRaceDef, resolveCourse, bashinStatsFrom } from './adapter';

describe('toRaceDef', () => {
  it('applies sensible defaults (firm/sunny/G1)', () => {
    const d = toRaceDef({ courseId: '10101' });
    expect(d).toEqual({ ground: 1, weather: 1, season: 3, time: 2, grade: 100 });
  });
  it('lets callers override conditions', () => {
    const d = toRaceDef({ courseId: '10101', ground: 2, grade: 999 });
    expect(d.ground).toBe(2);
    expect(d.grade).toBe(999);
  });
});

describe('resolveCourse', () => {
  it('looks up real engine course geometry by string courseId', () => {
    const c = resolveCourse('10101'); // Sapporo turf 1200m in the engine data
    expect(c.distance).toBe(1200);
    expect(c.surface).toBe(1); // turf
  });
  it('throws a clear error for an unknown course', () => {
    expect(() => resolveCourse('99999999')).toThrow(/course/i);
  });
});

describe('bashinStatsFrom', () => {
  it('projects the engine result onto our BashinStats', () => {
    const stats = bashinStatsFrom({ results: [1, 2, 3], min: 1, max: 3, mean: 2, median: 2, skillActivations: {}, runData: null });
    expect(stats).toEqual({ mean: 2, median: 2, min: 1, max: 3, nsamples: 3, results: [1, 2, 3] });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/sim/adapter.test.ts`
Expected: FAIL — `toRaceDef`/`resolveCourse`/`bashinStatsFrom` not exported.

- [ ] **Step 3: Implement them**

Append to `src/sim/adapter.ts`:

```ts
import { coursesService } from '@/sim/vendor/umalator.bundle.mjs';
import type { CourseData, RaceDef, SkillComparisonResult, PlannerCompareResult } from '@/sim/vendor/umalator.bundle.mjs';
import type { SimRaceParams, BashinStats } from './types';

export function toRaceDef(race: SimRaceParams): RaceDef {
  return {
    ground: race.ground ?? 1,
    weather: race.weather ?? 1,
    season: race.season ?? 3,
    time: race.time ?? 2,
    grade: race.grade ?? 100,
  };
}

/** Resolve our string courseId to the engine's CourseData. Throws if unknown. */
export function resolveCourse(courseId: string): CourseData {
  const numeric = Number(courseId);
  const course = coursesService.getSimCourse(numeric);
  if (!course || typeof course.distance !== 'number') {
    throw new Error(`Unknown course: ${courseId}`);
  }
  return course;
}

/** Project an engine skill/planner result onto our honest BashinStats. */
export function bashinStatsFrom(r: SkillComparisonResult | PlannerCompareResult): BashinStats {
  return { mean: r.mean, median: r.median, min: r.min, max: r.max, nsamples: r.results.length, results: r.results };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/sim/adapter.test.ts`
Expected: PASS (all adapter tests).

- [ ] **Step 5: Commit**

```bash
git add src/sim/adapter.ts src/sim/adapter.test.ts
git commit -m "feat(sim): adapter race-def defaults, course resolution, result projection"
```

---

## Task 7: Headless `evalSkillDelta`

**Files:**
- Create: `src/sim/run.ts`
- Test: `src/sim/run.test.ts`

- [ ] **Step 1: Write the failing test (value + determinism)**

Create `src/sim/run.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { evalSkillDelta } from './run';
import type { SimBuild } from './types';

const build: SimBuild = {
  umaId: '',
  stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
  strategy: 'pace',
  aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
  skills: [],
};

describe('evalSkillDelta', () => {
  it('returns a finite mean bashin over nsamples for a real skill', () => {
    // Corner Adept ○ (200332) on Sapporo turf 1200m (10101).
    const stats = evalSkillDelta(build, { courseId: '10101' }, '200332', 30, 12345);
    expect(stats.nsamples).toBe(30);
    expect(Number.isFinite(stats.mean)).toBe(true);
    expect(stats.results).toHaveLength(30);
  });

  it('is deterministic for a fixed seed', () => {
    const a = evalSkillDelta(build, { courseId: '10101' }, '200332', 20, 999);
    const b = evalSkillDelta(build, { courseId: '10101' }, '200332', 20, 999);
    expect(b.results).toEqual(a.results);
    expect(b.mean).toBe(a.mean);
  });

  it('returns a zeroed result for a non-simulatable skill (no throw)', () => {
    const stats = evalSkillDelta(build, { courseId: '10101' }, '000000', 10, 1);
    expect(stats.mean).toBe(0);
    expect(stats.nsamples).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/sim/run.test.ts`
Expected: FAIL — `Cannot find module './run'`.

- [ ] **Step 3: Implement `evalSkillDelta`**

Create `src/sim/run.ts`:

```ts
import { runSkillComparison, skillsService } from '@/sim/vendor/umalator.bundle.mjs';
import { toRunnerState, toRaceDef, resolveCourse, bashinStatsFrom } from './adapter';
import type { SimBuild, SimRaceParams, BashinStats } from './types';

const EMPTY: BashinStats = { mean: 0, median: 0, min: 0, max: 0, nsamples: 0, results: [] };

/** With-vs-without bashin delta for adding `skillId` to `build` on `race`'s course. */
export function evalSkillDelta(
  build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed = 0,
): BashinStats {
  if (!skillsService.isSimulatable(skillId)) return { ...EMPTY };
  const runnerA = toRunnerState(build);
  const runnerB = toRunnerState({ ...build, skills: [...build.skills, skillId] });
  const result = runSkillComparison({
    trackedSkillId: skillId,
    nsamples,
    course: resolveCourse(race.courseId),
    racedef: toRaceDef(race),
    runnerA,
    runnerB,
    options: { seed, ignoreStaminaConsumption: false },
  });
  return bashinStatsFrom(result);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/sim/run.test.ts`
Expected: PASS (3 tests). If the determinism test fails, the engine seed isn't threading — confirm `options.seed` is passed (it is in the code above).

- [ ] **Step 5: Commit**

```bash
git add src/sim/run.ts src/sim/run.test.ts
git commit -m "feat(sim): headless evalSkillDelta (deterministic with-vs-without bashin)"
```

---

## Task 8: Headless `runVacuumCompare` + `runPlannerCompare`

**Files:**
- Modify: `src/sim/run.ts`
- Modify: `src/sim/run.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `src/sim/run.test.ts`:

```ts
import { runVacuumCompare, runPlannerCompare } from './run';

const buildB: SimBuild = { ...build, stats: { spd: 1100, sta: 850, pow: 950, gut: 520, wit: 880 } };

describe('runVacuumCompare', () => {
  it('returns bashin gap + first-place + stamina rates for A vs B', () => {
    const r = runVacuumCompare(build, buildB, { courseId: '10101' }, 30, 7);
    expect(r.nsamples).toBe(30);
    expect(Number.isFinite(r.mean)).toBe(true);
    expect(r.aFirstPlaceRate).toBeGreaterThanOrEqual(0);
    expect(r.aFirstPlaceRate).toBeLessThanOrEqual(1);
    expect(r.aStaminaSurvival).toBeGreaterThanOrEqual(0);
  });
});

describe('runPlannerCompare', () => {
  it('returns a bashin delta tracking candidate skills', () => {
    const r = runPlannerCompare(build, { courseId: '10101' }, ['200332'], 20, 3);
    expect(r.nsamples).toBe(20);
    expect(Number.isFinite(r.mean)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/sim/run.test.ts`
Expected: FAIL — `runVacuumCompare`/`runPlannerCompare` not exported.

- [ ] **Step 3: Implement them**

Append to `src/sim/run.ts`:

```ts
import { runComparison, runPlannerComparison } from '@/sim/vendor/umalator.bundle.mjs';
import type { VacuumResult } from './types';

/** A-vs-B head-to-head (M1 inheritance compare, M2 vs-veteran). */
export function runVacuumCompare(
  a: SimBuild, b: SimBuild, race: SimRaceParams, nsamples: number, seed = 0,
): VacuumResult {
  const r = runComparison({
    nsamples,
    course: resolveCourse(race.courseId),
    racedef: toRaceDef(race),
    uma1: toRunnerState(a),
    uma2: toRunnerState(b),
    options: { seed, ignoreStaminaConsumption: false },
  });
  return {
    mean: mean(r.results), median: median(r.results),
    min: r.results.length ? Math.min(...r.results) : 0,
    max: r.results.length ? Math.max(...r.results) : 0,
    nsamples: r.results.length, results: r.results,
    aFirstPlaceRate: r.firstUmaStats.uma1.firstPlaceRate,
    bFirstPlaceRate: r.firstUmaStats.uma2.firstPlaceRate,
    aStaminaSurvival: r.staminaStats.uma1.staminaSurvivalRate,
    bStaminaSurvival: r.staminaStats.uma2.staminaSurvivalRate,
  };
}

/** Multi-candidate delta (M2 basket sims). */
export function runPlannerCompare(
  build: SimBuild, race: SimRaceParams, candidateSkills: string[], nsamples: number, seed = 0,
): BashinStats {
  const r = runPlannerComparison({
    nsamples,
    course: resolveCourse(race.courseId),
    racedef: toRaceDef(race),
    runnerA: toRunnerState(build),
    runnerB: toRunnerState({ ...build, skills: [...build.skills, ...candidateSkills] }),
    candidateSkills,
    ignoreStaminaConsumption: false,
    options: { seed },
  });
  return bashinStatsFrom(r);
}

function mean(xs: number[]): number { return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0; }
function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/sim/run.test.ts`
Expected: PASS (all run tests).

- [ ] **Step 5: Commit**

```bash
git add src/sim/run.ts src/sim/run.test.ts
git commit -m "feat(sim): runVacuumCompare + runPlannerCompare headless wrappers"
```

---

## Task 9: Fidelity validation vs the upstream engine

**Files:**
- Create: `src/sim/fidelity.test.ts`

Rationale: our bundle is built from the same commit as the upstream engine, so for identical inputs + seed it must reproduce the upstream `adversarial-smoke` mean **exactly**. That is a stronger, self-contained check than chasing external VFalator numbers (the engine *is* umalator). This task records the upstream reference and asserts parity.

- [ ] **Step 1: Capture the upstream reference number**

Run the engine's own headless smoke to get the canonical mean:

Run: `cd spikes/repos/umalator-global && pnpm exec tsx scripts/adversarial-smoke.ts`
Expected: prints `[result] { ... meanBashin: '<NUMBER>' ... }` then `ADVERSARIAL SMOKE: PASS`. **Record `<NUMBER>`** (e.g. `0.3xxx`) — you paste it into the test below.

- [ ] **Step 2: Write the parity + sanity test**

Create `src/sim/fidelity.test.ts` (replace `EXPECTED_MEAN` with the recorded value):

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { evalSkillDelta } from './run';
import type { SimBuild } from './types';

// Exact inputs from the engine's own scripts/adversarial-smoke.ts.
const smokeBuild: SimBuild = {
  umaId: '',
  stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
  strategy: 'pace',
  aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
  skills: [],
};
// NOTE: the upstream smoke runs with ignoreStaminaConsumption: true; mirror that here
// by passing the same flag. evalSkillDelta uses false, so this test calls the engine
// path with the smoke's exact options via a dedicated helper.
const EXPECTED_MEAN = 0; // <-- paste the value recorded in Step 1

describe('vendored bundle fidelity', () => {
  it('reproduces the upstream adversarial-smoke mean for the same seed', () => {
    // Recreate the smoke exactly: 50 samples, seed 12345, ignoreStaminaConsumption true.
    const { runSkillComparison, coursesService } = require('@/sim/vendor/umalator.bundle.mjs');
    const course = coursesService.getSimCourse(10101);
    const runner = {
      outfitId: '', speed: 1150, stamina: 800, power: 1000, guts: 500, wisdom: 850,
      strategy: 'Pace Chaser', distanceAptitude: 'A', surfaceAptitude: 'A', strategyAptitude: 'A', mood: 2, skills: [] as string[],
    };
    const r = runSkillComparison({
      trackedSkillId: '200332', nsamples: 50, course,
      racedef: { ground: 1, weather: 1, season: 3, time: 2, grade: 100 },
      runnerA: runner, runnerB: { ...runner, skills: ['200332'] },
      options: { seed: 12345, ignoreStaminaConsumption: true },
    });
    expect(r.results).toHaveLength(50);
    expect(Number(r.mean.toFixed(4))).toBe(Number(EXPECTED_MEAN.toFixed(4)));
  });

  it('Corner Adept gives a non-negative mean on a cornered course (sanity)', () => {
    const stats = evalSkillDelta(smokeBuild, { courseId: '10101' }, '200332', 50, 12345);
    expect(stats.mean).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 3: Run to verify pass**

Run: `pnpm vitest run src/sim/fidelity.test.ts`
Expected: PASS (2 tests). If parity fails, the bundle diverged from upstream (re-run `pnpm sim:build` from the correct pin).

- [ ] **Step 4: Commit**

```bash
git add src/sim/fidelity.test.ts
git commit -m "test(sim): fidelity parity vs upstream adversarial-smoke + sanity"
```

---

## Task 10: L-cache

**Files:**
- Create: `src/sim/cache.ts`
- Test: `src/sim/cache.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/sim/cache.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { simCacheKey, makeDeltaCache } from './cache';
import type { SimBuild, SimRaceParams } from './types';

const build: SimBuild = {
  umaId: '', stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
  strategy: 'pace', aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, skills: [],
};
const race: SimRaceParams = { courseId: '10101' };

describe('simCacheKey', () => {
  it('is stable across stat order and bucketed', () => {
    const k1 = simCacheKey(build, race, '200332', 'v1');
    const reordered = { ...build, stats: { wit: 850, spd: 1150, sta: 800, pow: 1000, gut: 500 } };
    expect(simCacheKey(reordered, race, '200332', 'v1')).toBe(k1);
  });
  it('changes when course, skill, strategy, or dataVersion changes', () => {
    const base = simCacheKey(build, race, '200332', 'v1');
    expect(simCacheKey(build, { courseId: '10901' }, '200332', 'v1')).not.toBe(base);
    expect(simCacheKey(build, race, '200999', 'v1')).not.toBe(base);
    expect(simCacheKey({ ...build, strategy: 'front' }, race, '200332', 'v1')).not.toBe(base);
    expect(simCacheKey(build, race, '200332', 'v2')).not.toBe(base);
  });
});

describe('makeDeltaCache', () => {
  it('memoizes by key — computes once per distinct key', () => {
    const compute = vi.fn(() => ({ mean: 1, median: 1, min: 1, max: 1, nsamples: 1, results: [1] }));
    const cache = makeDeltaCache('v1');
    cache.get(build, race, '200332', compute);
    cache.get(build, race, '200332', compute);
    expect(compute).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/sim/cache.test.ts`
Expected: FAIL — `Cannot find module './cache'`.

- [ ] **Step 3: Implement the cache**

Create `src/sim/cache.ts`:

```ts
import type { SimBuild, SimRaceParams, BashinStats } from './types';

/** Bucket stats to 50-pt bins so near-identical builds share a key (shared-data-model §7). */
function bucketStats(build: SimBuild): string {
  const order: Array<keyof SimBuild['stats']> = ['spd', 'sta', 'pow', 'gut', 'wit'];
  return order.map((k) => Math.round(build.stats[k] / 50)).join('.');
}
function aptHash(build: SimBuild): string {
  return `${build.aptitudes.distance}${build.aptitudes.surface}${build.aptitudes.strategy}`;
}

/** Shared L-cache key: (courseId, strategy, bucketedStats, aptitudes, skillId, dataVersion). */
export function simCacheKey(build: SimBuild, race: SimRaceParams, skillId: string, dataVersion: string): string {
  return [race.courseId, build.strategy, bucketStats(build), aptHash(build), skillId, dataVersion].join('|');
}

export function makeDeltaCache(dataVersion: string) {
  const store = new Map<string, BashinStats>();
  return {
    get(build: SimBuild, race: SimRaceParams, skillId: string, compute: () => BashinStats): BashinStats {
      const key = simCacheKey(build, race, skillId, dataVersion);
      const hit = store.get(key);
      if (hit) return hit;
      const value = compute();
      store.set(key, value);
      return value;
    },
    size: () => store.size,
    clear: () => store.clear(),
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/sim/cache.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sim/cache.ts src/sim/cache.test.ts
git commit -m "feat(sim): shared L-cache key + memoizing delta cache"
```

---

## Task 11: Worker, client, public API

**Files:**
- Create: `src/sim/engine.worker.ts`
- Create: `src/sim/client.ts`
- Create: `src/sim/index.ts`
- Test: `src/sim/worker-core.test.ts`
- Test: `src/sim/client.test.ts`

- [ ] **Step 1: Write the failing test for the pure worker core**

Create `src/sim/worker-core.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { handleSimRequest } from './engine.worker';
import type { SimBuild } from './types';

const build: SimBuild = {
  umaId: '', stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
  strategy: 'pace', aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, skills: [],
};

describe('handleSimRequest', () => {
  it('handles a skillDelta request', () => {
    const res = handleSimRequest({ id: 1, kind: 'skillDelta', build, race: { courseId: '10101' }, skillId: '200332', nsamples: 10, seed: 1 });
    expect(res.ok).toBe(true);
    if (res.ok && res.kind === 'skillDelta') expect(res.stats.nsamples).toBe(10);
  });
  it('returns ok:false with a message on a bad course', () => {
    const res = handleSimRequest({ id: 2, kind: 'skillDelta', build, race: { courseId: '99999999' }, skillId: '200332', nsamples: 5 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/course/i);
  });
  it('handles a vacuum request with first-place rates', () => {
    const res = handleSimRequest({ id: 3, kind: 'vacuum', a: build, b: build, race: { courseId: '10101' }, nsamples: 10, seed: 2 });
    expect(res.ok && res.kind === 'vacuum').toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/sim/worker-core.test.ts`
Expected: FAIL — `Cannot find module './engine.worker'`.

- [ ] **Step 3: Implement the worker (pure core + thin shell)**

Create `src/sim/engine.worker.ts`:

```ts
import { evalSkillDelta, runVacuumCompare, runPlannerCompare } from './run';
import type { SimRequest, SimResponse } from './types';

/** Pure request handler — unit-testable without a real Worker. */
export function handleSimRequest(req: SimRequest): SimResponse {
  try {
    switch (req.kind) {
      case 'skillDelta':
        return { id: req.id, ok: true, kind: 'skillDelta', stats: evalSkillDelta(req.build, req.race, req.skillId, req.nsamples, req.seed) };
      case 'planner':
        return { id: req.id, ok: true, kind: 'planner', stats: runPlannerCompare(req.build, req.race, req.candidateSkills, req.nsamples, req.seed) };
      case 'vacuum':
        return { id: req.id, ok: true, kind: 'vacuum', stats: runVacuumCompare(req.a, req.b, req.race, req.nsamples, req.seed) };
    }
  } catch (e) {
    return { id: req.id, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// Worker shell (ignored under the node test environment, which has no `self`).
declare const self: { onmessage: ((e: { data: SimRequest }) => void) | null; postMessage: (m: SimResponse) => void } | undefined;
if (typeof self !== 'undefined' && 'postMessage' in (self as object)) {
  (self as NonNullable<typeof self>).onmessage = (e) => {
    (self as NonNullable<typeof self>).postMessage(handleSimRequest(e.data));
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run src/sim/worker-core.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing client test (fake worker)**

Create `src/sim/client.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { SimClient } from './client';
import { handleSimRequest } from './engine.worker';
import type { SimRequest, SimResponse } from './types';

/** Minimal fake Worker: routes posts through the real pure handler, async. */
class FakeWorker {
  onmessage: ((e: { data: SimResponse }) => void) | null = null;
  postMessage(req: SimRequest) {
    queueMicrotask(() => this.onmessage?.({ data: handleSimRequest(req) }));
  }
  terminate() {}
}

describe('SimClient', () => {
  it('resolves a skillDelta request to BashinStats', async () => {
    const client = new SimClient(() => new FakeWorker() as unknown as Worker);
    const stats = await client.skillDelta(
      { umaId: '', stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 }, strategy: 'pace', aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, skills: [] },
      { courseId: '10101' }, '200332', 10, 1,
    );
    expect(stats.nsamples).toBe(10);
  });

  it('rejects when the worker reports an error', async () => {
    const client = new SimClient(() => new FakeWorker() as unknown as Worker);
    await expect(client.skillDelta(
      { umaId: '', stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 }, strategy: 'pace', aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, skills: [] },
      { courseId: '99999999' }, '200332', 5,
    )).rejects.toThrow(/course/i);
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `pnpm vitest run src/sim/client.test.ts`
Expected: FAIL — `Cannot find module './client'`.

- [ ] **Step 7: Implement the client**

Create `src/sim/client.ts`:

```ts
import type { SimBuild, SimRaceParams, SimRequest, SimResponse, BashinStats, VacuumResult } from './types';

type WorkerFactory = () => Worker;

/** Default factory uses Vite's ?worker import; tests inject a fake. */
function defaultFactory(): Worker {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore -- Vite resolves the ?worker suffix at build time.
  return new (require('./engine.worker?worker').default)();
}

export class SimClient {
  private worker: Worker;
  private seq = 0;
  private pending = new Map<number, { resolve: (r: SimResponse) => void; reject: (e: Error) => void }>();

  constructor(factory: WorkerFactory = defaultFactory) {
    this.worker = factory();
    this.worker.onmessage = (e: MessageEvent<SimResponse>) => {
      const p = this.pending.get(e.data.id);
      if (!p) return;
      this.pending.delete(e.data.id);
      p.resolve(e.data);
    };
  }

  private send(req: Omit<SimRequest, 'id'>): Promise<SimResponse> {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...req, id } as SimRequest);
    });
  }

  async skillDelta(build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed?: number): Promise<BashinStats> {
    const res = await this.send({ kind: 'skillDelta', build, race, skillId, nsamples, seed });
    if (!res.ok) throw new Error(res.error);
    return res.stats as BashinStats;
  }

  async vacuum(a: SimBuild, b: SimBuild, race: SimRaceParams, nsamples: number, seed?: number): Promise<VacuumResult> {
    const res = await this.send({ kind: 'vacuum', a, b, race, nsamples, seed });
    if (!res.ok) throw new Error(res.error);
    return res.stats as VacuumResult;
  }

  async planner(build: SimBuild, race: SimRaceParams, candidateSkills: string[], nsamples: number, seed?: number): Promise<BashinStats> {
    const res = await this.send({ kind: 'planner', build, race, candidateSkills, nsamples, seed });
    if (!res.ok) throw new Error(res.error);
    return res.stats as BashinStats;
  }

  dispose() { this.worker.terminate(); this.pending.clear(); }
}
```

- [ ] **Step 8: Run to verify pass**

Run: `pnpm vitest run src/sim/client.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: Create the public barrel + full gate**

Create `src/sim/index.ts`:

```ts
export type { SimBuild, SimRaceParams, BashinStats, VacuumResult, Strategy } from './types';
export { evalSkillDelta, runVacuumCompare, runPlannerCompare } from './run';
export { simCacheKey, makeDeltaCache } from './cache';
export { SimClient } from './client';
```

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all PASS. The build must succeed with the `?worker` import (Vite handles it). If the `require('./engine.worker?worker')` line breaks the build, replace `defaultFactory` with a static top-of-file import:
```ts
import EngineWorker from './engine.worker?worker';
function defaultFactory(): Worker { return new EngineWorker(); }
```
(and remove the inline `require`).

- [ ] **Step 10: Commit**

```bash
git add src/sim/engine.worker.ts src/sim/client.ts src/sim/index.ts src/sim/worker-core.test.ts src/sim/client.test.ts
git commit -m "feat(sim): web-worker engine, promise client, public API barrel"
```

---

## Self-Review

**1. Spec coverage** (engine-first foundation per the four module specs + shared-data-model):
- Δ L per skill (M4/M2) → `evalSkillDelta` (Task 7). ✅
- uma-vs-uma compare (M1 inheritance compare, M2 vs-veteran) → `runVacuumCompare` with first-place + stamina rates (Task 8). ✅
- multi-candidate basket delta (M2) → `runPlannerCompare` (Task 8). ✅
- shared L-cache key (shared-data-model §7) → `simCacheKey` + `makeDeltaCache` (Task 10). ✅
- off-main-thread Monte-Carlo → Web Worker + `SimClient` (Task 11). ✅
- determinism / honest numbers (P3) → seed threading + `BashinStats.results` distribution + fidelity parity (Tasks 7, 9). ✅
- GPL attribution (P1/license) → `NOTICE.md` + vendor README (Tasks 1–2). ✅
- *Out of scope for THIS plan (later plans):* the CmPlan type migration (plan 2), M1/M2/M3 features, `evalSkillDelta` ↔ M4 cache wiring (M2 plan).

**2. Placeholder scan:** `EXPECTED_MEAN = 0` in Task 9 is a deliberate fill-in with an explicit Step-1 instruction to record the real value — not a silent TODO. No other placeholders.

**3. Type consistency:** `SimBuild`/`SimRaceParams`/`BashinStats`/`VacuumResult`/`SimRequest`/`SimResponse` defined once (Task 4) and used consistently. `toRunnerState`/`toRaceDef`/`resolveCourse`/`bashinStatsFrom` (Tasks 5–6) consumed unchanged by `run.ts` (Tasks 7–8). `handleSimRequest` (Task 11) consumes `run.ts` exports. `simCacheKey`/`makeDeltaCache` signatures match between Task 10 def and test. The bundle's `.d.ts` (Task 3) is the single source for engine types used by the adapter.

**Risk flagged for the executor:** if `pnpm sim:build` fails on engine `node_modules` resolution, confirm `spikes/repos/umalator-global` has its deps installed (`pnpm install` there) — `absWorkingDir` points esbuild at it. If the worker `?worker` import misbehaves under Vitest, the node tests already bypass it (they import `handleSimRequest`/`SimClient`-with-fake-worker directly), so only the production `build` exercises the real worker.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-15-engine-vendoring.md`. Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
