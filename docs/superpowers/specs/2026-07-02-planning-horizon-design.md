# App-wide Planning Horizon — Design

**Date:** 2026-07-02
**Status:** Approved (brainstorming), pending implementation plan
**Author:** Sun + Claude

## Context

Availability sub-project **#3**, following the merged content slices — **2a** support cards (#26), **2b** umas (#27), **2c** skills (#28). The app now carries the full JP-ahead catalog (`server:'jp'` records with foresight-projected Global dates) behind six independent binary `show upcoming` toggles, plus seven hard `server === 'global'` safe-excludes. The gate mechanics work, but the *model* is fragmented: each surface derives its own `asOfISO` from the plan's CM, toggles don't agree with each other, "future" content (releasing after the CM) is invisible everywhere, and the foresight math (pace/gap) that powers the projected dates is invisible to the user.

Verified state (2026-07-02):

- **13 availability-sensitive sites across 8 files**: 6 gated surfaces (`SkillChartPanel`, `AccelChartPanel`, `SkillPicker`, `PlannerSidebar` runner search, `UmaChartPanel`, `SupportCardPoolCard`/`poolModel`) and 7 hard-excluded sites (`SourcingSection` card-hint index; `InheritanceCard` white options :50 / unique options :58 / `charaToUma` :69; `ParentForm` uma list :326 / white sparks :342 / inherited-unique sparks :356).
- `ActivePlanProvider` wraps the entire app (`App.tsx:98`) — one context can serve every module.
- The foresight `Calibration` (`pace` ≈ 1.33, `gapDays` ≈ 1441, 6-CM window) is computed at **build time** (`build-all.ts` / `cmSynthesis`) but **not baked into any `public/data` file** — the UI cannot show it.
- The timeline carries **4 future CMs** (16 Leo ~2026-07-30 → 19 Scorpio ~2026-10-30, `tier:'prediction'`) — enough to feed a CM-cutoff dropdown.
- `buildJpSkills` (2c) never emits `inherited_unique` (gt rarity 3–6 → `unique`), so the skill charts' inherited tab has no JP content. Gametora nests each inherited unique under its parent unique's `gene_version` — the same structure `buildSkills` already reads for Global inherited uniques.
- `ThemeToggle` (`src/app/ThemeToggle.tsx`) is the codebase's 3-way segmented-control precedent; `autoSave` in `ActivePlanContext` is the persisted-shared-setting precedent.

## Goal

Replace the fragmented per-surface toggles with **one app-wide, persisted `PlanningHorizon`** — *"every module thinks as-of that date"* — plus the legibility layer around it: tier chips (upcoming/future), an announced-vs-projected badge tooltip, the gap-pace foresight readout, a loud hypothetical-mode banner, and JP inherited-unique emission so the inherited tab lights up.

## Decisions (locked in brainstorming)

- **(A) Three-tier horizon, CM-selectable middle:**
  ```ts
  type PlanningHorizon =
    | { kind: 'current' }                 // Global today (default)
    | { kind: 'cm'; cmNumber: number }    // up to a CHOSEN CM's date (dropdown, next ~4 CMs)
    | { kind: 'allJp' };                  // the full JP catalog (hypothetical lens)
  ```
  The middle tier is a **dropdown** over the timeline's future CMs (title + `~date`, `~` marking predicted), defaulting to the plan's own CM (fallback: the next CM). A "specific date" cutoff is a **deferred extension** — the model already reduces every tier to a cutoff ISO, so a date picker slots in later without schema change.
- **(B) App-wide, shared, persisted.** One horizon in `ActivePlanContext` (localStorage, `autoSave` pattern; default `current`). Every module reads it — M4 planner, M1 inheritance/parents, M2 (transitively via wishlist), sourcing. No per-surface toggles remain.
- **(C) Visibility = calc-inclusion.** Whatever the horizon reveals is selectable AND counts in every calculation (sim, skill-rank, SP). At `allJp` this deliberately includes content not obtainable by the plan's CM — a **hypothetical** mode flagged by one loud app-level banner ("Hypothetical — includes content not achievable by this CM; for scouting"), not a silent leak. P4's "never silently mixed" is honored by the banner + tier chips, not by exclusion.
- **(D) `current` is behavior-preserving.** At the default horizon every site's predicate degenerates to exactly `server === 'global'` — byte-identical to today's behavior. The rewire cannot regress the normal path.
- **(E) JP inherited-uniques ship in this slice** (from gametora `gene_version`, dated from the parent unique's uma sources) — the inherited rarity tab lights up at `cm`/`allJp` horizons.
- **(F) Foresight readout = tooltip on the horizon control**, powered by a new baked `public/data/foresight.json` — not a persistent layout element.

## Components

### 1. Core: tiers + horizon predicate (`src/core/availability.ts`)

```ts
export type AvailabilityTier = 'now' | 'upcoming' | 'future';
export type PlanningHorizon =
  | { kind: 'current' }
  | { kind: 'cm'; cmNumber: number }
  | { kind: 'allJp' };

/** Which tier a record falls in relative to a cutoff date. */
export function availabilityTier(
  record: { server: Server; releaseDate?: string },
  cutoffISO: string,          // the chosen CM's date (or today for 'current')
  todayISO: string,
): AvailabilityTier;
// 'now'      = server 'global' (or dated ≤ today)
// 'upcoming' = JP-ahead with releaseDate ≤ cutoffISO
// 'future'   = JP-ahead with releaseDate > cutoffISO (or undated JP)

/** Which tiers a horizon reveals. */
export function visibleAtHorizon(tier: AvailabilityTier, horizon: PlanningHorizon): boolean;
// current → now · cm → now+upcoming · allJp → all three
```
Pure, unit-tested truth-table. `isReleasedBy` stays (used internally); the surfaces stop calling it directly.

### 2. Shared state + hook (`ActivePlanContext` + `useAvailability`)

- `ActivePlanContext` gains `horizon` / `setHorizon`, persisted to localStorage (default `{kind:'current'}`), validated on load (an unknown/stale `cmNumber` falls back to `current`).
- A `useAvailability()` hook packages the derived values every surface needs:
  ```ts
  { horizon, setHorizon, cutoffISO, todayISO,
    tierOf(record): AvailabilityTier,
    visible(record): boolean }          // visibleAtHorizon(tierOf(record), horizon)
  ```
  `cutoffISO`: today (`current`) · the chosen CM's `dates.start ?? finals` from the timeline (`cm`) · effectively ∞ (`allJp`, cutoff = the plan's CM date for *tier labeling* — future = "after your CM" even in allJp).

### 3. Horizon control (app header) + foresight readout + banner

- A `Current | [CM ▾] | All JP` segmented control (ThemeToggle pattern) in the app header next to the nav — it's an app-wide lens, not planner-local. The CM segment opens the future-CM dropdown.
- A `?`/hover **foresight tooltip** on the control: *"Upcoming = JP-ahead content projected to Global. JP is ~{gapDays} days (~{years} yrs) ahead; dates estimated at {pace}× release pace from the last {windowSteps} shared CMs. `~` = projected, not announced."* — real numbers from `foresight.json`.
- When `allJp` is active: a persistent app-level **warning banner** under the header: *"Hypothetical horizon — includes JP content not achievable by {plan's CM}; results are for scouting, not this CM."* Plus a distinct accent on the control itself.

### 4. Baked calibration (`public/data/foresight.json`)

`build-all.ts` writes the already-computed `cal` as `{ pace, gapDays, windowSteps, anchorJp, anchorGlobal, dataVersion }` (null-safe: file written with `cal: null` marker if calibration is impossible). `gameData` loads it lazily (optional field, `?? null`); the tooltip and any future readout consume it.

### 5. Rewire all 13 sites to `useAvailability()`

| Site | Today | After |
|---|---|---|
| SkillChartPanel / AccelChartPanel | local `showUpcoming` + own `asOfISO`; reps + view filter | `visible(s)` for candidate reps; view filter drops; tier chip per row |
| SkillPicker | `asOfISO?` prop + local toggle | drops both; `visible(s)`; tier chip in rows (prop removed from callers) |
| PlannerSidebar runner search | local toggle + own `asOfISO` | `visible(u)`; tier chip in result rows |
| UmaChartPanel | local toggle + own `asOfISO` | `visible(u)`; tier chip |
| SupportCardPoolCard / poolModel | `showUpcoming` + `asOfISO` params | `filterPool` takes `(tierOf, horizon)`-shaped inputs (stays pure); pool tiles get tier chips |
| SourcingSection card-hint index | hard `server==='global'` | `visible(c)` — upcoming cards become listable sources at `cm`/`allJp` |
| InheritanceCard white/unique options | hard `server==='global'` | `visible(s)` |
| InheritanceCard `charaToUma` | hard `server==='global'` | `visible(u)` (portrait resolution follows the lens) |
| ParentForm uma list / white / inherited-unique options | hard `server==='global'` | `visible(u)` / `visible(s)` |

All six local `showUpcoming` states, the `SkillPicker.asOfISO` prop, and the per-surface `cmEntry`/`asOfISO` derivations are **deleted** — `useAvailability()` is the single source. (Presentational/pure units — `poolModel`, any helper — take the predicate/values as inputs and stay provider-free, matching the M1 pattern.)

### 6. Tier chips + badge tooltip

- A small shared `TierChip` (e.g. `upcoming` amber / `future` violet; `now` renders nothing) used by every surface's JP rows/tiles.
- The existing `~date` badge gains a `title` tooltip: projected → *"Projected Global date (JP {jpDate?} × foresight pace) — not announced"*; announced → *"Announced Global release"*.

### 7. JP inherited-unique emission (`scripts/build-skills.ts`)

`buildJpSkills` additionally emits, for each emitted JP **unique** whose gametora entry carries `gene_version`, an `inherited_unique` record: `skillId = String(gene_version.id)`, conditions from `loc.en.gene_version.condition_groups ?? gene_version.condition_groups`, name/date/server inherited from the parent unique's record, `baseSpCost: 0`. Counts: `outputs.test.ts` updates (still id-unique — the uniqueness test from 2c guards collisions).

## Data flow

```
build:  cal → public/data/foresight.json          buildJpSkills → + inherited_unique records
app:    ActivePlanContext.horizon (persisted) ── useAvailability() ──►  visible()/tierOf()
             ▲ header control (Current | CM ▾ | All JP · foresight tooltip · allJp banner)
             └─ timeline future CMs feed the dropdown; cutoffISO = chosen CM date
        13 sites × visible(record)  →  selection + calcs as-of the horizon
        tier chips + ~date tooltips  →  legibility on every JP row/tile
```

## Testing

- **Core truth-table:** `availabilityTier` × `visibleAtHorizon` over {global, jp≤cutoff, jp>cutoff, jp-undated} × {current, cm, allJp}.
- **Context:** horizon persists/restores; stale `cmNumber` falls back to `current`.
- **Behavior-preservation:** for each rewired surface, a `current`-horizon test asserting today's exact behavior (JP absent) — the regression net for decision D.
- **Reveal tests:** `cm` horizon reveals upcoming (not future); `allJp` reveals future + the banner renders; tier chips render per tier.
- **Sourcing:** upcoming card appears as a hint source only at `cm`+.
- **foresight.json:** shape + null-safety; tooltip renders the numbers.
- **Inherited-unique:** a JP unique with `gene_version` emits the 9xxxxx record, dated like its parent; id-uniqueness test still green; the inherited rarity tab shows JP rows at `cm`/`allJp`.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Rewiring 13 sites regresses the default path | Decision D: `current` ≡ `server==='global'` — a per-surface behavior-preservation test each |
| allJp calc results mistaken for achievable builds | The loud app-level banner + control accent + tier chips (decision C); results honesty per P3 |
| `charaToUma`/portraits change under the lens unexpectedly | At `current` identical to today; horizon-driven change is the *intended* semantics |
| Six deleted toggles break existing tests | Each surface's tests updated in its own task; `SkillPicker.asOfISO` prop removal is a breaking internal API change — all callers in-repo |
| Stale persisted `cmNumber` (CM passed) | Validation on load → fallback `current` |
| `gene_version` inherited emission collides with an existing id | 2c's `skills.json` id-uniqueness test fails the build on any collision |
| Header layout crowding | The control is compact (3 segments); the banner is a separate strip only in allJp |

## Out of scope (deferred)

- "Specific date" cutoff option (model-ready; UI later).
- M3 timeline visual changes (it is date-native already).
- M2 optimizer UI changes (its candidates flow from the wishlist, which is horizon-gated upstream).
- Rebalance patches (sub-project #4).

## Open items for the plan

1. Exact header placement/markup of the control + banner in `App.tsx` (nav row vs a sub-row).
2. The precise `poolModel.filterPool` signature change (keep it pure/provider-free).
3. Whether `SupportCardPoolCard`'s existing `show upcoming` checkbox UI is removed or becomes a read-only reflection of the horizon (recommend: removed).
4. `TierChip` styling tokens (reuse `--warn*` / design-system chips).
5. Confirm gametora `gene_version` coverage among the 561 emitted JP uniques (how many inherited records to expect) — run-to-read during Task F.
