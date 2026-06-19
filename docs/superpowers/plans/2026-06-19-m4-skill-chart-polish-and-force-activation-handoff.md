# Handoff — M4 skill/unique chart polish + force-activation investigation (2026-06-19)

**For the next session.** This captures a large in-progress polish batch (currently
**uncommitted in the working tree on `main`**) and a completed investigation into
VFalator-style "force-activate" scoring.

## State of the tree (read this first)

- The polish batch below was made **directly on `main`'s working tree and is NOT committed.**
  It's on disk, not lost, but `git status` is dirty. Per the repo rule (commit only when the
  user asks; branch first on `main`), it was left uncommitted at the user's direction.
  **To preserve it:** `git checkout -b feat/m4-skill-chart-polish` then `git add` the files
  listed under "Done" (explicit paths — NOT `git add -A`) and commit.
- **`src/features/cm-planner/PlanInventoryCard.tsx` is modified but is NOT part of this work** —
  it's a parallel agent's per-group-delete feature (`deleteGroupConfirm`/`groupDeleteToolbarRef`).
  Do **not** fold it into the polish commit; leave it for its owner.
- **`dev.bat`** is untracked — a convenience launcher (`cd` + `pnpm dev` via cmd.exe to dodge
  the PowerShell ExecutionPolicy block). Commit it or not, user's call; it leaks no personal data
  (reads `TAILNET_HOST` from `.env.local` at runtime).
- Verification: `pnpm typecheck` was clean and the changed test files passed (rankSkillChart 8,
  rankUmaChart 7, SkillChartPanel 14, UmaChartPanel 7, useSkillRank 4, useUmaChart 4, adapter 9).
  A final `pnpm build` was **not** re-run at session end (classifier outage on the shell) — run it
  before committing. Remember: Vitest flakes en masse on the first run while `pnpm dev` is up — re-run.

## Done this session (uncommitted polish)

All on the `/` planner page's two charts. Files: `src/features/cm-planner/{SkillChartPanel,UmaChartPanel,useSkillRank,useUmaChart}.tsx?` (+ their `.test`), `{skill-chart,uma-chart,cm-planner}.css`, `src/core/{rankSkillChart,rankUmaChart}.ts` (+tests), `src/sim/{adapter,types}.ts` (+ `adapter.test`).

- **Stop button**: Run button becomes a `■` while running and force-stops (`stop()` added to
  `useSkillRank` + `useUmaChart`; cancels the in-flight run via the existing `runToken`, keeps
  partial rows, settles to `done`).
- **Run-status text** (unbolded, `font-weight:400` on `.cmp-uma-progress`): `ranking n/total`
  while running; **"Done"** or **"n/total skills|umas ran"** when finished; and when the
  build/course changed since the last run, an orange **"Changed detected!, please re-run"**
  (the `.cmp-stale` span; the Done/ran text hides while stale).
- **Captions**: persistent italic, 2ch-indented line above the search bar on both charts.
  Skill: *"…on your current uma plan. Editing the plan won't update the chart until you Re-run."*
  Uma: *"Run to rank umas by their unique skill's length on this track. Uses a fixed standard runner — independent of your build."*
- **Skill-chart filter tabs**: `all · non-unique · inherited unique · white · gold` (selected
  chip = blue/`--accent`). Filtering is by the row's own rarity. **Reps are now one-per-(family×rarity)**
  (`rankSkillChart` reps built per rarity), so cosmetic ○/◎ tiers collapse *within* a rarity but
  white/gold/inherited stay distinct rows — fixed "white filter showed gold / missing whites."
- **"show not-activatable" toggle** (renamed from "show all", both charts): hides **only**
  `inactive` rows by default; `zero`/`na` always show.
- **Sort-invert**: clicking the active sort column again flips asc/desc (▼/▲ arrow, kept out of
  the accessible name via `aria-hidden`). Skill chart: L/SP/L·100SP. Uma chart: Min/Max/Mean/Median.
  Uma thead changed `aria-hidden` → `role="row"` so the sort buttons are reachable.
- **Uma "Rank by style" dropdown** (mirrors the skill-chart filter position — same row as search,
  before "show all"): `Rank by best style` (default = each uma's best) | Front/Pace/Late/End Closer
  (forces every uma onto that style). Pure re-rank, **no re-sim** (all 4 styles pre-simulated);
  changing it clears per-row style overrides. Fixed-compact width (`.cmp-rank-style`, 9rem).
- **Proc-aware classification** (the important architectural change): the engine reports
  `skillActivations` (non-empty ⇔ the tracked skill procced ≥1×). Plumbed as **`BashinStats.activated`**
  (`bashinStatsFrom` in `src/sim/adapter.ts`) → through the worker → into the rank cores:
  - `rankSkillChart` rows: `na` (nsamples 0) / **`inactive`** (`activated===false`, never procs here) /
    `zero` (procs, ≤ `DEAD_L`) / `live`.
  - `rankUmaChart` rows: same, where `inactive` = no style activated the unique.
  - Panels hide only `inactive` by default and **dim only `inactive`** (`zero`/`na`/`live` full opacity).
  - `activated === undefined` (hand-built/older stats) is treated as activated — keeps old tests valid.
- Also folded in earlier: `rankSkillChart` now carries `min/max/median`, an optional
  `shouldContinue` cancellation, and an exported `compareSkillChartRows`.

## Force-activation investigation (VFalator-style "best-case") — findings

**Goal:** let strongly-conditional skills (Barcarole of Blessings, Festive Miracle, …) be scored at
their *intended* activation spot, since in a real race the player engineers the conditions to be met.

**Mechanics the user clarified (use this for where to force velocity skills):** early/mid leg the uma
runs at a target speed; entering the final leg the target jumps to top-spurt speed and the uma
*accelerates from its current speed*. A target-speed (velocity) skill fired **just before the final-leg
boundary** raises current speed so the uma ramps to top-spurt faster → more length. Fired mid-spurt it
does ~nothing. So "best-case" forcing for velocity skills should place them at the **final-leg entry**,
not anywhere in their window.

**Spike result (ran via the real engine, then deleted the temp test):**
| run | mean L | activated |
|---|---|---|
| ordinary speed skill `200332` (sanity) | +0.39 | ✅ |
| Barcarole `910151` baseline | 0 | ❌ **never fires** |
| Barcarole `910151` + `forcedPositions` + `scenarioOverrides.forcedRank` | 0 | ❌ unchanged |

**Conclusions:**
1. Barcarole reads 0 because it **never activates** in the calculator's sim — the skill A/B compare is
   effectively solo (your runner vs the same runner+skill, **no competitive field**), so a position-
   relative condition like `order_rate≤40` is never satisfied. The new proc-aware logic already labels
   it `inactive` correctly (hidden by default).
2. **The engine *does* support forcing** — the underlying `sunday-tools`/`uma-skill-tools` has a custom
   `ActivationSamplePolicy` (a policy returning a fixed `Region(P, P+10)` forces position) and the sim
   params carry `forcedPositions: {uma1,uma2: Record<skillId, pos>}` and
   `scenarioOverrides.{uma}.forcedRank: [{start,end,rank}]`. (basinnhyou instead *models* conditions via
   `.order()`/pacer/`withActivateCountsAsRandom()` + probabilistic policies, marking those skills `*`
   "grain of salt".)
3. **BUT our vendored bundle blocks it.** `src/sim/vendor/umalator.bundle.mjs` only exports
   `coursesService, runComparison, runPlannerComparison, runSkillComparison, skillsService`. The
   `runSkillComparison` (skill A/B, the one with `skillActivations`+mean) **ignores** `forcedPositions`/
   `forcedRank` — they sit on `CompareParams`/`Run1RoundParams`, not `RunComparisonParams`. Passing them
   changed nothing (proven above). `runComparison` (2-uma) returned all-zero and carries no
   `skillActivations`, so it's not a drop-in either.

## Decision + next step (if pursuing force-activation)

**Chosen direction = Option A (force / best-case), as its own brainstorm → plan → build cycle.** It
requires a **vendored-bundle rebuild** (`pnpm sim:build`) to expose a forced-capable skill-L entry —
either (i) a `runSkillComparison` variant accepting `forcedPositions`/`forcedRank`, or (ii) export the
low-level `RaceSolverBuilder` + a force-at-P `ActivationSamplePolicy` so the adapter injects the force
itself. Readable source: `spikes/repos/umalator-global/src/lib/sunday-tools/` and
`spikes/repos/uma-skill-tools/` (see `RaceSolverBuilder.addSkill(id, perspective, samplePolicy?)`,
`ActivationSamplePolicy.ts`, `basinnhyou.ts`). After rebuild, re-verify engine fidelity (CLAUDE.md
records meanBashin 0.2202 vs upstream). Then: a **"best-case" column/toggle** that force-activates each
skill at its intended spot (velocity skills at the final-leg boundary), shown **alongside** the realistic
number, with a P3 "assumes conditions met" caveat — never replacing the realistic L (else every skill
looks strong and the reliability signal is lost).

Alternatives if Option A proves too heavy: **(B)** rebuild to *model* conditions (basinnhyou style,
realistic expected L marked "estimate"); **(C)** defer and keep faithful-solo (conditional skills read
`inactive`).

## Other open items (pre-existing backlog, unchanged)

Card-hint sourcing (§3), uma innate/release/usable-here columns, HP/velocity/skill-activation zones on
the track, the skill-plate **type-tag** handoff (`docs/superpowers/specs/2026-06-17-skill-plate-type-tag-handoff.md`),
and the shared `useRankChart` DRY merge of the two chart hooks.
