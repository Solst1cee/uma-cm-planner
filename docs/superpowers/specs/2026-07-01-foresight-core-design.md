# Foresight Core — Design

**Date:** 2026-07-01
**Status:** Approved (brainstorming), pending implementation plan
**Author:** Sun + Claude

## Context

The app bakes a **pinned, Global-server snapshot** of game data. Global runs
~1.5 years behind JP, so content (cards, umas, skills, CMs) that JP already has
is absent until Global catches up. Planning a Champions Meeting is inherently
forward-looking: a CM happens on a future date, and by then more content will be
available. To reason about "what will the game be at this CM's date," we need
**predicted Global release dates** for JP-ahead content.

We already have the *bones* of a predictor but they are effectively unused:

- `predictGlobalDate(jpISO, pace, anchorJp, anchorGlobal)` in
  [`src/core/timeline.ts`](../../../src/core/timeline.ts) does the interval-compression math, but
  `predictGlobalDateDefault` hardcodes it to a **fixed pace 1.422 anchored at
  launch** (JP 2021-02-24 → Global 2025-06-26), and nothing calls it in the
  actual pipeline.
- The timeline's predicted CMs come from
  [`src/core/cmSynthesis.ts`](../../../src/core/cmSynthesis.ts), which uses a **naive fixed cadence**
  (`addMonths(anchor.finals, +1 month per CM)`) — not a JP-pace projection.
- We store **no JP dates** at all (CM entries carry only Global `dates`;
  `cm_tracks.json` has no dates).

GameTora ships a "Foresight Timeline" that does this well, using a **rolling
recent pace** (last 6 shared CMs → ~1.33×, adapting as the gap closes) rather
than a fixed launch-era average. This spec builds our own equivalent.

## Decomposition (this spec = sub-project #1 of 4)

The full temporal-availability feature is several subsystems; each gets its own
spec → plan → build:

1. **Foresight Core** ← *this spec*. JP→Global date prediction (rolling pace +
   projector), wired into the timeline's CM prediction.
2. **Availability gate** — `available(item, cmDate)` + release-date fields on
   records + "resolve the dataset as-of the plan's CM date." Consumes #1.
3. **UI surfacing** — "show upcoming" toggle, confirmed/predicted badges, the
   plan-ahead window, a GameTora-style gap/pace readout.
4. **Rebalance handling** — curated `skill_rebalances.json` (display) +
   engine-patch date-gate (calc). Separate axis.

## Goal

A JP→Global date-prediction ("foresight") core that **calibrates a rolling pace
from shared Champions Meetings** and **projects upcoming JP content (CMs,
banners, scenarios)** onto the Global timeline — replacing the timeline's naive
"+1 month" CM prediction with pace-based dates.

## Scope (deliverable boundary)

**In:** the uma.guide schedule importer, `jp-schedule.json`, `src/core/foresight.ts`
(calibrator + projector), and **wiring into `cmSynthesis`** so predicted CM dates
become pace-based.

**Out (later slices):** the availability gate, the "show upcoming" UI, the
GameTora-style readout panel, rebalance handling, and applying foresight to
per-card/uma/skill release dates. The core exposes the calibration numbers
(gap/pace) as return values; *displaying* them is slice #3.

## Non-goals

- No new UI surface in this slice.
- No change to the *confirmed* Global timeline (announced CMs keep their real
  dates; foresight only fills the *predicted* gaps).
- No per-item (card/skill) prediction yet — only CMs are projected + wired.
- Banner/scenario JP dates are **imported into `jp-schedule.json`** this slice,
  but **not projected or consumed** — `projectGlobalDate` is generic and supports
  them, but wiring a banner/scenario consumer is a later slice. This slice only
  collects their JP dates so the data is ready.

## Components

### 1. `data-overrides/jp-schedule.json` (hand-curated)

A small hand-maintained override file (sibling to `timeline_overrides.json`),
**seeded once** by cross-checking Moomoolator's public
`docs/jp-champions-meetings.json` / `jp-*-releases.json` + public trackers, then
hand-edited when JP announces new content. **No importer / no live fetch** —
uma.guide's `/cm-schedule` page was verified (2026-07-01) to carry *no dates*,
only track logistics. Shape:

```jsonc
{
  "cms":       [{ "cmNumber": 10, "cupName": "Aquarius Cup", "jpDate": "2022-02-15" }],
  "banners":   [{ "name": "...", "jpDate": "YYYY-MM-DD", "kind": "support" | "uma" }],
  "scenarios": [{ "name": "UAF", "jpDate": "YYYY-MM-DD" }]
}
```

`jpDate` = JP-server date (finals for CMs; release/start for banners/scenarios).
Read by `build-all.ts` / `rebuild-timeline.ts` like the other `data-overrides/`
files. JP dates are public facts (dates aren't copyrightable); Moomoolator /
GameTora are **cross-check references only**, not vendored. The stable shape lets
`foresight.ts` + tests be built against a fixture independent of the data.

### 2. `src/core/foresight.ts` (pure, P6 — unit-tested)

```ts
export interface SharedCm { cmNumber: number; jp: string; global: string; } // both real dates
export interface Calibration {
  pace: number;        // JP days per Global day over the window (>1 = Global compresses JP)
  gapDays: number;     // global[last] - jp[last]: how far behind JP the last shared CM is
  anchorJp: string;    // jp date of the most recent shared CM
  anchorGlobal: string;// global date of the most recent shared CM
  windowSteps: number; // CM-to-CM steps actually used (window-1, capped by availability)
}

/**
 * Rolling calibration over the last `window` (default 6) shared CMs.
 * pace = (jp[last] - jp[first]) / (global[last] - global[first])  over the window
 *       = totalJaSpan / totalServerSpan  (== GameTora's "avg JA gap / avg server gap").
 * Requires >= 2 shared CMs; fewer -> returns null (caller falls back).
 */
export function calibratePace(shared: SharedCm[], window?: number): Calibration | null;

/**
 * Project a JP date to Global by compressing the interval from the anchor.
 * global = anchorGlobal + (jpISO - anchorJp) / pace.
 * Thin wrapper over the existing predictGlobalDate() with rolling anchors.
 */
export function projectGlobalDate(jpISO: string, cal: Calibration): string;
```

`projectGlobalDate` **reuses** `predictGlobalDate(jpISO, cal.pace, cal.anchorJp,
cal.anchorGlobal)` — no new date math. The only new logic is `calibratePace`.

### 3. Wiring: `cmSynthesis.synthesizeUpcomingCms`

Replace the naive `addMonths(anchor.finals, (n - anchor.num) * monthsPerCm)` with
a foresight projection:

- Build the `SharedCm[]` from CMs that have **both** a JP date
  (`jp-schedule.json`) and a real Global date (the merged timeline).
- `cal = calibratePace(shared)`.
- For each upcoming CM `n` with a known JP date, `dates.finals =
  projectGlobalDate(jpDate(n), cal)`.
- **Fallback:** if `cal` is null (< 2 shared CMs) or a CM has no JP date, keep the
  existing `addMonths` cadence so the timeline never regresses.

`synthesizeUpcomingCms` gains an optional `jpSchedule` input (the CM rows);
`build-all.ts` / `rebuild-timeline.ts` read `jp-schedule.json` and pass it
through, mirroring how `cm_tracks.json` is already read.

## Algorithm (matches GameTora, so we can validate against it)

- **Shared CMs** = CMs present on both servers with real dates (JP from
  `jp-schedule.json`, Global from the confirmed timeline).
- Over the last **N = 6** shared CMs (⇒ 5 steps):
  - `pace = (jp[last] − jp[first]) / (global[last] − global[first])`
  - `gapDays = global[last] − jp[last]`
- **Project** a future JP date `D`: `global[last] + (D − jp[last]) / pace`.

This is the generalization of our `predictGlobalDate`: from *launch-anchored +
fixed 1.422* to *latest-shared-CM-anchored + rolling pace*.

## Confirmed vs predicted

If a CM already has a **real announced Global date** in the timeline
(`timeline_overrides.json` / official news), that wins — foresight only fills
CMs with **no** confirmed Global date. Predicted entries keep `tier:'prediction'`
(as `cmSynthesis` already stamps). Confirmed CMs are never overwritten.

## Data flow

```
data-overrides/jp-schedule.json (hand-curated JP dates)
                                   │
timeline (confirmed Global dates) ─┤
                                   ▼
                        calibratePace(shared) ──> Calibration {pace, gapDays, anchors}
                                   │
        upcoming JP CM dates ──────┴──> projectGlobalDate ──> cmSynthesis
                                                                   │
                                                                   ▼
                                                    timeline.json (pace-based predicted CMs)
```

## Testing

- **Self-validation (the anchor test):** `calibratePace` on the CM10→CM15 sample
  (Aquarius→Cancer) reproduces GameTora's published numbers:
  - per-step gaps/paces: (32d/24d=1.33×), (31/24=1.29×), (32/21=1.52×),
    (21/21=1.0×), (30/20=1.5×)
  - `pace ≈ 1.33` (avg JA gap 29.2 / avg server gap 22)
  - `gapDays ≈ 1441` (Cancer Cup: Global 2026-06-24 − JP date)
  (JP dates for CM10–15 come from the `jp-schedule` fixture; Global dates from the
  existing timeline fixture in `timeline.test.ts`.)
- `projectGlobalDate` round-trip: projecting a shared CM's JP date lands within a
  small tolerance of its real Global date.
- `synthesizeUpcomingCms` emits **pace-based** dates (assert the predicted CM16
  finals ≠ `addMonths(CM15, +1)` given a pace ≠ the implied monthly cadence).
- **Fallback guard:** `calibratePace([single])` → null; `synthesizeUpcomingCms`
  with no `jpSchedule` reproduces today's `addMonths` output exactly (no
  regression).
- Importer: parse a saved uma.guide fixture → expected `jp-schedule.json` rows
  (parser unit-tested separately from the live fetch, per `parse-uma-guide.ts`
  precedent).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| ~~uma.guide may not expose JP dates~~ **RESOLVED 2026-07-01** — it doesn't | Sourcing pivoted to a hand-curated `data-overrides/jp-schedule.json` seeded from Moomoolator's public dates. |
| JP date accuracy (hand-curated) | Cross-check each seeded date against ≥2 references (Moomoolator + a public tracker); the self-validation test catches gross errors (pace/gap would diverge from GameTora's ~1.33×/1441d). |
| Banner/scenario JP data coverage/quality | Out of the wired path this slice (CMs only wired); dates are collected but not consumed. |
| Pace instability with few shared CMs | `calibratePace` returns null < 2 shared CMs → `cmSynthesis` keeps the `addMonths` fallback. |
| Prediction presented as fact (P3) | Predicted CMs stay `tier:'prediction'`; confirmed Global dates always win. |

## Resolved decisions

1. ~~Verify uma.guide date coverage~~ — **done 2026-07-01**: uma.guide has no
   dates → hand-curated `data-overrides/jp-schedule.json`, seeded from Moomoolator.
2. **Location:** `data-overrides/jp-schedule.json` (hand-curated), read by the
   build like the other override files.
3. **Self-validation JP dates:** compile the JP dates for CM10–15 (Aquarius→Cancer)
   from Moomoolator's `jp-champions-meetings.json` during the seed task; hard-code
   them in the `calibratePace` test alongside the existing Global fixture dates.
