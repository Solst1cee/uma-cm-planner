# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current State

**Status (2026-06-17):** all four modules in progress on `main` (**478 tests**, typecheck + build green before the latest sidebar branch). **M4 is being rebuilt around umalator's _vendored_ UI** — the mockups are umalator-derived, so vendoring umalator's real components is the fastest path to fidelity (the hand-rolled track was far below the real uma-tools track that uma.guide ships). `/` is now `CmPlannerPage`: a **light CmPlan planner sidebar** with stat growth + pink-spark target summary + the **real umalator §0 race-track visualizer** + a **race-setup customizer** (preset ⇄ fully-custom track / ground / weather / season) + an engine-ranked **unique-skill chart** (VFalator-style sortable table; best-of-4-styles L on a fixed reference) + **skill effect-chips** in the detail viewer. The original engine-driven skill chart moved to **`/legacy`**. Rebuild spec: [2026-06-16-m4-umalator-build-foundation-design.md](docs/superpowers/specs/2026-06-16-m4-umalator-build-foundation-design.md).

**Per-module detail lives in [docs/modules/](docs/modules/) — load the lean file below + the one module you're working on, not the whole history.**

| Module | Route | Status | Doc |
|---|---|---|---|
| M4 Skill Acquisition | `/` (rebuild) · `/legacy` (old) | **Rebuild Slice A + sidebar + unique-skill chart done (2026-06-16); compact sidebar data/visual follow-up done (2026-06-17):** CmPlan planner sidebar + selected-uma stat growth/base aptitude spark summary + vendored umalator §0 race-track + race-setup customizer + engine-ranked unique-skill chart + skill effect-chips at `/`. Original engine skill chart + sourcing at `/legacy`. | [module-4](docs/modules/module-4-skill-acquisition.md) *(detailed)* |
| M1 Inheritance | — (stub) | Plans 1–2 (CmPlan SSOT + affinity core) done; **Plans 3–5 are Next** | [module-1](docs/modules/module-1-inheritance.md) |
| M2 SP Optimizer | `/sp-optimizer` | MVP shipped; F1–F4 follow-ups | [module-2](docs/modules/module-2-sp-optimizer.md) |
| M3 Meta Intel | `/meta-intel` | Timeline + synthesis shipped; phase-2 next | [module-3](docs/modules/module-3-meta-intel.md) |

**⚠️ Design fidelity — the mockups are the spec.** The built module UIs are **functional skeletons far below the design mockups** that capture the product vision: **[docs/mockups/](docs/mockups/)** (committed; the canonical visual spec — open the `.html` in a browser). Fidelity audit 2026-06-15: **M4 ~25%, M3 ~25%, M2 ~20%, M1 ~8%.** The gap was classified — and **~80% of it needs no new data:**
- **Design system** — one shared dark token + badge/chip/effect/track visual grammar, *identical across all 4 mockups*; building it once re-skins everything. (Currently mostly absent.)
- **Not-built but data exists** — M4 §0 track diagram (**DONE 2026-06-16 — vendored umalator track**), M4 left-panel planner cards (**DONE 2026-06-16 — CmPlan sidebar**), M4 sourcing table, **M2 results table + Compare-vs-Veteran** (`runPlannerCompare` exists), M3 grid-with-month-columns layout, M1 pedigree + goal-builder + compare-all. Buildable now.
- **Genuinely data-gated:** (1) skill effect-type/variants → **effect-chips DONE 2026-06-16** (effect/variant data baked into `skills.json`); duration → L-vs-distance graphs still open (M4/M2); (2) uma base aptitudes/stat growth → **DONE 2026-06-17** (`build-umas` bakes GameTora `aptitude` / `stat_bonus` into `umas.json`); innate skills + usable-here filters still open (M4/M1); (3) per-record release dates → Now/Upcoming/Future (M4); (4) banner + patch timeline entries → M3's empty lanes.

**Treat the mockup HTML as the spec; the design system is a first-class deliverable, not deferred** (the earlier "Slice 1 = functional minimum" scoping under-delivered on the visual vision). Recommended realignment: shared `design-system.css` → M4 to full mockup fidelity → the remaining high-value data tasks (skill duration/graphs, innate/release data) → M2/M3/M1.

**Shared foundation:** vendored umalator engine v0.14.2 (`src/sim/`, `pnpm sim:build`; `evalSkillDelta` / `runVacuumCompare` / `runPlannerCompare` + `SimClient` worker + L-cache; fidelity-verified vs upstream, meanBashin 0.2202), the canonical `CmPlan` SSOT ([`docs/superpowers/specs/2026-06-15-shared-data-model.md`](docs/superpowers/specs/2026-06-15-shared-data-model.md); Dexie **v3**), and pure mechanics in `src/core/`. All four module designs are locked (`docs/superpowers/specs/2026-06-14-m{1,2,3,4}-*.md`).

**Next (design-fidelity realignment — chosen direction 2026-06-15):** the built UIs are far below the mockups (see *Design fidelity* above). Recommended track: shared `design-system.css` (re-skins all 4) → M4 to full mockup fidelity → remaining data tasks (skill duration/graphs, innate/release data) → M2/M3/M1. The module-feature backlog still stands underneath: M1 Plans 3–5 ([module-1](docs/modules/module-1-inheritance.md)), M4 Slice 1b, M2 F1–F4, M3 phase-2.

**M4 rebuild — next up (2026-06-17):** `/` now has the CmPlan planner sidebar (compact stats, stat growth, base-aptitude pink-spark summary), vendored umalator §0 race-track, race-setup customizer, the engine-ranked **unique-skill chart** (`UmaChartPanel` + `rankUmaChart`/`useUmaChart` — VFalator-style sortable table, run-on-demand, per-style L dropdown that re-ranks with no re-sim; `REFERENCE_STATS` all-1200 fixed reference, plan-independent), and **skill effect-chips** (baked effect/variant data, `SkillDetailDisclosure`). Resume with: the **white/gold Skill chart** (vendor umalator's chart UI vs. reuse `/legacy` components — still open), **card-hint sourcing (§3)** + the uma **innate/release/usable-here columns** (base aptitudes/stat growth are already baked from `gametora/character-cards.json`), then **HP / velocity / skill-activation zones** on the track (needs the engine's per-frame run trace / `chartData`, not just `getSimCourse`). Specs/plans: [uma-chart](docs/superpowers/specs/2026-06-16-m4-uma-chart-design.md), [track](docs/superpowers/plans/2026-06-16-m4-slice-a-track.md), [sidebar](docs/superpowers/plans/2026-06-16-m4-planner-sidebar.md).

**Cross-cutting gotchas** (module-specific ones live in each module doc):
- `git worktree` dirs under `.claude/worktrees/` may fail to auto-remove on Windows (node_modules lock) — git de-registers them but delete the folder by hand.
- **`src/app/App.tsx` is the merge-collision point** when two module branches each add a nav route — resolve by keeping *both* NavLinks/Routes and trimming `STUB_MODULES` (only `Inheritance` remains a stub now).
- **The sim engine throws `firstPositionInLateRace` on a 0-speed runner** — never feed `evalSkillDelta` an all-zero build; `makeDefaultPlan` seeds non-zero stats and the M4 chart guards `spd > 0`.
- The pre-engine M4 coverage UI (old `SkillPlannerPage` + `src/features/coverage/` + `src/features/inventory/` + the `iconRetrofit` integration test that only exercised them) was **removed 2026-06-15** once the engine chart replaced it — recover the coverage-matrix/inventory pattern from git history if Slice 1b needs it. `PlanHeaderPanel`/`SkillPicker` stayed (shared by the new page).
- **Don't put the global `.page` class on a full-width *stacked* page** — at wider widths `.page` becomes a **2-column grid** (legacy coverage layout, `src/styles/app.css`), which lays children out side-by-side. The M4 rebuild page uses its own `.cmp-page` (flex column). (This bit us: the track + race-setup rendered side-by-side.)
- **The vendored bundle's `coursesService` exposes `getAll()` / `getAllEntries()` / `getByTrackId()` at runtime** even though the `.d.mts` originally only typed `getSimCourse` — widen the `.d.mts` and call them (no `pnpm sim:build` rebuild needed). `src/sim/courseCatalog.ts` enumerates all 107 courses / 11 tracks (incl. Ooi) from these for the custom-track picker.
- **Keep the engine lazy** — reach engine-backed data via lazy `import('@/sim/courseData')` / `import('@/sim/courseCatalog')`, **not** the `@/sim` barrel (the barrel's `run`/`adapter` pull the ~5 MB engine bundle synchronously into the importing chunk). Verified: those stay tiny separate chunks.
- **Vendored umalator racetrack layers carry `// @ts-nocheck`** (3 files under `src/features/planner/racetrack/vendor/layers/`) — verbatim third-party SVG that trips our strict `noUncheckedIndexedAccess`; the pragma is scoped to those files only.
- **Hand-rolled M4 §0 track retired (2026-06-16)** — `src/core/track.ts`, `src/sim/courseGeometry.ts`, and `TrackDiagramPanel` were deleted and replaced by the vendored umalator track (`src/features/planner/racetrack/`).

Key files:
- [docs/modules/](docs/modules/) — **per-module living docs (read first for any module).**
- [uma-cm-planner-plan.md](uma-cm-planner-plan.md) — the full project plan and single source of truth (Phase 0 checklist annotated with outcomes; §14 decisions annotated).
- [docs/provenance.md](docs/provenance.md) — engine vendor pin (umalator-global v0.14.2), licenses (clean GPL chain), all dataset sources/formats, UmaExtractor import spec, rental-site deep-link templates.
- [docs/mechanics-notes.md](docs/mechanics-notes.md) — verified mechanics numbers (cite these in core tests); §10 lists what still needs in-game verification.
- `spikes/` — scratch clones + research artifacts incl. a live Global master.mdb with extractions (`spikes/repos/umalator-global/db/`). **Gitignored.** Structured agent findings: `spikes/phase0-results.json` + `spikes/phase0-completion-results.json`.

Tooling note: git, Node 24, pnpm 10 (npm-global) present. Headless engine runs under plain Node need esbuild `define:{'import.meta.env':'{"DEV":false}','import.meta.main':'true'}` (see provenance §1.1). User exports with personal data live under `spikes/samples/` — gitignored, never commit.

The project: a local-first web app for Umamusume: Pretty Derby (Global) Champions Meeting build planning, with four modules — Skill Acquisition Planner (Module 4, build first), Inheritance Planner (Module 1), SP Purchase Optimizer (Module 2), and Meta Intel Workspace (Module 3).

## Commands

Stack: TypeScript + Vite + React 19, pnpm, Vitest (jsdom), Dexie. Path alias `@/*` → `src/*`.

```sh
pnpm dev          # dev server
pnpm test         # vitest run (single test: pnpm vitest run src/core/coverage.test.ts)
pnpm typecheck    # tsc --noEmit
pnpm build        # typecheck + vite build
pnpm data:build   # regenerate public/data/ from borrowed sources + data-overrides/ (tsx scripts/build-all.ts)
```

CI (`.github/workflows/ci.yml`): typecheck + test + build on every push/PR; GitHub Pages deploy from main (`BASE_PATH` env sets the Vite base).

**Remote access (Tailscale):** the dev server binds all interfaces on port 5177 and adds `TAILNET_HOST` (from the gitignored `.env.local`) to Vite's `allowedHosts`. **Whenever you start `pnpm dev`, also surface the tailnet URL `http://<TAILNET_HOST>:5177/`** (read the value from `.env.local`) so the user can open it from any device on their tailnet. It's tailnet-only, not public; true public exposure would be `tailscale funnel 5177` (don't enable without asking).

## Guiding Principles (standing rules — mirrored from plan §2, which is authoritative)

**P1. REUSE FIRST — always search before building.** The Umamusume community has 5+ years of tooling. Before implementing any mechanic, calculation, or dataset: (1) check the Resource Map in plan §3; (2) search the web for community tools beyond it; (3) prefer import as dependency > vendor/borrow data > port a known-good algorithm with attribution > build from scratch. When porting, record source URL + retrieval date in a code comment and in `docs/provenance.md`. **Keep the Resource Map alive:** any useful resource discovered in a session gets added to plan §3 with a "use for" note before the session ends.

**P2. Local-first, zero backend.** Static site; game data baked at build time; user data in IndexedDB; JSON export/import. No server-side anything.

**P3. Honest numbers.** Show real numbers where mechanics are calculable; show qualitative reliability tiers + evidence where they're RNG-dependent. Never fabricate precision. Simulations are estimations, not verdicts — surface caveats in the UI.

**P4. Server-versioned data.** Every skill/card/uma record carries `server: "global" | "jp"` and a `dataVersion`. JP-ahead content is preview-only, never silently mixed into Global calculations.

**P5. Hand-patchable data.** Every generated dataset has a sibling `*_overrides.json` merged last and maintained by hand. Never edit generated files (`public/data/`) directly.

**P6. Pure-function core.** All game-mechanics logic lives in `src/core/` as pure TypeScript functions with unit tests, validated against community references (plan §3). UI is a thin layer on top.

## Architecture (planned — plan §4–§5)

- `src/core/` — pure mechanics functions: `coverage.ts` (M4), `inheritance.ts` (M1), `spOptimizer.ts` (M2). 100% unit-tested; mechanics tests cite their source (URL/sheet + date).
- `src/sim/` — vendored umalator engine (jalbarrang/umalator-global, **GPL-3.0** — licensing decision in plan §4 applies to the whole repo) + Web Worker glue.
- `src/db/` — Dexie schema, export/import.
- `src/features/` — one folder per module's UI.
- `scripts/` — build-time data pipeline: fetch borrowed JSON from pinned umalator commits → normalize → merge `data-overrides/` → emit `public/data/` (git-tracked, generated).
- `CmPlan` is the cross-module single source of truth (race, targets, deck locks, parents); modules integrate through it (plan §10).

## Working Notes

- Mechanics numbers marked `VALIDATE`/`VERIFY` in plan §5 have conflicting community sources — reconcile against umamily.moe + Ice's sheet before encoding; record outcomes in `docs/mechanics-notes.md`.
- Validation targets: `sparkChance`/inheritance math must reproduce umamily.moe results; skill deltas spot-checked against VFalator (plan §12).
- Target skill lists are variable length (1–7 skills); never assume a fixed count — the priority field drives weighting, not list size.
- No scraping of community sites **by default** (GameTora ToS, ChronoGenesis blocks scrapers — email the operator instead, plan §7). **Private-use exception (owner-authorized, time-boxed, 2026-06-14):** importing from *permissive* feeds is OK **for the maintainer's private use** — uma.guide, Game8 upcoming table, SoulEC/Phoenix published Google-Sheets CSV — to seed data (M4 stat-target defaults, M3 timeline forecast). The **public build swaps these for `ManualStatTargets`/curated JSON before release.** **GameTora + ChronoGenesis stay off-limits / cite-and-deep-link only** regardless. Canonical statement: `docs/superpowers/specs/2026-06-15-shared-data-model.md` §8.
- Each phase must end in a usable artifact (plan §11); Module 4 steps 1–3 are the first milestone.
