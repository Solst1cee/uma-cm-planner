# M4 Acquirable-Skill Chart — Design

**Date:** 2026-06-17
**Module:** M4 Skill Acquisition Planner (`/` CmPlannerPage rebuild)
**Status:** Design approved; ready for implementation plan.

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
acquirableSkills(skills, plan.server)            → catalog (server-filtered, P4)
planToSimBuild(plan)                             → build  (plan-dependent)
{ courseId: selection.courseId }                 → race
catalog.map(s => s.skillId)   (only if spd > 0)  → ids
useSkillRank(build, race, ids, deps)             → { rows, status, done, total, isStale, run }
  per row (in panel, pure):
    skill = skillById.get(row.skillId)
    sp    = effectiveSpCost(skill, 0, sparkRates)
    eff   = sp > 0 ? (100 * L) / sp : null
```

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
  - **Skill plate** = `SkillDetailDisclosure` built from `skillRecordToSummary(skill)`
    (`showCost={false}` — SP has its own column). Expanding lazily loads effect-chips from
    the vendored bundle. The L distribution (`L +mean · min · max · med · n=`) rides in the
    disclosure's `technicalHeaderSide` slot. Gold rarity is styled by the disclosure's
    existing `cmp-skill-rarity-gold`.
  - **L cell**: `+mean.toFixed(2)` for `live`; muted for `zero`; `n/a` for `na`
    (engine can't simulate the effect — P3 honest numbers, never a misleading `+0.00`).
  - **SP cell**: `effectiveSpCost(skill, 0, sparkRates)`.
  - **Efficiency cell**: `(100·L/SP).toFixed(2)` for `live` with `SP > 0`, else `—`.
  - **Target button**: `+` → `✓` (`aria-pressed`), mirrors the Unique-skill chart's select
    button. `+` appends `{ skillId, priority: 1, source: 'targeted' }` to `plan.wishlist`
    via `onChange`; `✓` shown when the skill is already in the wishlist (feeds the sidebar
    target summary).
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
(`@/core/rankSkillChart`) · `cmp-plan-card` / `cmp-uma-table` CSS grammar · `useGameData` ·
the `CmPlan.wishlist` SSOT. New code is one hook + one panel + one CSS file + an additive
core enrichment.

## Performance & honest numbers

- The acquirable catalog is ~477 skills; at `DISCOVERY_NSAMPLES = 30` a full run is
  ~30–40 s serial on one worker, with top rows streaming in within ~1–2 s. The chart is
  badged a simulated estimate (P3). `slice-1b` progressive-refine (re-sim surviving top-N
  at higher samples) is out of scope here — noted as a follow-up, as in `rankSkillChart`.
- Efficiency divides by SP; a 0-SP skill (none expected in the acquirable set, but guard
  anyway) shows `—` rather than `Infinity`.

## Testing (TDD)

- **`rankSkillChart.test.ts`** (extend): row carries `min`/`max`/`median`; `na` when
  `nsamples === 0`; `shouldContinue` halts the loop (cancellation); `compareSkillChartRows`
  orders L desc with `na` last and is NaN-safe.
- **`useSkillRank.test.tsx`** (create): idle until `run()`; streams rows kept-sorted;
  `done/total` progress; `isStale` flips when the build or course changes; an in-flight run
  is cancelled by a second `run()` / unmount (injected fake `skillDelta`).
- **`SkillChartPanel.test.tsx`** (create): search + rarity + show-all filters; sort by
  L / SP / efficiency; `+ target` appends to `plan.wishlist` and flips to `✓`; `n/a`
  rendering; the `spd === 0` guard shows the prompt and never sims.

All UI tests run with the dev server stopped (CLAUDE.md: Vitest flakes vs a live
`pnpm dev`); trust `pnpm build` / `pnpm typecheck`.

## Out of scope

Card-hint sourcing (§3), uma innate/release/usable-here columns, L-vs-distance duration
graphs, HP/velocity/skill-activation track zones, and the shared `useRankChart` DRY merge —
all separate backlog items.
