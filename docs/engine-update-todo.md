# Sidelist — Engine update `v0.14.2 → v0.18.0`

> **Created 2026-06-24.** A parallel, non-blocking track off the main [roadmap](roadmap.md) (sidelist S1).
> Cross-ref: [data-refresh-runbook.md](data-refresh-runbook.md) (the canonical "how to bump the pin + refresh data" steps), [provenance.md](provenance.md) (vendor pin record).

## Context

- **Current pin:** `jalbarrang/umalator-global` **v0.14.2**, commit `c1fa2107`, 2026-06-05 (see `src/sim/vendor/README.md`).
- **Upstream now:** **v0.18.0** (2026-06-22) — ~7 releases ahead (v0.15.0, v0.15.1, v0.16.0–0.16.2, v0.17.0, v0.18.0).
- **What the gap contains:** data refreshes (incl. the **2026-06-10 Global patch** master.mdb + skill data), engine fixes (notably **"fixing non-full spurts"**), upstream sync with alpha123, and upstream notes about *adding visualization graphs to skill/uma charts* (overlaps features we hand-built).
- **⚠️ Local patch sits on top of the pin:** the engine carries a local **cooldown multi-fire** patch (`engine-patches/2026-06-22-multifire.patch`; flag `cooldownReactivation`, **default-ON**; gives Professor of Curvature 2× on Hanshin 3200m / 1× on a mile). It is **not** in upstream v0.14.2 and the engine clone is gitignored → **a bump must re-apply or supersede this patch, not blow it away.**

## Why bother

Our skill/course/uma data and a couple of physics behaviours are frozen at 2026-06-05. Anything that depends on post-2026-06-05 Global content (new skills, rebalances, the 2026-06-10 patch) is stale until we bump. The "non-full spurts" fix could also move our simulated numbers — which is exactly why this is a deliberate, tested upgrade, not a drop-in.

## ⚠️ Do NOT re-pin to TheCing/uma-tools

`TheCing/uma-tools` ("Moomoolator") is a **sibling** umalator fork (alpha123 → kachi-dev/VFalator → TheCing), not an ancestor of our pin. It's **Preact** (clashes with our React 19 + `src/sim` bundle pipeline), exposes **no versioned engine** (committed as minified bundle, `package.json` is `0.0.1`), and its additions are **UI/UX only** (bilingual, mobile, PNG card export, OCR) — no engine-physics advantage over what our `jalbarrang` line already incorporates. The correct upgrade lever is bumping **our existing vendor** to v0.18.0, below.

## Checklist

- [ ] **Read the changelogs** for v0.15.0 → v0.18.0; list every **physics-affecting** change (esp. "non-full spurts").
- [ ] **Reconcile the local multi-fire patch:** check whether upstream v0.15–v0.18 absorbed cooldown-based reactivation **natively**. If yes → drop `engine-patches/2026-06-22-multifire.patch` in favour of upstream's; if no → **re-port** it onto the new bundle. Either way re-confirm the behaviour survives (Prof 2× on Hanshin 3200m, 1× on a mile; flag default-ON, OFF = single-fire). Releases: <https://github.com/jalbarrang/umalator-global/releases>.
- [ ] **Trial bump on a worktree** (isolate from `main`): update the vendor pin/commit, run `pnpm sim:build`, then re-apply/verify the multi-fire patch.
- [ ] **Run `fidelity.test.ts`**; record the new meanBashin vs the **0.2202** baseline (measured on the `cooldownReactivation:false` flag-OFF path — keep comparing on that path). Note the delta.
- [ ] **If golden numbers shift:** investigate which change caused it; decide whether to **deliberately re-baseline** (update goldens with a comment citing the upstream fix) or hold the bump.
- [ ] **Refresh `public/data/`** via `pnpm data:build` (follow [data-refresh-runbook.md](data-refresh-runbook.md)); review the diff for new/changed skills + courses.
- [ ] **Re-run the full suite:** `pnpm typecheck` + `pnpm test` + `pnpm build` all green.
- [ ] **Smoke-test the engine surfaces** that the data touches: M4 skill charts, skill-detail graphs, two-build race overlay; M2 optimizer.
- [ ] **Update the pin record:** `src/sim/vendor/README.md` + `docs/provenance.md` (vendor pin → v0.18.0 + commit) + CLAUDE.md mentions of "v0.14.2".
- [ ] **Decide a cadence** for future bumps (e.g. check upstream releases once per CM cycle) so we don't drift 7 releases again.

## Caveats

- The bundle is **TypeScript/JS** (`umalator.bundle.mjs`), not Rust/wasm — same `pnpm sim:build` pipeline as today.
- License is unchanged (**GPL-3.0**, clean chain).
- Treat any meanBashin movement as **signal, not noise** — a physics fix changing our goldens is expected and fine *if understood*; an unexplained change is a stop-and-investigate.
