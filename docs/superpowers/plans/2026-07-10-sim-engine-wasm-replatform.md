# Sim Engine Re-platform (TS → Rust/WASM v0.27.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the vendored v0.14.2 TS engine bundle (+ 4 TS patches) with upstream umalator-global v0.27.0's Rust/WASM engine behind the unchanged `src/sim` public API, port cooldown multi-fire to Rust, re-baseline fidelity, retire the 95 pin-lag rebalance chips via an `ENGINE_DATA_DATE` gate, and unify the app-data pin with the engine pin.

**Architecture:** The wasm-pack pkg (built from the pinned clone + our multi-fire Rust patch) and a new esbuild wrapper bundle (upstream's param/result adapters + reducers + data services with baked JSON) are committed artifacts under `src/sim/vendor/`. Our `adapter.ts` maps `SimBuild` → `WasmCreateRunner` and applies `skillLevels`/`skillPatches` as pure transforms on the `WasmSkillInput`s we pass (the boundary is data-free). `run.ts` keeps every export signature; internals call the sync wasm fns after a one-time async init (worker start / test beforeAll).

**Tech Stack:** Rust (stable, `wasm32-unknown-unknown`) + wasm-pack; esbuild; TypeScript; Vitest (node for engine tests, jsdom for UI); Vite worker with `?url` wasm asset.

**Spec:** [2026-07-10-sim-engine-wasm-replatform-design.md](../specs/2026-07-10-sim-engine-wasm-replatform-design.md)

## Global Constraints

- Upstream pin: `jalbarrang/umalator-global` **v0.27.0**, commit `484539f5c67e7aea8ef3715443d66602d871902d` (data 10006860, 2026-07-09). Clone lives at `spikes/repos/umalator-global` (gitignored).
- `src/sim` public API signatures do not change: `simulatableBase`, `evalSkillDelta`, `runVacuumCompare(opts?: VacuumOpts)`, `runPlannerCompare`, `runSkillTrace`, `skillImpact`, `allActivationRegions`, `runRaceCompare`, `SimClient`, worker protocol (`SimRequest`/`SimResponse`), `BashinStats`, `SimBuild`.
- Multi-fire flag name stays `cooldownReactivation`, default **ON**; OFF must be byte-identical to the unpatched upstream pkg (seeded-output identity, not "mean looks the same").
- The engine stays lazy: only the worker chunk (and node tests) load the pkg; UI chunks must not grow.
- P3: every simulated number shifts at cutover — PR text + CLAUDE.md must state this plainly.
- GPL-3.0 chain unchanged; all generated artifacts are committed, CI never needs Rust.
- Windows dev machine: PowerShell-safe commands; case-insensitive FS naming rules apply.
- **Do NOT delete or rebase the clone's current local baseline branch** (`ec44fd2`, TS patches applied) until Task 9 — the old bundle rebuild must stay reproducible in case of abort.

## Upstream API cheat-sheet (verified 2026-07-10 against the v0.27.0 tree)

- `src/lib/uma-sim-wasm/types.ts` — `WasmSkillInput { skillId, rarity, alternatives: [{ baseDuration, cooldownTime?, condition, precondition?, effects: [{ modifier, target, type, valueUsage?, valueLevelUsage? }] }] }`; `WasmCreateRunner { outfitId, name, mood, strategy(1-5), popularity?, aptitudes{distance,strategy,surface: 0-7}, stats{speed,stamina,power,guts,wit}, skills?, injectedDebuffs?, forcedPositions?, … }`; `WasmCompareParams { course, parameters, settings?, duelingRates?, runners, nsamples, masterSeed }`.
- `src/lib/uma-sim-wasm/adapter-params.ts` — `courseDataToWasm(CourseData)`, `resolveSkillInput(skillId) → WasmSkillInput|null` (reads `skillsService`), `raceParametersToWasm`, `sundayRunnerToWasm(CreateRunner, name)`, `compareSettingsToWasm(SimulationSettings)`.
- `src/lib/uma-sim-wasm/adapter-results.ts` — `wasmCompareRoundDataToCollected(WasmCompareRoundData) → CollectedRunnerRoundData` (time/position/velocity/hp arrays + `skillActivations: Record<skillId, SkillEffectLog[]>` + rushed/dueling regions + startDelay).
- `src/modules/simulation/simulators/shared-pure.ts` — `toCreateRunner(IRunnerState, sortedSkills, forcedPositions?, injectedDebuffs?, scenarioOverrides?, popularity?)` (**IRunnerState still takes 'Pace Chaser' labels + letter aptitudes + `wisdom`** — our `toRunnerState` output feeds it directly), `toSundayRaceParameters(racedef)` (accepts `{ground,weather,season,time,grade}` — maps `time`→`timeOfDay`), `createCompareSettings(overrides)`, `computePositionDiff(posA, posB)`, `isSameSkill`, `DEFAULT_DUELING_RATES`.
- `src/modules/simulation/simulators/wasm-compare.ts` — `reduceCompareRoundsPublic(rounds: CompareRounds, nsamples) → CompareResult` (`results` sorted asc, `runData.{min,max,mean,median}run: SimulationRun`, `staminaStats.{uma1,uma2}.{staminaSurvivalRate,fullSpurtRate}`, `firstUmaStats.{uma1,uma2}.firstPlaceRate`). **No `finalHp` upstream** — we derive it from round hp arrays ourselves. `CompareRounds = { roundsA: CollectedRunnerRoundData[], roundsB: … }` (see `splitContestedCompareRounds` for the shape).
- Loader (`loader.ts`) is upstream's async wrapper — **we bypass it**: our bundle imports the pkg glue statically and exposes `initEngine` + sync fns (§Task 2).
- The wasm pkg fns (`runCompare`, `runContestedCompare`, `runRaceSim`, exported from `pkg/uma_sim_wasm.js`) are **synchronous after wasm-bindgen init**.
- Multi-fire gap: `packages/uma-sim-primitives/src/skills/model.rs:49` carries `cooldown_time: Option<f64>` but no activation-logic read anywhere in `packages/` — confirmed by grep.

## File Structure (end state)

```
engine-patches/2026-07-10-multifire-rust.patch   # NEW — the only engine patch (Rust)
engine-patches/2026-06-22-multifire.patch        # DELETED (with the other 3 TS patches)
scripts/build-wasm.mjs                           # NEW — wasm-pack build → src/sim/vendor/pkg/
scripts/build-sim.mjs                            # REWRITTEN — bundles the v0.27.0 TS wrapper
src/sim/vendor/pkg/uma_sim_wasm.js|_bg.wasm|.d.ts# NEW committed artifacts
src/sim/vendor/umalator-wasm.bundle.mjs          # NEW committed bundle
src/sim/vendor/umalator-wasm.bundle.d.mts        # NEW hand-maintained decls
src/sim/vendor/umalator.bundle.mjs|.d.mts        # DELETED (Task 9)
src/sim/init.ts                                  # NEW — initEngine plumbing (worker + node)
src/sim/enginePin.ts                             # NEW — ENGINE_DATA_DATE constant
src/sim/adapter.ts                               # REWRITTEN — SimBuild→Wasm params + skill-input transforms
src/sim/run.ts                                   # REWRITTEN internals, same exports
src/sim/engine.worker.ts / worker-core.ts        # init-before-first-message
src/sim/fidelity.test.ts                         # re-baselined goldens
src/core/rebalancePatches.ts                     # ENGINE_DATA_DATE gate
```

---

### Task 0: Toolchain + unpatched pkg build + Node smoke (fail-fast spike)

**Files:**
- Create: `scripts/build-wasm.mjs`
- Create: `scripts/wasm-smoke.mjs` (temporary; deleted in Task 9)

**Interfaces:**
- Produces: `pnpm sim:build:wasm` emitting `src/sim/vendor/pkg/{uma_sim_wasm.js, uma_sim_wasm_bg.wasm, uma_sim_wasm.d.ts}`; proof that Node can init + run a seeded `runCompare`.

- [ ] **Step 1: Install the toolchain (one-time, manual-ok)**

```powershell
winget install Rustlang.Rustup; rustup default stable; rustup target add wasm32-unknown-unknown; cargo install wasm-pack
rustc --version; wasm-pack --version
```
Expected: stable rustc ≥ the clone's `clippy.toml` msrv; wasm-pack prints a version.

- [ ] **Step 2: Check out the pin in the clone on a work branch**

```powershell
cd spikes/repos/umalator-global
git switch -c local-wasm-baseline 484539f5c67e7aea8ef3715443d66602d871902d
```
(Leaves the old TS baseline branch untouched per Global Constraints.)

- [ ] **Step 3: Write `scripts/build-wasm.mjs`**

Port upstream's `scripts/build-wasm.ts` to plain Node (no bun): prepend the rustup stable toolchain bin dir to PATH (`rustc --print sysroot` → `<sysroot>/bin`), then run
`wasm-pack build packages/uma-sim-wasm --target web --release --out-dir <repo>/src/sim/vendor/pkg --out-name uma_sim_wasm` with `cwd` = the clone. Delete `pkg/.gitignore` after build (wasm-pack writes one that would hide the artifacts). Use `node:child_process.spawnSync` with `shell: process.platform === 'win32'`.

- [ ] **Step 4: Add the script + run it**

In `package.json` scripts: `"sim:build:wasm": "node scripts/build-wasm.mjs"`. Run `pnpm sim:build:wasm`.
Expected: pkg files exist; note the `.wasm` size in the task commit message.

- [ ] **Step 5: Node smoke — init from fs bytes + seeded runCompare**

`scripts/wasm-smoke.mjs`: read `src/sim/vendor/pkg/uma_sim_wasm_bg.wasm` with `node:fs`, `WebAssembly.compile(bytes)`, `await mod.default({ module_or_path: compiled })` on the glue import, then call `mod.runCompare` with: a minimal `WasmCourseData` taken from the clone's `course_data.json` entry `10101` (hand-copy the fields per the cheat-sheet type), `parameters {ground:1, weather:1, season:3, timeOfDay:2, grade:100}`, two identical runners (stats 1000s, strategy 2, aptitudes 1/1/1, `skills: []`), `nsamples: 5`, `masterSeed: 12345`. Log the result's round count and one runner's first/last position sample. Run it twice.
Expected: identical output both runs (determinism), 5 rounds. **If init or determinism fails here, STOP — re-plan before anything else.**

- [ ] **Step 6: Commit**

```powershell
git add scripts/build-wasm.mjs scripts/wasm-smoke.mjs package.json
git commit -m "chore(sim): wasm-pack build pipeline + node init smoke (upstream v0.27.0 spike)"
```
(Do NOT commit `src/sim/vendor/pkg/` yet — that lands with the patched build in Task 1.)

---

### Task 1: Multi-fire Rust port + identity backstop

**Files:**
- Modify (in the gitignored clone): `packages/uma-sim-primitives/src/runner/skills.rs`, `packages/uma-sim-primitives/src/skills/model.rs` (if the trigger model needs a field), `packages/uma-sim-wasm/src/dto.rs` + the settings plumbing for the flag
- Create: `engine-patches/2026-07-10-multifire-rust.patch`
- Commit: `src/sim/vendor/pkg/` (patched build)

**Interfaces:**
- Consumes: Task 0's build pipeline.
- Produces: pkg with `cooldownReactivation?: boolean` accepted in `WasmSettings` (default true); multi-fire behavior per the oracle below.

**Reference sources (read first):**
- Our TS port: `engine-patches/2026-06-22-multifire.patch` (the exact eligibility + gate semantics to reproduce) and its spec `docs/superpowers/specs/2026-06-22-m4-engine-multifire-cooldown-activation-design.md`.
- Upstream Rust: activation sampling lives in `packages/uma-sim-primitives/src/runner/skills.rs`; trigger-region sampling policies near the corner/straight `*_random` handling.

**Semantics to port (from the TS patch, verbatim):**
1. Eligibility: the skill's sampling policy is corner-random or straight-random (`all_corner_random`, `straight_random` — the policies that can emit multiple candidate regions) AND `cooldown_time < 5_000_000`.
2. Eligible skills sample a trigger position in EVERY matching region (multi-emit), not just one.
3. A later trigger fires only if `elapsed_race_time_since_last_fire ≥ (cooldown_time / 10000) * (distance / 1000)` seconds (distance = course distance in metres), gated on real accumulated race time.
4. Flag OFF ⇒ single-fire exactly as unpatched upstream (first trigger only).

- [ ] **Step 1: Write the Rust unit test first** — in `packages/uma-sim-primitives`, a `#[cfg(test)]` test constructing a skill with `cooldown_time: Some(2000.0)` (model.rs:343 already builds such a fixture) and a long course with ≥2 corner regions; assert two activations with the flag on and one with it off. Run `cargo test -p uma-sim-primitives` in the clone; expected FAIL (single activation).
- [ ] **Step 2: Implement** multi-emit + the cooldown gate + the `cooldown_reactivation` setting (serde `cooldownReactivation`, `#[serde(default = "default_true")]`). Run `cargo test -p uma-sim-primitives`; expected PASS, plus the crate's existing tests stay green (`cargo test` at `packages/`).
- [ ] **Step 3: Identity backstop.** Build the pkg from the CLEAN pin (`git stash` in the clone → `pnpm sim:build:wasm` → copy pkg aside to the scratchpad), then from the patched tree. Extend `scripts/wasm-smoke.mjs` to run a Prof-of-Curvature-like fixture (skill `200332` data from the clone's `skills.json`, Hanshin 3200 course `10914`, seeds 12345, nsamples 50, `cooldownReactivation: false`) against both pkgs and diff the full JSON output. Expected: byte-identical.
- [ ] **Step 4: Acceptance oracle.** Same smoke with flag ON (default): tracked activations for `200332` show 2 distinct fire positions on Hanshin 3200m (`10914`) in at least some rounds, and exactly 1 on a mile course (`10602`). Record the observed ×2 rate in the commit message.
- [ ] **Step 5: Capture the patch + commit artifacts**

```powershell
cd spikes/repos/umalator-global; git diff 484539f5 > ../../../engine-patches/2026-07-10-multifire-rust.patch; cd ../../..
pnpm sim:build:wasm
git add engine-patches/2026-07-10-multifire-rust.patch src/sim/vendor/pkg
git commit -m "feat(sim): multi-fire cooldown reactivation ported to Rust; commit patched wasm pkg (v0.27.0 + multifire)"
```

---

### Task 2: Wrapper bundle + `src/sim/init.ts`

**Files:**
- Rewrite: `scripts/build-sim.mjs`
- Create: `src/sim/vendor/umalator-wasm.bundle.d.mts`, `src/sim/init.ts`
- Commit: `src/sim/vendor/umalator-wasm.bundle.mjs`

**Interfaces:**
- Produces (bundle exports, used by Tasks 3–5):
  `initWasm(source?)` (the pkg glue's default init), sync `runCompare(params: WasmCompareParams): WasmCompareData`;
  `courseDataToWasm`, `resolveSkillInput`, `sundayRunnerToWasm`, `raceParametersToWasm`, `compareSettingsToWasm`;
  `wasmCompareRoundDataToCollected`; `reduceCompareRoundsPublic`; `toCreateRunner`, `toSundayRaceParameters`, `createCompareSettings`, `computePositionDiff`, `isSameSkill`;
  `skillsService`, `coursesService` (constructed with the pin's baked JSON).
- Produces (`src/sim/init.ts`): `initEngine(source?: WebAssembly.Module): Promise<void>` (idempotent), `initEngineFromFs(): Promise<void>` (node: reads `src/sim/vendor/pkg/uma_sim_wasm_bg.wasm`), `initEngineFromUrl(url: string): Promise<void>` (worker: fetch+compile).

- [ ] **Step 1: New entry source in `scripts/build-sim.mjs`.** Keep the existing esbuild scaffold (alias `@` → clone `src`, `absWorkingDir` = clone, json loader, `import.meta.env` define). Replace `entrySource` with an entry that (a) re-exports the pkg glue: `export { default as initWasm, runCompare } from './src/sim-pkg-glue'` — implemented as a static import of the built pkg's `uma_sim_wasm.js` copied into the clone temp entry dir (simplest: import via absolute path `<repo>/src/sim/vendor/pkg/uma_sim_wasm.js`); (b) re-exports the adapters/reducers/services listed in Interfaces; (c) constructs the services if v0.27.0 no longer exports ready instances — probe first:

```powershell
cd spikes/repos/umalator-global; git grep -n "export const skillsService\|export const coursesService" -- src/modules/data/services/
```
If instances are exported, re-export them; if only classes + loaders, instantiate in the entry with the JSON imports (`skill-loader` parse fn + `@/modules/data/json/skills.json`, `course_data.json`) and export the instances. Mark the wasm glue import as NOT external (bundle it); expect the glue's fallback `new URL('uma_sim_wasm_bg.wasm', import.meta.url)` to remain unused (we always init explicitly).

- [ ] **Step 2: Probe `isSimulatable`.** `git grep -n "isSimulatable" -- src/` in the clone at the pin. If it exists on the service, re-export as-is. If renamed/moved, export whatever predicate the pin uses (`skill-compare` filters non-simulatable ids somewhere — follow that import) under the name `isSimulatable(skillId: string): boolean` in the entry so `run.ts` keeps its guard unchanged.
- [ ] **Step 3: Run `pnpm sim:build`** (now = `node scripts/build-wasm.mjs && node scripts/build-sim.mjs` — update the package.json script). Expected: bundle written; esbuild fails loudly if any wrapper import drags in an app-only module — if so, drop that export and note the replacement in the bundle entry comment.
- [ ] **Step 4: Write `.d.mts` decls** for exactly the exported surface (mirror the cheat-sheet types; keep them minimal — `unknown` for shapes we don't consume).
- [ ] **Step 5: `src/sim/init.ts`** — module-level `let ready: Promise<void> | null`; `initEngine` calls the bundle's `initWasm({ module_or_path })` once; `initEngineFromFs` guards `typeof process`, reads + compiles the wasm; `initEngineFromUrl` fetches + compiles. Add `src/sim/init.test.ts` (node env): `initEngineFromFs()` resolves, second call resolves instantly (same promise).
- [ ] **Step 6: Run + commit**

```powershell
pnpm vitest run src/sim/init.test.ts
git add scripts/build-sim.mjs src/sim/vendor/umalator-wasm.bundle.mjs src/sim/vendor/umalator-wasm.bundle.d.mts src/sim/init.ts src/sim/init.test.ts package.json
git commit -m "feat(sim): v0.27.0 wasm wrapper bundle + engine init plumbing"
```

---

### Task 3: Adapter rewrite — `SimBuild` → Wasm params, skill-input transforms

**Files:**
- Rewrite: `src/sim/adapter.ts` (keep `STRATEGY_LABEL`, `toRaceDef`, `resolveCourse` semantics)
- Test: `src/sim/adapter.test.ts` (extend), port `src/sim/skillLevel.test.ts` + `src/sim/skillPatches.test.ts` to transform-level tests

**Interfaces:**
- Consumes: bundle exports from Task 2; `src/sim/skillLevelCoef.ts` (existing `coef(abilityType, level)` table — read it first, keep its API); `SkillPatch` from `@/core/rebalance`.
- Produces: `toWasmRunner(build: SimBuild, name: string, extras?: { injectedDebuffs?: Array<{ skillId: string; position: number }> }): WasmCreateRunner` (resolves skills via `resolveSkillInput`, applies transforms, threads debuffs into `toCreateRunner`); `applySkillLevel(input: WasmSkillInput, level: number): WasmSkillInput`; `applySkillPatch(input: WasmSkillInput, patch: SkillPatch): WasmSkillInput`; `toWasmRace(race: SimRaceParams): { course: WasmCourseData; parameters: WasmRaceParameters }`; `resolveCourse` (unchanged consumer contract: throws on unknown id, returns object with numeric `distance`); `bashinStatsFrom` moves to run.ts (Task 4) since the result shape changes.

**Transform semantics (authoritative references — mirror exactly, then port the old tests):**
- `applySkillLevel`: for a unique with level L, every effect's `modifier` scales by `coef(effect.type, L) / 10000`, rounded to integer. Reference: `engine-patches/2026-06-29-skill-level-scaling.patch` + `src/sim/skillLevel.test.ts` (Lv1 ⇒ identity).
- `applySkillPatch` (reference `engine-patches/2026-07-03-skill-patches.patch` + `src/sim/skillPatches.test.ts`): `patch.conditions` `'@'`-splits and replaces alternative conditions pairwise for non-empty split entries; `patch.modifier` (human units) × 10000 replaces EVERY effect's modifier on every alternative; `patch.duration` (seconds) × 10000 → `baseDuration`; `patch.cooldown` (already raw ×10000 units) → `cooldownTime`. Absent patch ⇒ return the input object UNCHANGED (reference equality — identity backstop).

- [ ] **Step 1: Write failing transform tests** (pure, no wasm init needed) — port every case from `skillLevel.test.ts`/`skillPatches.test.ts` onto fixture `WasmSkillInput`s, plus: `toWasmRunner` maps spd/sta/pow/gut/wit → speed/stamina/power/guts/wit, strategy `'pace'` → 2, grade `'A'` → 1, mood default 2, drops unresolvable skill ids silently, applies level+patch only to matching ids.
- [ ] **Step 2: Run to verify failure.** `pnpm vitest run src/sim/adapter.test.ts` — FAIL (functions missing).
- [ ] **Step 3: Implement.** `toWasmRunner` composes: `toRunnerState`-style label mapping → `toCreateRunner(runnerState, sortedSkills)` → `sundayRunnerToWasm(createRunner, name)` → map `skills` through `applySkillLevel` (ids in `build.skillLevels`) and `applySkillPatch` (ids in `build.skillPatches`). Keep our wit→wisdom note.
- [ ] **Step 4: Run tests to green**, then **Step 5: Commit** `feat(sim): SimBuild→WASM adapter with app-side skillLevel/skillPatch transforms`.

---

### Task 4: `run.ts` rewrite on the WASM engine

**Files:**
- Rewrite: `src/sim/run.ts` internals (every export keeps its exact signature)
- Test: `src/sim/run.test.ts` (node env; `beforeAll(initEngineFromFs)`)

**Interfaces:**
- Consumes: Task 2 bundle (`runCompare`, `wasmCompareRoundDataToCollected`, `reduceCompareRoundsPublic`, `computePositionDiff`, `isSameSkill`, `isSimulatable`), Task 3 adapter.
- Produces: the unchanged `src/sim` API; internal helper `vacuumRounds(a: SimBuild, b: SimBuild, race, nsamples, seed, settings?) → { rounds: CompareRounds, result: CompareResult }` shared by all entries.

**Implementation notes (per entry):**
- All entries: guard `nsamples < 1` / `spd <= 0` / `isSimulatable` exactly as today; `simulatableBase` filters via the bundle's `isSimulatable`.
- `vacuumRounds`: build `WasmCompareParams` with `runners: [toWasmRunner(a,'uma1'), toWasmRunner(b,'uma2')]`, `settings: compareSettingsToWasm(createCompareSettings({ healthSystem: true, ...overrides }))` (we always sim with stamina ON today — `ignoreStaminaConsumption: false`), `masterSeed: seed`, call sync `runCompare`, convert rounds with `wasmCompareRoundDataToCollected`, reduce with `reduceCompareRoundsPublic`.
- `evalSkillDelta(build, race, skillId, n, seed)`: `vacuumRounds(base, {...base, skills:[...base.skills, skillId]}, …)`; `BashinStats` from the reduction's results; `activated` = any roundB has a `skillActivations` key matching `isSameSkill(·, skillId)`.
- `runVacuumCompare(a, b, race, n, seed, opts)`: `vacuumRounds` with `settings` overrides `{ downhill: opts?.downhill ?? false, staminaDrainOverrides: opts?.staminaDrainOverrides ?? {} }`; injected debuffs go on each runner via `toWasmRunner`'s `extras.injectedDebuffs` (Task 3 contract). `aFinalHp/bFinalHp` = per-round `hp[hp.length-1] ?? 0`; survival/spurt/first-place rates from the reduction (`/100` as today).
- `runPlannerCompare(build, race, candidateSkills, n, seed)`: `vacuumRounds(build, {...build, skills:[...build.skills, ...candidateSkills]}, …)`; `activated` = any candidate id matches any roundB activation key.
- `runSkillTrace` / `runRaceCompare`: the reduction's `runData.{min,max,mean,median}run` are `SimulationRun`s with the same indexed shape (`time[runner]`, `velocity[runner]`, `position[runner]`, `hp[runner]`, `skillActivations[runner]`) — `zipFrames`, `activationRegions`, `allActivationRegions`, `gapCurve`, `mapRun`, `mapCompareRun` port with type updates only.
- `skillImpact`: per-round over `roundsB`: tracked logs (keys matching `isSameSkill`) → `positions` = each log's start position; `horseLength` = `computePositionDiff(roundA.position, roundB.position) / 2.5` — **verify against the old semantics** (old engine returned バ身 directly in `skillActivations[id].horseLength`; positionDiff is metres, バ身 = m/2.5). Only rounds with ≥1 tracked log become samples.

- [ ] **Step 1: Write the failing tests** — port `run.test.ts` cases: `evalSkillDelta` returns n results sorted ascending + `activated` true for `200332` on `10101`; same seed ⇒ identical stats twice; `runVacuumCompare` returns `aFinalHp.length === n`; `runSkillTrace` runs have equal-length with/without frame arrays and activation regions within `[0, distance]`; `skillImpact` samples ⊆ nsamples with positions in-range; `runRaceCompare` gap curve length > 0; unknown skill id in `skills` does not throw (simulatableBase); `evalSkillDelta` with an unknown tracked id returns EMPTY.
- [ ] **Step 2: FAIL run**, **Step 3: implement**, **Step 4: green run** (`pnpm vitest run src/sim/run.test.ts src/sim/adapter.test.ts`), **Step 5: commit** `feat(sim): run.ts entries on the WASM engine (unchanged public API)`.

---

### Task 5: Worker init + client

**Files:**
- Modify: `src/sim/engine.worker.ts`, `src/sim/worker-core.ts` (if the dispatch lives there), `src/sim/client.ts` (only if a ready-handshake is needed)
- Test: `src/sim/worker-core.test.ts` (node), `src/sim/client.test.ts` (unchanged expectations)

- [ ] **Step 1:** In the worker module: `import wasmUrl from '@/sim/vendor/pkg/uma_sim_wasm_bg.wasm?url'` and await `initEngineFromUrl(wasmUrl)` before processing the first message (queue messages until ready — a top-level `const ready = init()` + `await ready` at the head of the message handler keeps the protocol unchanged, no client handshake).
- [ ] **Step 2:** Vite config: confirm `.wasm?url` needs no plugin (Vite core handles `?url`). Run `pnpm build`; verify the wasm lands in `dist/assets` and the worker chunk stays lazy (`grep -c uma_sim_wasm dist/assets/<worker chunk>` sanity).
- [ ] **Step 3:** worker-core tests: swap any bundle mocks to the new module id; green. **Step 4: commit** `feat(sim): worker loads wasm asset before first message`.

---

### Task 6: Fidelity re-baseline + parity spot-check

**Files:**
- Rewrite: `src/sim/fidelity.test.ts`
- Modify: `docs/mechanics-notes.md` (spot-check record)

- [ ] **Step 1: New goldens.** `beforeAll(initEngineFromFs)`. Test A (flag-OFF anchor): `evalSkillDelta(smokeBuild, {courseId:'10101'}, '200332', 50, 12345)` with `cooldownReactivation:false` threaded via a settings override (add a test-only escape: `vacuumRounds` already takes settings overrides; expose `evalSkillDelta`'s internals or run `runCompare` directly in the test) — record the mean produced on the first verified run as `EXPECTED_MEAN` with a comment `// Recorded from wasm pkg (v0.27.0 + multifire patch, flag OFF) — re-record only deliberately, citing cause`. Test B: multi-fire oracle — flag ON (default), Prof `200332` on `10914` shows ≥1 round with 2 distinct activation starts across 200 samples, and 0 such rounds on `10602`. Test C (Corner Adept sanity, ported): mean ≥ 0 on `10101`.
- [ ] **Step 2: Upstream parity spot-check (manual, one-time).** Run 3 builds (the smoke build; a stamina-poor long-distance build; a skill-heavy build) on upstream's deployed umalator with identical course/conditions/samples; compare mean/median to our `runVacuumCompare`/`evalSkillDelta` outputs — agreement within sampling noise (±~0.1 バ身 at 500 samples). Record inputs + both sides' numbers in `docs/mechanics-notes.md` §"WASM re-platform parity (2026-07)".
- [ ] **Step 3: Full engine suite green:** `pnpm vitest run src/sim` — every test passes. **Step 4: commit** `test(sim): wasm fidelity goldens + upstream parity record`.

---

### Task 7: `ENGINE_DATA_DATE` rebalance gate

**Files:**
- Create: `src/sim/enginePin.ts` — `export const ENGINE_DATA_DATE = '2026-07-09';` (data 10006860) + doc comment "bump on every engine-data refresh"
- Modify: `src/core/rebalancePatches.ts`, the sidebar version-picker component (grep `skillVer` in `src/features/` for the picker), `src/core/rebalancePatches.test.ts`

**Interfaces:**
- Produces: `skillPatchMap(ctx)` and `activePatchNotes(ctx)` take `engineDataDate: string` in `PatchCtx` (threaded by every existing call site from `ENGINE_DATA_DATE` — grep `skillPatchMap(` / `activePatchNotes(`); a version is **in-pin** when `v.globalDate !== undefined && v.globalDatePredicted !== true && v.globalDate <= engineDataDate`; in-pin versions emit no patch and no note. `pinLag` becomes `v.ver <= info.globalVer && !inPin(v)`.

- [ ] **Step 1: Failing tests:** a July-1-style version (`globalDate:'2026-07-01'`, confirmed, with modifier) emits NO patch and NO note at `engineDataDate:'2026-07-09'`; a confirmed version dated `2026-08-01` still emits (pin-lag); a **pinned** in-pin version emits no patch; a pinned OLDER-than-pin version (v1 when v2 is in-pin) emits no patch and the picker helper marks it `simUnavailable`.
- [ ] **Step 2:** FAIL run → implement the gate + a pure `versionSimUnavailable(v, info, engineDataDate): boolean` for the picker label ("pre-patch values unavailable in sim") → green (`pnpm vitest run src/core/rebalancePatches.test.ts`).
- [ ] **Step 3: App-level verification:** `pnpm dev` → planner page → The Duty of Dignity Calls detail: **no** "confirmed patch, engine pin pending" chip; rebalance-history section still lists v2; timeline patch entries intact. **Step 4: commit** `feat(rebalance): ENGINE_DATA_DATE gate retires in-pin patch chips`.

---

### Task 8: One-pin app-data refresh (runbook §1)

**Files:**
- Modify: `scripts/fetch-borrowed.ts` (`UPSTREAM_COMMIT = '484539f5c67e7aea8ef3715443d66602d871902d'`), `scripts/outputs.test.ts` (counts + `global-484539f5` literals), every `global-76214c82` occurrence (`grep -rn "global-76214c82" src scripts data-overrides`)

- [ ] **Step 1:** Bump the pin, `pnpm data:fetch && pnpm data:build`. Resolve any `already emitted by the generator` failures per runbook §1 step 3 (delete stale addition records).
- [ ] **Step 2:** Update `outputs.test.ts` counts + dataVersion literals; `grep` sweep for the old fragment.
- [ ] **Step 3:** Review the `public/data/` diff deliberately: new skills/cards/umas counts, rebalance auto-candidates, timeline changes. Check the icon build behavior (server-aware since PR #36 — JP-ahead icons absent from the dump stay placeholders; note count).
- [ ] **Step 4:** `pnpm typecheck && pnpm test && pnpm build` all green. **Step 5: commit** `data: bump app pin to v0.27.0 (484539f5) — unified with engine pin`.

---

### Task 9: Delete the old engine + cleanup

**Files:**
- Delete: `src/sim/vendor/umalator.bundle.mjs`, `src/sim/vendor/umalator.bundle.d.mts`, `engine-patches/2026-06-22-multifire.patch`, `engine-patches/2026-06-24-stamina-finalhp.patch`, `engine-patches/2026-06-29-skill-level-scaling.patch`, `engine-patches/2026-07-03-skill-patches.patch`, `scripts/wasm-smoke.mjs`, old `src/sim/skillLevel.test.ts`/`skillPatches.test.ts` if fully superseded by Task 3's transform tests

- [ ] **Step 1:** `grep -rn "umalator.bundle" src scripts docs` — retarget every import to the new bundle (courseData.ts / courseCatalog.ts / skillTechFormat.ts / coverage innate loaders reach `coursesService`/`skillsService` through `@/sim/courseData` etc. — keep those modules' lazy-import discipline, only their vendor specifier changes).
- [ ] **Step 2:** Delete the files; `pnpm typecheck && pnpm test && pnpm build` green. Verify chunk sizes: the new engine chunks stay out of UI chunks (compare `dist/assets` listing before/after; record in commit).
- [ ] **Step 3: Full-app smoke (manual, with the dev server):** `pnpm dev` (+ tailnet URL per CLAUDE.md) — M4 unique + skill charts run; skill-detail velocity/impact graphs render; mini-sim overlay draws both curves + rung-stacked markers; stamina tab full-spurt + finish-HP histogram + debuff injection; sidebar unique Lv stepper changes +L; M2 optimizer compare runs; `/inheritance` unaffected.
- [ ] **Step 4: commit** `chore(sim): delete v0.14.2 TS engine bundle + superseded TS patches`.

---

### Task 10: Docs, memory, wrap

**Files:**
- Rewrite: `src/sim/vendor/README.md` (pin v0.27.0 `484539f5`, artifact inventory: pkg + wrapper bundle, rebuild = `pnpm sim:build`, Rust prereqs, patch re-apply flow)
- Modify: `docs/provenance.md` §1 (pin record; GPL unchanged; wasm-pack toolchain note), `docs/data-refresh-runbook.md` (§1 one-pin procedure: data:fetch + data:build + sim:build together; `ENGINE_DATA_DATE` bump step; delete the "sim engine is pinned separately" note), CLAUDE.md (status entry + engine gotchas: multi-fire now Rust, `runComparison` references → `runCompare`, lazy-engine gotcha now names the pkg, fidelity anchor wording)
- Delete: `docs/engine-update-todo.md` (superseded by the spec)
- Modify: `docs/roadmap.md` — record the unlocked follow-ups (spec §10): contested compare → near-lane skills + full race-sim page; force-activation UI; position-keep/Power-Conservation telemetry surfacing
- Memory: update `masterdb-patch-diff-technique.md` (the "skillPatches is the practical path until re-evaluated" line → re-platform DONE 2026-07; datamine feed still the source for future patches, now gated by `ENGINE_DATA_DATE`)

- [ ] **Step 1:** Make all doc edits; **Step 2:** `pnpm typecheck && pnpm test && pnpm build` final gate; **Step 3:** commit `docs: engine re-platform records (pin, runbook, provenance, CLAUDE.md)`; **Step 4:** merge/PR per `superpowers:finishing-a-development-branch` — PR text MUST include the P3 note: *"every simulated number shifts at this cutover (13 releases of upstream physics + fresh data); this is expected and desirable, not a regression."*

---

## Verification checklist (whole-plan acceptance)

- [ ] `pnpm sim:build` reproduces both committed artifacts from a clean clone checkout + patch apply.
- [ ] Flag-OFF seeded outputs identical between patched and unpatched pkg (Task 1 Step 3 record).
- [ ] Prof of Curvature: 2× Hanshin 3200m / 1× mile (fidelity Test B).
- [ ] No "engine pin pending" chips anywhere at Current horizon; rebalance history + timeline intact.
- [ ] `aFinalHp`/`bFinalHp`, downhill, staminaDrainOverrides, injectedDebuffs all flow (stamina tab works end-to-end).
- [ ] Unique Lv stepper still changes projected +L (skillLevels transform).
- [ ] Full suite green: `pnpm typecheck && pnpm test && pnpm build`.
- [ ] UI chunks did not grow (engine stays worker/lazy-only).
