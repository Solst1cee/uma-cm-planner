# M4 full-race uma1-vs-uma2 compare — future-session handoff (2026-06-20)

**Status:** NOT started — explicitly deferred this session. This note scopes it so a cold session can pick it up. It is the **other** umalator view (the per-skill "skill-detail graphs" are done; see [2026-06-20-m4-skill-detail-graphs-handoff.md](2026-06-20-m4-skill-detail-graphs-handoff.md)).

## Goal (umalator's main view)

Compare **two full builds head-to-head over the whole race** — each with their complete stats **and all wishlist/owned skills active** — and show, across the entire course, **where uma1 pulls ahead and where it slows down**, with each skill's activation position marked. This is umalator-global's primary output (velocity + バ身-gap over distance), as the user described: *"see you get ahead at this area and will slow down there."*

This is distinct from the shipped per-skill charts (which isolate ONE skill via build-vs-build+skill). Here both runners keep their full skill sets; the comparison is uma1 vs uma2, not skill-on vs skill-off.

## What it should render

- **Velocity vs distance** (x = course position, NOT time) for both umas — two lines, so you see who's faster where.
- **バ身 gap vs distance** — `(pos_uma1 − pos_uma2) / 2.5` over the race; positive = uma1 ahead. This is the "ahead here / behind there" curve.
- **Skill activation markers** — where each runner's skills fire (from the per-frame `skillActivations`), so spikes/dips line up with skills.
- Reuse the shipped chart furniture: 4 phase bands + labels, 1L/500m-style grid, theme colors, square corners (`skill-trace/geometry.ts` + `skill-trace.css` + `SkillTraceCharts.tsx`).

## Engine path — already exists

`runComparison` (vendored bundle, wrapped by `runVacuumCompare` in `src/sim/run.ts`) runs uma1 vs uma2 over N samples and returns `runData.{minrun,maxrun,meanrun,medianrun}` — each a full `SimulationRun` with **both runners'** per-frame `time/position/velocity/hp` and `skillActivations` (indexed `[uma1, uma2]`). That's everything this view needs; `runVacuumCompare` currently discards `runData` (it only keeps bashin stats).

**Plan:** add a `runRaceCompare(uma1, uma2, race, nsamples, seed)` wrapper that returns a typed trace like `runSkillTrace` does — map the representative run's `position`/`velocity` arrays for both runners + the gap curve + activation markers. Then a worker kind + `SimClient` method + a `useRaceCompare` hook (mirror `useSkillTrace`, incl. the LRU memo), and a panel component on `CmPlannerPage`.

## Open decisions (resolve with the user before building)

1. **What is uma2?** Options offered, none chosen:
   - your build **minus** the wishlist skills (shows what all your skills together buy you, and where),
   - a **rival/reference** build (e.g. all-1200 `REFERENCE_STATS`, or a meta opponent you configure),
   - **two fully-editable** umas (closest to umalator).
   Likely a small selector; uma1 defaults to the current `CmPlan` build (`planToSimBuild`).
2. **Where it lives** — a new collapsible panel on `CmPlannerPage` (like `UmaChartPanel`), NOT inside `SkillDetailDisclosure`. Probably its own `RaceComparePanel` + `useRaceCompare`.
3. **Representative run vs distribution** — start with one representative run (median by gap) for the curves, like the velocity chart; the bashin distribution is already available if a histogram is wanted.
4. **x-axis is distance, not time** — the shipped velocity chart is vs *time*; here use position directly (both runners share the course distance), so the gap and phase bands align on distance. `domainOf`/`vtPoints` assume time — add position-based variants or reuse `gridLinesX` + a position-mapped point builder.

## Reuse checklist

- Geometry: `gridLinesX/Y`, `distancePhaseBands` (4 phases), `binColumns`/`polyline`, `lAxisDomain`, theme CSS — all reusable.
- Infra: worker/client request-kind pattern (`src/sim/{types,engine.worker,client}.ts`), the run-on-demand + LRU-memo hook pattern (`useSkillTrace.ts`), `clearSkillTraceCache`-style reset.
- Honesty (P3): label as a single representative run; gap is an estimate.

## Not in scope

Multi-uma fields (>2), pace-maker/position-keep visualization, or the per-frame HP/zone overlay on the §0 racetrack (that's a separate deferred item — pipe the trace into `RaceTrackView`).
