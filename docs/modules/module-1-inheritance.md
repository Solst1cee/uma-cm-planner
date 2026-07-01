# Module 1 — Inheritance Planner

> Brief module doc. Expand into a detailed living doc (like [M4's](module-4-skill-acquisition.md)) when M1 build work starts.

- **Route:** `/inheritance` — the workbench is live (un-stubbed in M1.1). The M1.4 **Inheritance card** (parents + importer + picker) is built and being landed via PR.
- **Status:** foundation (Plans 1–2) + M1.0 affinity core + workbench M1.1–M1.5 on main; **M1.4 Inheritance card finished on `feat/m1-4-inheritance-card` (this PR).** Next: M1.6 support-card pool, M1.7 coverage matrix (+ green 9xxxxx / saddle→G1 reconciliation).
- **Spec:** [docs/superpowers/specs/2026-06-14-m1-inheritance-design.md](../superpowers/specs/2026-06-14-m1-inheritance-design.md) (design locked) + canonical [shared-data-model](../superpowers/specs/2026-06-15-shared-data-model.md).
- **⚠️ Mockup = the visual spec:** [docs/mockups/m1-inheritance.html](../mockups/m1-inheritance.html) (committed — open in a browser). **Current fidelity ~8%** — only a parents CRUD form exists; the pedigree tree, goal builder, roster filter, and compare-all are unbuilt. Affinity core *is* done ([src/core/affinity.ts](../../src/core/affinity.ts)); most remaining work is UI, buildable now. See CLAUDE.md → *Design fidelity*.

## Purpose

Pedigree-aware parent/grandparent hunting: given a plan's wishlist (skills to inherit) + stat-threshold spark goals, find the best own/borrowed parent pairs. Uses computed affinity + the sim.

## Shipped (Plans 1–2)

- **CmPlan reconciliation** — `CmPlan` migrated to the canonical SSOT (`race`→`cmRef`, `targetSkills`→`wishlist`, `requiredAptitudes`→`sparkGoals.pink`, `chosenParents`→`parents.{a,b}`); db **v2**; export **v2**. `src/core/cost.ts` extracted (Fast Learner → additive). Plan: [2026-06-15-cmplan-reconciliation.md](../superpowers/plans/2026-06-15-cmplan-reconciliation.md).
- **Affinity core** — [src/core/affinity.ts](../../src/core/affinity.ts) (clean-room `aff2`/`aff3`/member-scores/△○◎ tiers from `succession_relation`) + generated `public/data/affinity.json`. **Static only** (dynamic +3 / shared-G1-win deferred — the planner has no race history). Plan: [2026-06-15-affinity-core.md](../superpowers/plans/2026-06-15-affinity-core.md).

## M1.0 affinity core (2026-06-25)

Four pure additions landed on `feat/m1.0-affinity-core` (merged to main 2026-06-25):

- **`src/core/winBonus.ts`** — 2.0 G1-only win-bonus (+3 per shared G1 win, capped); `sharedG1` helper + `computeWinBonus`.
- **`src/core/lineageAffinity.ts`** — adapter that assembles a `Lineage` from a `CmPlan` (reads `Parent.wonRaces`, grandparents) and calls `affinity.ts` to produce the full `LineageAffinity` including `memberScores`.
- **`src/core/spark.ts`** — per-member `memberAffinity` resolver passed into `sparkChance` opts; de-approximates the earlier per-parent average with the exact per-member value.
- **Rental target-tier helper** — `tierThreshold` / `affinityNeededForTier` in `src/core/affinity.ts`: given a target tier (△/○/◎), returns the affinity score needed and how far a plan is from it.

The 2.0 affinity model is **logic-complete**. It is **data-gated** on two follow-ons: (1) the UmaExtractor `wonRaces` import so real win-history flows in, and (2) the S1 base-relation refresh (engine v0.18.0) which updates the underlying `succession_relation` data. Until those land, the win-bonus and per-member scores are computed correctly but default to zero won-races.

Validated: `winBonus` synthetic fixtures, `spark.ts` de-approx, rental-tier thresholds. See [docs/mechanics-notes.md](../mechanics-notes.md) §3 for the locked affinity numbers; spec/plan: [2026-06-25 M1.0 spec](../superpowers/specs/) (dated 2026-06-25).

## M1.5 "Your deck" card (2026-06-26)

The center-column **"Deck"** panel landed: a 6-slot support-card deck with
drag-drop (HTML5 DnD `text/card-id`), per-slot limit-break diamond steppers, and
remove/clear. State is a dedicated `DeckState` (NOT `CmPlan.lockedDeckSlots` —
that is M4's suggester concept). **All deck state is browser-local and
plan-independent** (the deck workspace is not tied to the uma plan): working deck
`scb_deck`, active template name `scb_deck_active`, templates `scb_profiles`.
**Templates use an autosave combobox** (no Save/Load buttons): the name field
names the active template and, via a caret dropdown, loads a saved template or
starts **"New"** (keep cards, blank name); editing the deck **live-autosaves into
the active template**. First load seeds a **"Default"** template (else selects the
last-edited); **"New" survives reloads** (a stored `''` is distinguished from
never-chosen via the hook's `stored` flag). Robustness rules: typing an *existing*
template name **switches to it** (never overwrites); clearing the name field is a
**no-op** (only the dropdown's New unnames); switching away from a non-empty
unnamed deck **preserves it as `Untitled`**; **Del** loads the next remaining
template (or blanks like Clear). Files: `deckOps.ts` (pure; incl. `isDeckEmpty`),
`useDeckState.ts` (persistence — `useDeckState` / `useDeckTemplates` /
`useActiveTemplateName`, all global), `YourDeckCard.tsx` (provider-free panel;
CM-planner card-head grammar + `minmax(360px,26rem)` sidebars / 720px center). The
fill seam `addCardToDeck(cardId)` + the drop target are built and tested; the
interactive drag *source* / "+ Add" button arrive with **M1.6** (support-card
pool). Spec/plan: 2026-06-26-m1-5-your-deck-card.

## M1.6 "Support cards" panel (2026-06-26)

The center-column **"Support cards"** pool panel landed (replaces the old M1.6 placeholder), with three views, filter + sort controls, euophrys training-power scoring, and drag/add wiring into the M1.5 deck.

**Three views:**
- **Icon** — compact tiles; no-score cards show `—` for the Effect column.
- **Art** — taller cards with **Chain** (green) / **Random** (orange) event-skill chips.
- **Plot** — SVG scatter: X = wishlist matches, Y = euophrys Effect score; cards without a euophrys row are omitted and footnoted.

**Filters:** Rarity / Type (7 `CardType` values) / Skill (wishlist chips) / free-text search. **Sort:** Matches · Effect (hidden in Plot view).

**euophrys training-power score (vendored, MIT):** `src/vendor/uma-tiers/` holds four files from euophrys' [uma-tiers](https://github.com/euophrys/uma-tiers) project — `tierlist-calc.js`, `gl.js` (1130 rows = 226 card ids × 5 LBs), `card-events.js`, `scenarios.js` — joined to our cards by `cardId` ≡ euophrys numeric id. Scoring is **per training type**: a card is scored under its own type's weights as the marginal add to the current deck. Default scenario = `getDefaultScenario('gl')` = **MANT + bondPerDay:10**. Provenance recorded in `docs/provenance.md`.

**Honesty (P3):** Effect is captioned "training power · URA scenario · via euophrys". Cards without a euophrys row show `—` (Icon/Art) or are omitted (Plot). **Matches** is the primary plan-relevant axis.

**Score Weights panel (`ScoreWeightsPanel`):** mirrors euophrys' Weights panel 1:1 — 6 type tabs, gated customize section, uma bonuses. Weights persisted to `localStorage` key `scb_score_weights`.

**Drag/Add:** tiles are draggable (`text/card-id`) + have a `+ Add` button → fills the next deck slot at the tile's LB (completes the M1.5 deck input side).

**Key files:**
- `src/core/cardScore.ts` — per-type scoring wrapper + `DEFAULT_SCENARIO` / `scoreCards` / `resolveDeckObjects` / `cardRowsByKey`
- `src/core/cardMatches.ts` — `matchedSkillIds` / `matchCount`
- `src/features/inheritance/useScoreWeights.ts` — browser-local weights hook (`scb_score_weights`)
- `src/features/inheritance/weightsPanelModel.ts` — pure weights-panel helpers
- `src/features/inheritance/poolModel.ts` — `PoolItem` / `PoolFilters` / `PoolSort` view-model + filter/sort logic
- `src/features/inheritance/ScoreWeightsPanel.tsx` — editable weights panel
- `src/features/inheritance/SupportCardPoolCard.tsx` — pool panel (Icon/Art/Plot views + filters)

Provider-free panels: the page injects game data, `renderIcon`, and `skillName` as props. **967 tests** (full suite green; build green).

**Known gap:** the mockup's **Stats filter row + per-tile stat-line are NOT built** — `PoolItem` carries no per-LB stat-line values yet (tb/mb/fs_bonus/specialty_rate/race_bonus/hint_rate from euophrys). This is the one §5 element deferred; a follow-up must thread those values from the vendored data onto `PoolItem`.

### M1.6 additions — card effects, deck conflict rules, detail-card polish (2026-07-01)

A second M1.6 pass (merged with main's M1.4). **1119 tests**, typecheck + build green.

- **Card Unique Effects** (`public/data/card_unique_effects.json`) — from master.mdb `support_card_unique_effect` × `text_data` enum; 21 hand-written conditional (type≥101) lines in `data-overrides/unique_effect_text_overrides.json`. Build: `scripts/build-card-unique-effects.ts` (+ localOnly input `scripts/borrowed/support-card-unique-effects.json`).
- **Full base-effect list** (`public/data/card_effects.json`) — all always-on effects, LB-aware, from GameTora's effect matrix (`scripts/build-card-effects.ts`; `CAP_INDEX_BY_RARITY`, drops inactive/all-zero). Both datasets lazy-fetched in `InheritancePage` and rendered in the detail card. Provenance §6b.
- **Detail card redesign** (`CardDetailCard`): single column — centered full-width art (soft `--ds-card-shadow`, click → full viewer), a centered meta row (stat icon + rarity above the LB stepper), **Unique Effect above the base Effects** (shared muted styling, uniform `0.28rem` rhythm), **Estimated Effect Value** under the list, wishlist count on the skill section's first line, thin separators.
- **Deck vs. trainee conflict rules** (`deckConflicts.ts`, pure + tested): can't use a support card of the **trainee's own character** (greyed + centered "Trainee" badge, add blocked); **one card per character** (siblings blocked; template dupes greyed "Dup"). Matched by character **name** (`uma.nameEn` ≡ card `charName`, verified across the roster). Enforced in picker tiles, the detail Add button, deck slots, and a guarded `addToDeck`. Clicking a filled deck slot's icon opens its detail (`onSelect`).
- **Skill filter** drops `unique`/`inherited_unique` skills (not card-obtainable). **Scoring weights** card moved inside the Support cards panel (below search, above grid; `weightsSlot`), smaller head, "?" `HeaderHelp` popup, **default-collapsed**. Removed the "N shown" header count.

**Gotchas (this pass):**
- **Match trainee/deck conflicts by character name** — support cards have `charName` but no `charaId`; every uma's `nameEn` equals its card `charName` (whole Global roster), so name-matching is exact. Don't reach for a charaId that isn't on `SupportCardRecord`.
- **`addToDeck` allows the add when the card can't be resolved** (`cardById` miss) rather than early-returning — the pool renders from `items`/`cards`, and a test mock left `cardById` empty; a hard `if (!card) return` silently dropped every add.
- **Don't commit `scripts/borrowed/gametora/`** (network-fetched `support-cards.json`/`support-effects.json`); a `scripts/borrowed/.gitignore` now ignores it. Only localOnly borrowed inputs are tracked.

## M1.4 "Inheritance" card + UmaExtractor importer + spark-filter picker (2026-06-27)

The center-column **"Inheritance"** card: owned **Parent 1 & 2** slots
(`InheritanceCard`/`ParentCardView`), each showing the full lineage's sparks as
colour-coded chips — blue (stat) · pink (aptitude) · **green (inherited-unique)** ·
white (skill) — with **gold legacy / dark grandparent** stars. Selection persists to
`CmPlan.parents.{a,b}`. Parent 2 has an Owned/Rental toggle (Rental → M1.4b stub);
`Find candidates` is a heuristic pre-rank (`candidateScore`).

**UmaExtractor importer** (`UploadDataButton`/`useRoster`/`umaExtractor`/`factorDecode`):
"Upload data" parses a UmaExtractor `data.json` → `Parent[]` (factor decode → blue/
pink/green/white sparks, grandparents from succession positions 10/20, `wonRaces`,
`rankScore`), `bulkUpsertParents` into the Dexie `parents` store. `useRoster` is a
shared store (`useSyncExternalStore`) so an import refreshes everywhere live. Green
sparks store the decoded base/alt unique id (100xxx/110xxx) for name display; the
9xxxxx reconciliation for coverage math is M1.7. Privacy: the parser drops every
`*viewer_id`.

**Picker modal** (`UmaPickerModal`): the **Pick/Change** button opens a full-screen
modal — a **spark-filter search-builder** (`sparkAggregate`/`sparkFilter`: add-a-row
blue/pink/white legacy+total `≥` clauses + any-blue) over the roster, a name search,
and one-veteran-per-row **2-column tiles**: a left rail (a **pedigree row** — uma
icon ─┤ the two grandparents stacked, rank badge + numeric score alongside — then
name · colour-coded **stat row** · **affinity**) + a wide right area holding all the
lineage spark chips. Affinity via `candidateAffinity` = lineage affinity + G1 win
bonus (`useAffinityIndex` loads `affinity.json`). Shared `LineageSparkChips` drives
the card + tile chips.
Spec/plan: 2026-06-26-m1-4-inheritance-card · 2026-06-26-m1-4-uma-picker-spark-filter.
**Deferred (M1.4b):** Parent-2 rental builder + search-link; green-spark 9xxxxx +
saddle→G1 `wonRaces` reconciliation (M1.7).

**Wishlist glow + evaluation-rank badges (2026-06-27, on PR #14 icon assets):**
- A white/green spark whose skill is on the active plan's **wishlist** now gets the
  planner's `.cmp-apt-card.is-current` **blue glow** (`.badge.is-wishlisted`), on both
  the Parent cards and the picker tiles. An `isWishlisted` predicate threads
  `InheritanceCard` → `ParentCardView`/`UmaPickerModal` → `LineageSparkChips`.
- The veteran's **rank rating now shows the real in-game evaluation-rank badge**
  (G…SS+, UG…US9, LG…LS24) instead of a `◆` glyph. New pure core
  [`src/core/rankScore.ts`](../../src/core/rankScore.ts) `rankLabelFromScore(score)` —
  the daftuyda/UmaTools `RATING_BADGE_MINIMA` thresholds (same source+version as the
  PR #14 rank-badge atlas; first-91 bands cross-checked against master.mdb
  `single_mode_rank`). The importer derives `Parent.rating` from `rank_score` (falls
  back to the `rank` id via `ratingFromRank`). `GameIcon` gained a **`rank`** kind
  (→ `rankIconPath`); a small wired `RankBadge` (**icon only** — the badge art
  already spells the rank; label rides along as `alt`/`title`) is built by the
  container and passed as a node to the provider-free card/picker. The picker
  tile shows the badge but **not** the numeric rank score (icon-only by request).

## M1.4 finalization — "Star Tracks" filter + affinity marks + parent guards (2026-07-01, this PR)

The picker's spark filter was **redesigned to "Star Tracks"** (from a claude.ai/design
handoff, `docs/handoff/design_handoff_spark_filter/`): three category cards **STAT
(blue) · APTITUDE (pink) · UNIQUE (green)** with a light tinted header + lineage-member
pips; each active factor row has **Parent (gold legacy) + Total star meters** (member
boxes shrink as the ≤9★/≤3-member budget is consumed — `SparkMeter`), add-chips
(pink laid out as the in-game surface/distance/style rows), and a **unique-skill search**
for green (smaller box + **keyboard nav** ↑/↓/Enter/Esc, combobox a11y). A sticky
**summary bar** (`SparkSummary`) shows the live match count, Reset-all, an **upload-data
button**, and active-filter chips. Two-column modal (filter column `fit-content` + results).
Files: `SparkFilterCards` / `SparkMeter` / `SparkSummary` (+ `sparkBudget`, `green` clause
in `sparkFilter`, `greens` in `sparkAggregate`).

- **Affinity compatibility marks** — `AffinityMark` renders the in-game **◎/○/△** symbol
  (core `affinityTier`; neutral grey) next to each picker uma's affinity number **and**
  beside the card header for the current Parent-1+2 selection (`charaIdOf` + `candidateAffinity`
  sum − the double-counted A↔B term). *(No ✕ — the documented bands start at △ 0–50; ✕ isn't real.)*
- **Same-character parent guard** — the two parents can't be the same **character** (any
  outfit/copy), so `itemsFor` blocks + greys + tags every veteran sharing the other slot's
  `charaId`, not just the exact roster row; Find-candidates filters the same. Tiles carry
  `selectedLabel` ("Parent 1/2" / "Same as Parent 2") + `unavailableReason` tooltip.
- **data.json import help** — a reusable `HeaderHelp` ("?") popup next to the Upload button
  explains getting `data.json` from **UmaExtractor** (links `github.com/xancia/UmaExtractor`).
- Smaller UI: roster **#tag under the uma name** on the parent cards; centered "No parent
  selected." empty state; green/white chips keep the faithful unique name (trailing ☆) with
  a space before the spark star; Star-Tracks CSS uses the `.badge.spark-*` colour scheme
  (`--chip`/`--chip-ink`), neutral card borders (fixes the `parents.css .spark-*` bleed).

## M1.7 "Obtainable vs. wishlist" coverage matrix (2026-07-01)

The right-column **"Obtainable vs. wishlist"** card (`CoverageMatrixCard`) landed with four new cores and a wired `InheritancePage` integration.

**Core additions:**
- **`src/core/greenSparkReconcile.ts`** — `buildUniqueToInheritedMap(skills)`: maps each native-unique id (100xxx / 110xxx, as decoded by the UmaExtractor importer) to its inherited-unique form (9xxxxx) by swapping the prefix (10→90 / 11→91) then falling back to a name-match; reports any `unresolved` ids that have no 9xxxxx counterpart. Derived purely from `skills.json` — no network call. `reconcileGreenSkillId(id, map)` applies it per-spark.
- **`src/core/g1Saddle.ts`** — `isG1Saddle(id, set)` / `filterG1(races, set)`: filter won-races to G1 only using a hand-patchable saddle-id set. The set is currently empty (safe — win-bonus stays 0, never fabricated) pending user-supplied data (see *Deferred* below).
- **`src/core/lineageAffinity.ts`** — now filters `wonRaces` to G1-only (optional `g1Set` param, passed through `planLineageAffinity`) before the win-bonus, fixing a prior over-count where all shared wins scored regardless of grade.
- **`src/core/coverageMatrix.ts`** — `buildCoverageMatrix(CoverageInput) → CoverageResult`: per-skill coverage rows with **real per-member inherit-% from `spark.ts` contributions** (isolated per parent/grandparent member), source classification (`Innate | Parent | G.parent | Hint | Chain | Random`), coverage bars, and a bonus list (skills obtainable but not on the wishlist). Column map: `hint_pool → Hint`, `chain → Chain`, `random_event + date_event → Random`.
- **`src/core/types.ts`** — added optional `UmaRecord.innateSkills?: string[]` (consumed by the Innate column; falls back to `uniqueSkillId` only until the data pipeline lands).

**UI:**
- **`src/features/inheritance/CoverageMatrixCard.tsx`** (+ `.inh-cov-*` CSS in `inheritance.css`) — provider-free card with a **Matrix / Coverage toggle** (the matrix shows per-source chips; the coverage view shows per-skill coverage bars) and a **bonus list** section. Cells cap at 2 chips + "+N more".
- **`src/features/inheritance/InheritancePage.tsx`** wires it: resolves parents from `useRoster`, builds the `greenMap` via `buildUniqueToInheritedMap`, a `memberAffinity` resolver from `planLineageAffinity(…).memberScores`, `deckCards`, and `umaNameById`, calls `buildCoverageMatrix`, and replaces the M1.7 placeholder.
- **`src/features/inheritance/useG1SaddleSet.ts`** — hook that loads `g1_saddle_ids.json` (lazy fetch from the in-`src` copy) and returns a `Set<number>`; returns `new Set()` on empty/missing data.
- **`src/features/inheritance/g1_saddle_ids.json`** (in-`src` copy, currently `[]`) + **`data-overrides/g1_saddle_ids.json`** (P5 hand-patch source, also currently `[]`).

**Test suite:** 1154 tests pass (156 files), typecheck + build green.

**Deferred (data-gated — pending user-supplied data; card degrades gracefully without them):**
- **Task 8 — per-uma `innateSkills` pipeline:** the `Innate` column currently falls back to the plan's `uniqueSkillId` only (no innate-white skills). To fully populate it, `scripts/build-umas.ts` needs to be extended to read `scripts/borrowed/gametora/` innate-skill sources and bake them into `umas.json`. Until the source files are dropped in and `pnpm data:build` run, the column is a one-skill fallback — never fabricated.
- **Task 9 — populate `data-overrides/g1_saddle_ids.json`:** the G1 saddle-id set is currently empty; the win-bonus always computes as 0. To enable real win-bonus scoring, update **both** `data-overrides/g1_saddle_ids.json` AND `src/features/inheritance/g1_saddle_ids.json` with the real G1 saddle ids. (Both files must be kept in sync — see gotcha below.)

**Gotchas:**
- **~17 native uniques unresolved by `greenSparkReconcile`:** 5-digit legacy ids (e.g. `10071` "Warning Shot!") have no 9xxxxx form in `skills.json`. Correctly reported via `unresolved`, harmless — the UmaExtractor importer only produces 6-digit 100xxx/110xxx green sparks, so these never appear in practice. A `skills.json` 5-digit → 6-digit unique-id reconciliation (likely the v0.18 engine refresh) would close it.
- **`g1_saddle_ids.json` exists in TWO places** — `data-overrides/g1_saddle_ids.json` (P5 hand-patch source) and `src/features/inheritance/g1_saddle_ids.json` (in-`src` copy served at runtime). Keep them in sync; the build script does NOT auto-copy them.
- **`useG1SaddleSet` returns `new Set()` per call** → `coverageResult` recomputes every render (trivial hoist-to-const fix pending; low impact given the small set size).

## Next (Plans 3–5)

3. **Nested `Parent` + roster store migration** — flat→nested `Parent`/`ParentSparks`, `parents` Dexie store → `roster` (`RosterEntry`). **Carries the open grandparent-sourcing design decision** (a parent's grandparents come from the parent-veteran's own parents, not an inline form).
4. **Roster import + residual spark-goal search-builder + pairwise compare** (uses the affinity core + `runVacuumCompare`).
5. **M1 UI** — pedigree view, search-builder, compare-all, roster filter.

## Gotchas

- `relation_point` values are **1/2/7** (not uniformly 2) — affinity sums the real per-type point.
- `scripts/borrowed/relation*.json` are committed (deviation from the fetch-only borrowed pattern) because `spikes/` is gitignored/absent in worktrees.
- The flat→nested `Parent` rewrite is M1 Plan 3's job (Plan 1 deliberately kept `Parent` flat).
- **M1.5 deck state is browser-local, NOT per-plan** (and NOT `CmPlan.lockedDeckSlots`): `scb_deck` / `scb_deck_active` / `scb_profiles`. Don't re-introduce a `planId` to `useDeckState`/`useActiveTemplateName` — it caused cross-plan template divergence (the per-plan deck and the shared global template drift apart; fixed by going fully global).
- **The global `input[type='text']` rule (`app.css`: `padding: 0.5rem`, `border: 1px solid var(--border)`) out-specifies a single-class selector** like `.inh-deck-tplname` (element+attribute `(0,1,1)` beats one class `(0,1,0)`). To restyle an input's padding/border in feature CSS, scope it (e.g. `.inh-deck-combo .inh-deck-tplname`) so it wins — otherwise your padding/transparent-border silently does nothing (this bit the M1.5 name field's height and a "transparent" border that never applied). `align-items: stretch` to "equalize" heights grows the *taller* sibling — match the box model instead.
- Any new InheritancePage consumer of `useGameData()` must mock it in **both** `InheritancePage.test.tsx` and the route smoke test `src/app/App.inheritance.test.tsx` (the latter renders the real page with no `GameDataProvider`).
- **euophrys scoring internals (M1.6):** `weights` is a FLAT merge `{ ...scenario[typeKey], ...scenario.general }` — do NOT pass the nested scenario object directly. `selectedCards` (the deck-context arg) are card **objects** not ids. Scoring is **per training type** (a card is scored under its own type's weights, not globally). The four vendored files (`gl.js` / `tierlist-calc.js` / `card-events.js` / `scenarios.js`) are euophrys' data to maintain — re-pull them from [uma-tiers](https://github.com/euophrys/uma-tiers) on euophrys' Global updates (don't maintain them ourselves).
- **M1.6 known gap — Stats filter / per-tile stat-line not built.** `PoolItem` has no per-LB stats (tb/mb/fs_bonus etc.) yet; the mockup's Stats filter row + stat-line inside each tile are the one §5 element deferred. Thread the euophrys per-LB stats onto `PoolItem` in a follow-up before adding the Stats filter.
- **`useRoster` reads Dexie on mount** (`subscribe` → `void reload()`). It now swallows a missing-IndexedDB error (jsdom / private mode) → empty roster. Before that guard, any page-level test rendering the roster-backed `InheritanceCard` produced an **unhandled rejection** that made `pnpm test` exit non-zero even though all tests passed. Don't remove the try/catch in `reload()`.
- **Unique/inherited-unique skill names carry a trailing `☆`/`★` level marker in the data** (e.g. `OMG! (ﾟ∀ﾟ)  The Final Sprint! ☆`). It is part of the name (keep it faithful) — put a space before the spark-star glyph rather than stripping it, or it reads as a second star.
- **Same-parent restriction is by `charaId` (character), not roster id** — any outfit/copy of the same character counts. `charaIdOf(umaId) = floor(umaId/100)` groups outfits. Self-vs-trainee is allowed; only the two *parents* must differ.
- **`parents.css` has unscoped global `.spark-{blue,pink,green}` chip rules with dark borders** (`#166534` etc.) that bleed into any same-named element via equal-specificity later-wins (bit `.spc-card.spark-green`). Scope filter-card overrides with the compound `.spc-card.spark-*` (0,2,0) to win. This is the M1-flavour of the app.css single-class-specificity gotcha.
