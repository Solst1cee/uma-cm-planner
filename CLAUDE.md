# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current State

**M4 (Skill Acquisition Planner) shipped** (2026-06-13, image-based UI: plan header + inventory + coverage matrix w/ parent spark columns + deck suggester + contingency; `/parents` CRUD; 360 curated WebP icons). **Engine-first foundation + M1 groundwork merged 2026-06-15:**
- **Engine vendored → `src/sim/`** — umalator v0.14.2 as a built ESM bundle (`pnpm sim:build`) + pure adapter + `evalSkillDelta` / `runVacuumCompare` / `runPlannerCompare` + Web-Worker `SimClient` + L-cache. Deterministic; fidelity-verified vs upstream (meanBashin 0.2202).
- **Plan 1 — CmPlan reconciliation** — `CmPlan` migrated to the canonical SSOT (`docs/superpowers/specs/2026-06-15-shared-data-model.md`): `race`→`cmRef`, `targetSkills`→`wishlist`, `requiredAptitudes`→`sparkGoals.pink`, `chosenParents`→`parents.{a,b}`, `scenario`→`scenarioId`; db **v2**; export **v2**. **`src/core/cost.ts`** extracted with **Fast Learner fixed to ADDITIVE** (`mechanics-notes §7/§10`). Flat `Parent` kept (M1 owns the nested rewrite).
- **Plan 2 — Affinity core** — `src/core/affinity.ts` (clean-room `aff2`/`aff3`/member-scores/△○◎ tiers from `succession_relation`) + generated `public/data/affinity.json`. **Static** affinity only (dynamic +3/shared-G1-win deferred — planner has no race history).
- **313 tests**, typecheck + build green; all of the above on `main`.

**Next: Module 1 (Inheritance Planner), Plans 3–5** — see the roadmap memory + `docs/superpowers/plans/`: (3) nested `Parent` + roster (`RosterEntry`) store migration — **carries the grandparent-sourcing design decision**; (4) roster import + residual search-builder + pairwise compare (uses the affinity core + sim); (5) M1 UI (pedigree, search, compare-all). M2/M3 follow. All four module designs are locked (`docs/superpowers/specs/2026-06-14-m{1,2,3,4}-*.md`).

**Gotchas (this session):** `git worktree` dirs under `.claude/worktrees/` may fail to auto-remove on Windows (node_modules lock) — git de-registers them but delete the folder by hand; a stray `feat+shared-types-reconciliation` dir lingers from this session, and a `feat+m2-sp-optimizer` worktree exists from another session. `relation_point` values are **1/2/7** (not uniformly 2) — affinity sums the real per-type point. `scripts/borrowed/relation*.json` are committed (deviation from the fetch-only borrowed pattern) because `spikes/` is gitignored/absent in worktrees.

Key files:
- [uma-cm-planner-plan.md](uma-cm-planner-plan.md) — the full project plan and single source of truth (Phase 0 checklist annotated with outcomes; §14 decisions annotated).
- [docs/provenance.md](docs/provenance.md) — engine vendor pin (umalator-global v0.14.2), licenses (clean GPL chain), all dataset sources/formats, UmaExtractor import spec, rental-site deep-link templates.
- [docs/mechanics-notes.md](docs/mechanics-notes.md) — verified mechanics numbers (cite these in core tests); §10 lists what still needs in-game verification.
- `spikes/` — scratch clones + research artifacts incl. a live Global master.mdb with extractions (`spikes/repos/umalator-global/db/`). **Gitignore this dir when scaffolding.** Structured agent findings: `spikes/phase0-results.json` + `spikes/phase0-completion-results.json`.

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
