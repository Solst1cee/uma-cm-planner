# M4 — Two-build race-sim comparison on the §0 racetrack (design)

**Date:** 2026-06-20
**Status:** approved (brainstorming) — implementation plan next
**Branch / worktree:** `worktree-m4-race-compare-track-overlay` (off local `main` @ 4f2c0d7)
**Supersedes / merges these handoffs:**
- [2026-06-20-m4-velocity-hp-vs-distance-racetrack-overlay-handoff.md](../plans/2026-06-20-m4-velocity-hp-vs-distance-racetrack-overlay-handoff.md) — *where it belongs* (the §0 racetrack overlay)
- [2026-06-20-m4-full-race-compare-handoff.md](../plans/2026-06-20-m4-full-race-compare-handoff.md) — *the data* (uma1-vs-uma2 full-race compare)

## 1. Goal

Reproduce umalator's **main view** inside the M4 planner: run a full race sim comparing **two builds head-to-head over the whole course** and overlay, on the existing §0 racetrack, **both builds' velocity + HP curves**, **both builds' skill-activation markers**, and a **バ身-gap-vs-distance curve** showing where uma1 pulls ahead and where it slows down. uma1 is the current `CmPlan` build (uma + unique + wishlist skills); uma2 is a comparison build.

This is one feature that unifies the two handoffs above: the **surface** is the racetrack overlay; the **data** is the two-build comparison.

## 2. Prior-tool research (what umalator actually does on a sim run)

Verified from source in `spikes/repos/` so we match it rather than approximate it.

- **The run — `runComparison` ([umalator-global vacuum-compare.ts](../../../spikes/repos/umalator-global/src/modules/simulation/simulators/vacuum-compare.ts)):** builds **two independent vacuum races** (`raceA` for uma1, `raceB` for uma2), each with its own collector. The umas **never share a track** — they don't actually race each other. Per sample they get the *same* seed, both `.run()`, and the "comparison" is purely the バ身 diff `(positionA − positionB) / 2.5` of their independent finishing positions. Over N samples it keeps **4 representative full runs**: min/max バ身 (extremes) + mean/median (the sample whose バ身 is closest to the running mean/median, computed after an 80% cutoff). Each kept run carries **both** runners' per-frame `time/position/velocity/hp` + `skillActivations` (`Record<skillId, log[]>` per runner).
- **The track draw — `useVisualizationData` ([umalator-global useVisualizationData.ts](../../../spikes/repos/umalator-global/src/modules/racetrack/hooks/useVisualizationData.ts)):** takes **one** chosen run and builds activation regions from `skillActivations[0]` **and** `[1]`, grouping effects by start position. Rule: **`end − start > 1` → shaded "Textbox" region; instant effect → "Immediate" marker.** Colored per uma.
- **The velocity/HP chart — `VelocityLines` ([uma-tools app.tsx:365](../../../spikes/repos/uma-tools/umalator/app.tsx#L365)):** `x = d3.scaleLinear().domain([0, courseDistance])`; plots **velocity vs position** for each runner; **HP on a separate scale** overlaid; gated by a "Show HP" checkbox.

**Key consequence for our design:** calling our vendored `runComparison(build, build)` and reading runner 0 is **exactly** how umalator produces uma1's trace — because the engine already runs each uma as an independent vacuum. So a two-build compare via `runComparison(uma1, uma2)` is faithful with **no `pnpm sim:build` rebuild**. Critically, `runComparison` (the vacuum-compare entry, wrapped by our `runVacuumCompare`/`runSkillTrace`) **does** populate `skillActivations` for both runners — unlike the gimped `runSkillComparison` skill-compare entry called out in CLAUDE.md's gotcha.

## 3. Architecture & data flow

```
CmPlan (active)            ─ planToOverlayBuild ─► uma1: SimBuild (uma+unique+wishlist)
CmPlan (uma2 source)       ─ planToOverlayBuild ─► uma2: SimBuild
        │
        ▼
useRaceCompare(uma1, uma2, race, enabled)   ── auto-run, LRU-memoized
        │  SimClient.raceCompare ─► worker kind:'raceCompare' ─► runRaceCompare (run.ts)
        ▼
RaceCompare { runs: Record<RunChoice, RaceCompareRun>, distance, nsamples, meanBashin }
        │
        ▼
RaceTrackView (extended)  ── new overlay layers, drawn in the same SVG on the distance→x scale
   VelocityHpLayer · ActivationMarkersLayer · GapLayer
```

`RunChoice = 'min' | 'max' | 'mean' | 'median'` (existing type). `RaceCompareRun = { uma1Frames: SkillFrame[]; uma2Frames: SkillFrame[]; uma1Acts: RaceActivation[]; uma2Acts: RaceActivation[]; gap: GapPoint[] }`. `RaceActivation = { skillId: string; start: number; end: number }`. `GapPoint = { pos: number; bashin: number }`.

## 4. Engine layer (`src/sim/`, `src/core/simBuild.ts`)

### 4.1 `planToOverlayBuild(plan: CmPlan): SimBuild` (new, in `core/simBuild.ts`)
Like `planToSimBuild` but with skills active: `skills = dedupe([plan.uniqueSkillId, ...plan.wishlist.map(w => w.skillId)])`, filtered to `skillsService.isSimulatable`. Everything else (stats, strategy, aptitudes, mood) identical to `planToSimBuild`. Keep `planToSimBuild` (vacuum, `skills:[]`) untouched — it's still the right base for the per-skill marginal-L charts.

### 4.2 `runRaceCompare(uma1, uma2, race, nsamples, seed)` (new, in `run.ts`)
Wraps the vendored `runComparison(uma1, uma2)` — the same call `runVacuumCompare` already makes — but **also maps the `runData` traces it currently discards**:
- For each of `min/max/mean/median`, map **both** runners' frames via `zipFrames(run, 0)` / `zipFrames(run, 1)` (reuse the existing helper).
- Collect **all** activation regions for each runner from `skillActivations[0]` / `[1]` (iterate `Object.entries`, flatten to `{skillId, start, end}` — generalize the existing single-skill `activationRegions`).
- Compute the **gap curve** per representative run: frames are tick-aligned (same dt + per-sample seed), so for frame index `j`, `gap[j] = { pos: uma1.pos[j], bashin: (uma1.pos[j] − uma2.pos[j]) / 2.5 }`. (Plot at uma1's position — "by the time uma1 reaches here, it leads by N バ身".)
- Return `RaceCompare { runs, distance, nsamples, meanBashin }`, `meanBashin = _mean(results)`, `distance = resolveCourse(race.courseId).distance`.
- Guard: if `uma1.stats.spd <= 0 || uma2.stats.spd <= 0` → `EMPTY_RACE_COMPARE` (mirrors `EMPTY_TRACE`).

> Note (efficiency, deferred): `runComparison` runs both vacuum races every sample; we use both runners here, so nothing is wasted (unlike a single-build trace). No rebuild needed.

### 4.3 Worker plumbing (mirror the existing pattern exactly)
- `types.ts`: add `'raceCompare'` variants to the `SimRequest` / `SimResponse` discriminated unions; export `RaceCompare`, `RaceCompareRun`, `RaceActivation`, `GapPoint`.
- `engine.worker.ts`: add `case 'raceCompare': return { …, kind:'raceCompare', result: runRaceCompare(...) }`.
- `client.ts`: add `SimClient.raceCompare(uma1, uma2, race, nsamples, seed?)` following the `skillTrace` method shape.

## 5. uma2 source — pluggable seam

A discriminated `Uma2Source` so the comparison build can come from several places; ship one, leave the others as typed-but-unimplemented follow-ups:
- **`{ kind: 'savedPlan'; planId: string }` — shipped this session.** uma2 = `planToOverlayBuild(savedPlans.find(planId))`; a small plan picker on the panel, sourced from inventory `savedPlans` (active plan excluded).
- `{ kind: 'minusWishlist' }` — *follow-up.* uma2 = active build with only the unique (no wishlist) → "what the wishlist buys, and where".
- `{ kind: 'reference' }` — *follow-up.* uma2 = a separately editable build (all-1200 / meta rival).

A `resolveUma2(source, activePlan, savedPlans): SimBuild | null` function centralizes this; the panel only knows about the source it offers. uma1 is **always** the active plan.

## 6. Hook — `useRaceCompare.ts`

Mirrors `useSkillTrace`'s structure (auto-run on change, module-level **LRU memo**, request token to ignore stale results, shared `SimClient` imported from `@/sim/client` — **not** the `@/sim` barrel, to keep the engine bundle lazy):
- Auto-runs when `enabled` + both builds present. **Sig** = `course | uma1(stats+skills) | uma2(stats+skills)` so editing the wishlist *or* swapping uma2 re-runs; re-selecting a cached pair is instant.
- `runChoice` Best/Typical/Worst toggle over the 4 reps with **no re-sim** (default `median`).
- Returns `{ status, run, runChoice, setRunChoice, distance, meanBashin }`, `status: 'idle'|'running'|'done'|'na'`.
- `clearRaceCompareCache()` for tests / data-version changes.
- `SAMPLES` constant (start at the existing `TRACE_SAMPLES = 20` cadence; tune if the gap curve looks noisy).

## 7. Geometry — distance-axis helpers (`skill-trace/geometry.ts`)

Salvage the reverted prototype helpers (preserved verbatim in the velocity-HP-overlay handoff), adapted to the **track's coordinate system** `x = xOffset + (pos / distance) · RenderWidth` (so curves register with the slope/phase bands):
- `velocityHpDomain(uma1Frames, uma2Frames) → { vMax, hpMax }` — maxes across **both** runners.
- `posPoints(frames, box, distance, pick, max) → Pt[]` — per-frame `x = pos→track-x`, `y` inverted.
- `activationZonesByPos(acts, box, distance) → { x, w }[]` and a marker-position variant.
- `gapPoints(gap, box, distance, gapMax) → Pt[]` + `gapZeroY` — signed curve on a zero baseline.

The **time-axis** helpers (`vtPoints`, `domainOf`, `timePhaseBands`, `velocityWindow`, …) stay **untouched** — they still feed the skill-detail velocity-vs-**time** chart. Per the overlay handoff's explicit **"Do NOT"**: do not convert the skill-detail chart to distance. Both coordinate systems coexist.

## 8. Rendering — unified band on the track (`RaceTrackView` + new layers)

- `RaceTrackView` gains optional props `trace?: RaceCompareRun`, `distance`, `skillName(id)`, `showHp`. **When `trace` is absent the track renders exactly as today (zero regression);** existing `RaceTrackView` tests stay green.
- **Grow `RaceTrackDimensions.ViewHeight` by an overlay-band height.** The existing bands are anchored bottom-up from `xAxisY`, so the new vertical space opens at the **top** `[marginTop, SlopeVisualizationY]` with no need to edit each band's Y. The overlay band lives there. (The dimensions file already carries `// local mod` comments — precedented.)
- Three **new, non-vendored, fully-typed** layer components (our code — no `@ts-nocheck`), each colored per uma using umalator's `colors[0]` / `colors[1]` convention:
  - **`VelocityHpLayer`** — two velocity polylines (left axis) + two HP polylines (right axis, violet-tinted per uma), value labels; HP gated by `showHp` (default on).
  - **`ActivationMarkersLayer`** — per-uma activation in a lane per uma just above the slope viz; **umalator's rule** `end − start > 1` → shaded zone else labeled marker; labels resolved via `skillName(id)`.
  - **`GapLayer`** — the バ身-gap curve in its **own thin sub-band** (different units from velocity — keeps both readable), zero baseline, `+ = uma1 ahead`.
- Phase bands already line up (`PHASE_FRACTIONS` = `[1/6, 2/3, 5/6]` matches the track's phase bar) — overlay registers by construction.

## 9. Panel & page wiring

- A `RaceComparePanel` (collapsible `cmp-plan-card` grammar — `cmp-collapse-head` + caret; interactive controls `stopPropagation`) hosts: the uma2 plan picker, the Best/Typical/Worst toggle, the HP toggle, the mean-バ身 headline + status pill, and the extended `RaceTrackView` with the overlay. It lives on `CmPlannerPage` under the existing track card (uma1 is the active plan; the static track card stays as the at-a-glance course view).
- `CmPlannerPage` passes `plan`, `savedPlans`, `selection.courseId`, and `collapseSkillSignal` (honor it like the other panels).

## 10. Honesty (P3)

- Caption: **"representative vacuum run — same model as umalator's main view; gap is an estimate."**
- Best/Typical/Worst toggle exposes the spread; status pill (`running`/`done`/`n-a`); mean バ身 as the headline number.
- No fabricated precision: the gap curve is one representative run, not a distribution.

## 11. Testing (TDD)

- **Geometry** (`geometry.test.ts`): pure-fn tests for `velocityHpDomain`, `posPoints`, `activationZonesByPos`, `gapPoints`/`gapZeroY` (incl. negative gap, zero-distance guard).
- **Engine** (`run.test.ts`): `runRaceCompare` with a **mocked** `runComparison` result — assert both runners' frames mapped, all skills' activations flattened per runner, gap computed `(pos1−pos2)/2.5` at uma1 pos, distance/meanBashin populated, empty-build guard.
- **Hook** (`useRaceCompare.test.tsx`): LRU hit on identical sig, re-run on wishlist/uma2 change, stale-token ignore, `na` on empty.
- **Render** (`RaceTrackView.test.tsx`): with-trace draws both velocity lines + markers + gap; without-trace unchanged. **Must `vi.mock` the hook** if a component under test constructs `SimClient` — a real worker crashes jsdom (CLAUDE.md gotcha).
- **Wiring** (`RaceComparePanel.test.tsx`, `CmPlannerPage.test.tsx`): uma2 picker lists saved plans (excl. active), toggles work, `collapseSkillSignal` collapses.

## 12. Out of scope (this session)

- uma2 `minusWishlist` / `reference` sources (seam present; impls deferred).
- Fields >2 umas, pace-maker / position-keep / rushed / dueling overlays (the engine returns these; not drawn here).
- A dedicated single-runner sim entry / `pnpm sim:build` rebuild (not needed — two-build compare uses both runners).
- Per-frame HP-zone shading on the *vendored* slope terrain (curves overlay the new band, not the terrain).

## 13. File-change summary

| File | Change |
|---|---|
| `src/core/simBuild.ts` | + `planToOverlayBuild` |
| `src/sim/types.ts` | + `RaceCompare`/`RaceCompareRun`/`RaceActivation`/`GapPoint`; + `raceCompare` req/resp variants |
| `src/sim/run.ts` | + `runRaceCompare`; generalize `activationRegions` for all-skills |
| `src/sim/engine.worker.ts` | + `case 'raceCompare'` |
| `src/sim/client.ts` | + `raceCompare` method |
| `src/features/cm-planner/useRaceCompare.ts` | new hook (LRU, auto-run) |
| `src/features/cm-planner/resolveUma2.ts` | new — `Uma2Source` seam |
| `src/features/cm-planner/skill-trace/geometry.ts` | + distance-axis + gap helpers (time helpers untouched) |
| `src/features/planner/racetrack/vendor/types.ts` | bump `ViewHeight`, + overlay-band constants |
| `src/features/planner/racetrack/RaceTrackView.tsx` | optional `trace` props + 3 overlay layers |
| `src/features/planner/racetrack/overlay/*` | new `VelocityHpLayer` / `ActivationMarkersLayer` / `GapLayer` |
| `src/features/cm-planner/RaceComparePanel.tsx` | new panel |
| `src/features/cm-planner/CmPlannerPage.tsx` | mount the panel |
| (+ matching `*.test.tsx` / `*.test.ts`) | TDD coverage per §11 |
