# 2026-06-16 — M4 rebuild, Part 1: §0 race-track diagram (on a fresh page)

> **STATUS: COMPLETE** (all 6 tasks). New page mounted at `/` (`src/features/cm-planner/CmPlannerPage`); old `skill-acq` page kept at `/legacy`, unedited. 441 tests green, typecheck + build clean. Geometry resolver code-splits to a 0.33 kB chunk; the ~3.87 MB main chunk is **pre-existing** (legacy + sp-optimizer pull the engine via the `@/sim` barrel) — my work added +6.7 kB, not the engine.

## Context

We are building Module 4 toward the locked visual mockup
`.superpowers/brainstorm/1698-1781377711/content/m4-current.html` (the visual SSOT,
alongside `docs/superpowers/specs/2026-06-14-m4-skill-acquisition-design.md`), **part by
part**. The user chose the **§0 always-on race-track diagram** as the first part.

Two direction decisions from the user (2026-06-16):

1. **Build a fresh new main page** that the full app grows from. The existing
   `src/features/skill-acq/SkillAcquisitionPage` is **reference-only — do not edit it.**
2. The §0 section gets a **VFalator-style race-setup bar** (PRESET · TRACK · TIME OF DAY ·
   GROUND · WEATHER · SEASON, with full customization; selecting a preset snaps the track to
   match). **For now CM15 is the only preset and the default** — full preset list +
   customization come later.

Test case: **CM15 Cancer Cup = course `10906` (Hanshin turf 2200m)**.

## Decisions

- **Course geometry:** reuse the engine — `coursesService.getSimCourse` via
  `resolveCourse` (`src/sim/adapter.ts`) at runtime, behind a **lazy dynamic import** so the
  5.3 MB bundle doesn't bloat the main chunk. No new `public/data/` file this slice.
- **Activation zones (Route 3, hybrid):** render real geometry now; band **START** parsed
  from a small set of positional `conditions` tokens; band **width** is an APPROXIMATE fixed
  default (`DEFAULT_BAND_WIDTH_M = 200`) with an `approximate: true` flag + a P3 caveat in the
  UI. The full engine region-algebra is NOT re-implemented; `skillConditionToBand` is the seam
  a later part upgrades (duration → real width, or engine-sourced regions).

## Tasks

1. **[DONE]** `src/core/track.ts` pure core + `track.test.ts` (18 tests, TDD). Types
   `CourseGeometry`/`TrackSegment`/`ActivationBand`; `pctOf`, `trackSegments` (corner geometry
   → ordered straight/corner segments), `activationAnchor` (6 positional tokens →
   start metres | null), `skillConditionToBand`, `activationBands` (unique always + wishlist,
   deduped). Verified against real course-10906 geometry.
2. `src/sim/courseGeometry.ts` — widen `CourseData` (type-only; runtime already returns
   `turn`/`corners`/`straights`/`slopes`) + `courseGeometryFor(courseId) → CourseGeometry`;
   re-export from `src/sim/index.ts`; lazy-import in callers.
3. `src/features/<newpage>/useSelectedSkill.ts` — feature-local `SelectedSkillProvider` +
   `useSelectedSkill()` context. Transient UI state, **not** persisted to the plan.
4. `TrackDiagramPanel.tsx` (+ test, CSS) — resolve geometry by `courseId` (guard
   unknown/empty), render the mockup DOM (`.track`/`.tseg`/`.act`(+`hot`)/`.fin`/`.axis`/
   `.tracklegend`), direction from `turn`, P3 approximate-width caveat, band click →
   `setSelectedSkillId`. Port the mockup's track classes into CSS using project token vars.
5. **NEW main page** (route TBD) + VFalator-style race-setup bar (CM15 preset only) + mount
   `TrackDiagramPanel` + wire shared selection. Old page untouched.
6. Verify: `pnpm typecheck` + `pnpm test` + `pnpm build` (inspect main-chunk size delta; if
   bloated, fall back to a worker `getCourse` or a build-time `public/data/courses.json`).

## Verification

- `pnpm typecheck` clean; `pnpm test` green (18 new track tests + full suite, no regressions);
  `pnpm build` green with acceptable chunk size.
- Manual: load the new page → CM15 selected by default → track renders Hanshin-2200m
  segments + every wishlist/unique activation band → selecting a skill highlights its band.

## Deferred to later parts

Accurate band widths (needs skill duration data), effect badges, the full CM preset list +
track customization controls, and an engine re-vendor for exact activation regions.
