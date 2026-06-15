# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current State

**Phases 0–2 DONE: Module 4 (Skill Acquisition Planner) is complete** (2026-06-13), now with an **image-based UI** (GameTora-style). Plan header + inventory + coverage matrix with parent **spark columns**, **deck suggester**, and static **contingency view**; `/parents` CRUD; card/skill/uma **icons** throughout. Data: 578 skills / 220 cards / 84 umas / spark_rates + **360 curated WebP icons** (`public/data/icons/`, see plan §4 + provenance §2.1; `iconId` on SkillRecord; resolver `src/core/icons.ts` + `<GameIcon>`). 275 tests. Phase 3 next: Module 1 (Inheritance Planner) — UmaExtractor roster import (sample ready at `spikes/samples/`), residual-spec builder, pairwise own×borrow compare, computed affinity (algorithm verified in `docs/mechanics-notes.md` §3). Key files:
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
