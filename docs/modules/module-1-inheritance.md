# Module 1 — Inheritance Planner

> Brief module doc. Expand into a detailed living doc (like [M4's](module-4-skill-acquisition.md)) when M1 build work starts.

- **Route:** not yet routed (nav shows **Inheritance** as a disabled stub).
- **Status:** **Plans 1–2 shipped 2026-06-15** (foundation). **Plans 3–5 are the project's current "Next".**
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
