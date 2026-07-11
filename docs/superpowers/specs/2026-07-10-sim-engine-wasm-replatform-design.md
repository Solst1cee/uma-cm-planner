# Sim Engine Re-platform: TS Bundle → Rust/WASM (upstream v0.27.0) — Design

**Date:** 2026-07-10
**Status:** Approved (brainstormed with maintainer; scope + shape choices locked)
**Supersedes:** `docs/engine-update-todo.md` (the "bump to v0.18.0" sidelist — premise invalidated, see §1)

## 1. Why, and why now

Our vendored engine is `jalbarrang/umalator-global` **v0.14.2** (2026-06-05), a TS
bundle carrying four local patches (multi-fire, stamina/final-HP, skill-level
scaling, skillPatches). The old sidelist assumed upstream stayed TS and targeted
v0.18.0. Investigation (2026-07-10) shows:

- Upstream ported the engine **TS → Rust/WASM** starting v0.15.0 (2026-06-14,
  `packages/uma-sim-{primitives,race,vacuum,wasm}` workspace). v0.18.0 is the
  last tag with any TS engine (already restructured + demoted to a parity
  reference); by v0.19 the TS engine is deleted. Upstream is now **v0.27.0**
  (2026-07-10).
- The post-v0.18 era contains the physics work we actually want: Global
  1.5-anniversary position-keep updates, Power Conservation / Fully Charged,
  rushed-opponent condition aliases, 14 new condition tokens, game-accurate
  Runaway coupling, contested same-race compare, "mechanics fidelity from real
  race data" (v0.26).
- v0.27.0's data includes game data **10006860** (2026-07-09) — the 2026-07-01
  rebalance patch and everything since.

Decision (maintainer, 2026-07-10): **re-platform now** onto the Rust/WASM
engine rather than a data-only refresh of the frozen TS engine.

## 2. Key upstream facts the design builds on (verified in the pinned clone)

1. **The WASM boundary is data-free.** `WasmCreateRunner.skills` carries full
   skill definitions (`WasmSkillInput`: alternatives with
   condition/precondition/baseDuration/cooldownTime/effects); course data is a
   `WasmCourseData` param. The engine bakes nothing.
2. **Deterministic batch APIs** (all take `masterSeed`):
   - `runCompare(WasmCompareParams)` — two-runner vacuum compare with shared
     per-round seeds (our skill-compare / vacuum path).
   - `runContestedCompare(WasmContestedCompareParams)` — 2–12 runner same-race
     field with mob fill (new capability; out of scope here, see §10).
   - `runRaceSim(WasmRaceSimParams)` — full race with per-tick focus traces +
     event logs.
3. **Telemetry** per round/runner: time/position/velocity/hp/lane arrays,
   `skillActivations` (effect logs keyed by skill id), startDelay, rushed /
   dueling / spot-struggle / fully-charged regions, stamina counters
   (hpDied/fullSpurt), finish orders.
4. **Native params we currently patch in:** `WasmSettings.downhill`,
   `WasmSettings.staminaDrainOverrides`, `WasmCreateRunner.injectedDebuffs`,
   `forcedPositions`, `forcedRank`, forced rushed/dueling regions.
5. **Cooldown re-activation is NOT implemented.** `cooldownTime` crosses the
   boundary into `packages/uma-sim-primitives/src/skills/model.rs` but the
   activation logic never reads it — every skill fires at most once. Our
   multi-fire capability needs a Rust port.
6. **The wasm pkg is built, not committed**, via wasm-pack `--target web`
   (`scripts/build-wasm.ts`, cross-platform; Rust stable +
   `wasm32-unknown-unknown`; output gitignored at `src/lib/uma-sim-wasm/pkg/`).
7. **The TS wrapper layer is headless-clean.** `src/lib/uma-sim-wasm/`
   (loader / adapter-params / adapter-results / types) and
   `src/modules/simulation/simulators/` (`wasm-compare`, `wasm-skill-compare`
   (+`-plan`), `wasm-skill-planner` (+context), `shared`, `shared-pure`) import
   only pure domain modules + `es-toolkit` — bundleable exactly like today.
   `SkillService`/`CourseService` constructors accept their data as arguments.
8. License unchanged: GPL-3.0, clean chain (provenance §1 applies as-is).

## 3. Decisions (locked during brainstorm)

| Decision | Choice |
|---|---|
| Scope | Full Rust/WASM re-platform now (not data-only refresh, not v0.18.0 TS bump) |
| Multi-fire | **Port to Rust in phase 1** — no capability regression at cutover |
| Vendor shape | **Vendor upstream's TS wrapper layer** as a new bundle + committed wasm pkg |
| Migration | **Big-bang swap** — rewrite `run.ts`/`adapter.ts` internals in one pass, delete the old bundle + all four TS engine patches immediately; validate via new seeded goldens + upstream-site spot-checks |
| Pin | **v0.27.0** (one commit for engine code, engine data, and the app-catalog `UPSTREAM_COMMIT`) |

## 4. Vendored artifacts (all generated, all committed)

- **`src/sim/vendor/pkg/`** — wasm-pack `--target web` output
  (`uma_sim_wasm.js`, `uma_sim_wasm_bg.wasm`, `.d.ts`), built from the pinned
  source **with the multi-fire Rust patch applied**. This replaces
  `umalator.bundle.mjs` as the committed engine artifact.
- **`src/sim/vendor/umalator-wasm.bundle.mjs`** — esbuild bundle (same
  `scripts/build-sim.mjs` pattern, new entry list) of the upstream TS wrapper:
  `lib/uma-sim-wasm/*`, the `wasm-*` simulators, `shared`/`shared-pure`
  reducers, and the `SkillService`/`CourseService` classes with the pin's
  `skills.json`/`course_data.json` baked in (their constructors accept data —
  we construct the services ourselves in the bundle entry, sidestepping
  upstream's runtime manifest fetching).
- **`engine-patches/2026-07-10-multifire-rust.patch`** — the one remaining
  engine patch (Rust), replacing all four TS patches, which are **deleted**
  along with `umalator.bundle.mjs`.

The wasm `.js` glue resolves its `.wasm` sibling at runtime. In the app it is
loaded inside `engine.worker.ts` (fetch of a static asset colocated by Vite);
in Node tests the `.wasm` is read from disk and passed as a compiled
`WebAssembly.Module` to wasm-bindgen's init (`{ module_or_path }` — supported
path, used by upstream's own worker-pool sharing). The engine stays lazy: only
the worker chunk touches the pkg, same as the current bundle discipline.

## 5. API preservation — `src/sim` is the seam

**The public surface of `src/sim` does not change.** `simulatableBase`,
`evalSkillDelta`, `runVacuumCompare(opts: VacuumOpts)`, `runPlannerCompare`,
`runSkillTrace`, `skillImpact`, `allActivationRegions`, `runRaceCompare`,
`SimClient` + the `engine.worker` message protocol, `BashinStats` (incl.
`activated`), `SimBuild` (incl. `skillLevels`/`skillPatches`), every LRU cache
and sig helper (`skillPatchesSig` etc.). Only the internals of `run.ts` /
`adapter.ts` / `worker-core` are rewritten to build Wasm params and reduce Wasm
telemetry. **No UI component, hook, or test above `src/sim` changes behaviorally**
(numbers shift — §7; shapes don't). Existing cache keys already cover every
sim-affecting field, so the sig-completeness invariant carries over untouched.

Mapping of the four local capabilities:

| Capability (old TS patch) | New mechanism |
|---|---|
| `skillPatches` (2026-07-03) | **Adapter-side input transform**: apply conditions/modifier/duration/cooldown onto the `WasmSkillInput` before the boundary. Same replace semantics + expressibility limits as today (cannot add alternatives, `modifier` only for single-effect skills, `@`-split per alternative). |
| `skillLevels` (2026-06-29) | **Adapter-side**: scale each unique's effect modifiers by `skillLevelCoef(abilityType, level)/10000` on the passed `WasmSkillInput`. `src/sim/skillLevelCoef.ts` unchanged. |
| stamina/final-HP `VacuumOpts` (2026-06-24) | **Native**: `WasmSettings.downhill` / `staminaDrainOverrides`, `WasmCreateRunner.injectedDebuffs`, per-tick `health` telemetry (finish HP = last hp sample per round; full-spurt/hpDied counters come with the round data). |
| cooldown multi-fire (2026-06-22) | **Rust port** — §6. |

Vacuum semantics are preserved: `runCompare` is the two-runner vacuum compare
(both runners independent, `skillActivations` populated for both), matching
today's `runComparison`. Position-relative solo-sim caveats (order_rate skills
→ `inactive`) carry over unchanged.

## 6. Multi-fire Rust port

Port the 2026-06-22 TS logic into `packages/uma-sim-primitives` at the pin:

- Corner/straight random policies (`all_corner_random`, `straight_random`)
  emit **multiple candidate trigger regions** (the TS `sampleMulti`
  equivalent).
- Activation gating re-fires an expired skill when the distance-scaled
  cooldown has elapsed on real race time:
  `(cooldownTime/10000)·(distance/1000)` seconds. Eligibility = policy
  supports multi-sampling **and** `cooldownTime < 5_000_000` (same gate as
  today).
- A `cooldownReactivation` flag on the boundary settings (`WasmSettings`),
  **default ON**, threaded through our adapter from
  `SimulationSettings.cooldownReactivation` exactly as today. OFF must
  reproduce unpatched upstream behavior.

**Identity backstop (redefined for WASM):** build the pkg twice — patched and
unpatched — and assert seeded outputs are identical on the flag-OFF path for a
multi-fire-eligible skill (not merely "mean looks the same"). This is a
one-time verification recorded in the plan; the committed pkg is the patched
build.

**Acceptance oracle (unchanged):** Professor of Curvature fires 2× on Hanshin
3200m and 1× on a mile course; the ×1/×2 `activationCounts` distribution
remains a distribution (~double-rate on long courses), and the §0 overlay
shows every fire.

Escape hatch (only if the port stalls unrecoverably): land the cutover
flag-OFF-only and follow up — explicitly *not* the default plan.

## 7. Fidelity + testing

The TS-era anchor (meanBashin 0.2202, seed 12345) is **retired** — different
RNG stream, 13 releases of mechanics, new data. Replacements:

1. **Upstream parity spot-check (one-time, manual):** ~3 representative builds
   run through upstream's deployed umalator and through our vendored path with
   identical course/stats/samples; distribution-level agreement (mean/median
   within sampling noise). Results recorded in `docs/mechanics-notes.md` with
   date + inputs, same style as existing verifications.
2. **New seeded goldens** in `fidelity.test.ts` on the **flag-OFF path** (the
   upstream-identical anchor, same role the 0.2202 number played). Golden =
   exact mean at fixed seed/samples, updated only deliberately with a comment
   citing cause.
3. **Multi-fire identity backstop** per §6.
4. All existing `src/sim` unit tests keep their contracts (adapter shapes,
   cache behavior, worker protocol); expected *numbers* inside tests are
   re-baselined where asserted.

Node/vitest: wasm init from fs bytes (§4). jsdom UI tests: unchanged — they
mock `SimClient`/`useSkillTrace` already (existing gotcha discipline).

**P3 communication:** every simulated number in the app shifts at cutover.
The PR description + CLAUDE.md status entry must say so plainly: expected,
desirable (13 releases of physics fixes), not a regression signal.

## 8. Rebalance re-baseline (pin-lag retirement)

New pure gate in `src/core/rebalancePatches.ts` (or a sibling): a version
whose **confirmed** (non-predicted) `globalDate` ≤ **`ENGINE_DATA_DATE`** — a
constant exported by the vendor layer naming the pin's data date (2026-07-09
for 10006860) — emits **no patch and no chip** (its values are already native
in the engine data). Effects:

- The 95 July-1 entries in `data-overrides/rebalances.json` stay **verbatim**
  as history (Δ badges, rebalance-history section, timeline `type:'patch'`
  entries, version picker all survive) but stop patching. "confirmed patch,
  engine pin pending" disappears app-wide.
- The datamine feed (`scripts/rebalance-datamine/`) is untouched: the *next*
  Global patch's entries date after `ENGINE_DATA_DATE`, so they flow as
  pin-lag patches exactly as designed, until the next pin bump raises the
  constant and absorbs them. No entry deletion or payload stripping — the
  history file remains append-only.
- **Version-pin honesty:** a wishlist pin selecting a version *older* than the
  engine pin (e.g. pinning v1 after this lands) can no longer reproduce
  pre-patch physics — there is no reverse patch. The version picker labels
  such versions "pre-patch values unavailable in sim" (P3), and no patch is
  emitted for them.
- `activePatchNotes.pinLag` becomes `ver <= globalVer && globalDate > ENGINE_DATA_DATE`.
- `skillPatchesSig` and every cache key are unaffected (the map just gets
  smaller).

## 9. One pin + toolchain + docs

- `UPSTREAM_COMMIT` (app catalog) moves to the v0.27.0 commit → full runbook §1
  pass (data:fetch, data:build, `outputs.test.ts` counts, `global-<8>`
  literals, JP-ahead re-projection on the shared foresight clock, icon
  refresh). Engine data and app catalog are now the **same pin**; the runbook's
  "sim engine is pinned separately" note is rewritten: a pin bump = data:fetch
  + data:build + sim:build together.
- **Toolchain (one-time):** `rustup` (stable, `wasm32-unknown-unknown` target)
  + `wasm-pack`. `pnpm sim:build` becomes: verify/apply the Rust patch →
  wasm-pack build (via a ported, bun-free `scripts/build-wasm.mjs`) → esbuild
  wrapper bundle. CI untouched — artifacts are committed; CI never needs Rust.
- **Docs:** `src/sim/vendor/README.md` (new pin, artifact inventory, rebuild
  steps), `docs/provenance.md` §1 (pin record; GPL chain unchanged),
  `docs/data-refresh-runbook.md` (one-pin procedure + `ENGINE_DATA_DATE`
  bump), **delete `docs/engine-update-todo.md`** (this spec supersedes it),
  CLAUDE.md engine paragraphs + gotchas (multi-fire wording, `runComparison`
  references, "keep the engine lazy" now points at the pkg), memory note
  update (`masterdb-patch-diff-technique` — the "skillPatches is the practical
  path" line is superseded).
- Future bump cadence: check upstream releases once per CM cycle (the old
  sidelist's unanswered item — now cheap, since a bump is pin + rebuild +
  re-baseline against a stable API).

## 10. Out of scope (unlocked follow-ups, record in roadmap)

- **`runContestedCompare`** real-opponent fields → the deferred near-lane
  skills (Slipstream) and the planned dedicated full race-sim page.
- **`forcedPositions`/`forcedRank` UI** (VFalator-style "force at meter" —
  now natively honored, the old spike's blocker is gone).
- Surfacing position-keep / Power Conservation / rushed / dueling telemetry in
  charts and overlays.
- `runRaceSim` event-log-driven overlay upgrades.

## 11. Risks

| Risk | Mitigation |
|---|---|
| Multi-fire Rust port stalls | §6 escape hatch (flag-OFF-only landing + follow-up); port is phase-1 priority so it fails fast |
| Wasm-in-Node test init friction | Upstream's own `module_or_path` init path; prove in the first plan task before anything depends on it |
| All app numbers shift silently | §7 P3 communication; goldens updated deliberately with cited cause |
| Wrapper layer drags in app-only upstream modules on a future bump | Bundle entry is explicit; esbuild fails loudly on unresolvable imports — same discipline as today |
| Payload growth (wasm + glue) | Lazy worker-only loading preserved; measure and record size in the PR |
| Upstream data schema drift inside the wrapper | The wrapper and its data come from the same pin by construction — cannot drift |
