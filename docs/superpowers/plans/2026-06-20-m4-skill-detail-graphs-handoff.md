# M4 skill-detail graphs — session handoff (2026-06-20)

**Branch:** `feat/m4-skill-detail-graphs` — **local-only, NOT merged/pushed** (the user deferred the push/merge decision). 26 commits ahead of `main`. **518 tests green, `pnpm build` clean.** Built in an isolated worktree (`.claude/worktrees/m4-skill-detail-graphs/`).

## What shipped

Skill-detail graphs inside `SkillDetailDisclosure` (expanded + `traceContext` present). Two views, **both auto-run on expand**:

1. **Velocity vs time** — single representative run (`runSkillTrace` → `runComparison.runData`), Best/Typical/Worst toggle (no re-sim).
2. **L gained by activation position** + **Activation frequency by position** — umalator's "Length Difference Impact" pair, from N=400 Monte-Carlo samples (`skillImpact` → per-activation `{horseLength, positions}` binned by fire-position: **max バ身/bin** and **%/bin**). The activation rate is `samples.length / nsamples`.

Velocity paints first (20 samples); the impact pair queues behind it on the FIFO worker (~1s). **Results are LRU-memoized** (`useSkillTrace`, key = skill+course+full build stats) → re-opening or Re-running the chart with the same build is instant. Charts: hand-rolled SVG, square corners, faint 1L/500m grid, 4 phase bands (Early/Mid/Late/Last-spurt) + labels in the racetrack colors, y-labels in a thin left gutter.

**Wired into:** `UmaChartPanel` (accordion, one open at a time; per-row `REFERENCE_STATS` build) and `PlannerSidebar` (plan build, on unique + wishlist rows). `buildLabel` captions the P3 note ('your build' vs 'the reference').

Full file-by-file detail is in **[docs/modules/module-4-skill-acquisition.md](../../modules/module-4-skill-acquisition.md)** (reconciled this session).

## ⚠️ Spec/plan are stale vs. what shipped

The original **[spec](../specs/2026-06-17-m4-skill-detail-graphs-design.md)** and **[plan](2026-06-17-m4-skill-detail-graphs.md)** describe the *first* design (velocity + a single-run "L-vs-distance" curve + button-gated activation rate). That was built (9 TDD tasks, reviewed) and then **rebuilt** in-session after the user clarified the target. The chart-② evolution: single-run cumulative line → per-segment columns → incremental ΔL → **finally** umalator's position-binned max-バ身 (the real prototype). Trust **module-4 doc + this note + the code**, not the original spec/plan, for chart ②.

Research that settled it: umalator-global's `length-difference-chart.tsx` is the real "X = activation position, Y = max バ身" chart; `alpha123/uma-skill-tools` (VFalator's CLI) only has matplotlib histogram/velocity charts; mee1080 has a contribution *table*, not a chart.

## Next up (resume here)

1. **Full-race uma1-vs-uma2 compare** (umalator's *main* view, explicitly deferred this session) — both full builds + **all wishlist skills**, one run over the **entire race**, velocity + バ身 gap vs distance, all activation positions marked, "where you pull ahead / slow down." **Open decision: what is uma2?** (your build minus wishlist skills / a rival build / two fully-editable umas). This is a new panel, not per-skill — likely its own component, not inside `SkillDetailDisclosure`. The engine path exists (`runComparison` already returns both runners' per-frame traces).
2. White/gold acquirable-skill chart; card-hint sourcing + wishlist; HP/velocity/activation zones overlaid on the §0 racetrack (needs the per-frame trace piped into `RaceTrackView`).

## Known / not-bugs

- **No open bugs.** A suspected "off-by-one re-open" while testing the accordion turned out to be a **test artifact** — the uma chart streams + re-sorts rows as ranking completes, so clicking `.first()` mid-sort hit different rows. With the ranking settled and a pinned row, collapse/re-open is correct and (with the cache) instant.
- **`IMPACT_SAMPLES = 400` auto-runs on every fresh expand.** Off-main-thread (Worker) so the page never blocks, accordion bounds it to one in flight, and the LRU makes revisits free — but if browsing many *distinct* skills feels heavy on a weak device, lower it in `useSkillTrace.ts`.
- **jsdom gotcha:** an open disclosure with a live `traceContext` constructs a real `SimClient` Worker (crashes jsdom). Tests that open one must `vi.mock('./useSkillTrace')` (done in `UmaChartPanel.test.tsx` + `PlannerSidebar.test.tsx`).
- **`runComparison` has no `min/max/mean/median` fields** — derive from the sorted `results`. Skill-comparison `runData` carries only `sk` activation logs; full-comparison `runData` carries both runners' per-frame traces — don't conflate.

## ⚠️ Merging this branch — it has DIVERGED from main

This branch forked from `b18e179` (an older main). During this session the **parallel agent advanced `main` to `73dedfc`** with a big M4 line my branch does NOT contain: the **acquirable-skill chart** (`SkillChartPanel`, `useSkillRank`, `rankSkillChart`, `familyRepresentatives`), **plan inventory management**, **saved-plans + sidebar polish**, and a session-handoff doc. `git merge-base main HEAD` = `b18e179`, so this is a **3-way merge, not a fast-forward**.

Expect conflicts in the shared M4 surfaces — resolve by keeping BOTH sides:
- `CLAUDE.md` — both bumped the test count / M4 status lines (combine; re-run `pnpm test` for the true total).
- `docs/modules/module-4-skill-acquisition.md` — both edited the M4 status.
- `src/app/App.tsx` — the documented nav-route merge-collision point.
- `src/features/cm-planner/*` (esp. `CmPlannerPage.tsx`) — the other line added `SkillChartPanel` to the same page this branch's `UmaChartPanel`/sidebar wiring touches.

Recommended: `git rebase main` (or merge main in) on this branch in the worktree, resolve, re-run `pnpm test` + `pnpm build`, then PR. The sim-engine additions here (`skillTrace`/`skillImpact` in `run.ts`/`types.ts`/`client.ts`/worker) are additive and should merge clean.

## Worktree housekeeping (not committed, safe to ignore/remove)

- `.../sdd/*.mjs` (Playwright drive/diag scripts) + `*.png` + `*-brief.md`/`*-report.md` live under `.git/worktrees/.../sdd/` — gitignored, never tracked.
- `.env.local` was copied into the worktree (for the tailnet dev URL) — gitignored, not committed.
- A `pnpm dev` server may still be running on **port 5178** (5177 is the other session's). Kill it if stale.
