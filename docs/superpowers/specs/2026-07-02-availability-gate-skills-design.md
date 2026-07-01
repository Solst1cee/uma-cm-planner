# Availability Gate — JP-ahead Skills — Design

**Date:** 2026-07-02
**Status:** Approved (brainstorming), pending implementation plan
**Author:** Sun + Claude

## Context

Slice **2c** of the availability gate (sub-project #2), following **2a — support cards** (merged, PR #26) and **2b — umas** (merged, PR #27). The mechanism is proven: a shared build-time foresight foundation (`scripts/lib/foresight-build.ts`) projects Global release dates for JP-ahead content, records carry `server`/`releaseDate`/`releaseDatePredicted`, and `isReleasedBy(record, asOfISO)` gates surfaces by the plan's CM date.

This slice applies it to **skills** — the "existing gate lights up" case. Findings that shaped the design (verified 2026-07-02):

- **The skill gate already exists but is starved of data.** `SkillChartPanel` and `AccelChartPanel` already carry the full gate — `showUpcoming` state, an `isReleasedBy(s, asOfISO)` filter on `s.server === 'jp'`, and a `show upcoming` checkbox — but there are **0 `server:'jp'` skill records** today, so it never fires.
- **Skills have no intrinsic Global release date.** Unlike cards/umas (which carry a `release` field), a gametora skill record has **no date**. A skill becomes available on Global when the **card or uma that grants it** releases — sources we now date via 2a/2b.
- **The skill→source join is already in the data.** Each gametora skill carries its own reverse-source fields: `sup_hint`/`sup_e` (support-card ids) and `char`/`char_e` (uma outfit ids). Of **1,323** gametora skills absent from the Global master, **1,174** have at least one such source (149 undatable → dropped). Sample: skill `203441` (gold) ← card `30275`, umas `100301`/`113301` — ids that join directly to our card/uma records.
- **The engine bundle already carries JP skill effect data** (full JP+Global catalog), so a JP skill sims correctly with **no `sim:build`**. Its *displayed* fields (name/rarity/conditions) come from gametora; its *sim effect* comes from the bundle keyed by id.
- The wishlist **`SkillPicker`** (`src/features/skill-planner/SkillPicker.tsx`) currently hard-filters `s.server === 'global'` (a P4 guard). That is the one surface that gains a **new** gate this slice.

## Decomposition

- 2a — support cards (merged): the pattern + shared `foresight-build.ts`.
- 2b — umas (merged): `UmaRecord` dates + gated uma surfaces.
- **2c — skills** ← *this spec*.
- #3 UI polish (badges/readout), #4 rebalances follow.

## Goal

Emit the source-backed JP-ahead skills as `server:'jp'` `SkillRecord`s with a Global `releaseDate` **derived as the earliest date among the card/uma sources that grant them**, so the two skill charts light up and the wishlist picker can offer upcoming skills — both behind a `show upcoming` toggle gated by the plan's CM date.

## Scope

**In:** a pure `resolveJpSkillDate` date-derivation helper; `buildJpSkills` (+ `build-all` wiring + `outputs.test.ts` count); confirming the two charts light up (+ a `~date` badge if absent); the new `SkillPicker` gate; a safe-exclude audit of all other skill consumers.

**Out (follow-ups / later):** un-dropping JP-ahead skill ids on JP *cards'* skill-lists (the join uses the skill's own reverse fields, so this isn't needed here); extending upcoming skills into the **M2 SP optimizer** (safe-excluded here); the `#3` badge/readout polish; any `sim:build`/engine change.

## Non-goals

- No `sim:build` — the engine already has the JP skill effect data.
- No new date/foresight math — reuse 2a's `projectReleaseDate` semantics; the only new logic is the **min-over-sources** reduction.
- No change to the 587 Global skill records.

## Decisions (locked in brainstorming)

- **(A) Dates derived from sources.** A JP skill's Global date = the **minimum** Global date across its source cards (`sup_hint`/`sup_e`) and source umas (`char`/`char_e`). This makes the CM-date gate genuinely meaningful — a skill shows only once a real source is out. `releaseDatePredicted:true` iff the earliest source is predicted.
- **(B) Emit all source-backed JP skills** (white/gold from cards **and** uniques/innate from umas), full records, so every skill-chart rarity tab lights up for JP content too — mirroring how Global skills populate all tabs. (Uniques additionally show via 2b's uma chart, which loads from the bundle; the two don't conflict — different mechanism.)
- **(C) Surfaces = the two charts + the wishlist picker.** The charts already gate (feed data + badge). The wishlist `SkillPicker` gets a new toggle. Everything else safe-excludes JP skills.
- **(D) Approach 1 — skill-record self-sourced dates.** Use the skill's own `sup_*`/`char_*` fields against card/uma date maps; no changes to card skill-lists.
- **(E) Undatable skills are dropped.** A JP skill with no source, or whose every source is itself undated, gets no `releaseDate` → it is **not emitted** (can't honestly date or place it).

## Amendment (2026-07-02, during planning)

Planning verified the source data and settled the details the brainstorm couldn't see:

- **Emission set = all 1,174 source-backed JP skills** (decision B, confirmed) — including the **596 "evolution skills"** (9-digit uma-specific variants, gametora `rarity:6`, no `cost`). These are a JP-only skill-evolution mechanic; being newer than the engine pin they may drop out of sims (`simulatableBase`) and rank `na` in the charts — **accepted** as honest preview clutter (they still list + date correctly). `skills.json`: **587 → ~1,761**.
- **gametora `rarity` → `SkillRarity` map** (derived empirically from skills present in both master and gametora): `1 → white`, `2 → gold`, `3 | 4 | 5 | 6 → unique`. (No non-evolution skill has `rarity:6`; the 596 evolution variants map to `unique`.)
- **`baseSpCost`** = gametora `cost` when present, else `0` (uniques + evolution skills are `0`, matching the `SkillRecord` "0 for uniques" contract).
- **Record fields come from gametora** (no master entry): `nameEn` = `loc.en.name ?? name_en ?? enname ?? jpname`; `nameJp` = `jpname`; `iconId` = `String(iconid)`; `conditions` = `serializeConditions(loc.en.condition_groups ?? condition_groups)`; `server:'jp'`, `releaseDate`, `releaseDatePredicted`, `dataVersion`.
- **Date maps built from `jpCards` + `jpUmas` only** (the dated preview records). A JP skill sourced solely by already-Global cards/umas resolves to no dated source → dropped (decision E); such records are anomalies (a Global source implies the skill should already be in the master cutover).
- **`SkillPicker` gate = an optional `asOfISO?: string` prop** (backward-compatible): when provided, the picker opt-ins released JP skills behind an internal `show upcoming` toggle; when absent, it stays Global-only (current behaviour). Only the **wishlist** callers pass it (`PlannerSidebar`, `PlanHeaderPanel`, `InheritancePage`); the parents `SearchPicker` does not.
- **Safe-exclude targets found:** `InheritanceCard.tsx:48` filters white skills with **no** `server` guard (would leak JP white skills into green-spark options) → add `s.server === 'global'`; the **M2 SP optimizer** candidate-skill pool needs an audit. (`ParentForm.tsx:342` already filters `server === 'global'` ✓.)

## Components

### 1. `resolveJpSkillDate` (pure — `scripts/lib/jpSkillDate.ts`)
```ts
export interface DateEntry { date: string; predicted: boolean }
/**
 * Earliest Global availability of a JP skill = min date across its source
 * cards (sup_hint/sup_e) and umas (char/char_e). Returns undefined when the
 * skill has no source, or no source resolves to a dated entry (decision E).
 */
export function resolveJpSkillDate(
  skill: GtSkill,
  cardDates: ReadonlyMap<string, DateEntry>,
  umaDates: ReadonlyMap<string, DateEntry>,
): { releaseDate?: string; predicted: boolean };
```
- Flattens `sup_hint`+`sup_e` → card ids, `char`+`char_e` → uma ids (both may be nested arrays — see `GtSkill`); looks each up in the maps; takes the entry with the **minimum ISO date**; `predicted` = that entry's flag. No dated source → `{ predicted: false }` (undefined date).

### 2. `buildJpSkills` (`scripts/build-skills.ts`)
Mirrors `buildJpCards`/`buildJpUmas`. For each gametora skill whose id is **not** in the Global master and that `resolveJpSkillDate` dates → a `server:'jp'` `SkillRecord` built from **gametora-only** fields (the JP-card path already proves gametora-only record construction): rarity (gametora `rarity` → white/gold/unique/inherited-unique), `nameEn` (`loc.en` / `name_en` / `jpname` fallback), conditions (gametora `condition_groups`), type, `iconId`, `baseSpCost` where derivable. `server:'jp'`, `releaseDate`, `releaseDatePredicted`, `dataVersion`. Log the count emitted + projected-vs-announced split.

### 3. Build wiring (`scripts/build-all.ts`)
Skills are currently built **before** cards/umas. Restructure so JP-skill emission runs **after** both: build the Global skills as today, build cards + umas, then assemble `cardDates` / `umaDates` (a `global` record → its release date or "today"/released sentinel; a `jp` record → its projected date + predicted flag), call `buildJpSkills`, concat + sort into `skills`, write. Reuse the `cal` already computed for the cards slice. Update `outputs.test.ts` skill count only.

### 4. Charts — confirm + badge
`SkillChartPanel` + `AccelChartPanel` already filter `s.server === 'jp' && isReleasedBy(s, asOfISO)` behind `showUpcoming`. Confirm they light up with the new data; add a small `~{releaseDate}` predicted badge to the JP rows if not already present.

### 5. Wishlist `SkillPicker` gate (new)
`SkillPicker` (`src/features/skill-planner/SkillPicker.tsx`) currently filters `s.server === 'global'`. Change to opt-in released JP skills: accept an `asOfISO` prop (the plan's CM date, derived by the caller via the `cmEntry` idiom) + a `show upcoming` toggle; show a `server:'jp'` skill only when the toggle is on **and** `isReleasedBy(s, asOfISO)`; render a `~{releaseDate}` badge. The wishlist page passes the plan's CM date. **P4:** because a picked JP skill is release-gated to the plan's CM at pick-time and the engine bundle carries its effect, the sim is honest for a future-CM plan; a JP skill can't be added to a plan whose CM predates its release.

### 6. Safe-exclude audit
Every **other** skill lister (M2 SP optimizer, M4 sourcing index, any selection/ranking list of `useGameData().skills`) filters to `server === 'global'` so JP skills surface **only** in the three gated surfaces. Mirrors 2b's Task 4; the whole-branch review hunts leaks.

## Data flow

```
gametora/skills.json (1823) → not in Global master (1323) → datable source (≤1174)
  cardDates{cardId→{date,predicted}}  +  umaDates{umaId→{date,predicted}}   (from built cards/umas)
  → resolveJpSkillDate = min(sources) → buildJpSkills → SkillRecord{server:'jp', releaseDate, releaseDatePredicted}
  → public/data/skills.json  (587 global + N jp)
  → SkillChartPanel + AccelChartPanel (existing gate) + SkillPicker (new gate): behind toggle + ~date badge
  → all other skill consumers: server === 'global' (safe-exclude)
```

## Testing

- **`resolveJpSkillDate`:** min-of-sources across a card + a uma; predicted propagates from the earliest source; a skill with a card source only vs a uma source only; no source / no dated source → undefined.
- **`buildJpSkills`:** a JP skill sourced from a JP card → `server:'jp'` + projected date + `releaseDatePredicted`; sourced from a released (announced) source → `releaseDatePredicted:false`; a sourceless skill → not emitted; a Global-master skill → skipped; rarity/name/conditions mapped from gametora.
- **`SkillPicker` gate:** a JP skill hidden by default; shown when `show upcoming` on **and** released by the CM date; the `~date` badge renders; a Global skill always shows.
- **Charts:** a JP skill appears in the chart candidates only when toggled + released (may already be covered by existing chart tests — extend if not).
- **`outputs.test.ts`:** skill count 587 → new total; all JP skills `server:'jp'` + dated; Global count unchanged.
- **Safe-exclude:** JP skills absent from the M2 optimizer / any non-gated skill list.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| `sup_e`/`char` are GT# order numbers, not internal ids | Sample joins cleanly (`30275`, `100301`); the plan verifies the id space against our card/uma ids before relying on it. `sce_e` (GT#) is NOT used. |
| A JP skill's only source is itself undated | Dropped (decision E) — no `releaseDate`, not emitted; can't honestly place it. |
| gametora-only `SkillRecord` missing fields (no master entry) | The JP-*card* path already builds records from gametora alone; reuse that field-mapping shape; sim effect comes from the bundle, not the record. |
| P4 leak via a JP skill entering a Global calc ungated | Only 3 surfaces opt in (all CM-date gated); every other consumer filtered to `global`; whole-branch review hunts leaks (caught the 2a sourcing leak). |
| Count/test churn (~1k new records) | `outputs.test.ts` count is asserted → drift fails the build. |
| Build-order restructure (skills after cards/umas) | Localized to `build-all.ts`; the Global skills still build first, only the JP pass moves. |

## Open items for the plan

1. Confirm `sup_hint`/`sup_e`/`char`/`char_e` id spaces are internal (joinable to our `cardId`/`umaId`), including nested-array flattening.
2. Confirm the exact gametora-only field mapping `buildJpSkills` reuses (from the JP-card path / `buildSkills` gametora branch) so a record validates without a master entry.
3. Enumerate the safe-exclude targets (M2 optimizer, sourcing index, any other `useGameData().skills` selection list).
4. Decide the `~date` badge placement in the charts + `SkillPicker` (visual detail).
5. Confirm the `SkillPicker` caller(s) can supply the plan's CM date (`asOfISO`) without prop-drilling churn.
