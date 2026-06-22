# Engine Multi-Fire / Cooldown-Aware Skill Activation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the vendored umalator engine simulate cooldown-based re-activation so short-cooldown corner/straight skills (e.g. Professor of Curvature) fire the correct per-course number of times, and the race-compare overlay surfaces every fire.

**Architecture:** A flag-gated (`cooldownReactivation`, default ON) dynamic model in two parts — a *recurrence source* (corner/straight policies surface their multiple candidate windows) and a *shared cooldown gate* in the runner's firing loop (suppresses a re-fire until real race-time since the last fire ≥ the distance-scaled cooldown). Downstream (activation collector, `allActivationRegions`, overlay) needs no change. The engine source is edited under `spikes/repos/umalator-global` and rebuilt into the committed bundle via `pnpm sim:build`.

**Tech Stack:** TypeScript, esbuild (sim bundle), Vitest (node env for engine integration), pnpm. Engine source = a git clone under `spikes/` (gitignored); committed artifact = `src/sim/vendor/umalator.bundle.mjs`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-22-m4-engine-multifire-cooldown-activation-design.md`. Every task implicitly inherits it.
- **Flag default ON**, `cooldownReactivation` on `SimulationSettings`. **Flag OFF ⇒ byte-identical to today** — the fidelity backstop.
- **Eligibility:** only skills whose sample policy exposes `sampleMulti` (corner/straight) AND `cooldownTime < 5000000`. Everything else is untouched in *both* flag states.
- **Cooldown formula (seconds):** `effectiveCooldown = (cooldownTime / 10000) * (course.distance / 1000)`. Mirrors the engine's existing `baseDuration * (course.distance / 1000)` scaling; `accumulateTime.t` is seconds (15 fps).
- **Fidelity gate:** flag-OFF reproduces the captured golden `meanBashin` (anchor: 0.2202) exactly.
- **Acceptance:** flag-ON, Professor of Curvature (`200331`) on Hanshin 3200m (course `10811`) fires **2×**; on a mile course fires **1×**; flag-OFF fires **1×** everywhere.
- Engine edits live in `spikes/repos/umalator-global/src/...`; rebuild with `pnpm sim:build`; commit the regenerated `src/sim/vendor/umalator.bundle.mjs`.
- Commit messages end with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File map

**Engine source (under `spikes/repos/umalator-global/src/`, rebuilt into the bundle — not committed directly; captured as a patch in Task 8):**
- `lib/sunday-tools/common/race.ts` — add `cooldownReactivation` to `SimulationSettings`.
- `modules/simulation/simulators/shared.ts` — default `cooldownReactivation: true` in `createCompareSettings`.
- `modules/simulation/simulators/vacuum-compare.ts` + `skill-compare.ts` — thread `options.cooldownReactivation`.
- `modules/simulation/types.ts` — add `cooldownReactivation?: boolean` to the compare `options` type.
- `lib/sunday-tools/skills/skill.types.ts` — add `cooldownTime` to `SkillTrigger` and `PendingSkill`.
- `lib/sunday-tools/runner/runner.utils.ts` — `buildSkillData` puts `cooldownTime` on each trigger.
- `lib/sunday-tools/skills/policies/ActivationSamplePolicy.ts` — `sampleMulti` on `ActivationSamplePolicy` (optional), `AllCornerRandomPolicy`, `StraightRandomPolicy`.
- `lib/sunday-tools/common/runner.ts` — `skillLastFireTime` field + per-round reset; multi-emit in trigger consumption; cooldown gate in `processSkillActivations`.

**App side (committed in the worktree branch `feat/m4-engine-multifire`):**
- `src/sim/vendor/umalator.bundle.mjs` — regenerated bundle.
- `src/sim/vendor/umalator.bundle.d.mts` — widen compare `options` with `cooldownReactivation?: boolean`.
- `src/sim/run.test.ts` — acceptance + fidelity tests.
- `engine-patches/2026-06-22-multifire.patch` — engine source diff (provenance).
- `scripts/build-sim.mjs`, `docs/provenance.md`, `docs/modules/module-4-skill-acquisition.md` — provenance + docs.

---

### Task 0: Worktree build setup + capture baselines

**Files:** none committed (environment + golden capture).

- [ ] **Step 1: Make the worktree self-contained for building.** The engine source (`spikes/`) and `node_modules` are gitignored and absent from the worktree.

```bash
# from repo root of the PRIMARY checkout
PRIMARY="c:/Users/User/Project/uma-cm-planner"
WT="$PRIMARY/.claude/worktrees/m4-engine-multifire"
# junction the engine source into the worktree (gitignored; not committed)
cmd //c mklink /J "$(cygpath -w "$WT/spikes")" "$(cygpath -w "$PRIMARY/spikes")"
# install deps in the worktree
cd "$WT" && pnpm install
```

- [ ] **Step 2: Verify the worktree can build and test.**

Run: `cd "$WT" && pnpm sim:build && pnpm vitest run src/sim/run.test.ts`
Expected: bundle rewrites; existing sim tests PASS.

- [ ] **Step 3: Capture the fidelity GOLDEN (current behavior) and the current Prof fire-count.** Add a temporary probe, run it, record the printed numbers into this plan's Task 7 assertions, then delete it.

```ts
// .claude/worktrees/m4-engine-multifire/src/sim/__baseline.test.ts
// @vitest-environment node
import { it, expect } from 'vitest';
import { runComparison } from './vendor/umalator.bundle.mjs';
import { toRunnerState, toRaceDef, resolveCourse } from './adapter';
import type { SimBuild } from './types';
const base: SimBuild = { umaId:'', stats:{spd:1150,sta:1100,pow:1000,gut:600,wit:900}, strategy:'pace', aptitudes:{distance:'A',surface:'A',strategy:'A'}, skills:[] };
const mean = (xs:number[]) => xs.reduce((a,b)=>a+b,0)/xs.length;
it('golden', () => {
  // FIDELITY fixture: base vs base+Prof on Hanshin 3200, fixed seed.
  const r = runComparison({ nsamples:200, course:resolveCourse('10811'), racedef:toRaceDef({courseId:'10811'}),
    uma1: toRunnerState(base), uma2: toRunnerState({...base, skills:['200331']}),
    options:{ seed:1234, ignoreStaminaConsumption:false } });
  console.log('GOLDEN meanBashin =', mean(r.results).toFixed(6));
  expect(true).toBe(true);
});
```

Run: `cd "$WT" && pnpm vitest run src/sim/__baseline.test.ts 2>&1 | grep GOLDEN`
Record the printed value as `GOLDEN_MEANBASHIN` (used in Task 7). Then delete: `rm "$WT/src/sim/__baseline.test.ts"`.

- [ ] **Step 4: Confirm the downstream "2 logs → 2 markers" assumption is the only gap.** (Spec implementation step 1.) No commit — this is the rationale that `allActivationRegions` already groups by start, so once the engine emits two logs the overlay draws two markers. Proceed.

---

### Task 1: Add the `cooldownReactivation` flag (no behavior change)

**Files:**
- Modify: `spikes/repos/umalator-global/src/lib/sunday-tools/common/race.ts` (`SimulationSettings`)
- Modify: `spikes/repos/umalator-global/src/modules/simulation/simulators/shared.ts` (`createCompareSettings`)
- Modify: `spikes/repos/umalator-global/src/modules/simulation/types.ts` (compare `options` type)
- Modify: `src/sim/vendor/umalator.bundle.d.mts` (widen exported `options`)

**Interfaces:**
- Produces: `SimulationSettings.cooldownReactivation: boolean`; `options.cooldownReactivation?: boolean` on the compare entrypoints (read by later tasks via `this.race.settings.cooldownReactivation`).

- [ ] **Step 1: Add the setting field.** In `race.ts`, inside `export type SimulationSettings = { ... }` (after `dueling: boolean;`), add:

```ts
  /**
   * Whether short-cooldown corner/straight skills may re-activate within a race
   * (distance-scaled cooldown). Default ON; OFF reproduces upstream single-fire.
   */
  cooldownReactivation: boolean;
```

- [ ] **Step 2: Default it ON.** In `shared.ts` `createCompareSettings`, add to the returned object literal (alongside `dueling: false,`):

```ts
    cooldownReactivation: true,
```

- [ ] **Step 3: Allow an override from `options`.** In `types.ts`, find the compare params `options` type (the one with `seed`, `ignoreStaminaConsumption`, `allowRushedUma1`, …) and add:

```ts
  cooldownReactivation?: boolean;
```

In `vacuum-compare.ts` and `skill-compare.ts`, where `createCompareSettings({...})` / `createSkillCompareSettings(...)` is called, pass through the override (e.g. in `vacuum-compare.ts` add to the settings overrides object): `cooldownReactivation: options.cooldownReactivation ?? true`. For `skill-compare.ts`'s `createSkillCompareSettings`, add `cooldownReactivation: options.cooldownReactivation ?? true` to its `createCompareSettings({...})` overrides.

- [ ] **Step 4: Widen the bundle types.** In `src/sim/vendor/umalator.bundle.d.mts`, find the `options` object type on the exported `runComparison` (and `runSkillComparison` if present) and add `cooldownReactivation?: boolean;`.

- [ ] **Step 5: Build and verify no regression.**

Run: `cd "$WT" && pnpm sim:build && pnpm typecheck && pnpm vitest run src/sim/run.test.ts`
Expected: builds clean; all existing sim tests PASS (default ON has no logic yet, so behavior is unchanged).

- [ ] **Step 6: Commit.**

```bash
cd "$WT" && git add src/sim/vendor/umalator.bundle.mjs src/sim/vendor/umalator.bundle.d.mts
git commit -m "feat(sim): add cooldownReactivation engine flag (default on, no-op)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Carry `cooldownTime` onto triggers

**Files:**
- Modify: `spikes/repos/umalator-global/src/lib/sunday-tools/skills/skill.types.ts` (`SkillTrigger`, `PendingSkill`)
- Modify: `spikes/repos/umalator-global/src/lib/sunday-tools/runner/runner.utils.ts` (`buildSkillData`)
- Modify: `spikes/repos/umalator-global/src/lib/sunday-tools/common/runner.ts` (pending-skill base object)

**Interfaces:**
- Produces: `SkillTrigger.cooldownTime: number`, `PendingSkill.cooldownTime: number` (read by Task 5/6).

- [ ] **Step 1: Add the field to both types.** In `skill.types.ts`, add `cooldownTime: number;` to `export type SkillTrigger = { ... }` (after `extraCondition`) and to `export type PendingSkill = { ... }` (after `extraCondition`).

- [ ] **Step 2: Populate it in `buildSkillData`.** In `runner.utils.ts`, both trigger pushes get the alternative's cooldown. In the main push (the `triggers.push({ ... })` near the `samplePolicy: parsedOperator.samplePolicy,` line) add:

```ts
        cooldownTime: skillAlternative.cooldownTime ?? 5000000,
```

In the fallback trigger object at the end of the function (the one with `samplePolicy: ImmediatePolicy,` and `extraCondition: (_) => false`) add:

```ts
      cooldownTime: 5000000,
```

- [ ] **Step 3: Pass it onto pending skills.** In `runner.ts`, in the `this.pendingSkills = skillTrigers.flatMap(...)` block, add `cooldownTime: skillTrigger.cooldownTime,` to the returned pending-skill object literal (next to `effects: skillTrigger.effects`).

- [ ] **Step 4: Build + verify no regression.**

Run: `cd "$WT" && pnpm sim:build && pnpm typecheck && pnpm vitest run src/sim/run.test.ts`
Expected: builds; all tests PASS (field is carried, unused).

- [ ] **Step 5: Commit.**

```bash
cd "$WT" && git add src/sim/vendor/umalator.bundle.mjs
git commit -m "feat(sim): thread cooldownTime onto skill triggers and pending skills

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `AllCornerRandomPolicy.sampleMulti`

**Files:**
- Modify: `spikes/repos/umalator-global/src/lib/sunday-tools/skills/policies/ActivationSamplePolicy.ts`

**Interfaces:**
- Produces: `ActivationSamplePolicy.sampleMulti?(regions, nsamples, rng): Array<Array<Region>>` (one candidate set per sample); implemented on `AllCornerRandomPolicy`.

- [ ] **Step 1: Declare the optional method on the interface.** In `export interface ActivationSamplePolicy { ... }` add:

```ts
  // optional: per-sample SET of candidate trigger windows for cooldown-based multi-fire
  sampleMulti?: (regions: RegionList, nsamples: number, rng: PRNG) => Array<Array<Region>>;
```

- [ ] **Step 2: Extract the corner placement so single- and multi-fire share identical RNG draws.** In `AllCornerRandomPolicy`, replace the body of `placeTriggers` so it delegates to a new `placeTriggerPositions` (verbatim loop — identical RNG calls), and `placeTriggers` returns the first:

```ts
  placeTriggerPositions(regions: RegionList, rng: PRNG): Array<number> {
    const triggers: Array<number> = [];
    const regionCandidates = regions.toSorted((a, b) => a.start - b.start);
    while (triggers.length < 4 && regionCandidates.length > 0) {
      const candidateIndex = rng.uniform(regionCandidates.length);
      const regionCandidate = regionCandidates[candidateIndex];
      const start = regionCandidate.start + rng.uniform(regionCandidate.end - regionCandidate.start - 10);
      if (start + 20 <= regionCandidate.end) {
        regionCandidates.splice(candidateIndex, 1, new Region(start + 10, regionCandidate.end));
      } else {
        regionCandidates.splice(candidateIndex, 1);
      }
      regionCandidates.splice(0, candidateIndex);
      triggers.push(start);
    }
    return triggers;
  },

  placeTriggers(regions: RegionList, rng: PRNG) {
    const triggers = this.placeTriggerPositions(regions, rng);
    return new Region(triggers[0], triggers[0] + 10);
  },

  sampleMulti(regions: RegionList, nsamples: number, rng: PRNG): Array<Array<Region>> {
    const out: Array<Array<Region>> = [];
    for (let i = 0; i < nsamples; ++i) {
      const positions = this.placeTriggerPositions(regions, rng);
      out.push(positions.map((p) => new Region(p, p + 10)));
    }
    return out;
  },
```

(Keep the existing `sample`, `reconcile*` methods unchanged. `sample` already calls `placeTriggers` per sample, so its RNG consumption is identical to before.)

- [ ] **Step 3: Build + verify flag-off is still identical.**

Run: `cd "$WT" && pnpm sim:build && pnpm typecheck && pnpm vitest run src/sim/run.test.ts`
Expected: builds; all tests PASS (no consumer yet; single-fire path unchanged).

- [ ] **Step 4: Commit.**

```bash
cd "$WT" && git add src/sim/vendor/umalator.bundle.mjs
git commit -m "feat(sim): AllCornerRandomPolicy.sampleMulti (all candidate corners)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `StraightRandomPolicy.sampleMulti`

**Files:**
- Modify: `spikes/repos/umalator-global/src/lib/sunday-tools/skills/policies/ActivationSamplePolicy.ts`

**Interfaces:**
- Produces: `StraightRandomPolicy.sampleMulti` — per sample, a random starting straight + all later straights (random first fire preserved; later straights enable cooldown-gated re-fire).

- [ ] **Step 1: Add `sampleMulti` to `StraightRandomPolicy`** (keep its existing `sample`):

```ts
  sampleMulti(regions: RegionList, nsamples: number, rng: PRNG): Array<Array<Region>> {
    if (regions.length == 0) {
      return [];
    }
    const sorted = regions.toSorted((a, b) => a.start - b.start);
    const out: Array<Array<Region>> = [];
    for (let i = 0; i < nsamples; ++i) {
      const startIdx = rng.uniform(sorted.length); // random first straight (preserves single-fire randomness)
      const set: Array<Region> = [];
      for (let j = startIdx; j < sorted.length; ++j) {
        const r = sorted[j];
        const pos = r.start + rng.uniform(r.end - r.start - 10);
        set.push(new Region(pos, pos + 10));
      }
      out.push(set);
    }
    return out;
  },
```

- [ ] **Step 2: Build + verify no regression.**

Run: `cd "$WT" && pnpm sim:build && pnpm typecheck && pnpm vitest run src/sim/run.test.ts`
Expected: builds; all tests PASS.

- [ ] **Step 3: Commit.**

```bash
cd "$WT" && git add src/sim/vendor/umalator.bundle.mjs
git commit -m "feat(sim): StraightRandomPolicy.sampleMulti (random first straight + later)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Emit one pending skill per candidate (eligible skills, flag-on)

**Files:**
- Modify: `spikes/repos/umalator-global/src/lib/sunday-tools/common/runner.ts` (trigger-consumption block, ~L1807–1834)

**Interfaces:**
- Consumes: `SkillTrigger.{samplePolicy,cooldownTime}`, `this.race.settings.cooldownReactivation`, `policy.sampleMulti`.
- Produces: multiple `PendingSkill`s (shared `skillId`) for eligible skills when flag-on; one otherwise.

- [ ] **Step 1: Replace the trigger-consumption block.** Replace the `const triggers = skillTrigers.map(...)` computation and the `this.pendingSkills = skillTrigers.flatMap(...)` block with the single flatMap below (preserves RNG order for the flag-off / ineligible path → byte-identical):

```ts
    const roundIteration = this.race.roundIteration;
    const multiFire = this.race.settings.cooldownReactivation;

    this.pendingSkills = skillTrigers.flatMap((skillTrigger) => {
      const baseSkillId = skillTrigger.skillId.split('-')[0] ?? skillTrigger.skillId;
      const forcedPosition = this.forcedPositions[baseSkillId];
      const base = {
        skillId: skillTrigger.skillId,
        rarity: skillTrigger.rarity,
        extraCondition: skillTrigger.extraCondition,
        effects: skillTrigger.effects,
        cooldownTime: skillTrigger.cooldownTime,
      };

      if (forcedPosition !== undefined) {
        const fixedPolicy = createFixedPositionPolicy(forcedPosition);
        const samples = fixedPolicy.sample(skillTrigger.regions, this.race.skillSamples, this.skillRng);
        if (samples.length === 0) return [];
        return [{ ...base, trigger: samples[roundIteration % samples.length] }];
      }

      const policy = skillTrigger.samplePolicy;

      // multi-fire: short-cooldown skills whose policy can surface multiple candidate windows
      if (multiFire && typeof policy.sampleMulti === 'function' && skillTrigger.cooldownTime < 5000000) {
        const sets = policy.sampleMulti(skillTrigger.regions, this.race.skillSamples, this.skillRng);
        const candidates = sets.length === 0 ? [] : (sets[roundIteration % sets.length] ?? []);
        return candidates.map((trigger) => ({ ...base, trigger }));
      }

      const samples = policy.sample(skillTrigger.regions, this.race.skillSamples, this.skillRng);
      if (samples.length === 0) return [];
      return [{ ...base, trigger: samples[roundIteration % samples.length] }];
    });
```

- [ ] **Step 2: Build + verify flag-off identical.**

Run: `cd "$WT" && pnpm sim:build && pnpm typecheck && pnpm vitest run src/sim/run.test.ts`
Expected: builds; all tests PASS. (No cooldown gate yet, so an eligible skill now produces multiple pendings that would *each* fire — the gate in Task 6 thins them. Existing tests don't assert multi-fire, so they still pass; if any asserts a single Prof activation, note it for Task 6.)

- [ ] **Step 3: Commit.**

```bash
cd "$WT" && git add src/sim/vendor/umalator.bundle.mjs
git commit -m "feat(sim): emit one pending skill per candidate window (eligible, flag-on)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Cooldown gate in the firing loop

**Files:**
- Modify: `spikes/repos/umalator-global/src/lib/sunday-tools/common/runner.ts` (field decl ~L158, per-round reset ~L1774, `processSkillActivations` ~L548–578)

**Interfaces:**
- Consumes: `PendingSkill.cooldownTime`, `this.accumulateTime.t`, `this.race.course.distance`, `this.race.settings.cooldownReactivation`.
- Produces: re-fires gated by `effectiveCooldown = (cooldownTime/10000) * (distance/1000)` seconds.

- [ ] **Step 1: Declare the per-round map.** Near the other runner field declarations (e.g. after `public accumulateTime!: Timer;`), add:

```ts
  public skillLastFireTime: Map<string, number> = new Map();
```

- [ ] **Step 2: Reset it each round.** In the per-round skill setup (the method containing `this.pendingSkills = [];`), immediately after that line add:

```ts
    this.skillLastFireTime = new Map();
```

- [ ] **Step 3: Add the gate before activation.** In `processSkillActivations`, inside `if (this.position >= skill.trigger.start && skill.extraCondition(this)) {` and **before** the `shouldSkipWitCheck` branch, insert the gate; and **after each** `this.activateSkill(skill);` record the fire time:

```ts
        // cooldown gate: suppress a re-fire still within the distance-scaled cooldown (real race time)
        if (this.race.settings.cooldownReactivation) {
          const last = this.skillLastFireTime.get(skill.skillId);
          if (last !== undefined) {
            const effectiveCooldown = (skill.cooldownTime / 10000) * (this.race.course.distance / 1000);
            if (this.accumulateTime.t - last < effectiveCooldown) {
              this.pendingSkills.splice(i, 1); // on cooldown — consume without firing
              continue;
            }
          }
        }
```

Then, after both `this.activateSkill(skill);` calls in this block, add:

```ts
          this.skillLastFireTime.set(skill.skillId, this.accumulateTime.t);
```

(The `.set` is inert when the flag is OFF — nothing reads the map — so flag-OFF output is unchanged; the Task 7 golden test proves it.)

- [ ] **Step 4: Build.**

Run: `cd "$WT" && pnpm sim:build && pnpm typecheck`
Expected: builds clean. (Behavior tests come in Task 7.)

- [ ] **Step 5: Commit.**

```bash
cd "$WT" && git add src/sim/vendor/umalator.bundle.mjs
git commit -m "feat(sim): distance-scaled cooldown gate for multi-fire skills

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Acceptance + fidelity tests

**Files:**
- Create/Modify: `src/sim/run.test.ts` (append a `describe` block)

**Interfaces:**
- Consumes: `runComparison`, `runRaceCompare`, `allActivationRegions` from `src/sim/run.ts`; the bundle from Task 1–6.

- [ ] **Step 1: Write the acceptance + fidelity tests.** Replace `GOLDEN_MEANBASHIN` with the value captured in Task 0 Step 3. Append to `src/sim/run.test.ts`:

```ts
// @vitest-environment node
import { runComparison } from './vendor/umalator.bundle.mjs';
import { toRunnerState, toRaceDef, resolveCourse } from './adapter';
import { runRaceCompare } from './run';

describe('cooldown multi-fire', () => {
  const stayer = {
    umaId: '', stats: { spd: 1150, sta: 1100, pow: 1000, gut: 600, wit: 900 },
    strategy: 'pace' as const, aptitudes: { distance: 'A' as const, surface: 'A' as const, strategy: 'A' as const }, skills: [],
  };
  const profPositions = (courseId: string, cooldownReactivation: boolean) => {
    const r = runComparison({
      nsamples: 60, course: resolveCourse(courseId), racedef: toRaceDef({ courseId }),
      uma1: toRunnerState(stayer), uma2: toRunnerState({ ...stayer, skills: ['200331'] }),
      options: { seed: 1234, ignoreStaminaConsumption: false, cooldownReactivation },
    });
    // distinct activation starts for Prof in the max-bashin representative run
    const logs = r.runData.maxrun.skillActivations[1]?.['200331'] ?? [];
    return new Set(logs.map((l: { start: number }) => Math.round(l.start))).size;
  };

  it('flag ON: Prof fires twice on Hanshin 3200m', () => {
    expect(profPositions('10811', true)).toBe(2);
  });
  it('flag ON: Prof fires once on a mile (1600m)', () => {
    // 10304 = a 1600m turf course (see courseCatalog)
    expect(profPositions('10304', true)).toBe(1);
  });
  it('flag OFF: Prof fires once on Hanshin 3200m (upstream behavior)', () => {
    expect(profPositions('10811', false)).toBe(1);
  });
  it('flag OFF reproduces the fidelity golden meanBashin', () => {
    const r = runComparison({
      nsamples: 200, course: resolveCourse('10811'), racedef: toRaceDef({ courseId: '10811' }),
      uma1: toRunnerState(stayer), uma2: toRunnerState({ ...stayer, skills: ['200331'] }),
      options: { seed: 1234, ignoreStaminaConsumption: false, cooldownReactivation: false },
    });
    const mean = r.results.reduce((a: number, b: number) => a + b, 0) / r.results.length;
    expect(mean).toBeCloseTo(GOLDEN_MEANBASHIN, 4); // <-- paste Task 0 value
  });
  it('overlay surfaces both fires: runRaceCompare yields 2 Prof markers (flag default ON)', () => {
    const rc = runRaceCompare({ ...stayer, skills: ['200331'] }, { ...stayer, skills: ['200331'] }, { courseId: '10811' }, 60, 1234);
    const markers = rc.runs.max.uma1Acts.filter((a) => a.skillId === '200331').length;
    expect(markers).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify FAIL→PASS reasoning, then PASS.** If you wrote these before Task 6, they fail (counts 1/1/1). After Tasks 1–6 + rebuild they pass.

Run: `cd "$WT" && pnpm vitest run src/sim/run.test.ts`
Expected: all PASS — ON→2 on 3200, ON→1 on mile, OFF→1, golden reproduced, overlay→2 markers.

- [ ] **Step 3: Confirm `runRaceCompare` defaults the flag ON.** If `runRaceCompare`/`runVacuumCompare` in `src/sim/run.ts` build `options` without `cooldownReactivation`, the engine default (true) applies — the overlay test above proves it. If the test shows 1 marker, set `cooldownReactivation: true` explicitly in those `options` objects in `src/sim/run.ts`, rebuild nothing (app-only), and re-run.

- [ ] **Step 4: Commit.**

```bash
cd "$WT" && git add src/sim/run.test.ts src/sim/run.ts
git commit -m "test(sim): multi-fire acceptance + flag-off fidelity (Prof 2x/1x)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Provenance, docs, final gate

**Files:**
- Create: `engine-patches/2026-06-22-multifire.patch`
- Modify: `scripts/build-sim.mjs` (source comment), `docs/provenance.md`, `docs/modules/module-4-skill-acquisition.md`

- [ ] **Step 1: Capture the engine source diff as a committed patch (reproducibility).**

```bash
cd "$WT" && mkdir -p engine-patches
git -C spikes/repos/umalator-global diff > engine-patches/2026-06-22-multifire.patch
```

- [ ] **Step 2: Note the local modification in the build script.** In `scripts/build-sim.mjs`, update the header comment under the existing `// Source:` line:

```js
// Local modification: cooldown-aware multi-fire (engine-patches/2026-06-22-multifire.patch).
```

- [ ] **Step 3: Record provenance.** In `docs/provenance.md`, under the engine pin section, add one line: the engine is v0.14.2 `c1fa210` **plus** `engine-patches/2026-06-22-multifire.patch` (cooldown-aware multi-fire; flag `cooldownReactivation`, default ON).

- [ ] **Step 4: Update the module doc + close the loop on issue #4.** In `docs/modules/module-4-skill-acquisition.md`, add a short note: the engine now models cooldown re-activation for `all_corner_random`/`straight_random` short-cd skills (flag `cooldownReactivation`, default ON; distance-scaled cooldown); the overlay surfaces every fire; continuous near-lane skills remain single-fire (deferred, spec §12). Reference issue #4 as resolved by this work.

- [ ] **Step 5: Full gate.**

Run: `cd "$WT" && pnpm typecheck && pnpm build && pnpm test`
Expected: typecheck clean, vite build OK, full suite PASS.

- [ ] **Step 6: Commit.**

```bash
cd "$WT" && git add engine-patches/ scripts/build-sim.mjs docs/provenance.md docs/modules/module-4-skill-acquisition.md
git commit -m "docs(sim): provenance patch + module/provenance notes for multi-fire

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 7: Push + open PR** (after user confirms — do not push to main).

```bash
cd "$WT" && git push -u origin feat/m4-engine-multifire
gh pr create --title "feat(m4): engine cooldown-aware multi-fire skill activation" --body "Implements docs/superpowers/specs/2026-06-22-m4-engine-multifire-cooldown-activation-design.md. Flag cooldownReactivation (default ON); corner/straight short-cd skills re-fire per distance-scaled cooldown; overlay surfaces every fire; flag-OFF reproduces the fidelity baseline. Closes #4.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-review

- **Spec coverage:** flag (T1) ✓; eligibility corner+straight short-cd (T3/T4/T5) ✓; distance-scaled cooldown gate (T6) ✓; downstream no-change verified (T0 S4, T7 overlay) ✓; flag-OFF fidelity (T7) ✓; acceptance Prof 2x/1x (T7) ✓; L truncation = no code (whole-race sim, spec §3.4/§7) ✓; extensibility (spec §12) = no v1 code, the `sampleMulti` seam is the plug point ✓; provenance/build logistics (T0, T8) ✓.
- **Placeholders:** none — every code change is shown verbatim; `GOLDEN_MEANBASHIN` is a captured constant (T0 S3 → T7 S1), not a TODO; course `10304` (mile 1600m) is from `courseCatalog`, swap if the catalog differs (verify in T0).
- **Type consistency:** `cooldownReactivation` (settings + options), `cooldownTime` (SkillTrigger/PendingSkill, populated T2, read T5/T6), `sampleMulti` (interface T3, impls T3/T4, called T5), `skillLastFireTime` (field T6 S1, reset T6 S2, used T6 S3) — all consistent.
