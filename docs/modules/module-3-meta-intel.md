# Module 3 — Meta Intel Workspace

> Brief module doc. Expand into a detailed living doc (like [M4's](module-4-skill-acquisition.md)) when phase-2 work starts.

- **Route:** `/meta-intel`
- **Status:** **Timeline (core + importers + UI + synthesis + range) shipped 2026-06-15.** Phase-2 (three-up) remains.
- **Spec:** [docs/superpowers/specs/2026-06-14-m3-meta-intel-design.md](../superpowers/specs/2026-06-14-m3-meta-intel-design.md) + [2026-06-15-m3-synthesis-range-design.md](../superpowers/specs/2026-06-15-m3-synthesis-range-design.md).
- **Plans:** [m3-timeline-core](../superpowers/plans/2026-06-15-m3-timeline-core.md) · [m3-importers](../superpowers/plans/2026-06-15-m3-importers.md) · [m3-timeline-ui](../superpowers/plans/2026-06-15-m3-timeline-ui.md) · [m3-synthesis-range](../superpowers/plans/2026-06-15-m3-synthesis-range.md).

## Purpose

A browsable, tiered (official / datamined / prediction) timeline of CMs, banners, and patches — built at build time, hand-confirmable via overrides. Feeds M4 §0 the current/upcoming CM context.

## Shipped

- **[src/core/timeline.ts](../../src/core/timeline.ts)** — `effectiveDate` / `mergeTimeline` / `projectCmSchedule` / `predictGlobalDate` (JP→Global pace **1.422**, anchors JP `2021-02-24` / Global `2025-06-26`) / `addMonths` + `newsMatch.ts` + `slug.ts`.
- **[src/core/cmSynthesis.ts](../../src/core/cmSynthesis.ts)** — `synthesizeUpcomingCms` auto-fills predicted upcoming CMs (cup+track from `cm_tracks.json`, monthly cadence from the latest **confirmed** CM; window **slides forward**; no `courseId` so excluded from M4). **CM15 Cancer Cup** seeded; **CM16–18 synthesized**.
- **Build-time importers** — `scripts/build-timeline.ts` + official-news/uma.guide parsers (`pnpm timeline:import`); `pnpm timeline:rebuild` regenerates timeline-only. Output `public/data/timeline.json` ⊕ `data-overrides/timeline_overrides.json` (P5).
- **[src/features/meta-intel/](../../src/features/meta-intel/)** — three swimlanes (CM/Banners/Patches), now-marker, ✓/◆/~ tier badges, lane + confirmed-only filters, **Upcoming / ±1yr / All** range selector, detail panel feeding M4 §0. Read-only browse — confirmation is a hand-edit of the overrides (a static app can't write files).

## Next (phase-2)

- **Three-up** — JP/TW prior vs Global observed vs sim. Its own spec; engine-in-UI dependent.

## Gotchas

- Synthesis horizon **slides forward** (anchor = highest cmNumber *with* finals; predict anchor+1..anchor+horizon, skip present) — a base-pinned window wrongly shrinks predictions to zero as CMs are confirmed.
- Predicted CMs have **no `courseId`** → correctly excluded from M4's schedule.
