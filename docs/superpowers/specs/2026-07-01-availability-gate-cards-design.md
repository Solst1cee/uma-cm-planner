# Availability Gate — JP-ahead Support Cards — Design

**Date:** 2026-07-01
**Status:** Approved (brainstorming), pending implementation plan
**Author:** Sun + Claude

## Context

The availability *mechanism* already exists but is **dormant**:

- `isReleasedBy(record, asOfISO)` ([`src/core/availability.ts`](../../../src/core/availability.ts)) — dated records gate on `releaseDate <= asOf`; undated fall back to `server` (`'global'` = now, `'jp'` = preview).
- `SupportCardRecord` / skill records carry `server`, `releaseDate?`, `releaseDatePredicted?`.
- `SkillChartPanel` + `AccelChartPanel` already gate JP-ahead skills by a `show upcoming` toggle + `asOfISO` derived from the plan's CM date (`cmEntry.dates.start ?? finals ?? today`).

But there is **zero JP-ahead data**: 0 `server:'jp'` records in skills/cards/umas; the curated override files (`upcoming_cards.json`, `skill_additions.json`) are empty; the just-merged **foresight** engine is not connected to populate any `releaseDate`. The build actively **drops** JP-ahead content (P4: `build-cards: dropped N JP-ahead skill id(s)`).

So sub-project #2 is "feed and widen the gate," and the chosen source is **Choice B — the full JP catalog** (bake JP content as `server:'jp'` with foresight-projected dates). This spec is the **first content-type slice: support cards** (cleanest JP-date data; the core build-planning content).

## Decomposition

- **Sub-project #1 — Foresight core** (merged): JP→Global date projection.
- **Sub-project #2 — Availability gate (Choice B).** Content-type slices sharing one build-time foresight foundation:
  - **2a — Support cards** ← *this spec*.
  - 2b — Umas (needs `releaseDate` fields + a gated uma surface).
  - 2c — Skills (existing gate lights up; JP skill-date coverage is patchy).
- Sub-projects #3 (UI: badges/toggle polish, plan-ahead readout) and #4 (rebalances) follow.

## Goal

Reverse the "drop JP content" policy **for support cards**: the build emits the ~321 JP-only gametora cards as `server:'jp'` records with a **foresight-projected** Global `releaseDate`, and the M1 support-card pool gates them by the plan's CM date (with a `show upcoming` toggle). Establish the reusable **build-time foresight foundation** for the later slices.

## Scope

**In:** `scripts/lib/foresight-build.ts` (build-time `Calibration` + `projectReleaseDate`), JP-card emission in `scripts/build-cards.ts`, and the gate + `show upcoming` toggle in `SupportCardPoolCard.tsx`.

**Out (later slices / follow-ups):** umas, skills, the JP cards' unreleased skills (see Decisions), other card consumers (M4 sourcing, deck import), the plan-ahead readout UI, rebalances.

## Non-goals

- No change to the ~222 Global cards or their `perLevel`.
- No new prediction math — reuse the merged `calibratePace` / `projectGlobalDate`.
- No JP-ahead *skills* this slice (JP cards show their released-subset skill list).

## Components

### 1. `scripts/lib/foresight-build.ts` (shared foundation)

Assembles the shared-CM window at build time and reuses the core foresight math:

```ts
import { calibratePace, projectGlobalDate, type Calibration, type SharedCm } from '@/core/foresight';

/** A confirmed Global CM date, keyed by CM number (from timeline_overrides). */
export interface ConfirmedCm { cmNumber: number; global: string }

/** Build SharedCm[] by matching jp-schedule CMs to confirmed Global CM dates by cmNumber. */
export function buildForesightCalibration(jpCms: JpCmDate[], confirmed: ConfirmedCm[]): Calibration | null;

/**
 * Resolve a Global release date for a JP record.
 * - announcedGlobal present ⇒ { releaseDate: announcedGlobal, predicted: false }
 * - else ⇒ { releaseDate: projectGlobalDate(jpDate, cal), predicted: true }
 * - cal null / no jpDate ⇒ { releaseDate: undefined, predicted: false } (record stays server-gated)
 */
export function projectReleaseDate(
  jpDate: string | undefined,
  announcedGlobal: string | undefined,
  cal: Calibration | null,
): { releaseDate?: string; predicted: boolean };
```

- **Shared-CM join (by `cmNumber`, verified 2026-07-01):** the confirmed Global CM dates live in `data-overrides/timeline_overrides.json` (CM entries with `cm.cmNumber` + `dates.finals` + `server:'global'` + `status:'confirmed'`), **not** `cm_presets.json` (which holds only the 5 old class-named CMs — CLASSIC/SPRINT/…, no zodiac cups). `ConfirmedCm[]` = those entries filtered to `status:'confirmed'` (this naturally drops CM16's stale unconfirmed date). `SharedCm = { cmNumber, jp: jpCms.jpDate, global: confirmed.global }`; `calibratePace` sorts + takes the last 6.
- `build-all.ts` already reads `timeline_overrides.json`, so it computes the `Calibration` once up front and passes it to `build-cards.ts` (also available later to unify with `cmSynthesis`).
- `calibratePace`'s existing `< 2 shared CMs ⇒ null` fallback carries through (`projectReleaseDate` then yields undefined `releaseDate`).

### 2. `scripts/build-cards.ts` — emit JP-only cards

After the Global cards are built, iterate gametora cards whose `support_id` is **not** in the Global master set, and emit a `SupportCardRecord` per card:

- `server: 'jp'`.
- `{ releaseDate, releaseDatePredicted } = projectReleaseDate(gt.release, gt.release_en, cal)` (announced Global date `release_en` wins; else project from JP `release`).
- `rarity`/`type`/`nameEn`/`charName` from gametora.
- `perLevel`: map gametora's `effects` matrix → `CardPerLevel[]` via the existing `buildPerLevel` lerp helper (extract the hint-frequency / hint-levels / specialty-priority rows by effect-type code — the same codes `extract-card-additions.ts` uses).
- `skills`: from gametora `event_skills` + `hints`, **dropping any skill id not in the Global release cutover** (same P4 rule as today — Decision A).
- `dataVersion`: the current `DATA_VERSION`.

Log the count of JP cards emitted + how many were date-projected vs announced.

### 3. `SupportCardPoolCard.tsx` — gate + toggle

Mirror the `SkillChartPanel` pattern:
- `asOfISO` = the plan's CM date (`cmEntry.dates.start ?? finals ?? today`).
- A `show upcoming` checkbox (default off).
- Filter the pool: a `server:'jp'` card is shown only when `showUpcoming` is on **and** `isReleasedBy(card, asOfISO)`. Global cards always show.
- A predicted card (`releaseDatePredicted`) renders a small `~<date>` badge (P3 honesty).

## Data flow

```
jp-schedule.json (JP CM dates) ───────────────┐
timeline_overrides.json (confirmed Global CMs) ┘→ buildForesightCalibration → Calibration
gametora/support-cards.json (539)
   → for each NOT in Global master set (~321):
        projectReleaseDate(gt.release, gt.release_en, cal)
        emit SupportCardRecord{server:'jp', releaseDate, releaseDatePredicted, perLevel←effects, skills←released-subset}
   → public/data/support_cards.json  (222 global + ~321 jp)
   → SupportCardPoolCard: isReleasedBy(card, planCmDate) + showUpcoming toggle + ~date badge
```

## Decisions

- **(A) JP cards' unreleased skills are dropped this slice.** A JP card shows its released-subset skill list; the full list arrives with slice 2c (skills). Rationale: keeps the slice bounded; the availability gate's job (does the card exist by the CM) is served without the skill catalog change.
- **(B) `perLevel` for JP cards comes from gametora `effects`** (Global cards keep their master-derived `perLevel`). New mapping, validated against shared cards (see Testing).

## Testing

- **perLevel self-validation (correctness anchor):** for a card present in *both* master and gametora, the gametora-`effects`→`perLevel` mapping equals the master-derived `perLevel`. If they agree on a shared card, the JP-only mapping is trustworthy.
- **foresight-build:** `buildForesightCalibration` over the CM10–15 fixture yields the same `Calibration` the core `foresight` test pins (pace ≈ 1.327); `projectReleaseDate` returns `predicted:false` + the announced date when `release_en` is set, and `predicted:true` + a projected date otherwise; `cal===null` ⇒ undefined `releaseDate`.
- **build-cards:** emits the JP-only cards as `server:'jp'` with a `releaseDate`; total count 222 → ~543; a spot-checked JP card (e.g. `30067` "The Throne's Assemblage", JP `2022-07-20`) has a plausible projected Global date + `releaseDatePredicted:true`.
- **`SupportCardPoolCard`:** a JP card is hidden when `planCmDate < releaseDate` with the toggle off; shown when the toggle is on and `isReleasedBy` passes; the `~date` badge renders for predicted cards. (Test stubs `useGameData` with a JP card, per existing pool tests.)
- **`scripts/outputs.test.ts`:** update the support-card count assertion to the new total.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| gametora `effects` → `perLevel` format mismatch | shared-card self-validation test blocks a wrong mapping |
| JP cards show partial skill lists (dropped JP-ahead skills) | accepted + flagged (Decision A); completed by slice 2c |
| P4 calc leak via a JP card entering a sim for an earlier CM | gating the *selection pool* prevents selection ⇒ can't enter calc; other card consumers audited as a follow-up |
| Far-future projected dates inaccurate | `releaseDatePredicted` badge (P3); confirmed `release_en` always wins |
| Count/test churn from ~321 new records | update `outputs.test.ts`; the count is asserted, so drift fails the build |
| Calibration assembled twice (here + cmSynthesis) | acceptable — both reuse `calibratePace`; unifying the two SharedCm builders is a noted follow-up |

## Open items for the plan

1. Confirm the gametora `effects` effect-type codes for hint-frequency / hint-levels / specialty-priority match `extract-card-additions.ts`'s constants (`EFFECT_HINT_FREQUENCY` etc.) so `buildPerLevel` can be reused directly.
2. ~~cm_presets join~~ **RESOLVED 2026-07-01:** confirmed Global CM dates come from `timeline_overrides.json` matched by `cmNumber` (cm_presets lacks the zodiac CMs). Filter to `status:'confirmed'`.
3. Decide the exact predicted-badge placement in `SupportCardPoolCard` (visual detail).
