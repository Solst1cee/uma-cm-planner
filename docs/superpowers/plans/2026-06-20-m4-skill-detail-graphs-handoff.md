# M4 skill-detail graphs — session handoff (2026-06-20)

**Status:** **MERGED to `main` (`003f14d`, 2026-06-20).** 671 tests green, typecheck + build clean. Merged cleanly with the parallel session's main line (no conflicts). A second pass on 2026-06-20 **polished** the section — see *Polish pass* below.

## Polish pass (2026-06-20, merged)

The skill graph is now a **"Simulated performance"** section (`SkillTraceSection.tsx`):
- **Summary block** (numbers only; graphs below are visual): avg バ身 gain (`meanL`, 2dp, skill-chart styling), biggest gain + exact fire position (`peakImpactPosition`), integer **×1/×2 fire-count breakdown** (`activationCounts` = % of runs; no fractional average).
- **Windowed velocity-vs-time** (utools/kachi-style — `velocityWindow`/`vtWindowPoints`/`timePhaseBandsWindowed`): zoom to the activation (±10s), floor the y-axis (`V_FLOOR=18`), trim the with-skill line at re-convergence. **Worst/Typical/Best picker moved into the chart title** (shared `.cmp-control-group` segmented control). A "skill didn't fire in this run" note shows when the chosen run has no activation (Worst/Typical are often non-firing for sub-100%-proc skills).
- Activation-frequency chart on its own line, half-height, 0/50/100% y; **250m minor gridlines** (same colour as 500m).
- **"?" help popup** (click-outside closes) explaining how each graph is simulated; the inline P3 note was folded into it.
- **Velocity-vs-_distance_ + HP was prototyped here then reverted** — it belongs on the racetrack overlay. Captured in [the racetrack-overlay handoff](2026-06-20-m4-velocity-hp-vs-distance-racetrack-overlay-handoff.md).

**⚠️ Multi-fire limitation (open):** `velocityWindow` + `peakImpactPosition` use only the **first** activation (`acts[0]`); `impactByPosition`/`frequencyByPosition`/`activationCounts` handle every fire, and total バ身 already sums all cooldown re-procs (whole-race sim). The velocity-chart fix (widen window to span all procs) is undecided — see *Next up*.

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

1. **Velocity-chart multi-fire** (open decision) — widen `velocityWindow` to span all activations (`first.start − pad` → `last.end + pad`), shade every zone, trim through the **last** re-convergence; make `peakImpactPosition` / the "fires at" line list all positions. User was asked (widen vs "fires N×" badge vs leave) and pivoted to the fire-count breakdown instead, so the chart fix is still undecided.
2. **Full-race uma1-vs-uma2 compare** (umalator's *main* view) — both full builds + **all wishlist skills**, one run over the **entire race**, velocity + バ身 gap vs distance, all activation positions marked. **Open decision: what is uma2?** A new panel, not per-skill. `runComparison` already returns both runners' per-frame traces. [Handoff](2026-06-20-m4-full-race-compare-handoff.md).
3. **Racetrack overlay** — HP / velocity / activation zones on the §0 racetrack: reuse the reverted velocity+HP-vs-distance geometry ([handoff](2026-06-20-m4-velocity-hp-vs-distance-racetrack-overlay-handoff.md)); pipe the per-frame trace into `RaceTrackView`.
4. Card-hint sourcing + wishlist; uma innate/release/usable-here columns. True **per-proc バ身 attribution** needs forced single-activation sims (the deferred force-activation task).

## Known / not-bugs

- **No open bugs.** A suspected "off-by-one re-open" while testing the accordion turned out to be a **test artifact** — the uma chart streams + re-sorts rows as ranking completes, so clicking `.first()` mid-sort hit different rows. With the ranking settled and a pinned row, collapse/re-open is correct and (with the cache) instant.
- **`IMPACT_SAMPLES = 400` auto-runs on every fresh expand.** Off-main-thread (Worker) so the page never blocks, accordion bounds it to one in flight, and the LRU makes revisits free — but if browsing many *distinct* skills feels heavy on a weak device, lower it in `useSkillTrace.ts`.
- **jsdom gotcha:** an open disclosure with a live `traceContext` constructs a real `SimClient` Worker (crashes jsdom). Tests that open one must `vi.mock('./useSkillTrace')` (done in `UmaChartPanel.test.tsx` + `PlannerSidebar.test.tsx`).
- **`runComparison` has no `min/max/mean/median` fields** — derive from the sorted `results`. Skill-comparison `runData` carries only `sk` activation logs; full-comparison `runData` carries both runners' per-frame traces — don't conflate.

## Merge — RESOLVED (2026-06-20)

This branch was merged with the parallel session's main line (acquirable-skill chart, plan inventory, cmRef/timeline race-setup) into `main` (`003f14d`) with **no conflicts** — the two sessions touched mostly disjoint files. 671 tests + build green on the merged tree. *(An earlier note warned of a 3-way merge with conflicts; in the end the bases had already reconciled and it was clean.)*

## Worktree housekeeping (not committed, safe to ignore/remove)

- `.../sdd/*.mjs` (Playwright drive/diag scripts) + `*.png` + `*-brief.md`/`*-report.md` live under `.git/worktrees/.../sdd/` — gitignored, never tracked.
- `.env.local` was copied into the worktree (for the tailnet dev URL) — gitignored, not committed.
- A `pnpm dev` server may still be running on **port 5178** (5177 is the other session's). Kill it if stale.
