# M1.6 — Support Card Pool (design)

**Date:** 2026-06-26
**Module:** M1 Inheritance workbench (`/inheritance`)
**Builds on:** M1.5 "Your deck" card (the 6-slot deck + `text/card-id` drop target + `addCardToDeck` fill seam).
**Mockup:** `docs/modules/design_handoff_support_card_builder/` §5 ("Support cards" panel) + screenshots `03/04/05/06`.

## Goal

Complete the deck's **input side**: a browse / filter / scoreable support-card pool that
drag-sources and "+ Add"s cards into the M1.5 deck, faithful to mockup §5's three views
(Icon · Art · Plot). It integrates a **real training-power score** (vendored from euophrys'
tier list, with editable weights) **alongside** wishlist-skill coverage, so the player can
weigh *card power* and *obtainable skills* together — the actual support-card decision in CM
planning.

The M1.5 doc already states the seam: *"the interactive drag source / '+ Add' button arrive
with M1.6 (support-card pool)."* This card delivers it.

## Decisions (locked in brainstorming)

1. **Full mockup §5**, not a tight subset — all three views, all filter rows, both sorts.
2. **Effectiveness = euophrys' real score, vendored** (not a fabricated number, not an in-house
   estimate). Rationale: it's the community-standard card-power metric, MIT-licensed, current to
   the Global server (last updated 2026-04-10), and built from the same `master.mdb` our data
   comes from.
3. **Editable weights** exposed (not fixed defaults) — the player tunes the training-power
   score like euophrys' own site, because the support-card choice must be weighed against
   obtainable skills case-by-case.
4. **Matches stays the primary, plan-specific axis.** euophrys scores *URA career-training*
   power, which is deliberately **off-axis** from inheritance/CM (where the card's job is
   supplying wishlist skills + sparks). So Effect is a power column; Matches is the on-point one.

## Honesty (P3 / P4)

- The Effect score is **captioned** as *"training power, URA scenario, via euophrys"* with a
  `?` explainer, a credit, and a deep-link to <https://euophrys.github.io/uma-tiers/#/global>.
- The score is **deck- and weights-dependent** (marginal value of adding the card to the
  current deck) — surfaced in the explainer, not presented as a bare per-card constant.
- Cards present in our data but **absent from euophrys' set** show Effect `—` (never fabricated).
- **Matches** is an exact intersection — fully honest.

## Vendoring (P1 reuse-first)

Source: [`Euophrys/umamusume-tierlist`](https://github.com/Euophrys/umamusume-tierlist), **MIT**.
Vendor verbatim under `src/vendor/uma-tiers/` (mirrors the vendored-racetrack pattern; scoped
`@ts-nocheck` / thin `.d.ts` shims where the JS trips strict TS):

- `tierlist-calc.js` — the ~550-line `processCards(cards, weights, selectedCards)` scorer.
- `cards/gl.js` — per-`(card, limit_break)` stat inputs (`tb`/`mb`/`fs_*`/`stat_bonus[6]`/
  `specialty_rate`/`race_bonus`/`hint_rate`/…). 5 rows per card.
- `card-events.js` — event-id → 8-stat-bonus arrays (euophrys-maintained, not us).
- The `getDefaultScenario('global')` defaults (stat weights, race counts, bond rate, scenario
  bonus, stat cap) — lifted verbatim as our `DEFAULT_WEIGHTS`.

**Join:** euophrys `id` ≡ our `SupportCardRecord.cardId` (both are master support-card ids,
e.g. `10001`, `30028`). Clean `Map` lookup; no id remapping.

**Provenance:** record the repo URL, the pinned commit, retrieval date, MIT license, and the
"training-power, off-axis from inheritance" caveat in `docs/provenance.md`.

**Maintenance:** re-pull the three vendored files on euophrys' update cadence (same as our
umalator engine pin). We hand-maintain **no** card-stat or event data ourselves.

## Architecture

Follows the M1 conventions: **pure helpers in `src/core/`**, a **provider-free presentational
panel** (`useGameData`/`GameIcon` live only in the page, which passes resolved data + placeholder
nodes in), `inh-deck`/`cmp-plan-card` card grammar, browser-local persistence.

### Core math (`src/core/`, pure + unit-tested)

- **`cardScore.ts`** — wraps the vendored `processCards`:
  - `scoreCards(weights, deck): Map<cardId, { score: number; lb: LimitBreak }>` — deck-context
    is the current 6 slots (marginal scoring, like euophrys).
  - `DEFAULT_WEIGHTS` — lifted from `getDefaultScenario('global')`.
  - `ScoreWeights` type — **the full set of knobs euophrys' own Weights panel exposes** (we mirror
    their site 1:1): the 7 stat weights (speed/stamina/power/guts/wisdom/skill-points/energy),
    race counts (G1, G2–3, OP), bond rate (bonds/day), scenario/spec bonus, the multiplier,
    motivation, stat cap, minimum training score, and the per-stat uma bonuses. Same ranges/steps
    as their `Weights.jsx`.
  - Spot-check tests against euophrys output (e.g. Kitasan Black SSR ranks at/near the top under
    default weights; a card absent from `gl.js` yields no entry).
- **`cardMatches.ts`** (or fold into an existing M1 helper) — `matchCount(card, wishlistIds)` =
  size of the intersection of the card's skill ids with the plan wishlist; `matchedSkillIds` for
  the Skill filter + hint highlighting.

### Scoring hook + weights state

- **`useScoreWeights()`** — `[weights, setWeights, reset]`, persisted browser-local
  (`localStorage` key `scb_score_weights`), guarded read/write (mirrors `useStaminaWarnThreshold`
  / the M1.5 deck hooks). Consistent with M1.5: deck workspace is browser-local, plan-independent.
- **`useCardScores(deck, weights)`** — memoized `scoreCards`; recomputes on deck/weights change.
  (Engine-free; pure JS, no worker.)

### Components (provider-free)

- **`ScoreWeightsPanel.tsx`** — collapsible "Scoring weights" control mirroring euophrys' own
  Weights panel 1:1: the 7 stat-weight inputs, race counts (G1 / G2–3 / OP), bond rate,
  scenario/spec bonus, multiplier, motivation, stat cap, minimum training score, per-stat uma
  bonuses — same ranges/steps as their site — plus "Reset to defaults". Honest caption
  (training-power, URA, via euophrys; affects Effect only).
- **`SupportCardPoolCard.tsx`** — the §5 panel (replaces the `M1.6` placeholder):
  - **Header:** caret + "Support cards" + "{n} shown"; right side = view toggle **Icon · Art ·
    Plot** + sort **Matches · Effect** (sort hidden in Plot).
  - **Filter rows** (fixed uppercase label column, chips wrap/indent):
    - **Rarity:** All / SSR / SR / R (single-select).
    - **Type:** All / SPD / STA / POW / GUT / WIT / **FRD / GRP** (our data has all 7 `CardType`s;
      mockup's 5 + the two friend/group types). Active chip uses the type colour.
    - **Skill:** `Any` + one chip per **wishlist** skill (filters to cards providing it;
      toggles off on re-click).
    - **Stats:** multi-select toggles (Training / Friendship / Mood / Specialty / Race bonus /
      Init. gauge / Hint freq) controlling which stat values render on each card.
    - Plus a name/character **search** box.
  - **Icon view:** scrollable 3-col tiles — 4px type-colour left border; type tile; card title
    above char name (both truncate); rarity badge; `E {score}` (or `—`) + `{n} wishlist` match
    label (accent if >0); hint chips (wishlist hints highlighted); optional stat line (per Stats
    toggles); footer = LB diamonds + `+ Add`/`Added`. Tiles `draggable` → `text/card-id`.
  - **Art view:** scrollable taller cards — type-colour art-placeholder column; name + rarity +
    type chip; **Chain** (green) + **Random** (orange) event-skill chip rows (from
    `card.skills` `sourceType`); full stat line; LB + Add. Draggable.
  - **Plot view:** scatter quadrant — **X = wishlist matches, Y = Effect score**; each card a
    type-colour node positioned by `(matchCount, score)`; click-to-add; "★ best picks" hint
    top-right. Cards without a score are omitted from Plot (no fake Y) with a small "{k} cards
    have no score" footnote.
- **Stat-line values** are read from the vendored per-LB euophrys fields (race-bonus %,
  specialty, stat-bonus, hint-freq, friendship, mood, training) at the card's current pool-LB,
  with honest labels. (Hint-freq is also in our `perLevel`; prefer the single euophrys source for
  consistency across the line.)

### Page wiring (`InheritancePage.tsx`)

- The page owns `useGameData()` (cards), `useCardScores`, `useScoreWeights`, the wishlist
  (`uma1Plan.wishlist`), and the deck (to add into **and** as scoring deck-context).
- It resolves each card → a presentational `PoolCard` view-model (display strings, type
  colour/label, GameIcon/placeholder node, score, matchCount, matched-skill set, event-skill
  groups, stat-line values) and passes the list + handlers to `SupportCardPoolCard`.
- **`onAdd(cardId)`** → existing `addCardToDeck` (first empty slot; the slot inherits the pool
  card's current LB). Drag uses the existing deck drop target unchanged.
- **Pool per-card LB** (`cardLb`): ephemeral component state, defaults to max (4, matching deck
  default); adjustable via the tile's diamonds; the value Add/drop carries into the slot.
- Replaces `<Placeholder title="Support cards" phase="M1.6" />` in the center column. The
  `ScoreWeightsPanel` sits within/above the pool panel.

## CSS

New rules in `inheritance.css` under an `.inh-pool*` namespace, reusing design-system tokens
(`--bg-1/2`, `--border`, `--accent`, `--error`, `--tier-chain`/`--tier-random`, type colours
from `deckOps.TYPE_COLORS`). Honour the **global `input[type=…]` specificity gotcha** (scope
input overrides). Card grammar matches `inh-deck`.

## Testing

- **Pure:** `cardScore` (spot-checks vs euophrys; missing-card → no entry; weights change moves a
  card's rank), `matchCount`/`matchedSkillIds`, filter + sort helpers (rarity/type/skill/search,
  Matches vs Effect ordering).
- **Hooks:** `useScoreWeights` persistence + reset (guarded localStorage).
- **Component:** filters narrow the list, view toggle switches Icon/Art/Plot, sort reorders, `+
  Add` fills the next deck slot at the chosen LB, a tile drag sets `text/card-id`, editing a
  weight recomputes the Effect order, cards without a score render `—` (Icon/Art) / are omitted
  (Plot).
- The route smoke test (`App.inheritance.test.tsx`) already mocks `useGameData` — extend the mock
  with a couple of cards if the page now reads `cards`.
- Trust `pnpm build` + `pnpm typecheck` over a flaky vitest-with-dev-server run (CLAUDE.md gotcha).

## Phasing (the implementation plan will split; likely 2 PRs)

1. **Vendor + core** — vendored files + `cardScore.ts` (+ `DEFAULT_WEIGHTS`) + `matchCount` + tests
   + provenance entry.
2. **Weights** — `useScoreWeights` + `ScoreWeightsPanel` + persistence/reset.
3. **Panel core** — `SupportCardPoolCard` Icon view + all filters + Matches/Effect sort + search +
   drag/Add wiring into the deck.
4. **Art + Plot views.**
5. **Page wire + docs** — replace the placeholder, update `docs/modules/module-1-inheritance.md`,
   CLAUDE.md status, roadmap.

## Out of scope (later cards)

- M1.7 "Obtainable vs. wishlist" coverage matrix (the Plot's matches axis previews part of it,
  but the full source-crossing matrix is M1.7).
- Real card/uma **art** (placeholders only, per the handoff's Fidelity note).
- Scenario internals euophrys does **not** surface in its Weights panel (summer overrides,
  highlander internals, etc.) stay at euophrys defaults — we mirror exactly the knobs their site
  exposes, no more, no less.

## Non-goals / risks

- **Currency depends on euophrys.** If they lag a Global update, our Effect column lags too —
  acceptable; documented in provenance.
- **Two card datasets** (ours from master+GameTora+Tachyons; euophrys' `gl.js`) joined by id —
  any id present in one but not the other is handled (Effect `—`; a card in `gl.js` but not our
  set simply never appears, since the pool is driven by *our* `cards`).
