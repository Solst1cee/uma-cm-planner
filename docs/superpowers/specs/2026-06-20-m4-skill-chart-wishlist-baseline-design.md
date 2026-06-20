# M4 Skill Chart — Wishlist Baseline + Stamina Warning (Design)

**Date:** 2026-06-20
**Status:** Designed (awaiting user review → implementation)
**Module:** M4 Skill Acquisition — acquirable skill chart (`/`)
**Supersedes nothing.** Extends [2026-06-17-m4-acquirable-skill-chart-design.md](2026-06-17-m4-acquirable-skill-chart-design.md).

## Problem

A user reported an edge case in the acquirable skill chart: when a build's stamina is
insufficient, a **recovery** skill shows a far larger L than any velocity skill. Once the
recovery skill is actually selected (stamina now sufficient), the *other* gold skills no longer
provide the L they showed in the chart. The ranking misleads.

## Root cause

The chart ranks every candidate against a **vacuum baseline**: `planToSimBuild(plan)` hardcodes
`skills: []` ([src/core/simBuild.ts:95](../../../src/core/simBuild.ts#L95)). Each row's L is the
marginal delta of adding *that one skill alone* on top of bare stats with **no other skills**.

This exposes a real mechanic badly: **skill L is not additive — it is build-dependent.**

- When the baseline build **stamina-outs**, the runner gasses in the final spurt. A recovery
  skill rescues that whole spurt → enormous L. A velocity skill can't help a runner already out
  of HP → small L.
- Once recovery is *owned* (stamina sufficient), velocity skills carry to the finish and their
  true L is much higher than the chart showed — but the chart measured them against the gassed
  vacuum baseline.

This is not a bug in the engine; it is a presentation problem with the vacuum baseline.

## How other tools handle it

- **VFalator / umalator:** the user hand-configures the *actual deck* and compares A-vs-B for
  specific skill sets. Interactions are captured because measurement happens on the real build.
  They do not auto-rank a catalog independently — the tradeoff we made for the discovery chart.
- **GameTora tier lists:** static, ignore the build entirely (useless for exactly this case).
- **Community framing:** secure stamina/recovery first, then value speed skills against the
  stamina-sufficient build.

The fix is about **what baseline we rank against**, plus **being honest when the baseline is
stamina-gated.**

## Approach (chosen: "Wishlist baseline + stamina warning")

Three pieces. All feasible with **no `pnpm sim:build` rebuild** — the engine primitives and the
worker request kinds already exist.

### Piece 1 — Baseline = stats + your targeted wishlist skills (the core fix)

A new pure-core sibling of `planToSimBuild` measures each candidate **on top of the skills you
have already targeted**, instead of a vacuum.

- New function in `src/core/simBuild.ts`:
  `chartBaselineBuild(plan, skillById)` → returns the same `SimBuild` as `planToSimBuild(plan)`
  but with `skills` set to the engine ids of the currently-targeted wishlist skills (resolved
  via the existing `skillFamilies` helpers — `wishlistSkillId` / `wishlistSkillRecord`).
- `planToSimBuild` stays **untouched** — it is intentionally vacuum and is shared by the legacy
  page ([src/features/skill-acq/SkillChartPanel.tsx:35](../../../src/features/skill-acq/SkillChartPanel.tsx#L35))
  and the sidebar trace context
  ([src/features/cm-planner/PlannerSidebar.tsx:292](../../../src/features/cm-planner/PlannerSidebar.tsx#L292)).
- The new chart swaps its `build` memo from `planToSimBuild(plan)` to
  `chartBaselineBuild(plan, skillById)`.
- The engine path is transparent: `evalSkillDelta(build, …)` already adds the candidate on top of
  `build.skills` ([src/sim/run.ts:9-15](../../../src/sim/run.ts#L9-L15)), and the worker passes the
  whole `build` through. A baseline carrying wishlist skills "just works."
- **Robustness:** baseline skill ids must be restricted to engine-simulatable ids before the
  build is constructed, so a non-simulatable wishlist entry (e.g. a unique) can't make the whole
  sim throw. The simulatable filter uses a lazily-imported predicate from `@/sim`
  (`skillsService.isSimulatable`), keeping `chartBaselineBuild` pure-core and testable. The exact
  seam (predicate injected into `chartBaselineBuild`, or filtered at the chart) is settled in the
  plan; the pure function must remain unit-testable without the engine.

**Resulting workflow:** target recovery → Re-run → speed skills jump to their true marginal L; a
second recovery now correctly shows ~0. The "Changed detected, please re-run" stale prompt already
fires on plan edits, so the loop is natural.

**Backward compatible:** an empty wishlist yields `skills: []`, i.e. today's exact vacuum
behavior — nothing regresses for users who target nothing.

**Side benefit:** the chain of stamped `projectedL` values (each the marginal on top of the
then-current wishlist) now sums to the real build total by the chain rule, so the sidebar's L-sum
becomes more accurate.

### Piece 2 — Stamina-out warning (honest-numbers banner)

On Run, a one-shot baseline probe reports the build's **engine-authoritative** stamina survival.

- Probe: `vacuum(build, build, race, n)` → `aStaminaSurvival`. `runVacuumCompare`
  ([src/sim/run.ts:29-31](../../../src/sim/run.ts#L29-L31)) derives this from
  `staminaStats.uma1.staminaSurvivalRate` ([src/sim/run.ts:47](../../../src/sim/run.ts#L47)); the
  worker already supports the `'vacuum'` request kind
  ([src/sim/types.ts:94](../../../src/sim/types.ts#L94)). Comparing the build against itself is
  fine — survival is computed per-runner, so `aStaminaSurvival` is the build's own survival rate.
- If survival is below a tunable threshold (`STAMINA_WARN_THRESHOLD`, default **0.85**), the chart
  body shows a banner:
  > ⚠ This build survives only **N%** of runs (stamina-out). Recovery is inflated and speed skills
  > are undervalued here — secure stamina/recovery, then Re-run.
- The probe re-runs on every Run, so once recovery/stamina fixes the build, the banner clears.
- Honest-numbers (P3): show the actual survival percentage, never a fabricated verdict.

### Piece 3 — Already-targeted skills display

Targeted skills are now part of the baseline, so their fresh marginal L ≈ 0. To avoid a confusing
"your chosen skill is worth 0":

- Targeted skills are **excluded from the ranked candidate `ids`** (not re-simmed — slightly faster
  runs).
- They remain visible inline, sorted by their stamped `projectedL`, rendered with an **"in build"
  badge** and showing the stamped L (the value they contributed when added). The ✓ stays so the
  user can un-target.
- Un-targeting shrinks the baseline; the stale prompt covers the re-run.

## Scope / non-goals

- **Sidebar skill-detail velocity graphs** still trace against the vacuum `planToSimBuild` — left
  as-is (a separate visualization, not the ranking the user flagged). The inconsistency is noted
  here as a possible follow-up.
- **No `pnpm sim:build`** rebuild. No force-activation work (that remains the separately-deferred
  item).
- **Legacy page** (`/legacy`) untouched — it keeps vacuum ranking.

## Testing strategy (TDD)

- `chartBaselineBuild` (pure unit):
  - empty wishlist → `skills: []` (matches `planToSimBuild`).
  - wishlist with targeted skills → `skills` contains the resolved engine ids.
  - variant/family resolution: a targeted family rep resolves to the chosen variant id.
  - non-simulatable wishlist entry is filtered out (via injected predicate).
- `rankSkillChart` already covers streaming; add/confirm that a baseline `build.skills` is passed
  through to the injected `skillDelta` unchanged.
- Stamina probe (hook/unit with an injected `vacuum` dep):
  - survival below threshold → banner visible with the percentage.
  - survival at/above threshold → no banner.
- Component (`SkillChartPanel.test.tsx`, jsdom — stub `useSkillTrace` per the existing gotcha):
  - a targeted skill renders the "in build" badge + stamped L and is **not** passed to `skillDelta`.
  - empty wishlist → identical behavior to today (regression guard).

## File touch list

- `src/core/simBuild.ts` — add `chartBaselineBuild`; `src/core/simBuild.test.ts` — its tests.
- `src/features/cm-planner/SkillChartPanel.tsx` — baseline source, exclude targeted from `ids`,
  in-build rows, stamina banner.
- `src/features/cm-planner/useSkillRank.ts` (or a small `useStaminaProbe`) — fire the vacuum probe
  at Run start, expose `staminaSurvival`. Wire `SimClient.vacuum` if not already exposed.
- `src/sim` — ensure a lazily-importable `isSimulatable` predicate + `SimClient.vacuum` are
  reachable (no new engine build).
- `src/features/cm-planner/skill-chart.css` — banner + "in build" badge styles.
- Tests alongside each.
- Docs (at wrap-up): `docs/modules/module-4-skill-acquisition.md`, an addendum to the
  acquirable-skill-chart spec, and `CLAUDE.md` status line.
