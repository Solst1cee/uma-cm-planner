# M1.4 Inheritance card — wrap-up & PR handoff (2026-07-01)

Branch `feat/m1-4-inheritance-card` (rebased clean on `origin/main`, 49 commits), landing via PR. **1056 tests, typecheck + build green, `pnpm test` exits 0.**

## What shipped (the full M1.4 "Inheritance" card)

- **Parent 1 & 2 slots** (`InheritanceCard`/`ParentCardView`): lineage spark chips (blue/pink/**green-unique**/white; gold=own, grey=GP), rank badge, pedigree portraits, roster **#tag under the name**, selection → `CmPlan.parents.{a,b}`. Parent 2 has a **Rental** on/off toggle → M1.4b stub. `Find candidates` heuristic pre-rank.
- **UmaExtractor importer** (`UploadDataButton`/`useRoster`/`umaExtractor`/`factorDecode`): parses `data.json` → `Parent[]` → Dexie `parents`; shared `useSyncExternalStore` store; a **"?" `HeaderHelp`** next to Upload explains how to get `data.json` (links `github.com/xancia/UmaExtractor`).
- **Picker modal** (`UmaPickerModal`) with the **"Star Tracks" spark filter** (`SparkFilterCards`/`SparkMeter`/`SparkSummary`): STAT/APTITUDE/UNIQUE category cards, gold-legacy + total star meters bound to the ≤9★/≤3-member budget (`sparkBudget`), pink add-chips in in-game surface/distance/style rows, a **unique-skill search** (small box + **keyboard nav** ↑/↓/Enter/Esc, combobox a11y), and a sticky **summary bar** (match count · Reset · **upload button** · active chips). 2-column layout (fit-content filter + results).
- **Affinity compatibility marks** (`AffinityMark`, core `affinityTier` → ◎/○/△, grey): beside each picker uma's affinity number and beside the card header for the current Parent-1+2 selection.
- **Same-character parent guard**: the two parents can't be the same **character** (any outfit/copy), enforced by `charaId` in `itemsFor` (block/grey/tag) + Find-candidates. Tiles carry `selectedLabel` ("Parent 1/2" / "Same as Parent 2") + `unavailableReason` tooltip.
- **CI fix**: `useRoster.reload()` now try/catches missing IndexedDB (jsdom/private-mode) so the fire-and-forget `void reload()` can't emit an unhandled rejection.

Specs: `docs/superpowers/specs/2026-06-26-m1-4-*`; handoff `docs/handoff/design_handoff_spark_filter/`.

## Deferred (M1.4b / M1.7) — not bugs

- **Parent-2 rental builder + generated search-link** (toggle is a stub today).
- **Green-spark 9xxxxx reconciliation + saddle→G1 `wonRaces`** for coverage/affinity math (M1.7). Green sparks currently store the decoded 100xxx/110xxx unique id (name-display only).

## Known-minor (intentionally not fixed)

- **`.spc-sum-chip.spark-green` summary chip border** still picks up the dark `#166534` from the global `parents.css .spark-green` bleed. Left as-is (chips are meant to look coloured); the *card* borders were neutralized. Scope with `.spc-sum-chip.spark-*` if it bothers.
- **White-skill chips list self + grandparent copies separately** (same pattern the green dedup addressed and then reverted — faithful to in-game). Not merged by skill id in the display, unlike `sparkAggregate`.
- Accel/affinity `☆`-in-name only handled in the lineage chips; the green **filter** rows/search also show the trailing `☆` (faithful) — extend the space-before-star treatment there if desired.

## Resume here (next)

- **M1.6 support-card pool** (`feat/m1-6-support-card-pool`, local-only WIP): pool + Rarity/Type/Skill/Stats filters + Icon/Art/Plot views + Add/drag into the M1.5 deck (`addCardToDeck` seam already built).
- **M1.7 coverage matrix**: `Innate ‖ Parent | G.parent ‖ Chain | Random`, inherit %, uncovered stripe; reads M1.0 affinity + .4 parents + .5 deck + .6 pool. Do the green 9xxxxx + `wonRaces` reconciliation here.
- **M1.4b rental** builder + search-link.
