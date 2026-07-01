# Availability Gate — JP-ahead Umas + Uniques — Design

**Date:** 2026-07-01
**Status:** Approved (brainstorming), pending implementation plan
**Author:** Sun + Claude

## Context

Slice 2b of the availability gate (sub-project #2), following **2a — support cards** (merged, PR #26). The mechanism is proven there: a shared build-time foresight foundation projects Global release dates for JP-ahead content, records carry `server`/`releaseDate`/`releaseDatePredicted`, and `isReleasedBy(record, asOfISO)` gates surfaces by the plan's CM date.

This slice applies it to **umas**. Findings that shape it (verified 2026-07-01):

- **gametora `character-cards.json` has 170 JP-only umas, all with a JP `release` date** — clean data, like cards. `GtCharacterCard` currently under-types it (no `release`/`skills_unique`).
- **The vendored engine already carries JP unique-skill effect data** — `120011`/`110071`/`120131` (Special Week / Gold Ship / Mejiro McQueen JP outfits) are in `src/sim/vendor/*.mjs` but not in our Global `skills.json`. So `simulatableBase` will NOT drop them, and a JP uma **ranks/sims fine by its unique with no `sim:build`**.
- `buildUmas` iterates the master extract (Global umas); JP-only gametora chars aren't emitted. `UmaRecord` has `server` but **no `releaseDate`** fields.
- Umas surface in **more places** than cards: the M4 unique-skill chart (`UmaChartPanel`), the runner picker (`PlannerSidebar` search), and the parents picker (`ChosenParentsPicker`).

## Decomposition

- **2a — support cards** (merged): the pattern + shared `scripts/lib/foresight-build.ts`.
- **2b — umas + their uniques** ← *this spec*.
- 2c — skills (the general JP-ahead skill catalog).
- #3 UI polish, #4 rebalances.

## Goal

Emit the ~170 JP-only umas as `server:'jp'` `UmaRecord`s with foresight-projected Global dates **and their unique-skill records** (`server:'jp'` skills so the chart displays them; the engine already sims them), then gate **both** uma surfaces — `UmaChartPanel` and the `PlannerSidebar` runner search — by the plan's CM date + a `show upcoming` toggle.

## Scope

**In:** `UmaRecord` release-date fields; `buildJpUmas` + the JP-unique-skill emitter + `GtCharacterCard` extension + `build-all` wiring; the two gates (`UmaChartPanel` + `PlannerSidebar`); safe-exclude of JP umas from other `umas` consumers.

**Out (follow-ups / later slices):** 2c's general JP-ahead skill catalog (this slice emits only the JP umas' *uniques*); gating the parents picker with a CM-date toggle (it safe-excludes JP here); the `#3` badge/readout polish.

## Non-goals

- No `sim:build` / engine change — the engine already has the JP unique effect data.
- No new date/foresight math — reuse 2a's `foresight-build.ts` (`buildForesightCalibration`, `projectReleaseDate`).
- No general JP-ahead skills beyond the umas' uniques (that's 2c).

## Components

### 1. `UmaRecord` fields (`src/core/types.ts`)
Add `releaseDate?: string` + `releaseDatePredicted?: boolean` (mirroring `SupportCardRecord`/`SkillRecord`).

### 2. `buildJpUmas` (`scripts/build-umas.ts`)
For each gametora char whose `card_id` is **not** in the master extract → a `server:'jp'` `UmaRecord`:
- `umaId` = `String(card_id)`, `charaId` = `String(char_id)` (or `floor(umaId/100)` per the convention).
- `{ releaseDate, releaseDatePredicted } = projectReleaseDate(gt.release, gt.release_en, cal)`.
- `nameEn` = gametora `name_en` (fan/house-style; official EN absent for JP-only).
- `epithet` = `stripTitleBrackets(gt.title_en_gl ?? gt.title)` (fan-TL `title` for JP-only — honest P3 preview).
- `statGrowth` / `baseAptitudes` from gametora `stat_bonus` / `aptitude` (same mapping `buildUmas` already uses).
- `uniqueSkillId` = `String(gt.skills_unique[0])` (for the chart to load + the engine to sim).
- `server:'jp'`, `dataVersion`.

Extend `GtCharacterCard` with the fields read (`release?`, `title?` already there, `skills_unique?: number[]`, `name_en?` already there).

### 3. JP unique-skill emitter (`scripts/build-skills.ts` or a sibling helper)
Emit each JP uma's unique as a `server:'jp'` `SkillRecord` (rarity `unique`), metadata (nameEn, conditions, baseSpCost 0, iconId) from gametora's skill catalog, dated identically to its uma via `projectReleaseDate`. Deduplicate (one record per unique id). **Purpose: display** in the chart's `SkillDetailDisclosure`; the engine supplies the sim effect.

### 4. Build wiring (`scripts/build-all.ts`)
Reuse the calibration computed for the cards slice (jp-schedule ∩ `timeline_overrides` confirmed CMs); pass `cal` to `buildJpUmas` and the JP-unique emitter; concat into `umas` / `skills`. Update `outputs.test.ts` counts.

### 5. Two gates
- **`UmaChartPanel`**: filter its candidate uma list by `it.server === 'global' || (showUpcoming && isReleasedBy(it, asOfISO))`; add a `show upcoming` checkbox + a `~date` predicted badge; `asOfISO` from the plan's CM date (the `cmEntry` pattern from `SkillChartPanel`). Its `Select` commits an upcoming uma to the plan.
- **`PlannerSidebar` runner search**: same gate on the searchable uma list + a `show upcoming` toggle.

### 6. Safe-exclude
Any *other* consumer of `useGameData().umas` (parents picker, deck, etc.) filters to `server === 'global'` so JP umas surface **only** in the two gated surfaces.

## Key decisions

- **(A) Uniques ride with the uma** — each JP uma's unique is emitted as a `server:'jp'` skill dated identically. The engine sims it (data present); the record is for display.
- **(B) Residual limit** — a brand-new JP uma whose unique postdates the engine pin isn't engine-known → `simulatableBase` drops it → that uma ranks *without* its unique (degraded, not broken). Rare; flagged; the common uniques were verified present.
- **(C) Name/epithet fallback** — JP umas have no official EN title → gametora fan-TL `title`/`name_en` (honest preview, P3).

## Data flow

```
gametora character-cards (257) ──────────────┐
timeline_overrides (confirmed CMs), jp-schedule┘→ buildForesightCalibration → cal
   buildJpUmas:  chars NOT in master → UmaRecord{server:jp, releaseDate, uniqueSkillId, aptitudes…}
   JP-unique emitter: each uniqueSkillId → SkillRecord{server:jp, rarity:unique, releaseDate}
   → public/data/umas.json (87 + ~170)   public/data/skills.json (587 + ~170 uniques)
   → UmaChartPanel + PlannerSidebar: isReleasedBy(uma, planCmDate) + showUpcoming toggle + ~date badge
   → other umas consumers: server==='global' (safe-exclude)
```

## Testing

- **`buildJpUmas`**: a JP uma (Special Week outfit `100103`) → `server:'jp'`, projected `releaseDate` + `releaseDatePredicted`, `uniqueSkillId:'120011'`, aptitudes/growth mapped; a Global uma (in master) is skipped.
- **JP-unique emitter**: `120011` emitted once as `server:'jp'` rarity `unique`, dated.
- **`UmaChartPanel` gate**: a JP uma hidden by default; shown when `show upcoming` on AND released by the CM date; `~date` badge; `Select` still writes `umaId`.
- **`PlannerSidebar` gate**: JP uma absent from the runner search by default; shown when toggled + released.
- **`outputs.test.ts`**: uma count (87 → ~257) + skill count (587 → +unique JP), all JP umas `server:'jp'` + dated + predicted.
- **Safe-exclude**: JP umas absent from the parents-picker uma list.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Other uma consumers leak JP umas ungated | audit + `server==='global'` filter; whole-branch review hunts them (caught the cards sourcing leak) |
| JP unique metadata missing from gametora skill catalog | plan verifies the JP uniques resolve in gametora skills; a missing one → emit a minimal record (id + name) so display doesn't blank |
| Newest JP uma's unique not in the engine (decision B) | `simulatableBase` drops it → ranks without unique; flagged, degrades gracefully |
| Count churn (umas + skills) | update `outputs.test.ts`; asserted counts fail the build on drift |
| JP uma names are fan-TL/Japanese | honest P3 preview (decision C), only behind `show upcoming` |

## Open items for the plan

1. Confirm the JP uniques (`skills_unique` ids) resolve in gametora's skill catalog (`gametora/skills.json`) for name/conditions; define the minimal-record fallback for any that don't.
2. Confirm the `UmaChartPanel` candidate-list build site + how `Select` writes the plan (to place the gate + keep Select working for JP umas).
3. Confirm the `PlannerSidebar` runner-search list build site for the second gate.
4. Enumerate other `useGameData().umas` consumers to safe-exclude (parents picker at minimum).
