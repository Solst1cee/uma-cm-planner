# M4 WorkingTabs feedback — tabstrip, Uma-chart persistence, Accel chart, Stamina spurt analysis

**Date:** 2026-06-24
**Status:** Design (approved to write plan)
**Module:** M4 Skill Acquisition Planner (`/` · `CmPlannerPage`)
**Worktree:** `m4-workingtabs-stamina-accel`

## Context

Feedback on the 2026-06-24 main-page redesign (`WorkingTabs = Unique · Stamina · Accel · Skills · Mini-sim`). Four areas, landed as **separate commits A→B→C→D** (cheap wins first). This builds on the dual-build flip-card shell; the focused build is `focusedPlan ?? plan` throughout.

### Engine-capability findings (verified in the vendored clone)

The vendored engine (`spikes/repos/umalator-global`, bundle `src/sim/vendor/umalator.bundle.mjs`) already supports most of what the Stamina tab needs — only one tiny source patch is required.

- **`fullSpurtRate`** is already computed and returned by `runComparison` (`vacuum-compare.ts:267`, typed in `umalator.bundle.d.mts:101` as `staminaStats.uma1.fullSpurtRate`). Our adapter just doesn't surface it. **No patch.**
- **Downhill saving mode** is already a `runComparison` option: `options.allowDownhillUma1/2` → `createCompareSettings({ downhill })` (`vacuum-compare.ts:64,83`). Default **OFF** (`shared.ts:153`). **No patch** — pass it through the adapter.
- **Debuff injection** is already supported: `options.injectedDebuffs: { uma1: Array<{skillId, position}>, uma2: [...] }` (`types.ts:80–88`, wired in `runner.ts:1862`). Lets us model "expected debuffs hit" as forced HP-drain events even though the vacuum has no opponents. **No patch.**
- **Wit-check pass formula** lives in `runner.ts:1523`: `passChance = max(100 − 9000/wit, 20)%`. Used for the Accel tab's wit-check column — derived in JS, no engine call.
- **Per-sample finish HP** is the **only** missing piece. `runComparison` returns 4 representative runs (ranked by バ身) + aggregate stamina stats, not a per-sample HP array. A true distribution histogram needs it. **Small engine patch** (Area D).

### Acceleration-skill + condition data

- `SkillRecord.conditions` (in `skills.json`) holds the raw activation DSL (`order_rate<=40&phase>=2`, `all_corner_random==1`, …). Enough to parse **positioning** and detect **wit-check** (any `*_random` token).
- Effect **type** / **value** live only in the runtime bundle (`skillsService.skillCollection[id].alternatives[].effects[]` with `{type, modifier, value}`), reachable via `loadSkillTechnicalDetail` / `loadSkillCollection` (`skillTechnicalDetails.ts`). **Acceleration = effect `type === 31`** (per `SkillDetailDisclosure.EFFECT_TYPE_NAMES`). Identifying accel skills + effect value needs an async one-time scan of that collection — no `data:build`.

---

## Area A — Tabstrip: invisible lower border

`.cmp-tabstrip` has `border-bottom: 1px solid var(--border)` (`cm-planner.css:2130`). Change the border to transparent (remove the visible rule; keep layout/padding unchanged). One-line CSS.

**Test:** none beyond visual; covered by existing `WorkingTabs.test.tsx` render.

---

## Area B — WorkingTabs keep-alive + Uma-chart background run + track-change indicator

**Problem:** `WorkingTabs` renders only `current.node`, so switching tabs **unmounts** the active tab and discards its run state (the Uma chart's streamed rows vanish; an in-flight run is cancelled by `useStreamingRank`'s unmount cleanup).

### B1. Keep-alive tabs

Change `WorkingTabs` from "render only active" to **mount-on-first-visit, then keep mounted, hide inactive**:

- Track a `visited: Set<TabKey>` (seed with `initial`). Render a panel for each *visited* tab; never render an unvisited tab.
- The active panel is visible; inactive visited panels get the `hidden` attribute (`display:none`) and `aria-hidden`, and their tab keeps `role="tabpanel"` association.
- Result: a run started in any tab keeps streaming while you're on another tab; returning shows the same state. Applies uniformly to all tabs (Unique, Skills, etc.).

Keep-alive is safe because every heavy tab is **run-on-demand** (Unique/Skills already; Accel + Stamina become run-on-demand in C/D) — no hidden tab does engine work on its own.

`role="tablist"`/`role="tab"`/`aria-selected`/`aria-controls` semantics preserved; each visited panel needs its own stable `id` (`${PANEL_ID}-${key}`) and `aria-labelledby`.

### B2. Uma chart: clear only on track change; indicator on mid-run track edit

`UmaChartPanel` keeps its own `useUmaChart` state (now preserved by keep-alive). Two refinements:

- **Clear on track change:** when `courseId` changes, reset the chart to `idle` (drop streamed rows). Tab-switching never clears (handled by B1). Implement via an effect keyed on `courseId` that calls a new `reset()` from `useStreamingRank` (bump token, clear rows, `status:'idle'`, `runSig:null`), or unmount-remount the chart subtree on `courseId` (simpler: `key={courseId}` on the panel from `CmPlannerPage`, which also clears Skills/Accel/Stamina on track change — desirable and consistent).
  - **Chosen:** `key={selection.courseId}` on each heavy tab node in `CmPlannerPage` so a track change remounts (clears) them, while tab-switching (no courseId change) preserves them via keep-alive. This is the least-code, most-uniform mechanism and needs no `useStreamingRank` change.
- **Indicator on mid-run track edit:** the "Changed detected! please re-run" stale badge is currently gated `isStale && status !== 'running'`. Since a track edit now remounts (clears) the chart, a *non-track* edit (stats/wishlist) mid-run should still surface staleness. Drop the `status !== 'running'` guard so the stale badge can show while running too. (Same change in `UmaChartPanel` and `SkillChartPanel` for consistency.)

**Tests:** `WorkingTabs.test.tsx` — switching tabs keeps a previously-rendered tab in the DOM (hidden) and preserves its state (e.g. a typed-in search value persists across a round-trip). `UmaChartPanel` — remounts/clears when `courseId` changes; stale badge renders while `status==='running'` when sig differs.

---

## Area C — Accel tab → `AccelChartPanel` (filtered skill chart)

Replace `AccelCheckerTab` (median-position timing classifier) with **`AccelChartPanel`**, a skill chart scoped to **acceleration skills, excluding uniques**, reusing the Skills-tab ranking core. Build it as a *dedicated* panel that shares hooks/core with `SkillChartPanel` (not a refactor of `SkillChartPanel`) to limit blast-radius on the concurrently-edited `main`.

### Shared core (reused, unchanged)
`rankSkillChart` / `useSkillRank` / `chartBaselineBuild` / `acquirableSkills` (already excludes pure uniques) / `familyRepresentatives` / `purchaseSpCost` / `addOrReplaceWishlistSkill` / `SkillDetailDisclosure` / `useStaminaProbe`.

### Accel-skill identification
New helper `loadAccelSkillIds(): Promise<Set<string>>` in `skillTechnicalDetails.ts` (or a sibling): scan `loadSkillCollection()` once; a skill id is "accel" if any `alternatives[].effects[]` has `type === 31`. Also expose `loadSkillEffectValues()` returning, per accel skill id, the representative **effect value** (the type-31 effect's `modifier`, taking the max-magnitude alternative — same "strongest variant" spirit as the chart). Memoized module-level promise like the existing loaders.

The panel filters its candidate reps (`acquirableSkills` → `familyRepresentatives`) to those in the accel set before ranking.

### Columns & controls (mirrors Skills, plus accel-specific)
- **Filter tabs:** all / non-unique / inherited unique / white / gold — identical to `SkillChartPanel.FILTERS`.
- **Sortable metric columns:** **L**, **SP**, **L/100SP** (same `SortMetric` machinery), **plus Effect value** (sortable; from `loadSkillEffectValues`).
- **Positioning column (NOT sortable):** parsed from `conditions` by a new pure `src/core/skillConditions.ts` → `describePositioning(conditions: string): string`. Tokens handled: `order_rate<=N` → "≤N% back", `order>=N` / `order<=N` / `order==N` → "pos ≥/≤/= N", `bashin_diff_infront<=N` / `bashin_diff_behind<=N` → "within N back/front", `is_lastspurt`, `is_finalcorner`, `remain_distance<=N`. Multiple `@`-alternatives joined with " / ". Falls back to "—" when no positional token.
- **Wit-check column (NOT sortable):** `requiresWitCheck(conditions): boolean` (pure) = conditions contain any `*_random` token (`phase_random`, `all_corner_random`, `corner_random`, `straight_random`, `phaserandom`, etc.). Render **✗** when false (guaranteed proc); when true, render the **pass-chance number** `witCheckPassChance(wit)` = `Math.max(100 − 9000/wit, 20)` rounded, suffixed `%`, using the focused build's `wit`. (`witCheckPassChance` lives in `src/core/skillConditions.ts`, cites `runner.ts:1523`.)
- **In-build tag:** reuse the Skills-tab pattern — `SkillDetailDisclosure` + an `in build` chip on targeted rows (the `inBuildViews` + `cmp-inbuild` machinery).
- Run/Stop button + stale prompt: identical to `SkillChartPanel` (run-on-demand, streamed rows). Stamina-out warning banner reused.

### Wiring
`CmPlannerPage` renders `<AccelChartPanel courseId plan onChange collapseSkillSignal />` for the `accel` tab (same props shape as `SkillChartPanel`), replacing `<AccelCheckerTab>`. `AccelCheckerTab.tsx` + `accelCheck.ts` (and their tests) are **removed** — the timing classifier is superseded. (`classifyAccelTiming` has no other consumer; confirm before delete.)

**Tests:** `skillConditions.test.ts` (pure: positioning parse cases, wit-check detection, pass-chance formula incl. the 20% floor and a few wit values). `AccelChartPanel.test.tsx` (injected `skillImpact`/`skillDelta` deps + a stub accel-id set: filters to accel skills, excludes uniques, shows positioning/wit/effect columns, in-build tag, filter tabs, sort by effect value). Reuse the `SkillChartPanel.test.tsx` harness shape.

---

## Area D — Stamina tab → spurt analysis

Replace `StaminaCheckerTab`'s single finish/min-HP verdict with a **run-on-demand** spurt-analysis panel over the focused build. The build already carries wishlist recovery/green skills (via `planToOverlayBuild`) + the `gut` stat → feature 6 ("include recovery/green/guts") is satisfied by passing the overlay build; we additionally surface a small note confirming what's included.

### D0. Engine patch (the only source change) + adapter pass-through

**Patch `runComparison` (`vacuum-compare.ts`)** to also collect per-sample finish HP:
- add `finalHp: { uma1: number[], uma2: number[] }` accumulators; each sample push `roundA.hp[roundA.hp.length-1]` / `roundB.hp[...]`.
- return it on the result (extend `CompareResult.staminaStats.umaN` with `finalHp: number[]`, or add a sibling `staminaSamples`). Capture the diff as `engine-patches/2026-06-24-stamina-finalhp.patch` (precedent: `2026-06-22-multifire.patch`), then `pnpm sim:build`. **Run sim:build LAST**, right before finishing, to minimize the window where the regenerated bundle collides with the concurrent `main` session.

**Adapter / types / client pass-through (no rebuild):**
- `umalator.bundle.d.mts`: add `finalHp: number[]` to the `staminaStats.umaN` shape; add `allowDownhillUma1/2`, `injectedDebuffs`, `skillCheckChanceUma1/2`, `staminaDrainOverrides` to `SimOptions`.
- `SimRaceParams`/a new options arg: thread `downhill?: boolean` and `injectedDebuffs?` from our domain. `toRaceDef` stays race-conditions-only; the new flags go through the **`options`** object of `runComparison` (adapter `run.ts:runVacuumCompare` already builds `options`). Extend `runVacuumCompare(a,b,race,nsamples,seed,opts?)` with `opts = { downhill?, injectedDebuffs?, staminaDrainOverrides? }`.
- `VacuumResult`: add `aFullSpurtRate`, `bFullSpurtRate`, `aFinalHp: number[]`, `bFinalHp: number[]`.
- `SimClient.vacuum` + worker `vacuum` request: forward the new `opts`. (Worker request union gains optional fields; back-compat: absent = current behavior.)

### D1. HP-remaining distribution
From `aFinalHp` (focused build vs itself): show **min / max / median** finish HP and a **histogram** (hand-rolled SVG bars, ~12–16 bins over [0, maxObserved], umalator-style). Mark the 0-HP bucket (ran-out runs) distinctly. Reuses the chart styling grammar from `skill-trace`.

### D2. Spurt rate
Surface `aFullSpurtRate` (%) as a headline stat with a short caption ("% of runs that sustain max-speed spurt to the line").

### D3. Spurt-rate threshold → required stamina (reverse lookup)
- **Threshold input** (number, default **95%**): "target full-spurt chance".
- On Run, **binary-search the `sta` stat** (range e.g. [current build floor … 1200], integer steps) re-running `runVacuumCompare(build@sta, build@sta, race, N, …)` each step, reading `aFullSpurtRate`, to find the **minimum stamina** whose spurt rate ≥ threshold. ~8–10 sims (log₂ range). Show the result as **"Stamina needed: X"** with the search's spurt-rate at X.
  - Guard: cap iterations; if even max stamina can't hit the threshold, report "> 1200 (unreachable)". If current already meets it, report current/needed and a ✓.
  - Each sim uses the same `N` (e.g. `PROBE_NSAMPLES`-ish, maybe higher for stability, behind the Run button so latency is acceptable). State the chosen N in the plan.

### D4. Downhill saving mode (2.1)
A checkbox **"Downhill saving mode"** → passes `downhill:true` into every sim in this tab (D1–D3), via the new `runVacuumCompare` opts. Lowers required stamina / raises spurt rate. Off by default (matches engine default).

### D5. Debuff inputs (2.2) → folded into required stamina
Two number inputs: expected **white** stamina-debuffs and **gold** stamina-debuffs (separate, default 0). On Run, inject them as `injectedDebuffs.uma1` into the D1/D3 sims so the HP-drain is modeled by the engine (and thus folded into the **required-stamina** result and the HP distribution).

- **Representative debuff skills:** pick one representative **white** and one **gold** stamina-debuff skill id from the dataset (a skill whose type-31-adjacent / Recovery(type 9) effect has `modifier < 0` targeting others, i.e. an HP-drain debuff). Identify via a `loadDebuffSkillIds()` scan (Recovery effect with negative modifier, split by rarity). Inject `count` copies of the tier's representative at spread positions across the race (e.g. evenly in the middle phase).
  - **Fallback (if no clean representative or injection proves unfaithful in spike):** model each debuff as a flat HP penalty (`staminaDrainOverrides` or a post-hoc HP subtraction) using per-tier magnitudes sourced from `docs/mechanics-notes.md` / community data. The plan's first Stamina task is a **spike** to decide injection-vs-heuristic against a known build; the chosen path is recorded in the plan before building the UI.

### D6. Final stamina required
The **"Stamina needed"** output of D3 is computed **with** the D4 downhill toggle and D5 debuffs applied (they're part of the sims the binary search runs) — so it *is* the "final stamina required after including 2.1 and 2.2". Show a one-line breakdown: base (no downhill, no debuffs) → with downhill → with debuffs, so the deltas are legible.

### Layout
A controls row (threshold input, downhill checkbox, white/gold debuff inputs, Run/Stop) + results: spurt-rate stat, "stamina needed" stat with breakdown, HP min/max/median, histogram. Run-on-demand with the same stale-prompt pattern as the other charts.

**Tests:**
- `staminaSpurt.test.ts` (pure): histogram binning, min/max/median over a finish-HP array, the required-stamina **binary-search** over an injected `(sta) → spurtRate` function (monotonic stub) incl. the unreachable + already-met branches.
- Adapter/run tests: `runVacuumCompare` returns `aFullSpurtRate`/`aFinalHp`; downhill opt changes the result; injectedDebuffs opt threads through. (Real-engine, small N, like existing `run.test.ts`.)
- `StaminaSpurtTab.test.tsx`: injected vacuum dep — Run produces spurt rate + stamina-needed + histogram; downhill/debuff inputs feed the dep; no auto-run.

---

## Engine-change summary (collision management)

Only **one source patch**: per-sample finish HP in `runComparison`. Everything else (downhill, debuff injection, fullSpurtRate, wit formula) is already in the engine — surfaced via adapter/types only. Sequence: do all non-bundle work first; apply the engine patch + `pnpm sim:build` as the **final step before wrap-up**, capture `engine-patches/2026-06-24-stamina-finalhp.patch`, regenerate `umalator.bundle.mjs`, re-run the fidelity test (`cooldownReactivation:false` golden must still hold). If `main` has meanwhile regenerated the bundle, rebase and re-run `pnpm sim:build` (the bundle is generated, so "ours" = re-run the script, not a manual merge).

## Commit sequence (per-area)

1. **A** — `style(m4): invisible tabstrip lower border`
2. **B** — `feat(m4): keep-alive WorkingTabs + Uma-chart persists across tabs, clears on track change, mid-run stale indicator`
3. **C** — `feat(m4): Accel tab as filtered accel-skill chart (positioning · wit-check · effect value · in-build)`
4. **D (UI + adapter)** — `feat(m4): Stamina spurt analysis (spurt rate, required stamina, downhill, debuffs, HP histogram)`
5. **D (engine)** — `feat(sim): export per-sample finish HP for the stamina histogram` (+ regenerated bundle + patch file) — landed last.

## Out of scope / deferred

- Real opponent debuffs (vacuum has none) — debuffs stay an injected estimate.
- `velocityWindow`/`peakImpactPosition` multi-fire (pre-existing limitation, untouched).
- daftuyda.moe exact data parity — we derive positioning/wit from our own conditions data, not their table.
- Spurt-calculator reverse lookup via an exposed engine function — we use the binary-search-over-sta approach instead (no extra engine surface).

## Risks / verify-during-impl

- **Effect type 31 = Acceleration** — confirm against `SkillDetailDisclosure.EFFECT_TYPE_NAMES` and a couple of known accel skills (e.g. an Acceleration-effect gold) before relying on it.
- **`roundA.hp` last element = finish HP** (not a truncated/clamped artifact) — verify in the patch spike against a known survive/die build.
- **Debuff injection fidelity** — the D5 spike decides injection vs heuristic.
- **Binary-search stability** — `fullSpurtRate` is monotonic in stamina in expectation but noisy at small N; pick N high enough that the search is stable, or smooth (e.g. require the threshold to hold, accept ±1 stamina granularity).
- **Keep-alive perf** — all visited tabs stay mounted; confirm no auto-run effect fires engine work while hidden (all heavy tabs run-on-demand).
