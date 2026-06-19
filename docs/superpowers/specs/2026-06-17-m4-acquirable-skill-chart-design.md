# M4 Acquirable-Skill Chart — Design

**Date:** 2026-06-17
**Module:** M4 Skill Acquisition Planner (`/` CmPlannerPage rebuild)
**Status:** Implemented (2026-06-17, on `main`) + **polished 2026-06-19 (UNCOMMITTED on `main`'s working tree)**. The design below is as-built for the original slice; see the **Addendum (2026-06-19)** at the bottom for what changed/extended since (filter redesign, proc-aware status, run UX, force-activation investigation).

## Goal

Bring the engine-ranked **acquirable-skill chart** into the new `/` planner page as a
collapsible `cmp-plan-card`, ranking every acquirable skill by its marginal length
advantage (**L**) on the user's plan build, with **SP cost** and **efficiency (L per
100 SP)** columns. It is the natural step *after* the Unique-skill chart (pick uma →
rank skills to buy), and it reuses the card grammar, run-on-demand pattern, effect-chips,
and `SkillDetailDisclosure` skill-plate established by the Unique-skill chart.

The original engine skill chart stays at `/legacy` (untouched).

## Decisions (locked with the user)

1. **Runner model — the user's actual plan build (plan-dependent).** Ranks each skill's
   L on the current runner (sidebar stats + running style via `planToSimBuild`), i.e.
   "which skills help *my* build most." Matches `/legacy` `SkillChartPanel` and VFalator,
   and fits the "skills come after uma + strategy" workflow. NOT the fixed all-1200
   reference the Unique-skill chart uses (that chart is the plan-independent *first* step;
   this one is build-specific).
2. **Columns — L + SP cost + efficiency (L per 100 SP), sortable by each.** The L
   distribution (min / max / median, n) lives in the per-row detail disclosure, not as
   columns. Efficiency is the key purchase-decision number and bridges into M2's SP
   optimizer.
3. **Run-on-demand.** Nothing simulates until the Run button (explicit user requirement,
   mirrors the Unique-skill chart). A stale badge prompts a re-run when the build/course
   changes; no recompute until pressed.
4. **Running style — the plan's style.** No per-row Style dropdown (that was a
   Unique-skill-chart need, where one uma is best-of-4-styles on a fixed reference). Here
   the plan has a single chosen style, baked into the sim build.
5. **`/legacy` stays.** The old page remains the fallback; this is additive.
6. **Catalog — white + gold + inherited-unique, NOT native uniques.** Already what
   `acquirableSkills` returns (`CHART_RARITIES`); native `unique` skills belong to the
   Unique-skill chart. Inherited-unique versions appear here, as expected.
7. **Variants — one row per family.** Skills with `variantSkillIds` (white/gold/○/◎ tiers,
   inherited-unique counterparts — "alternate versions that apply the same behavior")
   collapse to a single row showing the strongest variant (`skillVariantRank`) and its L,
   with a variant dropdown to pick which one to target (same pattern as the wishlist line).
   Reuses `src/features/skill-planner/skillFamilies.ts`.
8. **`+ target` carries L into the wishlist.** On add, set `projectedL` (= the row's mean
   L) + `projectedLStale: false` so the sidebar's existing `individual L = Σ projectedL`
   total works (today it reads 0 because the add path omits `projectedL`). Add via
   `addOrReplaceWishlistSkill` (family dedup), then patch `projectedL` onto the resulting
   item — the helper's `resetProjectedSkill` clears it, so the patch must come after.
9. **Effect-chips stay on-expand.** Reuse `SkillDetailDisclosure` unchanged: the detailed
   effect badges + conditions + activation routes render when a row is expanded (already
   how the sidebar works). NOT inline-always-visible (the spec's earlier preview was
   misleading).
10. **Always-visible skill-type tag — OUT OF SCOPE (handed off).** The compact
    Speed/Accel/Recovery category pill is a separate cross-cutting plate task (needs a
    baked `category` field); see
    [2026-06-17-skill-plate-type-tag-handoff.md](2026-06-17-skill-plate-type-tag-handoff.md).
    This chart ships with the skill icon (game type-coded) + on-expand chips.

## Architecture

`CmPlannerPage` already owns `plan` (+ `setPlan`) and `selection.courseId`. Add a new
`<SkillChartPanel>` below `<UmaChartPanel>`. The panel mirrors `UmaChartPanel` exactly in
shape (card → collapsible header with Run → toolbar → sortable table → per-row plate +
metrics + target button), but ranks the acquirable catalog on the plan build instead of
umas on a fixed reference.

Build approach (chosen of 3): **new sibling panel + hook, reusing the pure
`rankSkillChart` core.** Alternatives considered and deferred: (2) generalize one shared
`useRankChart` for both charts — better as a later DRY cleanup once both exist; (3)
restyle the legacy panel in place — risks the legacy page (old grammar + auto-run).

### Data flow

```
useGameData() → skills, skillById, sparkRates
acquirableSkills(skills, plan.server)            → catalog (white+gold+inherited, server-filtered P4)
familyRepresentatives(catalog, skillById)        → reps  (one strongest variant per family)
planToSimBuild(plan)                             → build  (plan-dependent)
{ courseId: selection.courseId }                 → race
reps.map(s => s.skillId)      (only if spd > 0)  → ids
useSkillRank(build, race, ids, deps)             → { rows, status, done, total, isStale, run }
  per row (in panel, pure):
    skill = skillById.get(row.skillId)                       // the family rep
    sp    = effectiveSpCost(skill, 0, sparkRates)
    eff   = sp > 0 && L != null ? (100 * L) / sp : null
    targeted = wishlist has any same-family variant           // areSkillVariants
```

Collapsing the catalog to family representatives **before** simulating means one row per
family AND fewer sims (variants apply the same behavior). `familyRepresentatives` is a new
pure helper in `skillFamilies.ts`: group by `variantSkillIds`/`areSkillVariants`, keep the
highest `skillVariantRank` member of each group.

The engine cannot race a 0-speed runner (`firstPositionInLateRace` throw — see CLAUDE.md);
the panel guards `plan.statProfile.stats.spd > 0` before producing `ids`, exactly like the
legacy panel and the Unique-skill chart.

## Components & files

### Core — `src/core/rankSkillChart.ts` (modify, additive)

- Enrich `SkillChartRow` with `min`, `max`, `median` (currently dropped in `rowFrom`); the
  detail disclosure shows the distribution. Existing fields (`skillId`, `L`, `status`,
  `nsamples`) unchanged.
- Add an optional `shouldContinue?: () => boolean` parameter to `rankSkillChart` (checked
  before each skill) for run cancellation — parity with `rankUmaChart`.
- Export a `compareSkillChartRows(a, b)` comparator (extracted from the current inline
  `sort`), so the hook can stream rows kept-sorted (parity with `compareUmaChartRows`).
  Ranking is by L desc; `na` sorts last (use a finite sentinel, not `-Infinity`, to keep
  the comparator NaN-safe — see the Unique-skill chart's `Number.MIN_SAFE_INTEGER`).
- `/legacy` `useSkillChart` keeps working — all changes are additive.

### Helper — `src/features/skill-planner/skillFamilies.ts` (modify, additive)

Add a pure `familyRepresentatives(skills, skillById): SkillRecord[]` — group the input by
variant family (`variantSkillIds` / `areSkillVariants`) and return the highest-ranked member
(`skillVariantRank`) of each family, order-stable. Used by the panel to collapse the
acquirable catalog to one row (and one sim) per family. Existing helpers
(`addOrReplaceWishlistSkill`, `areSkillVariants`, `skillVariantRank`, `wishlistSkillId`) are
reused unchanged.

### Hook — `src/features/cm-planner/useSkillRank.ts` (create)

Run-on-demand wrapper around `rankSkillChart`, a near-mirror of `useUmaChart`:

- Returns `{ rows, status: 'idle'|'running'|'done', done, total, isStale, run }`.
- `run()` bumps a `runToken` (cancels any in-flight run), clears rows, streams each row
  kept-sorted via `compareSkillChartRows`, then sets the final sorted list.
- Default deps reuse a **module-shared `SimClient`** imported from `@/sim/client` (NOT the
  `@/sim` barrel — keeps the ~5 MB engine bundle out of this module's import graph; the
  worker loads it lazily on `run()`). Same singleton pattern as `useUmaChart`.
- `isStale` compares a signature of `(courseId, build, ids, nsamples)` to the last run's
  signature. The build is plan-dependent, so editing stats marks the chart stale (the
  Unique-skill chart only watches the course, since its runner is fixed).
- Cancel any in-flight run on unmount.

### Panel — `src/features/cm-planner/SkillChartPanel.tsx` + `skill-chart.css` (create)

`<section className="cmp-plan-card cmp-skill-chart">` with the shared card grammar:

- **Header** `cmp-plan-card-head cmp-collapse-head` (whole header toggles; `role=button`,
  Enter/Space, `cmp-collapse-caret` flipping on `data-open`). Contains the title
  ("Skill chart"), a Run/Re-run button (`stopPropagation` so it doesn't toggle collapse),
  a `ranking done/total` progress note while running, and a `re-run` stale badge.
- **Toolbar** (when not idle): search input + rarity chips (`all` / `white` / `gold`,
  `aria-pressed`) + a "show all" checkbox (reveals `zero`/`na` rows, hidden by default).
- **Table** `cmp-skill-table` (mirrors `cmp-uma-table`): a `thead` of sortable column
  buttons and a `ul` of rows.
  - Columns: **Skill** (plate) · **L** · **SP** · **L/100SP** · **+** (target).
  - Sortable headers: L / SP / Eff (clickable, `is-sort` highlight). Default sort: L desc.
    SP and efficiency are pure (computed in the panel from skill data + `row.L`), so
    re-sorting never re-sims — the panel sorts the visible list, same as the Unique-skill
    chart sorts by `sortMetric`. `na`/`zero` rows (no L) sort last.
  - **Skill plate** = `SkillDetailDisclosure` built from `skillRecordToSummary(rep)` where
    `rep` is the family representative (`showCost={false}` — SP has its own column).
    Expanding lazily loads the detailed effect-chips + conditions + activation routes
    (on-expand, unchanged). The L distribution (`L +mean · min · max · med · n=`) rides in
    the disclosure's `technicalHeaderSide` slot. No in-chart variant dropdown — the chart
    shows the strongest variant per family and `+ target` targets it; downgrading to a
    cheaper variant (○ / base) happens in the sidebar's existing wishlist variant switcher.
    Gold rarity is styled by the disclosure's existing `cmp-skill-rarity-gold`.
  - **L cell**: `+mean.toFixed(2)` for `live`; muted for `zero`; `n/a` for `na`
    (engine can't simulate the effect — P3 honest numbers, never a misleading `+0.00`).
  - **SP cell**: `effectiveSpCost(skill, 0, sparkRates)`.
  - **Efficiency cell**: `(100·L/SP).toFixed(2)` for `live` with `SP > 0`, else `—`.
  - **Target button**: `+` → `✓` (`aria-pressed`), mirrors the Unique-skill chart's select
    button. `+` adds via `addOrReplaceWishlistSkill(plan.wishlist, skillId, skillById)`
    (family-aware: replaces a same-family variant already targeted), then patches
    `projectedL = row.L` + `projectedLStale = false` onto the added/replaced item.
    `✓` shows when **any** family member is targeted (reuse `areSkillVariants` /
    `wishlistSkillId`, the same set logic the sidebar's `wishlistIds` uses).
- **Idle state**: a one-line "Run to rank acquirable skills by length on your build…"
  prompt (estimate caveat, P3). **No-speed state**: prompt to enter the runner's Speed.

CSS reuses `cmp-plan-card` / `cmp-plan-card-head` / `cmp-collapse-head` / `cmp-collapse-caret`
from `cm-planner.css` and the table/scroll grammar from `uma-chart.css`; `skill-chart.css`
holds only the column-grid specifics (5-column row: plate | L | SP | eff | target).

### Page — `src/features/cm-planner/CmPlannerPage.tsx` (modify)

Mount `<SkillChartPanel courseId={selection.courseId} plan={plan} onChange={setPlan} />`
inside `.cmp-main`, after `<UmaChartPanel>`. Default expanded (run-on-demand means no
auto-sim cost). Wrapped by the existing `SelectedSkillProvider`.

## Reuse (P1)

`acquirableSkills` (`@/core/skillCatalog`) · `planToSimBuild` (`@/core/simBuild`) ·
`effectiveSpCost` (`@/core/cost`) · `skillRecordToSummary` + `SkillDetailDisclosure`
(`cm-planner/`) · `GameIcon` · `SimClient` (`@/sim/client`) · `rankSkillChart`
(`@/core/rankSkillChart`) · `addOrReplaceWishlistSkill` / `areSkillVariants` /
`skillVariantRank` / `wishlistSkillId` (`skill-planner/skillFamilies`) · `cmp-plan-card` /
`cmp-uma-table` CSS grammar · `useGameData` · the `CmPlan.wishlist` SSOT (incl. the existing
`projectedL` field + the sidebar's `Σ projectedL` total). New code is one hook + one panel +
one CSS file + an additive `rankSkillChart` enrichment + an additive `familyRepresentatives`
helper.

## Multiple activation routes

A skill's routes are its `alternatives[]` (the `@`-separated OR-conditions). The engine
activates whichever route's condition is satisfied during the simulated A/B race, so the
computed L is the *realized* effect of whatever actually fires — no user choice or special
handling needed (this matches umalator/VFalator; GameTora's static DB just shows the
condition string). All routes are displayed in the expanded `SkillDetailDisclosure`
("Activation route 1/2…"). If no route can fire on this track → L≈0 → `zero`; if the effect
is unmodellable → `na`.

## Performance & honest numbers

- The acquirable catalog is ~477 skills; collapsing to family representatives trims the sim
  count (one per family). At `DISCOVERY_NSAMPLES = 30` a full run is tens of seconds serial
  on one worker, with top rows streaming in within ~1–2 s. The chart is badged a simulated
  estimate (P3). `slice-1b` progressive-refine (re-sim surviving top-N at higher samples) is
  out of scope here — noted as a follow-up, as in `rankSkillChart`.
- Efficiency divides by SP; a 0-SP skill (none expected in the acquirable set, but guard
  anyway) shows `—` rather than `Infinity`.

## Testing (TDD)

- **`rankSkillChart.test.ts`** (extend): row carries `min`/`max`/`median`; `na` when
  `nsamples === 0`; `shouldContinue` halts the loop (cancellation); `compareSkillChartRows`
  orders L desc with `na` last and is NaN-safe.
- **`skillFamilies.test.ts`** (extend): `familyRepresentatives` returns one member per
  family (the highest `skillVariantRank`), passes singletons through, and is order-stable.
- **`useSkillRank.test.tsx`** (create): idle until `run()`; streams rows kept-sorted;
  `done/total` progress; `isStale` flips when the build or course changes; an in-flight run
  is cancelled by a second `run()` / unmount (injected fake `skillDelta`).
- **`SkillChartPanel.test.tsx`** (create): catalog collapses to one row per family; search +
  rarity + show-all filters; sort by L / SP / efficiency; `+ target` adds via
  `addOrReplaceWishlistSkill` AND sets `projectedL = row.L` (so the sidebar total moves);
  `✓` shows when any same-family variant is already targeted; `n/a` rendering; the
  `spd === 0` guard shows the prompt and never sims.

All UI tests run with the dev server stopped (CLAUDE.md: Vitest flakes vs a live
`pnpm dev`); trust `pnpm build` / `pnpm typecheck`.

## Out of scope

Card-hint sourcing (§3), uma innate/release/usable-here columns, L-vs-distance duration
graphs, HP/velocity/skill-activation track zones, and the shared `useRankChart` DRY merge —
all separate backlog items.

---

## Addendum (2026-06-19) — as-built polish + deviations

Shipped per the design above, then extended in a polish batch (**uncommitted on `main`** —
see [the session handoff](../plans/2026-06-19-m4-skill-chart-polish-and-force-activation-handoff.md)).
Where this contradicts the original Decisions, **the Addendum wins.**

**Filter redesign (supersedes Decisions #6–#7 mechanics).** Real `variantSkillIds` families
bundle the white tiers (○/◎/×) **and** the gold together, so "one row per family / strongest
variant" (#7) collapsed every white+gold family to its *gold* rep — the white filter then showed
gold and dropped whites. Fixed:
- Reps are now **one per (family × rarity)** (`rankSkillChart` builds reps per rarity). Cosmetic
  ○/◎ tiers collapse *within* a rarity; white / gold / inherited stay as **distinct rows**.
- The rarity chips became **5 tabs**: `all · non-unique · inherited unique · white · gold`
  (`non-unique` = white+gold). Filtering is by the row's own rarity. The in-row variant dropdown
  was dropped (downgrade in the sidebar instead, as #7 already noted).

**Proc-aware status (supersedes the #9 / L-cell `na`-vs-`zero` model).** The engine reports
`skillActivations`; it's plumbed as **`BashinStats.activated`** (`bashinStatsFrom`, `src/sim/adapter.ts`).
Row `status` is now `live` / `zero` (procs but ≤ `DEAD_L`, e.g. recovery — shown `+0.0x`) /
**`inactive`** (`activated===false`, can never proc here — shown `—`) / `na` (unsimulatable).
The toggle is renamed **"show not-activatable"** and hides **only `inactive`**; `zero`/`na` always
show. Rows are **dimmed only when `inactive`**. `rankUmaChart` gained the same `inactive` (no style
activates the unique). `activated===undefined` counts as activated (keeps old/hand-built stats valid).

**Run UX.** Run button toggles to a **`■` stop control** mid-run (`useSkillRank.stop()` /
`useUmaChart.stop()` — cancels via `runToken`, keeps partial rows, settles `done`). Header shows a
persistent **run-status**: `ranking n/total` → **"Done"** or **"n/total skills ran"**; and when the
build/course changed since the run, an orange **"Changed detected!, please re-run"** (the
Done/ran text hides while stale). The idle prompt became a **persistent italic, 2ch-indented caption
above the search bar**.

**Sort inverts on re-click** (▼/▲ in an `aria-hidden` span, so the button's accessible name stays the
column label). Skill chart: L / SP / L·100SP. Unique-skill chart: Min/Max/Mean/Median.

**Unique-skill chart parity.** Same stop button, run-status + stale prompt, sort-invert, italic
caption, and proc-aware `inactive` — plus a **"Rank by style" dropdown** (`Rank by best style` =
each uma's best, or force Front/Pace/Late/End Closer for every uma; pure re-rank, no re-sim).

**Force-activation (VFalator "best-case") — investigated, deferred.** Goal: score strongly-
conditional skills (Barcarole, Festive Miracle) at their intended spot, since players engineer the
conditions. Spike result: Barcarole `activated:false` (never fires — the skill A/B compare is solo,
so `order_rate≤40` can't hold), and the exported `runSkillComparison` **ignores** `forcedPositions`/
`scenarioOverrides.forcedRank` (they're wired to other engine entries). The engine *can* force
(custom `ActivationSamplePolicy` returning a fixed `Region(P, P+10)`), so this needs a **`pnpm sim:build`
rebuild** to expose a forced skill-L entry. Mechanics note for the eventual build: force *velocity*
skills at the **final-leg boundary** (carry higher current speed into the spurt ramp), and show
best-case *alongside* the realistic L. Full findings + next steps in the handoff linked above.
