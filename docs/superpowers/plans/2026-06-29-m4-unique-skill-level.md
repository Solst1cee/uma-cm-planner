# Unique-skill Level (Lv1–6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user set a plan's unique-skill level (Lv1–6) and have that level scale the unique skill's effect in the unique-skill chart, mini-sim, and full-sim, surfaced as a `⟨ − Lv5 + ⟩ +X.XX` control on the sidebar plate.

**Architecture:** A per-skill level rides on `SimBuild.skillLevels` through the adapter into the runner state; a vendored-engine patch multiplies each effect's `modifier` by `coef(ability_type, level)/10000` (datamined `skill_level_value` coef table baked into the engine). `CmPlan.uniqueSkillLevel` (default 5) feeds it. The unique-skill chart and a new `useUniqueSkillL` hook become level-aware so the plate's `+L` matches the chart.

**Tech Stack:** TypeScript, React 19, Vitest (jsdom), Dexie, the vendored umalator engine (`src/sim/`, `pnpm sim:build`).

## Global Constraints

- **Range Lv1–6; default Lv5.** Reads use `plan.uniqueSkillLevel ?? 5`. Engine: absent level / Lv1 ⇒ coef ×1.0 ⇒ byte-identical to upstream (fidelity backstop).
- **No Dexie bump** — `uniqueSkillLevel` is a non-indexed optional field.
- **Honest numbers (P3):** scaling formula `effective_modifier = base × coef(ability_type, level)/10000`, coef from master.mdb `skill_level_value`. Verify the engine's embedded base modifier is the **Lv1** value (Shooting Star `100011` speed=3500) before applying coef — never double-scale.
- **Engine source is the gitignored vendored clone** (`spikes/repos/umalator-global/src/`). Edit clone → capture `engine-patches/2026-06-29-skill-level-scaling.patch` → `pnpm sim:build` → commit regenerated bundle. Precedent: `engine-patches/2026-06-22-multifire.patch`.
- **Provenance:** record schema source (umamusu-utils queries.txt / master.mdb) + behavior source (umareference.com unique-skills) in `docs/provenance.md`.
- **Tests:** `pnpm vitest run <file>` for a single file; `pnpm typecheck` and `pnpm build` are race-free (prefer them; vitest can flake if a dev server is running — re-run a failing UI file before trusting it).
- **Commit** after each task. Branch is the current worktree branch.

---

### Task 1: `CmPlan.uniqueSkillLevel` field + default

**Files:**
- Modify: `src/core/types.ts:351-374` (CmPlan interface)
- Modify: `src/app/ActivePlanContext.tsx:30-63` (makeDefaultPlan)
- Test: `src/app/ActivePlanContext.test.tsx` (create if absent) or extend existing default-plan test

**Interfaces:**
- Produces: `CmPlan.uniqueSkillLevel?: 1 | 2 | 3 | 4 | 5 | 6`; `makeDefaultPlan()` returns a plan with `uniqueSkillLevel === 5`.

- [ ] **Step 1: Write the failing test**

In `src/app/ActivePlanContext.test.tsx` (add to the existing describe, or create the file with the import already used elsewhere — `import { makeDefaultPlan } from './ActivePlanContext';`):

```typescript
import { describe, it, expect } from 'vitest';
import { makeDefaultPlan } from './ActivePlanContext';

describe('makeDefaultPlan unique skill level', () => {
  it('defaults uniqueSkillLevel to 5', () => {
    expect(makeDefaultPlan().uniqueSkillLevel).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/app/ActivePlanContext.test.tsx`
Expected: FAIL — `uniqueSkillLevel` is `undefined`, not `5`.

- [ ] **Step 3: Add the field to CmPlan**

In `src/core/types.ts`, inside the `CmPlan` interface, add after `uniqueIsInherited?: boolean;`:

```typescript
  uniqueIsInherited?: boolean;
  /** Unique-skill level 1–6 (in-game cap). Absent ⇒ treat as 5. Scales the unique effect's modifier. */
  uniqueSkillLevel?: 1 | 2 | 3 | 4 | 5 | 6;
```

- [ ] **Step 4: Seed the default**

In `src/app/ActivePlanContext.tsx` `makeDefaultPlan`, add to the `draft` object literal (e.g. right after `uniqueSkillId: '',`):

```typescript
    uniqueSkillId: '',
    uniqueSkillLevel: 5,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/app/ActivePlanContext.test.tsx`
Expected: PASS.

- [ ] **Step 6: Typecheck + commit**

```bash
pnpm typecheck
git add src/core/types.ts src/app/ActivePlanContext.tsx src/app/ActivePlanContext.test.tsx
git commit -m "feat(m4): add CmPlan.uniqueSkillLevel (default 5)"
```

---

### Task 2: `SimBuild.skillLevels` + adapter + runner-state type

**Files:**
- Modify: `src/sim/types.ts:11-21` (SimBuild)
- Modify: `src/sim/adapter.ts:13-28` (toRunnerState)
- Modify: `src/sim/vendor/umalator.bundle.d.mts:5-20` (IRunnerState)
- Modify: `src/sim/run.ts:11-13` (simulatableBase — preservation test only)
- Test: `src/sim/adapter.test.ts` (extend; create if absent)

**Interfaces:**
- Consumes: `CmPlan.uniqueSkillLevel` (Task 1).
- Produces: `SimBuild.skillLevels?: Record<string, number>`; `toRunnerState` copies it to `IRunnerState.skillLevels`; `simulatableBase` preserves it.

- [ ] **Step 1: Write the failing test**

In `src/sim/adapter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { toRunnerState } from './adapter';
import type { SimBuild } from './types';

const build: SimBuild = {
  umaId: '106801',
  stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 },
  strategy: 'front',
  aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
  skills: ['100011'],
  skillLevels: { '100011': 6 },
};

describe('toRunnerState skillLevels', () => {
  it('maps skillLevels onto the runner state', () => {
    expect(toRunnerState(build).skillLevels).toEqual({ '100011': 6 });
  });
  it('omits skillLevels when not provided', () => {
    const { skillLevels, ...rest } = build;
    expect(toRunnerState(rest).skillLevels).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/sim/adapter.test.ts`
Expected: FAIL — `skillLevels` does not exist on `SimBuild`/`IRunnerState` (type error) and is undefined at runtime.

- [ ] **Step 3: Add `skillLevels` to SimBuild**

In `src/sim/types.ts`, inside `SimBuild`, add after the `skills` field:

```typescript
  skills: string[];
  /** Per-skill level (1–6). Skills absent here use Lv1 (engine default). Keyed by master.mdb skill id. */
  skillLevels?: Record<string, number>;
```

- [ ] **Step 4: Add `skillLevels` to IRunnerState (vendor d.mts)**

In `src/sim/vendor/umalator.bundle.d.mts`, inside `IRunnerState`, add after `skills: string[];`:

```typescript
  skills: string[];
  /** Per-skill level (1–6) scaling the effect modifier; absent ⇒ Lv1. */
  skillLevels?: Record<string, number>;
```

- [ ] **Step 5: Map it in toRunnerState**

In `src/sim/adapter.ts`, change the return in `toRunnerState` to include `skillLevels` only when present:

```typescript
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
    ...(build.skillLevels ? { skillLevels: { ...build.skillLevels } } : {}),
  };
}
```

- [ ] **Step 6: Add the simulatableBase preservation test**

`simulatableBase` already spreads `...build`, so `skillLevels` is preserved with no code change. Lock it with a test in `src/sim/run.test.ts` (extend; create if absent):

```typescript
import { describe, it, expect } from 'vitest';
import { simulatableBase } from './run';
import type { SimBuild } from './types';

describe('simulatableBase preserves skillLevels', () => {
  it('keeps the skillLevels map after filtering skills', () => {
    const b: SimBuild = {
      umaId: '106801', stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 },
      strategy: 'front', aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
      skills: ['100011'], skillLevels: { '100011': 5 },
    };
    expect(simulatableBase(b).skillLevels).toEqual({ '100011': 5 });
  });
});
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm vitest run src/sim/adapter.test.ts src/sim/run.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck + commit**

```bash
pnpm typecheck
git add src/sim/types.ts src/sim/adapter.ts src/sim/vendor/umalator.bundle.d.mts src/sim/adapter.test.ts src/sim/run.test.ts
git commit -m "feat(sim): carry per-skill levels (SimBuild.skillLevels) to the runner state"
```

---

### Task 3: `planToOverlayBuild` derives `skillLevels`

**Files:**
- Modify: `src/core/simBuild.ts:110-113` (planToOverlayBuild)
- Test: `src/core/simBuild.test.ts` (extend; create if absent)

**Interfaces:**
- Consumes: `CmPlan.uniqueSkillLevel` (Task 1), `SimBuild.skillLevels` (Task 2).
- Produces: `planToOverlayBuild(plan).skillLevels === { [plan.uniqueSkillId]: plan.uniqueSkillLevel ?? 5 }`.

- [ ] **Step 1: Write the failing test**

In `src/core/simBuild.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { planToOverlayBuild } from './simBuild';
import { makeDefaultPlan } from '@/app/ActivePlanContext';

describe('planToOverlayBuild skillLevels', () => {
  it('maps the unique skill to its level (default 5)', () => {
    const plan = { ...makeDefaultPlan(), uniqueSkillId: '100011', uniqueSkillLevel: undefined };
    expect(planToOverlayBuild(plan).skillLevels).toEqual({ '100011': 5 });
  });
  it('uses the explicit level when set', () => {
    const plan = { ...makeDefaultPlan(), uniqueSkillId: '100011', uniqueSkillLevel: 3 as const };
    expect(planToOverlayBuild(plan).skillLevels).toEqual({ '100011': 3 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/simBuild.test.ts`
Expected: FAIL — `skillLevels` is undefined.

- [ ] **Step 3: Implement**

In `src/core/simBuild.ts`, update `planToOverlayBuild`:

```typescript
export function planToOverlayBuild(plan: CmPlan): SimBuild {
  const ids = [plan.uniqueSkillId, ...plan.wishlist.map((w) => w.skillId)].filter(Boolean);
  const skillLevels = plan.uniqueSkillId
    ? { [plan.uniqueSkillId]: plan.uniqueSkillLevel ?? 5 }
    : undefined;
  return { ...planToSimBuild(plan), skills: [...new Set(ids)], skillLevels };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/simBuild.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add src/core/simBuild.ts src/core/simBuild.test.ts
git commit -m "feat(m4): planToOverlayBuild emits unique-skill level into skillLevels"
```

---

### Task 4: Engine patch — coef table + level scaling + rebuild

> This task works in the **gitignored vendored engine clone** (`spikes/repos/umalator-global/`), captures a patch, and rebuilds the bundle. Follow `engine-patches/2026-06-22-multifire.patch` as the workflow template. The clone lives under the **parent repo** (`C:\Users\User\Project\uma-cm-planner\spikes\`); if absent from the worktree, operate on the parent path. If the clone is missing entirely, STOP and report — it must be restored before this task.

**Files:**
- Create (in clone): `spikes/repos/umalator-global/src/lib/sunday-tools/skills/skill-level-coef.ts` (generated coef table)
- Modify (in clone): the effect-build site `src/lib/sunday-tools/runner/runner.utils.ts` (around the `modifier: effect.modifier / 1e4` line, ~`:28-37`); the runner-state type that carries `skills` (add `skillLevels`); wherever `IRunnerState` → internal runner is constructed so the level reaches the effect builder.
- Create: `engine-patches/2026-06-29-skill-level-scaling.patch`
- Regenerate (committed): `src/sim/vendor/umalator.bundle.mjs` (+ `.d.mts` already done in Task 2)
- Test: `src/sim/skillLevel.test.ts` (new), `src/sim/fidelity.test.ts:8-34` (unchanged-baseline assertion)

**Interfaces:**
- Consumes: `IRunnerState.skillLevels` (Task 2).
- Produces: engine scales effect `modifier` by `coef(ability_type, level)/10000`; `evalSkillDelta(build, race, skillId, n)` returns a strictly larger mean when `build.skillLevels[skillId] = 6` vs `= 1` (on a course where the skill fires); no-level path unchanged.

- [ ] **Step 1: Write the failing engine test**

In `src/sim/skillLevel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { evalSkillDelta } from './run';
import type { SimBuild } from './types';
import type { SimRaceParams } from './types';

// Shooting Star (Special Week unique) on a course where it fires (phase>=2, mid-pack).
const SKILL = '100011';
const base: SimBuild = {
  umaId: '100101', // Special Week (outfit id; any uma that can run is fine for solo vacuum)
  stats: { spd: 1400, sta: 1000, pow: 1100, gut: 600, wit: 1100 },
  strategy: 'pace',
  aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
  skills: [],
};
const race: SimRaceParams = { courseId: '10906', ground: 1, weather: 1, season: 1, time: 2, grade: 100 };

describe('unique-skill level scaling', () => {
  it('Lv6 yields a strictly larger mean L than Lv1', () => {
    const lv1 = evalSkillDelta({ ...base, skillLevels: { [SKILL]: 1 } }, race, SKILL, 200, 1);
    const lv6 = evalSkillDelta({ ...base, skillLevels: { [SKILL]: 6 } }, race, SKILL, 200, 1);
    expect(lv1.nsamples).toBe(200);
    expect(lv6.mean).toBeGreaterThan(lv1.mean);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/sim/skillLevel.test.ts`
Expected: FAIL — `lv6.mean` equals `lv1.mean` (engine ignores level today).

- [ ] **Step 3: Verify the embedded base is Lv1 (anti-double-scaling guard)**

In the clone, confirm Shooting Star's speed effect base modifier is `3500` (Lv1), e.g. grep the clone's skill data / the borrowed extract:

Run (Bash, parent repo): `grep -n '"100011"' spikes/repos/umalator-global/scripts/borrowed/skills.json | head` and inspect the effect (`type:27, modifier:3500`). Record the finding in the patch notes. If it is NOT 3500, STOP and reconcile (the spec §3.1 guard) before scaling.

- [ ] **Step 4: Generate the coef table in the clone**

Query master.mdb for the coef table and write a TS constant. In the clone, create `src/lib/sunday-tools/skills/skill-level-coef.ts`:

```typescript
// Generated from master.mdb `skill_level_value` (ability_type, level → float_ability_value_coef).
// Source query: SELECT ability_type, level, float_ability_value_coef FROM skill_level_value ORDER BY ability_type, level;
// Provenance: umamusu-utils/misc/queries.txt; behavior: umareference.com unique-skills.
export const SKILL_LEVEL_COEF: Readonly<Record<number, Readonly<Record<number, number>>>> = {
  // EXAMPLE shape — replace ENTIRELY with the real dump (levels 1..6 at minimum, all ability_types present):
  27: { 1: 10000, 2: 10100, 3: 10400, 4: 10700, 5: 11000, 6: 11300 },
  31: { 1: 10000, 2: 10200, 3: 10400, 4: 10600, 5: 10800, 6: 11000 },
  // ...all other ability_types from the dump...
};

/** Multiplier for a given ability_type + level. Falls back to 1.0 (×10000) when unknown or Lv1. */
export function skillLevelCoef(abilityType: number, level: number | undefined): number {
  if (level === undefined || level <= 1) return 1;
  return (SKILL_LEVEL_COEF[abilityType]?.[level] ?? 10000) / 10000;
}
```

Generate the real body by dumping the table (Bash, where `sqlite3` is available against the clone's DB):

```bash
sqlite3 spikes/repos/umalator-global/db/master.mdb \
  "SELECT ability_type, level, float_ability_value_coef FROM skill_level_value WHERE level<=6 ORDER BY ability_type, level;"
```

Transcribe every `(ability_type, level)` pair into `SKILL_LEVEL_COEF`. Do not hand-wave — paste the actual numbers.

- [ ] **Step 5: Thread `skillLevels` into the runner + scale at the effect-build site**

In the clone:
1. Add `skillLevels?: Record<string, number>;` to the runner-state input type (the interface backing `IRunnerState`) and to the internal `Runner` so the per-skill level is reachable where effects are built (mirror how `skills` flows). 
2. At the effect-build site in `src/lib/sunday-tools/runner/runner.utils.ts` (the `modifier: effect.modifier / 1e4` construction), multiply by the coef for that effect's ability_type and the skill's level:

```typescript
import { skillLevelCoef } from '../skills/skill-level-coef';

// where `effect` is built for `skillId` and the runner has `skillLevels`:
const level = runnerSkillLevels?.[skillId];
const coef = skillLevelCoef(effect.type /* ability_type */, level);
// ...
modifier: (effect.modifier * coef) / 1e4,
```

Apply the same coef to every modifier-bearing branch the audit identified (speed/targetSpeed, accel, the raw `horse.speed` add) for that effect. Leave duration untouched. When `level` is undefined/1, `coef === 1` ⇒ unchanged.

- [ ] **Step 6: Rebuild the bundle**

Run: `pnpm sim:build`
Expected: regenerates `src/sim/vendor/umalator.bundle.mjs` with no build errors.

- [ ] **Step 7: Run the scaling test to verify it passes**

Run: `pnpm vitest run src/sim/skillLevel.test.ts`
Expected: PASS — `lv6.mean > lv1.mean`.

- [ ] **Step 8: Verify fidelity is unchanged**

Run: `pnpm vitest run src/sim/fidelity.test.ts`
Expected: PASS — meanBashin still `0.2202` (the fidelity build sets no `skillLevels` ⇒ Lv1 ⇒ coef 1.0 ⇒ identical).

- [ ] **Step 9: Capture the patch**

In the clone, produce the diff and save it:

```bash
git -C spikes/repos/umalator-global diff > engine-patches/2026-06-29-skill-level-scaling.patch
```

(If the clone tracks generated files differently, mirror exactly how `2026-06-22-multifire.patch` was produced.)

- [ ] **Step 10: Commit (bundle + patch + tests)**

```bash
git add src/sim/vendor/umalator.bundle.mjs engine-patches/2026-06-29-skill-level-scaling.patch src/sim/skillLevel.test.ts
git commit -m "feat(sim): scale unique-skill effect modifier by level (engine patch + coef table)"
```

---

### Task 5: Level-aware unique-skill chart (`rankUmaChart` + `useUmaChart`)

**Files:**
- Modify: `src/core/rankUmaChart.ts:78-113` (rowFor), the `RankUmaChartDeps` type, and `rankUmaChart` signature passing through.
- Modify: `src/features/cm-planner/useUmaChart.ts:10-27` (sigOf + useUmaChart)
- Test: `src/core/rankUmaChart.test.ts` (extend)

**Interfaces:**
- Consumes: `SimBuild.skillLevels` (Task 2), engine scaling (Task 4).
- Produces: `rowFor`/`rankUmaChart` apply `{ [uniqueSkillId]: level }` to the reference build before `skillDelta`; `RankUmaChartDeps` gains `uniqueLevel?: number`; `useUmaChart` accepts/keys on the level. Default level when absent: 5.

- [ ] **Step 1: Write the failing test**

In `src/core/rankUmaChart.test.ts`, assert the level is passed to `skillDelta` via the build:

```typescript
import { describe, it, expect } from 'vitest';
import { rankUmaChart } from './rankUmaChart';
import type { SimBuild } from '@/sim/types';

it('passes the unique level onto the reference build skillLevels', async () => {
  const seen: SimBuild[] = [];
  const deps = {
    nsamples: 1,
    uniqueLevel: 4,
    skillDelta: async (build: SimBuild) => {
      seen.push(build);
      return { mean: 1, median: 1, min: 1, max: 1, nsamples: 1, results: [1], activated: true };
    },
  };
  const race = { courseId: '10906', ground: 1, weather: 1, season: 1, time: 2, grade: 100 };
  await rankUmaChart([{ outfitId: '100101', uniqueSkillId: '100011' }], race, deps);
  expect(seen.every((b) => b.skillLevels?.['100011'] === 4)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/rankUmaChart.test.ts`
Expected: FAIL — `skillLevels` undefined on the build; `uniqueLevel` not on deps type.

- [ ] **Step 3: Add `uniqueLevel` to deps and apply it in rowFor**

In `src/core/rankUmaChart.ts`, add `uniqueLevel?: number;` to the `RankUmaChartDeps` interface. In `rowFor`, build the leveled reference build before calling `skillDelta`:

```typescript
  const level = deps.uniqueLevel ?? 5;
  for (const strategy of UMA_CHART_STRATEGIES) {
    let s: BashinStats;
    try {
      const build = {
        ...referenceBuild(c.outfitId, strategy),
        skillLevels: { [c.uniqueSkillId]: level },
      };
      s = await deps.skillDelta(build, race, c.uniqueSkillId, n, deps.seed);
    } catch {
      continue;
    }
```

(`c.uniqueSkillId` is non-null here — the early `if (!c.uniqueSkillId)` guard at the top of `rowFor` already returned.)

- [ ] **Step 4: Thread it through useUmaChart + the LRU sig**

In `src/features/cm-planner/useUmaChart.ts`, add the level to `UseUmaChartDeps`, the sig, and the `rank` call:

```typescript
function sigOf(courseId: string, candidates: UmaChartCandidate[], nsamples: number | undefined, uniqueLevel: number | undefined): string {
  return JSON.stringify([courseId, candidates.map((c) => [c.outfitId, c.uniqueSkillId]), nsamples ?? null, uniqueLevel ?? null]);
}
```

```typescript
  return useStreamingRank<UmaChartRow>({
    total: candidates.length,
    sig: sigOf(race.courseId, candidates, deps?.nsamples, deps?.uniqueLevel),
    compare: compareUmaChartRows,
    rank: (merged, onRow, shouldContinue) =>
      rankUmaChart(candidates, race, { skillDelta: merged.skillDelta, nsamples: merged.nsamples, uniqueLevel: deps?.uniqueLevel }, onRow, shouldContinue),
    deps,
  });
```

Add `uniqueLevel?: number;` to `UseUmaChartDeps`. At the `UmaChartPanel` call site (wherever `useUmaChart` is invoked with the plan), pass `uniqueLevel: plan.uniqueSkillLevel ?? 5`. Find the call site:

Run: `grep -rn "useUmaChart(" src/features/cm-planner`

Update each call to include `uniqueLevel`.

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm vitest run src/core/rankUmaChart.test.ts` then `pnpm typecheck`
Expected: PASS / no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/rankUmaChart.ts src/core/rankUmaChart.test.ts src/features/cm-planner/useUmaChart.ts src/features/cm-planner/UmaChartPanel.tsx
git commit -m "feat(m4): make the unique-skill chart level-aware"
```

---

### Task 6: `useUniqueSkillL` hook for the plate `+L`

**Files:**
- Create: `src/features/cm-planner/useUniqueSkillL.ts`
- Test: `src/features/cm-planner/useUniqueSkillL.test.ts`

**Interfaces:**
- Consumes: `referenceBuild` (`@/core/rankUmaChart`), the worker/`SimClient` `skillDelta` the chart already uses, `SimBuild.skillLevels`.
- Produces: `useUniqueSkillL({ outfitId, uniqueSkillId, strategy, level, race, deps }): { L: number | null; loading: boolean }` — mean バ身 for the current uma at the given strategy/level/course; recomputes only when `(outfitId, uniqueSkillId, strategy, level, courseId)` change.

- [ ] **Step 1: Write the failing test**

In `src/features/cm-planner/useUniqueSkillL.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useUniqueSkillL } from './useUniqueSkillL';
import type { SimBuild } from '@/sim/types';

const race = { courseId: '10906', ground: 1, weather: 1, season: 1, time: 2, grade: 100 };

describe('useUniqueSkillL', () => {
  it('returns the mean L for the current strategy/level and passes skillLevels', async () => {
    const calls: SimBuild[] = [];
    const skillDelta = async (build: SimBuild) => {
      calls.push(build);
      return { mean: 2.5, median: 2.5, min: 2, max: 3, nsamples: 4, results: [2, 2, 3, 3], activated: true };
    };
    const { result } = renderHook(() =>
      useUniqueSkillL({
        outfitId: '100101', uniqueSkillId: '100011', strategy: 'pace', level: 6, race,
        deps: { skillDelta, nsamples: 4 },
      }),
    );
    await waitFor(() => expect(result.current.L).toBe(2.5));
    expect(calls[0]?.skillLevels).toEqual({ '100011': 6 });
  });

  it('yields null L when there is no unique skill', async () => {
    const { result } = renderHook(() =>
      useUniqueSkillL({
        outfitId: '100101', uniqueSkillId: '', strategy: 'pace', level: 5, race,
        deps: { skillDelta: async () => { throw new Error('should not be called'); }, nsamples: 4 },
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.L).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/useUniqueSkillL.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the hook**

Create `src/features/cm-planner/useUniqueSkillL.ts`:

```typescript
import { useEffect, useRef, useState } from 'react';
import { referenceBuild } from '@/core/rankUmaChart';
import type { SimBuild, SimRaceParams } from '@/sim/types';
import type { BashinStats } from '@/sim/types';
import type { Strategy } from '@/core/types';

export interface UniqueSkillLDeps {
  skillDelta: (build: SimBuild, race: SimRaceParams, skillId: string, nsamples: number, seed?: number) => Promise<BashinStats>;
  nsamples?: number;
  seed?: number;
}

export interface UseUniqueSkillLArgs {
  outfitId: string;
  uniqueSkillId: string;
  strategy: Strategy;
  level: number;
  race: SimRaceParams;
  deps: UniqueSkillLDeps;
}

const NS = 200;

export function useUniqueSkillL(args: UseUniqueSkillLArgs): { L: number | null; loading: boolean } {
  const { outfitId, uniqueSkillId, strategy, level, race, deps } = args;
  const [state, setState] = useState<{ L: number | null; loading: boolean }>({ L: null, loading: false });
  // Recompute key: only these inputs change the result (matches the chart's reference build).
  const key = `${outfitId}|${uniqueSkillId}|${strategy}|${level}|${race.courseId}`;
  const depsRef = useRef(deps);
  depsRef.current = deps;

  useEffect(() => {
    if (!uniqueSkillId || !outfitId) {
      setState({ L: null, loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ L: s.L, loading: true }));
    const build: SimBuild = { ...referenceBuild(outfitId, strategy), skillLevels: { [uniqueSkillId]: level } };
    depsRef.current
      .skillDelta(build, race, uniqueSkillId, depsRef.current.nsamples ?? NS, depsRef.current.seed)
      .then((s) => { if (!cancelled) setState({ L: s.nsamples > 0 ? s.mean : null, loading: false }); })
      .catch(() => { if (!cancelled) setState({ L: null, loading: false }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/cm-planner/useUniqueSkillL.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add src/features/cm-planner/useUniqueSkillL.ts src/features/cm-planner/useUniqueSkillL.test.ts
git commit -m "feat(m4): useUniqueSkillL hook (reference-build +L for the unique plate)"
```

---

### Task 7: Plate stepper UI (`⟨ − Lv5 + ⟩ +X.XX`) + CSS

**Files:**
- Modify: `src/features/cm-planner/PlannerSidebar.tsx:595-607` (unique-skill block)
- Modify: `src/features/cm-planner/cm-planner.css` (new `.cmp-skill-level-stepper` rules)
- Test: `src/features/cm-planner/PlannerSidebar.test.tsx` (extend — note: mock `useSkillTrace` per the existing pattern; this block uses `traceContext`).

**Interfaces:**
- Consumes: `useUniqueSkillL` (Task 6), `plan.uniqueSkillLevel` (Task 1), the existing `onChange(plan)` prop.
- Produces: a `side` node on the unique `SkillDetailDisclosure` = `⟨ − Lv N + ⟩ +X.XX`; `−`/`+` clamp 1–6, `stopPropagation`, and call `onChange({ ...plan, uniqueSkillLevel })`.

- [ ] **Step 1: Write the failing test**

In `src/features/cm-planner/PlannerSidebar.test.tsx` (reuse the file's existing render harness + `vi.mock('./useSkillTrace')` and any `useUniqueSkillL` mock — mock `useUniqueSkillL` to return a fixed `{ L: 3.95, loading: false }`):

```typescript
// at top, alongside existing mocks:
vi.mock('./useUniqueSkillL', () => ({ useUniqueSkillL: () => ({ L: 3.95, loading: false }) }));

it('shows the unique level stepper and +L, and clamps/raises level', async () => {
  const onChange = vi.fn();
  renderSidebar({ onChange, plan: { /* a plan with a resolvable uniqueSkillId */ } });
  expect(await screen.findByText('Lv 5')).toBeInTheDocument();
  expect(screen.getByText('+3.95')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /increase unique skill level/i }));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ uniqueSkillLevel: 6 }));
});
```

(Adapt `renderSidebar`/prop names to the file's existing helpers; the unique skill must resolve, so reuse whatever `uniqueByUmaId`/`uniqueSkill` stub the file already sets up.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/cm-planner/PlannerSidebar.test.tsx`
Expected: FAIL — no `Lv 5` / `+3.95` / level button rendered.

- [ ] **Step 3: Build the stepper node + wire it**

In `PlannerSidebar.tsx`, compute the level and `+L`, then pass a `side`. Replace the unique block (lines 595-607) with:

```tsx
<div className="cmp-unique-block">
  <div className="cmp-mini-label">Unique Skill</div>
  {uniqueSkill ? (
    <SkillDetailDisclosure
      skill={uniqueSkill}
      showCost={false}
      traceContext={traceCtx}
      collapseSignal={collapseSkillSignal}
      side={
        <span className="cmp-unique-side">
          <span className="cmp-skill-level-stepper" data-edit-stay>
            <button
              type="button"
              aria-label="Decrease unique skill level"
              onClick={(e) => { e.stopPropagation(); e.preventDefault();
                onChange({ ...plan, uniqueSkillLevel: Math.max(1, uniqueLevel - 1) as 1|2|3|4|5|6 }); }}
            >−</button>
            <span className="cmp-skill-level-value">Lv {uniqueLevel}</span>
            <button
              type="button"
              aria-label="Increase unique skill level"
              onClick={(e) => { e.stopPropagation(); e.preventDefault();
                onChange({ ...plan, uniqueSkillLevel: Math.min(6, uniqueLevel + 1) as 1|2|3|4|5|6 }); }}
            >+</button>
          </span>
          {uniqueL != null ? <span className="L">+{uniqueL.toFixed(2)}</span> : null}
        </span>
      }
    />
  ) : (
    <p className="muted small">Unique skill pending source data.</p>
  )}
</div>
```

Above the `return` (near the other unique-skill derivations), add:

```tsx
const uniqueLevel = plan.uniqueSkillLevel ?? 5;
const { L: uniqueL } = useUniqueSkillL({
  outfitId: plan.umaId,
  uniqueSkillId: uniqueSkill?.skillId ?? '',
  strategy: plan.strategy,
  level: uniqueLevel,
  race: /* the SimRaceParams already derived in this component for traceCtx */ traceRace,
  deps: { skillDelta: /* the same worker-backed skillDelta the chart/traceCtx uses */ skillDeltaDep },
});
```

Wire `skillDeltaDep` to the existing worker-backed `skillDelta` (the same one `useUmaChart`/`traceCtx` use — locate it via `grep -n "skillDelta" src/features/cm-planner/PlannerSidebar.tsx` and the chart deps). If the sidebar doesn't already hold a `skillDelta`, import the shared one used by `useUmaChart` (the SimClient-backed dep) rather than constructing a new worker. Use the same `SimRaceParams` the component derives for `traceCtx`.

Add the import: `import { useUniqueSkillL } from './useUniqueSkillL';`

- [ ] **Step 4: Add CSS (transparent container + border)**

In `cm-planner.css`, add:

```css
.cmp-unique-side {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.cmp-skill-level-stepper {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.05rem 0.3rem;
  background: transparent;
  border: 1px solid var(--skill-text);
  border-radius: 6px;
}
.cmp-skill-level-stepper button {
  background: transparent;
  border: 0;
  padding: 0 0.2rem;
  line-height: 1;
  font-size: 0.95rem;
  color: var(--skill-text);
  cursor: pointer;
}
.cmp-skill-level-stepper button:hover { filter: brightness(1.1); }
.cmp-skill-level-value {
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
  color: var(--skill-text);
  text-shadow: var(--skill-shadow);
  min-width: 2.4rem;
  text-align: center;
}
```

- [ ] **Step 5: Run test + typecheck**

Run: `pnpm vitest run src/features/cm-planner/PlannerSidebar.test.tsx` then `pnpm typecheck`
Expected: PASS / no type errors. (If the UI test flakes with a dev server running, re-run it.)

- [ ] **Step 6: Commit**

```bash
git add src/features/cm-planner/PlannerSidebar.tsx src/features/cm-planner/cm-planner.css src/features/cm-planner/PlannerSidebar.test.tsx
git commit -m "feat(m4): unique-skill level stepper + projected +L on the sidebar plate"
```

---

### Task 8: Provenance + module docs

**Files:**
- Modify: `docs/provenance.md`
- Modify: `docs/modules/module-4-skill-acquisition.md`
- Modify: `CLAUDE.md` (Current State + the M4 row / gotchas, one concise paragraph)

**Interfaces:** none (docs only).

- [ ] **Step 1: Record provenance**

In `docs/provenance.md`, add an entry: unique-skill level scaling — formula `effective_modifier = base × coef(ability_type, level)/10000`; coef source master.mdb `skill_level_value` (schema mirrored in `spikes/repos/umamusu-utils/misc/queries.txt`); behavior corroborated by umareference.com unique-skills guide (recovery +2%/level; others +1% then +3%/level); engine patch `engine-patches/2026-06-29-skill-level-scaling.patch`, retrieved 2026-06-29.

- [ ] **Step 2: Update the module-4 doc + CLAUDE.md**

Add a short subsection to `docs/modules/module-4-skill-acquisition.md` describing the unique-skill level control (Lv1–6, default 5), the coef table + engine patch, chart parity, and the `useUniqueSkillL` hook. Add a one-line note in `CLAUDE.md` Current State (and bump the test count after a full `pnpm test`).

- [ ] **Step 3: Full test sweep + commit**

```bash
pnpm test
pnpm build
git add docs/provenance.md docs/modules/module-4-skill-acquisition.md CLAUDE.md
git commit -m "docs(m4): record unique-skill level scaling provenance + module notes"
```

---

## Self-Review

**Spec coverage:**
- §3 formula/coef → Task 4 (coef table + scaling). ✓
- §3.1 double-scaling guard → Task 4 Step 3. ✓
- §4.1 coef asset → Task 4 Step 4. ✓
- §4.2 engine patch + rebuild + capture + fidelity → Task 4. ✓
- §4.3 types/plumbing (CmPlan, SimBuild, adapter, planToOverlayBuild, default 5, no Dexie bump) → Tasks 1–3. ✓
- §4.4 chart parity (level-aware) → Task 5. ✓
- §4.5 +L value + recompute triggers → Task 6 (key = outfit/skill/strategy/level/course only). ✓
- §4.6 plate UI (stepper-then-+L, transparent+border, stopPropagation, autosave) → Task 7. ✓
- §6 testing (coef math, Lv6>Lv1, fidelity, plumbing, chart parity, UI clamp) → spread across Tasks 1–7. ✓
- Provenance (P1) → Task 8. ✓

**Placeholder scan:** Coef table body in Task 4 Step 4 is explicitly marked EXAMPLE-replace-with-real-dump with the exact `sqlite3` command to produce it — this is a generation step, not a placeholder. The PlannerSidebar `skillDelta`/`traceRace` wiring (Task 7 Step 3) references existing in-component values located by `grep`; acceptable because the exact local identifier is component-internal and must be matched at edit time.

**Type consistency:** `skillLevels: Record<string, number>` consistent across SimBuild / IRunnerState / adapter / planToOverlayBuild / rankUmaChart / useUniqueSkillL. `uniqueSkillLevel?: 1|2|3|4|5|6` consistent (CmPlan + the `as 1|2|3|4|5|6` casts in Task 7). `skillLevelCoef(abilityType, level)` name consistent within Task 4. Default `?? 5` consistent across Tasks 1/3/5/7.

**Known indirection:** Task 4 operates in the gitignored engine clone; steps mirror the multifire precedent and give exact queries/anchors but the implementer must locate the precise effect-build branches in `runner.utils.ts`. Task 7's `skillDelta`/`race` wiring reuses the sidebar's existing worker dep. Both are inherent to the codebase, not plan gaps.
