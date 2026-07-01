# M1.7 coverage matrix — wrap-up & handoff (2026-07-02)

Branch `feat/m1-7-coverage-matrix` (worktree `.claude/worktrees/feat+m1-7-coverage-matrix`), **19 commits ahead of `origin/main`**. **1163 tests pass, typecheck + build green.** Built subagent-driven from the [design](../specs/2026-07-01-m1-7-coverage-matrix-design.md) / [plan](2026-07-01-m1-7-coverage-matrix.md), then iterated heavily on live review. **NOT yet merged** — the user is reviewing live (dev server on port 5178) and choosing the integration path.

## What shipped

The center-column **"Obtainable vs. wishlist"** coverage card on `/inheritance`. Crosses each wishlist skill × where it's obtainable: `Innate ‖ Parent | G.parent ‖ Hint | Chain | Random`, with real per-member inherit-%, a Matrix/Coverage toggle, and a bonus list. Cores: `greenSparkReconcile.ts`, `g1Saddle.ts`, `coverageMatrix.ts`; `lineageAffinity.ts` gained the G1 filter. UI: `CoverageMatrixCard.tsx`. Full detail: [module-1 §M1.7](../../modules/module-1-inheritance.md).

**Live-review outcomes (all landed):**
- **Innate = the uma's non-unique kit (white+gold), resolved from the vendored engine bundle** (`loadInnateSkillsByUmaId` reads each skill's `sources[].outfitId`). This **obviated the originally-planned "Task 8" gametora innate pipeline** — the data was already committed. Excludes unique + inherited-unique.
- **Variant-family matching `○ ≡ ◎`** (interchangeable) across every column + the bonus filter; **gold / `×` stay exact-match**. Parent/gp inherit-% priced off the member's *held* spark.
- Deck chips render the real **support-card icon** (no stat-type tile).
- Parent green sparks reconciled before pricing (no fake `~0%`); gp green shows no `%` (unpriced, honest).

## Added 2026-07-02 (post-wrap): career training-event `Event` column

A 7th obtainability source landed after the initial wrap — a **career training-event** column right of Innate (`planUma.eventSkills`; Taiki → Head-On/All I've Got). Data: `public/data/uma_events.json` (`{ umaId: skillId[] }`) built by `scripts/build-uma-events.ts` inverting daftuyda `skills_all.json` `char_e`. **Provenance path B** — GameTora-derived, owner-authorized **private-use** relaxation (input localOnly/gitignored, `uma_events.json` **swap before public**; docs/provenance.md §10). Not in `pnpm data:build` (run `pnpm tsx scripts/build-uma-events.ts`). **1177 tests.**

## Resume here (next session)

1. **Integration is unfinished.** The user was choosing Push+PR / merge / keep when we wrapped. Use `superpowers:finishing-a-development-branch`. `origin/main` had moved past this branch's base — **rebase onto latest `origin/main` first**. (At wrap time local `origin/main` ref was `dbe6543`; re-fetch.)
2. **M1.8 — "Target spark" card** is the next M1 card (panel 7 of the handoff): the right-rail blue/pink/white-uncovered sparks a parent/rental must still supply + a generated search link. It reads M1.7's `CoverageResult` (uncovered skills → the white section).

## The one remaining data gate (not a bug — degrades safely)

- **Populate the G1 saddle-id set.** `data-overrides/g1_saddle_ids.json` and `src/features/inheritance/g1_saddle_ids.json` are both `{ "g1SaddleIds": [] }`, so the affinity **win-bonus is 0** everywhere (safe under-count, never fabricated). To enable it: get the G1 race saddle ids from `master.mdb` (the `win_saddle_id_array` id-space; ~24 G1 races) and put them in **both** files (they must stay in sync — `data-overrides/` is outside tsconfig `include`, so the runtime imports the in-`src` copy). A `lineageAffinity` fixture test with real ids would lock it end-to-end.

## Known-but-unfixed (all minor, intentionally deferred)

- **Grandparent green sparks are unpriced** (show a chip with no `%`) — gp green career math is deferred per mechanics-notes §10. Honest "unpriced", not a wrong number.
- **~17 native uniques stay `unresolved`** in `greenSparkReconcile` — 5-digit legacy ids (`10071` "Warning Shot!", …) with no 9xxxxx form in `skills.json`. Harmless (the importer only emits 6-digit green sparks). A `skills.json` id reconciliation (likely the v0.18 engine refresh, see [engine-update-todo](../../engine-update-todo.md)) closes it.
- **`UmaRecord.innateSkills` field is now effectively unused** — innate resolves at runtime from the bundle instead. The `build-umas` code to bake it was never needed and was not added; leave the optional field (harmless, and a baked override still takes precedence if ever populated).

## Gotchas learned this session (also in module-1 + CLAUDE.md)

- **Innate must filter by OUR `skillById` rarity, not the bundle's rarity int** — the bundle marks a 9xxxxx inherited-unique as rarity `1`, so filtering on it would wrongly include inherited-uniques. Keep white/gold via `skillById`.
- **Don't re-add the unique to Innate, and don't make gold cover the whites** — both were tried this session and reverted on user feedback. Innate = non-unique kit; `○ ≡ ◎` only, gold separate.
- **Parent/gp columns price `sparkChance` with the member's *held* spark id** (`coveringId(...)`), not the wishlisted id — else a family-matched `○`→`◎` prices as `0%`.
- **Probing the vendored bundle in a script needs the worktree cwd / absolute import path.**

## Housekeeping for whoever finishes the branch

- A gitignored **`.env.local` was copied into the worktree** (for the Tailscale dev host) — safe, not tracked; ignore or delete.
- A **dev server may still be running on port 5178** (5177 was taken by another workspace).
