# Handoff — Sim engine WASM re-platform MERGED (PR #51, 2026-07-11)

The engine re-platform (TS bundle → Rust/WASM v0.27.0, pin `484539f5`) is **merged to main** ([PR #51](https://github.com/Solst1cee/uma-cm-planner/pull/51), merge `eda2cda`). CLAUDE.md's status entry, provenance §1, runbook §1, `src/sim/vendor/README.md`, and roadmap S1 are the authoritative records; fidelity + determinism adjudication in mechanics-notes §12. Gate at merge: typecheck clean, **1538 tests / 193 files**, build green.

## Remaining maintainer items (Sun)

1. **Interactive full-app smoke** — start with **M2's first Analyze click** (cold engine → "Analyzing…" → results) and the **Stamina tab**; then M4 charts, mini-sim overlay, unique-L stepper, `/inheritance`. These two exercise the seams with the least automated end-to-end coverage (main-thread engine init; VacuumOpts threading).
2. **Deployed-site parity eyeball** vs upstream umalator (mechanics-notes §12.3 has our programmatic 0.0-delta record; the live-site check catches data drift ours can't).
3. **"The Duty of Dignity Calls"** skill detail at Current horizon: NO "confirmed patch, engine pin pending" chip (the ENGINE_DATA_DATE gate).
4. (Non-blocking) **Cold-clone `pnpm sim:build` reproduction** per `src/sim/vendor/README.md` — flow documented, never executed end-to-end; byte-stability across rebuilds of the existing clone IS proven.

## Known-but-unfixed (accepted by final review, fold into next touch)

- `src/sim/worker-core.ts:47` comment says engine.worker is "the ONLY module" importing the wasm asset URL — `ensureMainThread.ts` also does (its own header is correct).
- **sp-load concurrent-analyze race** (`SpOptimizerPage.tsx:146`): rapid clicks on two saved captures can pair the label of the last *clicked* with the result of the last *resolved* — display-only, saved data unaffected; gate the list on `analyzing` in a polish pass.
- `src/sim/init.test.ts` FromUrl test can time out under full-suite worker contention (baseline-reproduced flake, passes standalone).
- One stale `engine-update-todo.md` link in an archived plan doc (`2026-07-02-m1-7-coverage-matrix-wrapup.md:42`) — historical, exempt.

## Unlocked next-ups (roadmap S1 follow-ups)

The Rust engine natively exposes what the old TS bundle couldn't: (1) `runContestedCompare` real-opponent fields → **near-lane skills (Slipstream) + a dedicated full race-sim page**; (2) **force-activation UI** (`forcedPositions`/`forcedRank` now honored — the old spike's blocker is gone); (3) position-keep / Power Conservation / rushed / dueling telemetry in charts + overlays.

## Cleanup notes

- The worktree `.claude/worktrees/sim-wasm-replatform` is now merged history — safe to remove (harness-owned; on Windows delete the folder by hand if git de-registers it). Its `.superpowers/sdd/progress.md` holds the full execution trail if ever needed.
- The remote branch `worktree-sim-wasm-replatform` can be deleted once this handoff's roadmap cherry-pick (`docs(roadmap): link PR #51…`) is confirmed on main — that commit was pushed to the branch seconds after the merge and was cherry-picked here.
- A byte-identical stray copy of `engine-patches/2026-07-10-multifire-rust.patch` was removed from main's working tree (it would have blocked the merge checkout; the committed version arrived via the PR).

## Unrelated parallel state (untouched)

The **M2 post-run capture** track: uncommitted mods to `src/core/spOptimizer.ts` + sp-optimizer UI/tests + `docs/capture-bundle-contract.md` (stashed as "M2 capture track WIP" during the merge integration, then re-applied — if the stash pop conflicted, the pre-merge diff backup lives at the session scratchpad `m2-capture-dirty-backup.patch`), untracked `src/core/careerCapture.*`, `scripts/borrowed/*.json`, `test-import.mts`, `.codex/`, and the other worktrees (`m2-sp-optimizer`, `m2-capture-method`, `ci+data-update-workflow`).
