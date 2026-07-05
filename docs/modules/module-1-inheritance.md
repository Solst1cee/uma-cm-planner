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
`CmPlan.parents.{a,b}`. Parent 2 has an Owned/**Draft**/**Rental** 3-mode slot
(Draft/Rental shipped in M1.4b, below); `Find candidates` is a heuristic
pre-rank (`candidateScore`).

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
**Was deferred here, now shipped:** Parent-2 rental builder + search-link — see
*M1.4b* below. Green-spark 9xxxxx + saddle→G1 `wonRaces` reconciliation shipped
with M1.7.

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
handoff, `docs/handoff/design_handoff_spark_filter/`): four category cards **STAT
(blue) · APTITUDE (pink) · UNIQUE (green) · SKILL (white)** with a light tinted header +
lineage-member pips; each active factor row has **Parent (gold legacy) + Total star meters**
(member boxes shrink as the ≤9★/≤3-member budget is consumed — `SparkMeter`), add-chips
(pink laid out as the in-game surface/distance/style rows), and a **keyboard-navigable skill
search** (↑/↓/Enter/Esc, combobox a11y) for the green (unique) + white (skill) cards. A sticky
**summary bar** (`SparkSummary`) shows the live match count, Reset-all, an **upload-data
button**, and active-filter chips. Two-column modal (filter column `fit-content` + results).
Files: `SparkFilterCards` / `SparkMeter` / `SparkSummary` (+ `sparkBudget`, `green`/`white`
clauses in `sparkFilter`, `greens`/`whites` in `sparkAggregate`).

- **SKILL (white) card (2026-07-03, PR #39)** — the 4th category, added after the initial
  M1.4 merge, **mirrors the UNIQUE (green) card exactly**: same keyboard-nav skill search
  → factor row with Parent/Total meters, ≤3 per-member budget, single-legacy. The green
  search box was extracted into a stateful **`SkillSearch`** sub-component so the green +
  white searches keep **independent** query/highlight state. `whiteIcon` = a `kind="skill"`
  GameIcon (via `skillById → iconId`); grey `--tone` for `.spc-card.spark-white`.

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

## M1.7 "Obtainable vs. wishlist" coverage matrix (landed 2026-07-01, refined 2026-07-02)

The center-column **"Obtainable vs. wishlist"** card (`CoverageMatrixCard`) crosses each wishlist skill against where it can be obtained: the plan uma's innate kit, its **career training events**, the two inheritance parents + grandparents (real inherit-%), and the 6-slot deck (Hint / Chain / Random). Three new cores + a wired `InheritancePage`. Built subagent-driven from the [design](../superpowers/specs/2026-07-01-m1-7-coverage-matrix-design.md) / [plan](../superpowers/plans/2026-07-01-m1-7-coverage-matrix.md), then iterated on live review (§*Live-review refinements* below).

**Core additions:**
- **`src/core/greenSparkReconcile.ts`** — `buildUniqueToInheritedMap(skills)`: maps each native-unique id (100xxx / 110xxx, as decoded by the UmaExtractor importer) to its inherited-unique form (9xxxxx) by swapping the prefix (10→90 / 11→91) then falling back to a name-match; reports any `unresolved` ids. Derived purely from `skills.json`. `reconcileGreenSkillId(id, map)` applies it per-spark.
- **`src/core/g1Saddle.ts`** — `isG1Saddle(id, set)` / `filterG1(races, set)`: filter won-races to G1 only using a hand-patchable saddle-id set. Empty set ⇒ win-bonus stays 0 (safe, never fabricated) pending user-supplied data (see *Deferred*).
- **`src/core/lineageAffinity.ts`** — filters `wonRaces` to G1-only (optional `g1Set` param on `planLineageAffinity`) before the win-bonus, fixing a prior over-count where all shared wins scored regardless of grade.
- **`src/core/coverageMatrix.ts`** — `buildCoverageMatrix(CoverageInput) → CoverageResult`: per-skill coverage rows with **real per-member inherit-% from `spark.ts` contributions** (isolated per parent/grandparent member, priced off the spark the member actually holds), source classification (`Innate | Event ‖ Parent | G.parent ‖ Hint | Chain | Random`), coverage bars, and a bonus list. Column map: `hint_pool → Hint`, `chain → Chain`, `random_event + date_event → Random`. **Matching is variant-family-aware** — see *Live-review refinements*.
- **`src/core/types.ts`** — optional `UmaRecord.innateSkills?: string[]` (a baked override the matrix prefers if present; in practice innate data is resolved at runtime from the engine bundle — see below).

**UI:**
- **`CoverageMatrixCard.tsx`** (+ `.inh-cov-*` CSS) — provider-free card, **Matrix / Coverage toggle** + **bonus list**; cells cap at 2 chips + "+N". Deck chips render the real **support-card icon** via a `renderCardIcon` prop (no stat-type corner tile); parent/gp/innate chips use uma-name initials.
- **`InheritancePage.tsx`** wires it: parents from `useRoster`, `greenMap` from `buildUniqueToInheritedMap`, a `memberAffinity` resolver from `planLineageAffinity(…).memberScores`, `deckCards`, `umaNameById`, the innate kit (below), and the G1 set — replaces the M1.7 placeholder.
- **`useG1SaddleSet.ts`** (+ in-`src` `g1_saddle_ids.json` copy + `data-overrides/g1_saddle_ids.json`) — returns a module-const `Set<string>` from the JSON.

### Innate column — resolved from the engine bundle (no gametora pipeline needed)

The **Innate** column is the uma's built-in **non-unique** kit (white + gold), e.g. Mayano Top Gun's "No Stopping Me!" / "Nimble Navigator". It **explicitly excludes** the uma's unique and inherited-unique (those aren't "innate" for coverage — you always have your unique; the inherited-unique is what a parent passes down). New **`loadInnateSkillsByUmaId()`** in `skillTechnicalDetails.ts` builds `umaId → skillId[]` from each skill's `sources[].outfitId` in the vendored engine skill collection (the same data `loadUniqueSkillByUmaId` uses, extended to all rarities); the page filters it to **white/gold** via `useGameData().skillById` rarity. This **obviates the originally-deferred "Task 8 gametora innate-skill pipeline"** — the data already ships in the committed bundle.

### Career training-event column (`Event`, 2026-07-02)

A column immediately right of **Innate** crediting skills the plan uma's **career training events** can grant (the user's example: Taiki Shuttle's "Beyond the Mile" → *Head-On* + *All I've Got*). `CoverageInput.planUma.eventSkills` = the uma's event-obtainable skill ids; matched **family-aware** (`○ ≡ ◎`, gold/× exact), same as Innate. It is **availability** — whether the uma's events *can* grant the skill — **not** a per-run guarantee (P3), and (like Innate) does **not** feed the bonus list.

**Data pipeline:** `public/data/uma_events.json` = `{ umaId: skillId[] }`, built by **`scripts/build-uma-events.ts`** which inverts [daftuyda/UmaTools](https://github.com/daftuyda/UmaTools) `skills_all.json` `char_e` (per-skill list of outfit ids obtainable via a training event; `id` = our skill id, `char_e` = our `umaId` space — no remapping). Merges `data-overrides/uma_events_overrides.json` (`addByUma`/`removeByUma`, P5). Lazy-fetched in `InheritancePage` like `card_effects.json`.

⚠️ **Provenance — path B (private-use GameTora relaxation, owner-authorized 2026-07-02, docs/provenance.md §10):** the career event→skill mapping is **not** in our `master.mdb` (only event shells + support-card hint pools are; the choice→skill effects live in undecoded story-timeline assets — GameTora's source). A full spike found **no permissively-licensed** alternative. The user chose to **relax the standing "GameTora off-limits" rule for the private build only**: daftuyda's data is GameTora-derived (its README says so), the input stays **localOnly** (`scripts/borrowed/daftuyda/`, gitignored), only the derived id→id `uma_events.json` is committed, and it **MUST be swapped for a self-extracted/manual source before any public release**. `build-uma-events.ts` is **not** in `pnpm data:build` (input absent in CI) — run `pnpm tsx scripts/build-uma-events.ts` manually.

**Event-detail popup + innate potential levels (2026-07-03, provenance §10.1):**
- The Event cell renders a **"?" hint button** (page-supplied `renderEventHint` → `HeaderHelp` portal popup) listing every training event of the plan uma that grants the (family-resolved) skill: **event name, win-conditions ("Win the Mile Championship (Classic)" — race names from mdb `text_data` cat 28), and the full reward list** with the target skill highlighted. Data: `public/data/uma_event_details.json` (87 umas / 303 skill-granting events) baked by `scripts/fetch-gametora-chara-events.ts` (direct GameTora character-page fetch, cached gitignored under `scripts/borrowed/gametora-chara/`) + `scripts/build-uma-event-details.ts` (+ `data-overrides/uma_event_details_overrides.json`, P5). Returns null when no details exist → the cell falls back to the plain chip.
- **Global-period selection:** GameTora ships JP reward `history` by anniversary period; `pickGlobalVariant` places Global at JP-equivalent `GLOBAL_JP_EQUIVALENT_YEARS = 1.4` and picks the earliest applicable variant (events Global hasn't reached are excluded). Verified byte-identical to the user's in-game "Beyond the Mile" text (SP +30, 2 hints — not JP's +50, 3 hints). Flag `jpCurrentDiffers` → a violet "Global" badge in the popup. **Bump the constant as Global advances.**
- **Innate chip shows "Lv5"** — the potential (awakening) level that unlocks the skill, from the engine bundle's `sources[].needRank` (0 = base kit → Lv1). `loadInnateSkillsByUmaId()` now returns `umaId → Map<skillId, level>`; the core takes `planUma.innateRankBySkillId` and falls back to uma initials when the rank is unknown (P3 — no fabricated level). Family matches show the **covering** skill's level.
- Matrix cells lay chips out **2 rows × 3 columns, centered** (cap 6 + "+N"); source-column headers are centered too.

### Session 2026-07-04 — sort, ○-normalization, unified bonus, skill-detail popup (PR #38)

- **Icon-spec sort (both tables).** `src/features/inheritance/skillSort.ts` — `ICON_SUBCATEGORIES` is the user's ordered in-game icon spec; `buildSkillComparator` orders: **uniques + inherited-uniques first** (A-Z; a **guaranteed-from-a-direct-parent 100%** row leads absolutely — handled in `coverageMatrix` `guaranteedRank`), then the icon categories in order, then within a family **A-Z by white base name with the gold placed just above its white twin** (via `group_id`). The page builds the comparator and passes it as `CoverageInput.compareSkills`. Grouping data: `public/data/skill_categories.json` = `{ skillId: { category, group } }` (`scripts/build-skill-categories.ts` from master.mdb `skill_category` + `group_id`; `src/core/skillCategory.ts` `classifySkill`). Reference pages to re-tune the order: `pnpm dev` → `/_skill-icon-usage.html` (gitignored dev-only).
- **White sparks normalize ◎→○** — a white spark only grants the single-circle grade, so `src/core/skillCircle.ts` `toSingleCircle` maps a recorded ◎ id to its ○ family variant. Applied in the M1.7 page (parent/gp `whiteSparks` before `buildCoverageMatrix`) **and** the inheritance-card chips (`InheritanceCard.tsx` / `InheritancePage.tsx` `skillName` resolvers).
- **Parent unique (green) sparks are GUARANTEED 100%** at career start (never roll); grandparent greens **roll** (priced by `sparkChance`'s green path). Encoded in `spark.ts` + `coverageMatrix.ts`; resolves the mechanics-notes §1 Kamigame caveat (now **VERIFIED**, user-confirmed in-game).
- **Bonus is a second wishlist-style table** — `CoverageResult.bonus` is now `CoverageRow[]` (unified `cellsFor`), so bonus rows carry full cells (spark %, deck icons, event hints). Rendered with the same `MatrixTable`, **collapsible**. The **Matrix/Coverage toggle + the bars view were removed**.
- **Skill icon in front of each name** (`renderSkillIcon`; **uma portrait for inherited/native uniques** via `loadUniqueSkillByUmaId` + green reconcile). The **whole skill cell is the click target** → **`SkillDetailPopover`** (event-popup style: violet header, **light-blue Condition section**, sharp, full-bleed) showing **SP · Description · Condition (DSL line-split) · Effect · Duration · Cooldown**. Condition/effect/duration/cooldown come from the engine bundle (`loadSkillTechnicalDetail`, loaded on open — no Worker) via **shared `src/features/cm-planner/skillTechFormat.ts`** (`formatDuration` / `conditionLines` / `describeEffect` + `EFFECT_TYPE_NAMES`/`EFFECT_TARGET_NAMES`, extracted from M4's `SkillDetailDisclosure` — both surfaces now render identical strings). Readable Description baked to `public/data/skill_details.json` (daftuyda `desc_en`, path B).
- **Layout:** fixed-width skill-name column (aligned separators across both tables), narrowed Inheritance column, per-column classes (`inh-cov-col-*`).
- **Merge:** pulled `main` (availability epic #25–#37, skills.json 587→**1719** with JP-ahead + the 2026-07-01 rebalance patch); re-baked `skill_categories.json` (1719) + `skill_details.json` (1462/1719) against the merged catalog.

### Live-review refinements (2026-07-02)

- **Variant-family matching (`○ ≡ ◎`, gold separate)** across **every** column + the bonus filter. `○` and `◎` are the same white skill at different grades, so a source `Right-Handed ○` covers a wishlisted `Right-Handed ◎` (and vice-versa); the **gold** (`Right-Handed Demon`) and `×` variants stay **exact-match** (separate skills). Helpers `isWhiteCircle` / `coverageEquivalent` / `coveringId` in `coverageMatrix.ts` (family membership via `SkillRecord.variantSkillIds`). Parent/gp inherit-% is priced off the **held** spark (its `○`), not the wishlisted `◎`.
- Parent **green** sparks are reconciled (native→9xxxxx) before pricing so their inherit-% isn't a fake `~0%`; grandparent **green** matches show **no** `%` (gp green career math is unpriced per mechanics-notes §10 — honest "unpriced", not `~0%`).
- Deck chips show the real card icon; the Innate column resolves reliably regardless of whether `plan.uniqueSkillId` was ever set by the CM-planner sidebar.

**Test suite:** 1409 tests pass (post-merge with the availability epic), typecheck + build green.

**Deferred (one data gate — card degrades gracefully; nothing fabricated):**
- **Populate the G1 saddle-id set:** `data-overrides/g1_saddle_ids.json` (and the in-`src` copy) are empty, so the affinity **win-bonus is 0**. Drop in the real G1 saddle ids (from master.mdb) to enable it — update **both** files (see gotcha).

**Gotchas:**
- **Innate = NON-unique kit only.** `loadInnateSkillsByUmaId` returns all outfitId-associated skills; the page MUST filter to `white`/`gold` (drop `unique` / `inherited_unique`) via `skillById` — the bundle's own rarity int is unreliable (a 9xxxxx inherited-unique shows rarity `1`). Don't re-add the unique to Innate (an earlier attempt did, wrongly lighting up wishlisted inherited-uniques).
- **Family matching is `○ ≡ ◎` only; gold/× are separate.** `coverageEquivalent` collapses only white positive-circle variants (`isWhiteCircle` = white rarity AND no `×` glyph). Don't make gold cover whites (an earlier tier model did — reverted on user feedback). Parent/gp columns price sparkChance with the member's **held** spark id (`coveringId(...)`), not the wishlisted id, or the `%` comes back 0.
- **~17 native uniques unresolved by `greenSparkReconcile`:** 5-digit legacy ids (e.g. `10071` "Warning Shot!") have no 9xxxxx form. Reported via `unresolved`, harmless — the importer only emits 6-digit green sparks. A `skills.json` id reconciliation (likely the v0.18 refresh) would close it.
- **`g1_saddle_ids.json` exists in TWO places** — `data-overrides/` (P5 hand-patch source) and `src/features/inheritance/` (the in-`src` copy imported at build time; `data-overrides/` is outside tsconfig `include`). Keep them in sync; `data:build` does NOT auto-copy.
- **Probing the vendored bundle in a script needs the worktree cwd / an absolute import path** — a relative `./src/sim/vendor/umalator.bundle.mjs` resolves against the script's own dir.
- **Event column data is GameTora-derived (path B).** `uma_events.json` is committed but its input `scripts/borrowed/daftuyda/skills_all.json` is gitignored — a fresh clone can't regenerate it without re-fetching daftuyda. That's intentional (private-use gate). Before public release the file MUST be swapped (docs/provenance.md §10). Event = availability, not a per-run guarantee — don't relabel it as guaranteed.
- **Skill technical formatters are shared, not duplicated.** `formatDuration` / `conditionLines` / `describeEffect` (+ the effect/target name tables) live in `src/features/cm-planner/skillTechFormat.ts`; both M4's `SkillDetailDisclosure` and M1.7's `SkillDetailPopover` import them. Don't re-inline them — edit the shared module so both surfaces stay identical.
- **`skill_categories.json` is `{ skillId: { category, group } }`** (not a bare category string) and both it + `skill_details.json` are baked from `public/data/skills.json` — **re-bake both after any skills.json change** (`pnpm tsx scripts/build-skill-categories.ts` + `build-skill-details.ts`). They're standalone, NOT in `pnpm data:build`; `skill_details.json`'s input is the localOnly daftuyda file (path B, swap before public).
- **`SkillDetailPopover` loads the engine technical detail on OPEN** (`loadSkillTechnicalDetail` — a plain bundle read, no Worker), so rendering a coverage table is cheap; the fetch only fires on a click. To re-tune the icon sort order, edit `skillSort.ts` `ICON_SUBCATEGORIES` (the `200224` spec entry is the × icon `20024`; uniques are a top group, not in the icon list).

## M1.8 "Target spark" card (2026-07-04, `feat/m1-8-target-spark`)

Right-column read-off panel (handoff §7) — BLUE (`blueSparkRows`) + PINK
(`pinkSparkRows`) plan goals verbatim, plus WHITE = the wishlist skills the M1.7
coverage matrix reports uncovered. Pure `buildTargetSpark(plan, uma, skillById,
uncoveredSkillIds)` (`targetSpark.ts`) returns `{ blue, pink, white, coverage }`
(`coverage: 'empty' | 'covered' | 'gaps'`) and is the reusable seeding contract
for M1.4b's rental "Load from Target spark". `TargetSparkCard` is provider-free
(not collapsible, `cmp-plan-card` grammar, global `.badge.spark-*` chips + an
`.inh-target-spark .spark-chips` scope rule). The page feeds WHITE live from
`coverageResult.rows.filter(r => !r.covered).map(r => r.skillId)`. An **empty
wishlist** yields `coverage: 'empty'` → a neutral "No wishlist skills yet — add
some to the plan to see uncovered targets" note (keyed on `plan.wishlist.length`,
NOT a vacuous green check); a non-empty wishlist with nothing uncovered stays
`'covered'` (the green "✓ All wishlist skills obtainable"). WHITE inherits M1.7's
family-aware coverage (`○ ≡ ◎`, gold/`×` exact). Spec:
[2026-07-01-m1-8-target-spark-design](../superpowers/specs/2026-07-01-m1-8-target-spark-design.md).

**Fixed 2026-07-04** (was an accepted minor): the empty-wishlist vacuous
"covered" green check now renders the neutral `'empty'` state above, and the dead
`'pending'` coverage arm (unreachable once M1.7 shipped — the page always passes
a real array) was removed from `buildTargetSpark`/`TargetSparkCard`. The dead
`.inh-placeholder` CSS was removed in the PR #34–43 review-fix pass.

## M1.4b "Draft"/"Rental" Parent-2 builder + resolver wiring (2026-07-06, `feat/m1-4b-rental-builder`)

Closes the last M1.4 deferral: the Parent-2 slot is now a **3-mode segmented
selector** (`Owned · Draft · Rental`, `parent2Mode` on the plan, default
`'owned'` when absent — full back-compat) instead of the binary Rental toggle.

- **Owned** — unchanged: your `data.json` roster parent.
- **Draft** (`RentalDraft { filters: SparkFilter[]; forcedTier: 'double'|'single'|'triangle' }`,
  `RentalDraftPanel.tsx`) — a **search spec, not a real parent**. Reuses the
  M1.4 picker's "Star Tracks" filter cards via the shared `useSparkFilterState`
  hook (extracted from `UmaPickerModal`, no behavior change there). A **◎/○/△
  forced-tier** picker (`forcedTierScore` in `rentalDraft.ts`: △≈25 · ○≈100 ·
  ◎≈175, a documented P3 estimate aligned to the mechanics-notes §3 bands)
  feeds `draftToSyntheticParent(draft)` — a `Parent` with `umaId: ''`,
  `affinityHint = forcedTierScore`, and the draft's blue/pink/green/white
  clauses collapsed onto it (first green kept on a multi-green draft, a
  documented limitation) — so it rides the existing coverage/spark-pricing
  path as a **labelled hypothetical**, never as measured coverage. A **"Load
  from Target spark"** button seeds blue+white clauses from M1.8's
  `buildTargetSpark` residual (`seedFromTargetSpark`); green is left for
  manual add. Three **rental-search deep-link** buttons (`src/core/
  rentalSearch.ts`, pure + tested): `umaMoeUrl`/`pureDbUrl`/`chronoGenesisUrl`
  encode blue/pink clauses (factorId space **confirmed** against uma.moe's
  open-source frontend, provenance §6) and, on ChronoGenesis only, `anyBlue`
  (`blue_count`, confirmed). **White/green clauses are dropped on all three
  sites** — their factorId space is either an opaque live-fetched API table
  (uma.moe/ChronoGenesis) or undocumented (pure-db) — surfaced per-site as a
  "N filters not encodable" note, never silently discarded. The panel also
  carries the P3 honesty caveat (a matching record ≠ a guaranteed borrowable
  rental).
- **Rental** (`RentalParentEditor.tsx`) — a manual editor producing a full
  **veteran-shape `Parent`** (uma + blue/pink/green/white sparks + optional 2
  grandparents + optional stats/rating/`wonRaces`), so once recorded it feeds
  affinity + coverage exactly like an owned roster parent (`rentalRecorded` on
  the plan, `source: 'friend_rental'`). **UmaExtractor cannot read a rental
  you're only *considering*** — it scans your own trained-uma Veteran List
  screen, not a friend's parent on the inheritance/friend-select screen (a
  different, upstream-tool-limited screen) — so manual entry is the honest v1;
  friend-list extraction stays a documented wishlist item, not built.

**Resolver + wiring (Task 9, this PR):** `src/core/resolveParent2.ts`
(`resolveParent2(plan, rosterById) → {kind:'owned'|'draft'|'rental'|'none', …}`)
is the single place every Parent-2 consumer resolves the slot. `InheritanceCard`
already routed its header affinity mark + card render through it (Task 8);
this task wires **`InheritancePage`'s coverage `useMemo`** the same way — Parent
2 (`pB`) now comes from `resolveParent2` (owned parent / rental parent /
draft's synthetic), and `planLineageAffinity` (real lineage-affinity math) runs
**only** when Parent 2 is `owned` or `rental`, never `draft` (a draft's
synthetic parent has `umaId: ''` and must never reach `charaIdOf`). In draft
mode `memberAffinity` stays undefined, so `spark.ts` prices the synthetic
parent off its own `affinityHint` — the same fallback path a real Parent 2
with no computed affinity already used. The page also passes M1.7's live
`uncoveredSkillIds` into `InheritanceCard`'s `uncoveredWhiteIds` prop, so the
Draft panel's "Load from Target spark" seeds from the *current* uncovered
wishlist, not an empty default. Persistence (`parent2Mode`/`rentalDraft`/
`rentalRecorded` round-trip + validation) landed with the data-model task; no
Dexie version bump (all-additive-optional fields).

**Deferred (documented, not silent):** the exact white/green **factor-id**
format per rental-search site (needs a live browser capture against each
site's own filter UI — flagged in `rentalSearch.ts`'s header, not guessed);
the pure-db payload's `count`/`searchType`/`gameServerCode`/`supportCardId`
fields are best-effort/structurally-confirmed only, same flag. Manual smoke
(switching modes end-to-end in a running browser, confirming the search links
actually open filtered) was **not run by the implementing agent** — left for
the human, see the task report.

Spec/plan: [design](../superpowers/specs/2026-07-06-m1-4b-rental-builder-design.md) ·
[plan](../superpowers/plans/2026-07-06-m1-4b-rental-builder.md).

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
