# M4 — Skill-detail graphs (velocity / length / activation rate)

**Date:** 2026-06-17
**Module:** M4 Skill Acquisition (`/`)
**Branch:** `feat/m4-skill-detail-graphs`
**Status:** design approved, pending implementation plan

## Goal

Inside an expanded `SkillDetailDisclosure`, add three views for the skill, each
simulated against the **caller's** build + course:

1. **Velocity vs time** — the with-skill and without-skill speed curves overlaid,
   with the skill's activation zone shaded.
2. **L vs distance** — cumulative length advantage (バ身) the skill buys, plotted
   over race distance, with the activation point marked.
3. **Activation rate (発動率)** — the fraction of runs in which the skill actually
   procs (button-gated; see §"Run triggers").

These complete the effect-chip work already in the disclosure (the wishlist/chart
already show effect chips + a projected-L badge; the graphs are the missing piece
called out in `CLAUDE.md` and the M4 module doc).

## Key finding — no external data needed

VFalator (which the user saw crediting `ウマ娘.攻略.tools`/U-tools for these graphs)
is a **fork of umalator**, the same engine we vendored as umalator-global v0.14.2.
The per-frame trace these graphs draw is **already computed inside our bundle** —
we currently discard it.

Research artifacts (reference only, nothing to import):

- **U-tools** (`xn--gck1f423k.xn--1bvt37a.tools`) — a *directory* of community tools,
  not a tool itself.
- **しらす丼 Skill Simulator v4.9.1** (Google Sheet) — the canonical v-t graph; its
  method is `バ身差 = (time_without − time_with) × spurt_speed`, which is exactly the
  engine's `positionDiff / 2.5`.
- **mee1080 race emulator** (`mee1080.github.io/umasim/race/`) — a second independent
  port of the same engine; useful only as a future **validation oracle**, not a data source.

### Where the trace lives in our bundle

`src/sim/vendor/umalator.bundle.mjs`:

- `runComparison` (head-to-head A vs B) returns
  `runData: { minrun, maxrun, meanrun, medianrun }` where each run is a full
  `SimulationRun` with **both runners'** per-frame arrays
  (`time`/`position`/`velocity`/`hp`/`skillActivations`, indexed `[A, B]`) — see
  lines ~119279–119292. This is the source for the **curves**.
- `runSkillComparison` returns `skillActivations[trackedSkillId]` = one entry per
  sample the skill fired (line ~119161). This is the source for the **activation rate**.
- `1 バ身 = 2.5 m` (`basinn = positionDiff / 2.5`, line ~119125/119336).

The two graphs and the rate therefore come from **two engine entry points**; they
cannot share a single sim (the cheap curve call returns frames but no per-skill
activation count; the rate call returns counts but no velocity frames).

## Approved decisions

| Question | Decision |
|---|---|
| **Sim context** (which build + course) | **Per call site (Option A)** — disclosure takes an optional `traceContext={build, race}`. Sidebar passes the player's plan (matches the existing `projectedL` badge); UmaChartPanel passes the all-1200 `REFERENCE_STATS` build. No context → no graphs. |
| **Curve trigger** | **Auto** on expand (cheap single representative run). |
| **Rate trigger** | **Button-gated** — "Compute activation rate". Rationale: an honest % needs a few hundred samples (~20× the curve cost) and can't reuse the curve sim; auto-firing it on every expand while skimming the accordion list is the costly case to avoid. |
| **"Effectiveness rate" meaning** | Activation rate / 発動率 (not contribution or L/SP). |
| **Representative run** | Default **Typical** (median-by-L). User can re-pick **Best/Worst** (max/min) with no re-sim — all four runs return in one call. |
| **Accordion** | One disclosure open at a time **in the UmaChartPanel** ("this chart"). Controlled-open prop makes extending to the wishlist trivial later. |
| **Charting** | Hand-rolled SVG, matching the racetrack / `cmp-plan-card` grammar (no chart library — none is in `package.json`). |
| **Sample counts** | `~20` auto (curve), `~400` rate — tunable module constants. |

## Architecture

Data flow:

```
SkillDetailDisclosure (expanded, traceContext set)
  → useSkillTrace hook
    → SimClient (worker)               [@/sim/client, NOT the @/sim barrel — keep engine lazy]
      → run.ts wrappers
        → umalator.bundle.mjs (runComparison / runSkillComparison)
  → SkillTraceCharts (pure SVG)
```

### 1. Engine layer (`src/sim/`)

- **`run.ts` — two new wrappers:**
  - `runSkillTrace(build, race, skillId, nsamples, seed)` → `runComparison` with
    `uma1 = build`, `uma2 = build + skillId`. Returns a typed `SkillTrace`:
    ```ts
    interface SkillTrace {
      // each representative run mapped to clean per-frame arrays:
      runs: Record<'min' | 'max' | 'mean' | 'median', {
        withSkill: { t: number; v: number; pos: number; hp: number }[];
        without:   { t: number; v: number; pos: number; hp: number }[];
        activation: { start: number; end: number }[]; // tracked-skill regions (pos, metres)
        L: number;                                     // バ身 for this run
      }>;
      meanL: number;       // mean over all samples (== evalSkillDelta semantics)
      nsamples: number;
    }
    ```
  - `skillActivationRate(build, race, skillId, nsamples, seed)` → `runSkillComparison`;
    `rate = (skillActivations[skillId]?.length ?? 0) / nsamples`. Passive/always-on
    skills → `1`. Returns `{ rate: number; nsamples: number }`.
  - Both guard `skillsService.isSimulatable(skillId)` and `build.spd > 0` (the
    `firstPositionInLateRace` gotcha — never sim a zero-speed build).
- **`engine.worker.ts` (`handleSimRequest`):** add request kinds `skillTrace`, `skillRate`.
- **`client.ts`:** add `skillTrace(...)` / `skillRate(...)` methods (mirror `skillDelta`).
- **`types.ts`:** add `SkillTrace` / `SkillRate` types + request/response union members.
- **`umalator.bundle.d.mts`:** widen `CompareResult.runData` from `unknown` to
  `{ minrun, maxrun, meanrun, medianrun: SimulationRun }` and add the `SimulationRun`
  shape (`time/position/velocity/hp/skillActivations` as `[number[], number[]]` etc.).
  d.mts-only widening — same precedent as the `coursesService.getAll()` widening; **no
  `pnpm sim:build` rebuild needed.**

### 2. Hook layer (`src/features/cm-planner/useSkillTrace.ts`)

Mirrors `useUmaChart`'s run-on-demand pattern. Module-shared `SimClient` from
`@/sim/client`.

- Auto-runs `skillTrace` (nsamples ≈ 20) when the disclosure is **open and
  `traceContext` is present** → curves.
- `computeRate()` runs `skillActivationRate` (nsamples ≈ 400) on demand.
- `runChoice` (`Typical`/`Best`/`Worst` → `median`/`max`/`min`) selects which
  representative run the charts read — **no re-sim** (switches the already-returned run).
- States: `idle | running | done | na` (na = not simulatable / zero-speed build).
- Cancels in-flight runs on unmount / context change (run-token pattern from `useUmaChart`).

### 3. Presentational charts — `src/features/cm-planner/skill-trace/` (pure SVG)

All pure (data in → SVG out), independently unit-testable:

- `VelocityTimeChart` — two polylines (with/without), shaded activation zone,
  axes (t s, v m/s).
- `LengthDistanceChart` — single polyline `(posB − posA)/2.5` vs distance, zero
  baseline, activation marker.
- `ActivationRateBadge` — `idle` → "Compute activation rate" button; after run →
  `NN%` + a small bar.
- `RunChoiceToggle` — Best / Typical / Worst (default Typical).

### 4. Integration — `SkillDetailDisclosure.tsx`

- New optional prop `traceContext?: { build: SimBuild; race: SimRaceParams }`. When
  expanded **and** `traceContext` is set, render `<SkillTraceSection>` (hook + charts)
  below the effect list. No `traceContext` → unchanged (backward-compatible; existing
  callers pass `skill` only).
- Make open **controllable**: optional `open?: boolean` + `onOpenChange?(open)`.
  Controlled when both provided; otherwise keep the current internal `useState`
  (no behaviour change for existing callers).
- Wiring (Option A):
  - **Sidebar** (`PlannerSidebar`) — selected-uma unique + each wishlist target pass
    `{ build: <plan → SimBuild>, race: <plan race> }` (reuse the same conversion the
    existing `projectedL`/`evalSkillDelta` path uses).
  - **UmaChartPanel** — each row passes `{ build: <REFERENCE_STATS + row outfit/aptitude/style>, race: <course> }` (same inputs `rankUmaChart` already builds per row).

### 5. Accordion (UmaChartPanel)

`UmaChartPanel` holds one `openOutfitId`; passes `open` / `onOpenChange` to each row's
disclosure so only one is open at a time. This also bounds auto-sims to one in flight.
Scoped to the chart table; the wishlist keeps its current independent-open behaviour
(the controlled prop leaves the door open to change that later).

## Testing

- **Pure chart geometry** — polyline points + viewBox scaling from fixed input arrays
  (deterministic, no engine).
- **Hook** — auto-run + `computeRate` + `runChoice` switching with **injected fake deps**
  (pattern from `useUmaChart.test`).
- **`run.ts`** — a small-`nsamples` *real* engine run asserts: non-empty with/without
  traces, sane `L` sign, `rate ∈ [0, 1]`; guards reject a zero-speed build.
- **Accordion** — `UmaChartPanel` test asserts at most one disclosure open.
- **Flake guard** — no `pnpm dev` server running during tests; trust `pnpm build` /
  `pnpm typecheck`; re-run a failing UI file once before treating it as real (the known
  React-null HMR race).

## Honest numbers (P3)

- Curves are labelled "single representative run (`<choice>` of N samples)" and always
  shown next to the activation rate, so a low-rate skill reads honestly (a typical run
  where it didn't fire shows ~no gain).
- The graphs are estimations, not verdicts — keep the existing reliability framing.

## Out of scope (YAGNI)

- HP / velocity / skill-activation zones on the **full racetrack** (separate task; needs
  the per-frame trace wired into `RaceTrackView`, tracked in `CLAUDE.md`).
- Cross-distance L-vs-distance *duration* graphs (the data-gated M4/M2 item).
- Persistent caching of trace results (can add later if expand→sim latency warrants).
- Extending the accordion / graphs to the wishlist list (deferred; trivially enabled
  by the controlled-open prop).

## Affected files

- `src/sim/run.ts`, `engine.worker.ts`, `client.ts`, `types.ts`, `vendor/umalator.bundle.d.mts`
- `src/features/cm-planner/SkillDetailDisclosure.tsx`
- `src/features/cm-planner/useSkillTrace.ts` *(new)*
- `src/features/cm-planner/skill-trace/*` *(new)*
- `src/features/cm-planner/UmaChartPanel.tsx`, `PlannerSidebar.tsx`
- `src/features/cm-planner/cm-planner.css`
