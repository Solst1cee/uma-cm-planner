# 2026-06-20 — The CM race becomes a timeline reference (race-setup ← timeline SSOT)

## Context

The planner's race-setup chooser runs on a **second, hand-curated CM catalog** —
`src/features/planner/race-setup/presets.ts` (`PRESETS`, only CM15/CM16) — that
duplicates timeline data and must be maintained in parallel with
`public/data/timeline.json`. `PRESETS` is the source for the chooser dropdown, the
default race, and the per-CM conditions, referenced in ~5 places
(`RaceSetup`, `CmPlannerPage` selection-init / `newDefaultPlan` / `applyPlanTrackSetup`,
`ActivePlanContext.makeDefaultPlan`). Meanwhile the timeline — now accurate (CM10–18)
and already the SSOT for the nav badge + M3 — is **ignored by the chooser**.

This realizes the original goal (owner, 2026-06-19): *"the timeline as source of truth
when displaying many things."* The race-setup is the most prominent "many thing" still
on the old path.

**It also redesigns the `CmPlan` race shape.** Today `plan.cmRef` stores the full race
(`courseId` + geometry + conditions). That allows an **internally-inconsistent plan** —
an imported JSON tagged `CM15` whose embedded track isn't actually CM15's. The fix:
a CM race stores **only a reference** (`cmNumber`) and derives its track + conditions
from the timeline; a **custom** race stays self-contained. A `cm`-tagged plan then has
*nothing* to be inconsistent about.

**Stance change (acknowledged):** an earlier note argued `cmRef` should be a frozen
snapshot. For a *forward-looking planner* the reference model is more correct — a plan
should reflect the race it will actually run, so a corrected CM definition (e.g. the
CM15 finals fix) flows into the plan rather than going stale. Custom races lose nothing
(there is no CM to reference).

## Goals / non-goals

- **Goal:** the timeline is the single SSOT for the race chooser, the default race, and
  per-CM conditions; `PRESETS` is deleted.
- **Goal:** `cmRef` becomes a discriminated reference (`cm` | `custom`) — CM races are a
  `cmNumber` reference (derive), custom races are self-contained — making
  internally-inconsistent plans impossible and import deterministic.
- **Goal:** collapse `CmPlannerPage`'s dual race state (`selection` + `plan.cmRef`) into a
  single source (`plan.cmRef`), deriving `selection` (Approach B).
- **Non-goal:** wiring conditions into the engine (`SimRaceParams` is still `{courseId}`
  today — out of scope); a time-of-day field; M1/M2/M3 changes; the §3 sourcing toggles.

## Approach (chosen): B + cmRef reference-redesign, as one foundation

Design `cmRef` correctly first, then build the single-state UI on it — rather than
refactor the UI on the old shape and re-touch it later.

## Data model

**Timeline gains conditions.** `TimelineEntry.cm` (in `src/core/types.ts`) gains an
optional `conditions`:
```ts
cm?: { cmNumber?; courseId?; trackSummary?; conditions?: { ground: Ground; weather: Weather; season: Season } }
```
Curated in `timeline_overrides.json`; the merge already deep-merges `cm`, so no build
change. `Ground`/`Weather`/`Season` move from `presets.ts` into a shared core module
`src/core/raceConditions.ts` (so the timeline type and the UI import them from one place,
no dependency on the deleted `presets.ts`).

**`cmRef` is a discriminated union** (replaces the current flat `CmRef`):
```ts
type CmRef =
  | { kind: 'cm'; cmId: CmId; cmNumber: number }
  | { kind: 'custom'; courseId: string; surface: 'turf' | 'dirt'; distance: number;
      ground: Ground; weather: Weather; season: Season };
```
- `kind:'cm'` → track geometry (from `courseId`) **and** conditions are **derived from the
  timeline** by `cmNumber`. Nothing about the track is stored on the plan.
- `kind:'custom'` → fully self-contained (the only place a track setup is stored).
- **Editing any track/condition field of a CM race flips it to `custom`** — the storage
  rule version of today's "touch a preset field → — Custom —".

## Pure core (P6 — no React, unit-tested)

- `src/core/raceConditions.ts` — `Ground`/`Weather`/`Season` types + `defaultConditions(entry): { ground:'good'; weather:'sunny'; season }` where `season` derives from the CM date's month (P3: assumed values, editable; flaggable as assumed).
- `cmRaceOptions(entries: TimelineEntry[], catalog: CourseCatalogEntry[]): CmRaceOption[]` — the dropdown list: every CM entry **with a `courseId`**, **recent-first by date**, each `{ cmId, cmNumber, name, courseId, conditions }` (conditions = curated or `defaultConditions`). Geometry is resolved by consumers from `courseId` via the catalog, not stored here.
- `cmRefToSelection(cmRef, catalog, entries): RaceSelection` — derive the Race-setup view. `kind:'cm'` → `courseId` + conditions come from the matching timeline entry (the provider loads the timeline before the page renders), geometry (racetrack/distance/surface/direction/inOut) from `courseId` via the catalog, `presetCmId = cmId`. `kind:'custom'` → geometry from `courseId` (catalog) + stored conditions, `presetCmId` undefined. The course **catalog** loads after first render: until it arrives, a `cm` ref still shows its `courseId`/conditions and a `custom` ref shows its stored `surface`/`distance`/conditions, with the catalog-derived geometry filling in on load — so no blank/flicker.
- `selectionToCmRef(selection, options): CmRef` — inverse: if the selection exactly matches a `cmRaceOptions` entry (course + conditions) → `{kind:'cm', cmId, cmNumber}`; else `{kind:'custom', …}`.

## Persistence, migration, import/export

- **`CmPlan.cmRef`** in `src/core/types.ts` becomes the union above.
- **Dexie migration** (bump v3 → v4): each stored plan's flat `cmRef` → if it matches a
  known CM (by `cmNumber`, cross-checked on `courseId` + conditions) reduce to
  `{kind:'cm', cmId, cmNumber}`, else `{kind:'custom', …}` from its existing fields.
- **Import normalization** (the export/import path): apply the same classification to
  incoming plans. A `cm`-tagged plan **drops any embedded track and re-derives** from the
  timeline (`cmNumber` is authoritative — the inconsistency case is impossible). A plan
  whose `cmNumber` **isn't in this app's timeline** surfaces an honest warning
  ("references CM15, not in your timeline") and falls back to `custom` for re-pick (P3).
- **Export** emits the new compact shape (`cm` refs carry only `cmNumber`).

## Single-state UI (Approach B)

`CmPlannerPage`:
- **Drops the `selection` useState.** `const options = useMemo(() => cmRaceOptions(timeline ?? [], catalog), …)`; `const selection = useMemo(() => cmRefToSelection(plan.cmRef, catalog, timeline ?? []), …)`. `plan.cmRef` is the single source; `selection` is its view.
- `handleRaceChange(next) → setPlan({ ...plan, cmRef: selectionToCmRef(next, options) })`.
- **`applyPlanTrackSetup` is deleted** — loading a plan changes `plan.cmRef` → `selection`
  re-derives → Race-setup card + track diagram + both chart panels update automatically.
- **New** button → new plan keeps the current `plan.cmRef` (the race you're viewing).
- **`makeDefaultPlan(currentCm)`** (first-run / post-delete / delete-all in
  `ActivePlanContext`) → `cmRef = { kind:'cm', cmId, cmNumber }` of the current CM.
- **Auto-apply-track toggle (inventory):** ON (default) = load the plan as saved; OFF =
  load the **build onto the current race** → `setPlan({ ...loadedPlan, cmRef: currentCmRef })`.
  Save then persists the current track (no hidden divergence; Save-As keeps the original).
- Downstream (`RaceTrackView` / `UmaChartPanel` / `SkillChartPanel`) unchanged — they read
  `courseId={selection.courseId}` from the derived `selection`.

`RaceSetup`:
- The Preset dropdown maps over `cmRaceOptions` (passed in / via `gameData`) instead of the
  imported `PRESETS`; `matchPreset`/`fieldsFromPreset`/`onPreset` adapt to `CmRaceOption`.

**`PRESETS` is deleted.** Migrate its two records into `timeline_overrides.json`:
- **CM15 Cancer** (already a timeline entry): add `cm.conditions:{ ground:'good', weather:'cloudy', season:'summer' }`.
- **CM16 Leo** (currently predicted, no `courseId`): promote with `cm.courseId:'10501'` +
  `cm.conditions:{ ground:'firm', weather:'sunny', season:'summer' }` so it's a track-known
  option (date stays predicted).

## Error / edge handling

- Course catalog loads after first render → a `cm` ref shows its `courseId`/conditions
  from the (already-loaded) timeline immediately, geometry resolving when the catalog
  arrives; a `custom` ref uses its stored `surface`/`distance`/conditions. No flicker;
  the dropdown is empty until `options` populate.
- A `cmRef` whose CM isn't an option → shows "— Custom —" (today's behavior).
- Import with an unresolvable `cmNumber` → warning + `custom` fallback (above).

## Testing

- **Core:** `cmRaceOptions` (recent-first, only `courseId` entries), `cmRefToSelection`
  (both kinds, condition fallback, catalog-not-ready fallback), `selectionToCmRef`
  (matched-cm vs custom), `defaultConditions` (season-from-month).
- **Migration:** flat `cmRef` → `cm` when it matches a known CM, `custom` otherwise; a
  round-trip leaves a custom race byte-stable.
- **Import:** `cm`-tagged with a mismatched embedded track → re-derives (track dropped);
  legacy flat plan → classified; unresolvable `cmNumber` → warning + custom.
- **UI:** `RaceSetup` fed timeline-derived options (not `PRESETS`); `CmPlannerPage` flows —
  pick a CM, New (keeps track), load a plan with auto-apply on/off → Save persists the
  right track.
- **Build:** the `data:build` timeline test confirms `cm.conditions` survives the merge.
- **Gates:** `pnpm typecheck` + `pnpm test` + `pnpm build` green. Re-run a flaky UI test
  file before trusting a failure (dev-server/Vitest HMR race).

## Sequencing

This refactors the exact selection/plan + inventory code in the current **uncommitted M4
WIP** (`CmPlannerPage.test.tsx`, `PlanInventoryCard.tsx`, `cm-planner.css`). It must land
on a **clean base — after that WIP is committed** — to avoid a tangled rebase. The Dexie
v3→v4 migration rewrites stored plans, so it carries dedicated tests and is irreversible
on old data once run (export a backup before first run in dev).

## Out of scope

Wiring conditions into the engine/sim; a time-of-day field; sparse CM-condition overrides
(tweaking a CM race becomes custom instead); M1/M2/M3 changes; the §3 sourcing toggles.

## Amendment — 2026-06-20 (decision B): cm refs store geometry, derive only conditions

Implementation revealed that a pure `cmNumber`-only `cm` ref forces the entire sim/aptitude chain (~12–15 files, incl. the legacy page) to resolve race geometry. Decision (owner): make **geometry common** to both variants; derive only **conditions** for `cm`.

- `CmRefV2 = { kind:'cm'; cmId; cmNumber; courseId; surface; distance } | { kind:'custom'; courseId; surface; distance; ground; weather; season }`. `courseId`/`surface`/`distance` are **common** → consumers read them without narrowing; `simBuild`/`planToSimBuild` keep their plan-only signatures (NO `race` param); chart panels, hooks, and the legacy page are **unaffected**.
- A `cm` ref does NOT store conditions — `cmRefToSelection` derives them from the matching timeline entry (`cm.conditions` or `defaultConditions`). A `custom` ref stores conditions.
- `normalizeCmRef`: legacy flat `cmNumber>0` → `{kind:'cm', cmId, cmNumber, courseId, surface, distance}` (keep geometry, drop stored conditions); `cmNumber===0` → `custom`.
- Consistency: on **import**, a `cm` ref's geometry is re-resolved from its `cmNumber` via the app timeline + course catalog (a hand-edited "CM15 with the wrong track" is corrected). The Dexie migration of existing plans trusts their stored geometry (valid when saved).
- "Edit any field → custom" still holds: editing the track OR a condition away from the CM's flips it to `custom`.
