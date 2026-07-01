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
- **`useRoster` reads Dexie on mount** (`subscribe` → `void reload()`). It now swallows a missing-IndexedDB error (jsdom / private mode) → empty roster. Before that guard, any page-level test rendering the roster-backed `InheritanceCard` produced an **unhandled rejection** that made `pnpm test` exit non-zero even though all tests passed. Don't remove the try/catch in `reload()`.
- **Unique/inherited-unique skill names carry a trailing `☆`/`★` level marker in the data** (e.g. `OMG! (ﾟ∀ﾟ)  The Final Sprint! ☆`). It is part of the name (keep it faithful) — put a space before the spark-star glyph rather than stripping it, or it reads as a second star.
- **Same-parent restriction is by `charaId` (character), not roster id** — any outfit/copy of the same character counts. `charaIdOf(umaId) = floor(umaId/100)` groups outfits. Self-vs-trainee is allowed; only the two *parents* must differ.
- **`parents.css` has unscoped global `.spark-{blue,pink,green}` chip rules with dark borders** (`#166534` etc.) that bleed into any same-named element via equal-specificity later-wins (bit `.spc-card.spark-green`). Scope filter-card overrides with the compound `.spc-card.spark-*` (0,2,0) to win. This is the M1-flavour of the app.css single-class-specificity gotcha.
