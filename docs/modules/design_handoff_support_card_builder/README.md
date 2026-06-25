# Handoff: Support Card Builder + Parent Picker

## Overview
A planning workbench for an Umamusume Champions Meeting (CM) team builder. Given a **plan** (a chosen uma, race conditions, target sparks, and a wishlist of skills the player wants to learn), the module lets a player:

1. Pick the **trained uma** they're planning around.
2. Set/inspect **plan targets** — blue (stat) sparks, pink (aptitude) sparks, and the skill wishlist with SP costs.
3. Choose two **inheritance parents** (Parent 1 + Parent 2, with Parent 2 optionally being a "rental"), each contributing pink/blue/white sparks.
4. Browse & filter the **support card pool** and build a **6-slot deck** via drag-drop or an Add button, with per-card limit-break (LB) levels.
5. See a live **obtainable-vs-wishlist coverage matrix** that crosses each wishlist skill against where it can be obtained: Innate · Parent · Grandparent · Chain event · Random event — with spark-inherit probabilities.
6. Read off a **target spark** (right rail) describing the sparks a parent/rental must still supply to fully cover the wishlist, plus a generated search link.

Everything is reactive: changing the deck, parents, or plan targets immediately recomputes the matrix, the bonus list, and the target spark.

## Screenshots
Reference captures of the prototype are in `screenshots/`. Use them to anchor the spec visually:

| File | Shows |
|---|---|
| `01-overview.png` | Top of page — plan context header, "Your uma plan", and "Plan targets" (blue/pink spark steppers, wishlist with SP). |
| `02-inheritance.png` | The **parent picker** — Inheritance panel with Parent 1 & Parent 2 cards, the per-parent Owned/Rental toggle, Find candidates / Change / clear (×) actions, and each parent's aptitude ranks + spark/skill contributions. |
| `03-support-cards-icon.png` | Support-card pool in **Icon** view — compact 3-up tiles with type-colored card icon, card title + character, hint chips, training/friendship stats, LB diamonds, + Add. |
| `04-deck-and-filters.png` | The 6-slot **deck** strip + the Support cards header: Icon/Art/Plot view switch, Matches/Effect sort, and the Rarity / Type / Skill / Stats filter-chip rows. |
| `05-support-cards-art.png` | Support-card pool in **Art** view — full-bleed art column per card with chain/random event skills and full stat block. |
| `06-support-cards-plot.png` | Support-card pool in **Plot** view — scatter of cards by Wishlist matches (x) vs Effectiveness (y), with "best picks" cluster top-right. |
| `07-coverage-and-target-spark.png` | The coverage **matrix** tail + bonus list, and the **Target spark** right-rail (blue/pink/white sparks still needed to complete the plan). |

Note: card/uma art appears as colored placeholders (initials on a type-colored tile) — see Fidelity below.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype that demonstrates the intended look, layout, data model, and interaction behavior. **They are not production code to copy directly.**

The HTML is authored as a "Design Component" (a custom streaming-template runtime in `support.js`); **do not** port that runtime. Instead, **recreate this design in the target codebase's existing environment** (React, Vue, Svelte, etc.) using its established component patterns, state management, and styling system. If no front-end environment exists yet, choose the most appropriate framework for the project and implement there.

Treat `Support Card Builder.dc.html` as the source of truth for:
- **Visual design** — exact layout, spacing, colors, typography (all inline styles, easy to read off).
- **Data model** — the JS class at the bottom of the file holds the canonical shapes for umas, support cards, skills, the plan, and all derived computations (coverage matrix, candidate scoring, spark chances). Lift this logic directly.

To preview the prototype: open `Support Card Builder.dc.html` in a browser (it loads `support.js` and the `_ds/` bundle by relative path).

## Fidelity
**High-fidelity.** Final colors, typography, spacing, component styling, and interactions are all resolved. Recreate the UI faithfully using the codebase's existing primitives. The one caveat: **icons/portraits are colored placeholders** (initials on a type-colored tile) because no game art assets were available — wire real card/uma art into those slots when available.

## Design System Context
This module is built on the **Uma CM Planner UI** design system (a light-theme, mobile-first React UI kit). The handoff bundles it under `_ds/`. The prototype consumes:
- **CSS tokens + utility classes** from `_ds/.../_ds_bundle.css` (`.panel`, `.badge`, `.chip-sm`, `.matrix`, `.spark-pink/.spark-blue/.spark-green`, `.rarity-SSR/.rarity-SR`, `.cmp-small-btn`, `.cmp-control-group`, `.cmp-mini-label`, `.cmp-portrait-ph`, `.picker-results/.picker-row`, `.target-list/.target-row`, `.spark-list/.spark-row`, etc.).
- One React component: **`SearchPicker`** (`window.UmaCmPlanner.SearchPicker`) — a typeahead picker. Props: `label`, `placeholder`, `items: {id, name, sub, badge}[]`, `onPick(id)`.

If your target codebase already has this design system, use its real components. The tokens/classes referenced here map 1:1 to it.

## Screens / Views
This is a **single dense workbench screen** (no routing). Max content width **1560px**, centered, with `0.85rem 0.9rem 4rem` padding, vertical stack with `0.8rem` gaps.

### Top: Plan context header
- A `.panel`, horizontal flex, wraps. Left→right: `PLAN #N` badge (accent-colored), plan name (`<h1>`, 1.05rem), muted "From CM Planner · {course}". Pushed to the right (margin-left:auto): three `.chip-sm` — surface, distance, strategy.

### Workbench grid
A 3-column CSS grid: `minmax(290px,320px) minmax(0,1fr) minmax(290px,320px)`, `gap:0.8rem`, `align-items:start`. The `arrangement` prop can switch to a single stacked column. **Collapses to 1 column below 1120px**; parent grid → 1 column below 760px; card grid → 2 cols and deck slots → 3 cols below 640px.

#### LEFT SIDEBAR (sticky, `top:0.5rem`, `max-height:calc(100vh - 1rem)`, scrolls)
**1. "Your uma plan" panel**
- A bordered (accent, `#f4f8ff` bg) card: 50px portrait placeholder, name (700) + muted title (both truncate), a row of pink aptitude chips (e.g. "Long A", "Turf A", "Late A"), and a `Change`/`Close` button.
- Clicking Change reveals a `SearchPicker` ("Swap plan uma") over the trained-uma list.

**2. "Plan targets" panel** (collapsible — caret `▶`/rotate-90)
- **Blue sparks (stat):** list of rows — a `.spark-blue` badge (stat name, tinted to stat color) + `−` / `N★` / `+` steppers + red `×` delete.
- **Pink sparks (aptitude / style · from plan):** display-only rows — `.spark-pink` badge + `N★` (no steppers, no delete).
- **Wishlist ({count} skills · {SP} SP):** `.target-list` rows — skill name (gold `#c27a00` if gold-rarity skill, else default) + muted SP cost.

#### CENTER COLUMN
**3. "Inheritance" panel** (collapsible)
- Header: caret + "Inheritance" + muted "parents 1 & 2" on the left; on the right "Updated {timestamp}" + `Upload data` button.
- Body: 2-column grid (`1fr 1fr`, collapses to 1 col below 760px) of **Parent 1** and **Parent 2** cards (`.parent-form`).
- **Each parent card:**
  - Header: `Parent N` mini-label; right-aligned `Find candidates`, `Change`/`Close`, red `✕` clear buttons. (Parent 2 also has an **Owned / Rental** `.cmp-control-group` toggle beside its label.)
  - `Find candidates` → a `.picker-results` list of top-5 trained umas scored against the plan targets, each with a "match N" badge.
  - `Change` → a `SearchPicker` over trained umas.
  - When picked: 42px portrait, rarity badge + name, "GP:" + two grandparent portrait chips (22px). Then a `.spark-chips` row (pink chips + blue chips, tinted). Then a list of **white skill sparks**: skill name + optional `GP` tag + `★` stars colored **gold `#eab308` (own)** or **gray `#9aa6b6` (grandparent)**.
- **Parent 2 → Rental mode:** replaces the picker with a dashed "dummy parent" builder: a `RENTAL` badge + hint, `↻ Load from Target spark` button, then editable spark rows (blue/pink/white, each `−`/`N★`/`+`/`×`), a generated search-link field (monospace, truncated), and `Copy link` + `Open ↗` buttons.

**4. "Your deck" panel** (sticky, `top:0.5rem`, elevated shadow)
- Header: "Your deck — 6 support slots" + a toolbar: template-name text input, `Save`, `Load template…` select, `Del`, `Clear`. Templates persist to `localStorage` key `scb_profiles`.
- Body: 6-column grid (`repeat(6,1fr)`, → 3 cols below 640px) of **drop slots**:
  - Empty: dashed border, centered `＋` + slot number, `var(--bg-2)` bg.
  - Filled: dashed border with a 4px **left border in the card's type color**; a top-right `×` remove; centered content = a 2.4rem type-colored icon tile (type label) + an `LB` label and **4 gold rhombus diamonds** (limit-break stepper; click a diamond to set, click the current top to step down).
  - Slots accept drops from the card pool (`onDragOver/onDragLeave/onDrop`; `.drag-over` → accent border + `#eef4ff` bg).

**5. "Support cards" panel** (collapsible)
- Header: caret + "Support cards" + "{count} shown"; right side has a view toggle **Icon · Art · Plot** and (when not Plot) a sort toggle **Matches · Effect.**
- **Filter rows** (label in a fixed 3.2rem uppercase muted column, chips wrap and indent under the first chip):
  - **Rarity:** All / SSR / SR / R.
  - **Type:** All / SPD / STA / POW / GUT / WIT (active chip uses the type color).
  - **Skill:** `Any` + one chip per wishlist skill (filters to cards providing that skill).
  - **Stats:** (separated by a top border) toggle chips — Training / Friendship / Mood / Specialty / Race bonus / Init. gauge / Hint freq — controlling which stat values render on each card.
- **Icon view:** scrollable (`max-height:680px`) 3-col grid of compact tiles. Each tile: 4px type-colored left border; a 2.7rem icon (initials + a small corner type tag); card **title** above the **character name** (both truncate); rarity badge; `E {eff}` effectiveness + "{n} wishlist" match label (accent if >0); hint chips (wishlist hints highlighted accent); optional stat line (per the Stats toggles); footer with `LB` diamonds + `+ Add`/`Added` button. Tiles are `draggable`.
- **Art view:** scrollable (`max-height:820px`) 3-col grid of taller cards. Left: full-height type-colored art placeholder (62px wide). Right: name (800) + rarity badge + type chip, title, **Chain event** skills (green label) and **Random event** skills (orange label) as chip rows, full stat line, LB diamonds + Add. Also draggable.
- **Plot view:** a scatter quadrant — X axis "Wishlist matches →", Y axis "Effectiveness →", origin at bottom-left (0,0). Each card is a 30px type-colored node positioned by `(matchCount, eff)`; click to add. "★ best picks" hint top-right.

**6. "Obtainable vs. wishlist" panel**
- A **Matrix · Coverage** `.cmp-control-group` toggle.
- **Matrix view:** a `.matrix` table. Columns: `Wishlist skill | Innate ‖ Parent | G.parent ‖ Chain | Random` (double-border separators before Parent and before Chain). Sticky first column (`.skill-col`, skill name colored gold if gold-rarity). Each cell either shows source chips or a muted `·`:
  - **Innate** chip: spark-purple (`--tier-spark`) round chip with the plan uma's initials.
  - **Parent** chip: accent-bordered round chip (uma initials) **+ "~N%" inherit chance**.
  - **G.parent** chip: gray round chip (grandparent initials) + "~N%".
  - **Chain / Random** chips: square type-colored chip with the providing support card's initials (no %).
  - Cells cap at 2 chips with a "+N" overflow. Uncovered rows get an inset red stripe on the skill column (`.row-uncovered`).
- **Coverage view:** horizontal bars, one per source (Innate/Parent/G.parent/Chain/Random) + an "Uncovered" bar, each showing covered-count and % of wishlist, colored by source.
- **Bonus — obtainable, not on wishlist:** below a divider. Lists skills your deck+inheritance provide that aren't on the wishlist, each with its source chip(s) + method label (Chain/Random/Parent/G.parent/Innate).

#### RIGHT SIDEBAR (sticky, scrolls)
**7. "Target spark" panel**
- Intro line. Then **Blue** / **Pink** / **White (uncovered skills)** sections, each a `.spark-chips` row of badges. Blue first, then pink (matching the rest of the app). White lists the still-uncovered wishlist skills (green badges); if none, shows "✓ All wishlist skills obtainable from your setup." in green.

## Interactions & Behavior
- **Drag-drop:** support card tiles are draggable; deck slots are drop targets. Dropping a card already in the deck moves it; dropping onto a filled slot replaces. `.drag-over` highlight on the active slot. Drag state tracked via an instance var + `dragIndex` in state.
- **Add button:** fills the first empty deck slot with the card (inheriting the card's current LB into the slot's LB). Disabled (shows "Added") if already in the deck.
- **Limit break (LB):** both support-card tiles and deck slots use a 4-diamond stepper (0–4). Click diamond level L to set; click the current top diamond to step down one. Card stat values scale with LB (see `cardStatVals`).
- **Filters & sort:** rarity/type/skill filters are single-select (skill toggles off on re-click). Sort by "Matches" (wishlist hits, then effectiveness) or "Effect." (effectiveness desc). Stats chips are multi-select.
- **Parent candidates:** `Find candidates` scores all trained umas against the current plan targets (sum of `min(uma star, goal star)` over matching pink + blue goals), shows top 5.
- **Plan-target steppers:** blue goals editable (0–9 stars) + deletable; pink goals display-only.
- **Rental hunt:** `Load from Target spark` seeds the dummy parent's blue+pink from plan goals and white from uncovered wishlist skills; each editable; generates a `umalink.app/find?...` query (placeholder host — swap for the real partner URL/format). `Copy link` → clipboard with a transient "Copied ✓".
- **Deck templates:** Save names + stores `{slots, slotLb}` to `localStorage` (`scb_profiles`); Load restores; Del removes; Clear empties the deck.
- **Collapsible sections:** Plan targets, Inheritance, Support cards each toggle via a caret-header button.
- **Transitions:** caret rotation `transform .15s`. No other animation.

## State Management
The prototype holds all state in one component (`this.state`). Map these to your store/hooks:
- `planUmaId` — selected plan uma id.
- `slots: (cardId|null)[6]`, `slotLb: number[6]` — deck contents + per-slot LB.
- `cardLb: {cardId: number}` — per-card LB in the browse pool.
- `p1`, `p2` (uma ids), `p2mode: 'owned'|'rental'`.
- `rarity`, `type`, `skill`, `statsShown: string[]` — browse filters.
- `cardView: 'grid'|'art'|'plot'`, `sort: 'matches'|'eff'`, `view: 'matrix'|'bars'`.
- `pinkGoals: {key,star}[]`, `blueGoals: {stat,star}[]` — plan targets.
- `hunt: {pink,blue,white}|null` — the rental dummy parent's working sparks.
- `profiles: [{name,slots,slotLb}]`, `profileName`, `selProfile` — deck templates.
- UI flags: `browseOpen`, `inheritOpen`, `planTargetsOpen`, `planSearchOpen`, `p1SearchOpen`, `p2SearchOpen`, `candFor`, `dragIndex`, `copied`, `accountUpdated`, `lastUpload`.

**Key derived computations** (all in the prototype's `renderVals()` / helper methods — port these):
- `detailFor(skillId)` → `{innate, parent[], gp[], chain[], random[]}` — the heart of the coverage matrix.
- `sparkChance(star, isGp)` → inherit % (`{1:18, 2:27, 3:36}` capped at 3 stars, ×0.55 for grandparent). **Placeholder formula — replace with real game math.**
- `cardStatVals(card, lb)` → per-stat values. **Placeholder formula.**
- `matchCount(card)` → number of wishlist skills the card provides.
- `candidatesFor(slot)` → scored parent candidates.

## Data Model (lift from the prototype)
- **Uma (trained):** `{id, name, title, rarity, updated, innate: skillId[], pink: {key,star}[], blue: {stat,star}[], white: {id,star,gp}[], gp: [name,name]}`.
- **Support card:** `{id, name, rarity:'SSR'|'SR'|'R', type:'spd'|'sta'|'pow'|'gut'|'wit', eff: number, events: {id: skillId, t:'chain'|'random'}[]}` (+ a `CARD_TITLES` map).
- **Skill:** `{id: {name, rarity:'gold'|'white', sp: number}}`.
- **Wishlist:** `{id: skillId, priority: number}[]`.
- **Plan:** `{number, name, course, surface, distanceLabel, strategy, aptTargets: {key,rank}[]}`.
- The prototype ships representative sample data (real Umamusume character/skill names). Replace with the player's real extractor data when integrating.

## Design Tokens
Colors (from `_ds_bundle.css` `:root`):
- `--bg-0: #f5f7fb` (page) · `--bg-1: #ffffff` (panels) · `--bg-2: #eef3f9` (insets)
- `--fg: #172033` · `--fg-muted: #637083` · `--border: #d7dee8`
- `--accent: #3478f6` · `--error: #c2414b`
- `--tier-chain: #22c55e` · `--tier-random: #f97316` · `--tier-spark: #a78bfa` · `--tier-uncovered: #ef4444`
- `--tier-scenario: #14b8a6` · `--tier-date_event: #06b6d4` · `--tier-hint_strong: #a3e635` · `--tier-hint_weak: #eab308`

Support-card **type colors** (defined in the component, not the DS): SPD `#3b82f6` · STA `#ef4444` · POW `#ec4899` · GUT `#f59e0b` · WIT `#10b981`.

Other: Grandparent inherit chip / "Parent" bar `#3478f6`; "G.parent" bar `#0ea5e9`; gold skill name `#c27a00`; own-spark stars `#eab308`; grandparent-spark stars `#9aa6b6`; LB diamond fill `linear-gradient(160deg,#ffe488,#e8a008)`, empty `#d7dce4`.

Typography: `system-ui` stack. Sizes used: `<h1>` 1.05rem; `<h2>` panel titles ~1rem; body small 0.78rem; chips 0.62–0.72rem; mini-labels uppercase. Font weights 600–800 for emphasis.

Radii: panels 10px; cards/tiles 9–10px; chips/badges 999px (pill) or 4–6px (square); inputs/buttons 8px. Spacing scale is rem-based in ~0.2rem steps; grid/flex `gap` 0.35–0.8rem. Deck panel shadow: `0 6px 18px rgb(36 54 78 / 0.08)`.

## Assets
- **No real image assets.** All uma portraits, card art, and skill icons are colored placeholders (initials on a type-colored tile, or the DS `.cmp-portrait-ph` / `.game-icon-ph` placeholder). Wire in real game art where these placeholders appear.
- Icon glyphs used are plain Unicode (`★ ＋ × ↻ ↗ ▶ ◎`), no icon font.

## Files
- `Support Card Builder.dc.html` — the full prototype (template markup + the logic/data class at the bottom `<script>`). **Primary reference.**
- `support.js` — the Design Component runtime that renders the `.dc.html`. **For previewing only; do not port.**
- `_ds/uma-cm-planner-ui-.../` — the Uma CM Planner design system bundle (`_ds_bundle.css`, `_ds_bundle.js`, React vendor files, `README.md`, `_ds_manifest.json`). Source of the tokens, utility classes, and the `SearchPicker` component.

To run the prototype: open `Support Card Builder.dc.html` in a browser from this folder (relative paths resolve `support.js` and `_ds/`).
