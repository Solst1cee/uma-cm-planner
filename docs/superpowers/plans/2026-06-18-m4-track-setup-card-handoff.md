# M4 Track Setup Card Handoff (2026-06-18)

This note is intentionally separate from the M4 sidebar handoff. It covers the right-column race setup card, the track card title/condition labels, and the plan-name auto-generation behavior that depends on the active race selection.

## Scope

Touched areas:

- `src/features/cm-planner/CmPlannerPage.tsx`
- `src/features/cm-planner/PlannerSidebar.tsx`
- `src/features/planner/race-setup/RaceSetup.tsx`
- `src/features/planner/race-setup/selection.ts`
- `src/sim/courseCatalog.ts`
- `src/sim/vendor/umalator.bundle.d.mts`
- related tests under `src/features/cm-planner/`, `src/features/planner/race-setup/`, and `src/sim/`

## Accepted Behavior

When the user selects a CM preset, the plan name can still use the preset identity, for example `CM15`.

When the user changes the race setup so it no longer exactly matches a preset, the setup becomes custom and the auto-generated plan name must use the current course label instead of stale preset metadata.

Example:

- Start at `CM15`.
- Change to a custom track/course that no longer matches the CM15 preset.
- Turn on the sidebar's `Auto` name switch.
- The generated name should use a course label like `Hanshin 2,200m (Inner)`, not `CM15`.

The custom selection also resets `plan.cmRef.cmId/cmNumber` to `CM0/0` so saved plan metadata does not pretend the current custom race is still CM15.

## Distance And Layout Labels

The race setup distance dropdown and the track condition chips should match uma-tools / umalator style by showing course layout, not aptitude distance class.

Accepted example:

- Show `2,200m (Inner)`.
- Do not show `2,200m (Medium)` in the race setup distance label or track condition chips.

Implementation details:

- `coursesService.getAllEntries()` exposes raw course metadata including `course`.
- `course` is now carried through `CourseCatalogEntry`.
- Layout mapping follows uma-tools `RaceTrack.tsx`:
  - `1` = no layout suffix
  - `2` = `Inner`
  - `3` = `Outer`
  - `4` = `Outer-Inner`
- `formatDistanceWithLayout()` and `formatCourseLabel()` live in `src/features/planner/race-setup/selection.ts`.
- `describeSelection()` now includes the layout inside the distance chip, so the separate `Inner` chip is no longer needed.

## Card Boundary

Keep this work separate from the left sidebar:

- The race setup card lives in `src/features/planner/race-setup/`.
- The track card title and condition chips are assembled in `CmPlannerPage`.
- The sidebar only receives an optional `raceNameLabel` so its `Auto` name switch can include the current custom course label.

The M4 sidebar handoff remains the place for pink spark rows, Uma search/epithet behavior, sidebar scrolling/cropping, wishlist clear icon, portrait size, and Uma icon generation.

## Verification

Last known green commands:

```sh
pnpm.cmd vitest run src/features/planner/race-setup/RaceSetup.test.tsx src/features/planner/race-setup/selection.test.ts src/features/planner/race-setup/trackCatalog.test.ts src/sim/courseCatalog.test.ts src/features/cm-planner/PlannerSidebar.test.tsx src/features/cm-planner/CmPlannerPage.test.tsx
pnpm.cmd typecheck
```

The local dev server was responding at:

```txt
http://127.0.0.1:5177/
```
