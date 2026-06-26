# M1.5 — "Your deck" card (design)

**Date:** 2026-06-26
**Module:** M1 Inheritance workbench (`/inheritance`)
**Card:** M1.5 — replaces the `Placeholder title="Your deck" phase="M1.5"` in the center column of `InheritancePage`.
**Handoff source:** [docs/modules/design_handoff_support_card_builder/](../../modules/design_handoff_support_card_builder/) README §"4. Your deck panel" + the prototype `Support Card Builder.dc.html` (deck logic in the bottom `<script>`).
**Branch / worktree:** `feat/m1-5-your-deck` (isolated worktree, parallel with the M1.3/M1.4 session on `feat/m1-inheritance-workbench`).

## Purpose

A manually-built **6-slot support-card deck** for the inheritance workbench: drop / add cards into slots, set a per-slot limit-break (LB) level, remove cards, clear the deck, and save/load named deck templates. The deck is the upstream input to M1.7's "Obtainable vs. wishlist" coverage matrix (chain/random event sources come from the decked cards), so its state is lifted to the page for siblings to read.

## Scope decisions (locked with the user 2026-06-26)

1. **Deck state is its own model — NOT `CmPlan.lockedDeckSlots`.** `lockedDeckSlots` was designed for M4's deck *suggester* (slots an optimizer fills around); that is a different concept from M1's manually-chosen deck. M1.5 introduces a dedicated `DeckState` that is **not** persisted into `CmPlan` and requires **no Dexie schema change** (zero collision risk with the parallel M1.3/M1.4 session).
2. **The working deck autosaves per active plan.** Keyed by `uma1Plan.id` in `localStorage` (`scb_deck:<planId>`), so each plan remembers its own deck and it survives reload. Switching the active plan loads that plan's deck.
3. **Named templates** persist to `localStorage` `scb_profiles` (prototype-faithful) — independent of the per-plan autosave.
4. **New-slot LB defaults to 4 (max).** When M1.6 lands per-card LB, the add path can pass the card's own LB; until then every added/dropped card seeds slot LB = 4.
5. **M1.6 dependency:** M1.5 builds the deck panel **and** its fill API (HTML5-DnD drop target + an `addCardToDeck` page handler), unit-tested by injecting filled state and simulating drops. The interactive drag *source* and "+ Add" button live in M1.6 (the support-card pool); M1.5 ships no throwaway interim adder (YAGNI). After M1.5 the deck renders correctly and is fully driveable by tests + by M1.6 once it lands.

## Architecture & files

Follows the established M1 convention (see M1.2 `UmaPlanCard`): a **pure-helper sibling** + a **provider-free presentational component**, named apart so they never collide on the Windows case-insensitive FS.

All files under `src/features/inheritance/`.

### 1. `deckOps.ts` — pure deck logic (no React, no DOM)

```ts
import type { LimitBreak } from '@/core/types';

export const DECK_SLOTS = 6;
export const DEFAULT_SLOT_LB: LimitBreak = 4;

export interface DeckState {
  /** length 6; null = empty slot. cardId = SupportCardRecord.cardId. */
  slots: Array<string | null>;
  /** length 6; per-slot limit break, parallel to slots. */
  slotLb: LimitBreak[];
}

export function emptyDeck(): DeckState;                       // 6 nulls, 6× LB 4
export function clearDeck(): DeckState;                       // alias of emptyDeck (named for intent)
export function addCard(s: DeckState, cardId: string, lb?: LimitBreak): DeckState;
//   no-op if cardId already in deck or no empty slot; else fills first empty slot, slotLb = lb ?? 4
export function dropCard(s: DeckState, index: number, cardId: string, lb?: LimitBreak): DeckState;
//   if cardId already in another slot, that slot is emptied (move); target slot = cardId, slotLb[index] = lb ?? 4
export function removeSlot(s: DeckState, index: number): DeckState;     // slot → null; slotLb[index] left as-is (next add/drop overwrites it)
export function toggleSlotLb(s: DeckState, index: number, level: 1|2|3|4): DeckState;
//   click diamond L: if slotLb[index] === L → L-1 (step down), else → L. Clamp 0..4.
export function isValidDeckState(v: unknown): v is DeckState;          // shape guard for localStorage reads
```

Semantics lifted verbatim from the prototype (`addCard`, `dropOn`, `removeSlot`, `toggleSlotLb`). All functions are immutable (return a new `DeckState`; never mutate the argument). `index` out of range is a no-op return of the same state.

### 2. `useDeckState.ts` — persistence hooks (React + localStorage)

Mirrors the guarded read/write pattern of `useStaminaWarnThreshold.ts` (try/catch around every `localStorage` access; corrupt / missing value falls back to a safe default — a bad stored value can never break the panel).

```ts
const DECK_KEY = (planId: string) => `scb_deck:${planId}`;
const TEMPLATES_KEY = 'scb_profiles';

export interface DeckTemplate { name: string; slots: Array<string|null>; slotLb: LimitBreak[]; }

/** Working deck for the active plan: loads scb_deck:<planId> on planId change, autosaves on every change.
 *  planId undefined (no active plan) → in-memory empty deck, no persistence. */
export function useDeckState(planId: string | undefined): [DeckState, (next: DeckState) => void];

/** Named deck templates over scb_profiles (JSON array). */
export function useDeckTemplates(): {
  templates: DeckTemplate[];
  save: (name: string, state: DeckState) => void;   // upsert by name (replace same-name)
  remove: (name: string) => void;
  get: (name: string) => DeckTemplate | undefined;
};
```

`useDeckState` behavior:
- On `planId` change: read `scb_deck:<planId>`; if present & `isValidDeckState`, use it; else `emptyDeck()`.
- The returned setter updates React state **and** writes `scb_deck:<planId>` (when `planId` defined).
- `planId === undefined`: holds an in-memory empty deck; setter updates state only (no write).

### 3. `YourDeckCard.tsx` — provider-free presentational panel

```ts
export interface DeckCardInfo { typeLabel: string; typeColor: string; name: string; }

export interface YourDeckCardProps {
  state: DeckState;
  onChange: (next: DeckState) => void;
  /** cardId → display info; undefined ⇒ unknown card (render a neutral tile). */
  resolveCard: (cardId: string) => DeckCardInfo | undefined;
  templates: DeckTemplate[];
  onSaveTemplate: (name: string) => void;     // page passes current state through
  onLoadTemplate: (name: string) => void;
  onDeleteTemplate: (name: string) => void;
}
```

- Provider-free: it never calls `useGameData`/`GameIcon`. The page resolves cardId → `DeckCardInfo` and passes `resolveCard` (same pattern as M1.2 passing the portrait/icon ReactNodes).
- Internal-only React state: the template-name `<input>` value and the Load-template `<select>` value (transient UI, not lifted).
- All deck mutations go through the pure `deckOps` functions then `onChange(next)`.

**Drag-drop:** each slot is a drop target. On `dragOver` → `e.preventDefault()` + `.drag-over` highlight (tracked by a local `dragIndex` state). On `drop` → read `e.dataTransfer.getData('text/card-id')`; if non-empty, `onChange(dropCard(state, i, cardId))`. This is standard HTML5 DnD — decoupled from M1.6, which only needs `e.dataTransfer.setData('text/card-id', cardId)` on its tile `dragStart`. (Replaces the prototype's `this._drag` instance var.)

### 4. `InheritancePage.tsx` — wiring

Replace the `<Placeholder title="Your deck" phase="M1.5" />` with `<YourDeckCard …>`:
- `const [deck, setDeck] = useDeckState(uma1Plan?.id);`
- `const { templates, save, remove, get } = useDeckTemplates();`
- `resolveCard`: from `useGameData()` (the page is already inside the GameData provider — it uses `useUmas`/`GameIcon`). Build a `Map<cardId, DeckCardInfo>` from the support-card records once (memoized): `{ typeLabel: TYPE_LABEL[card.type], typeColor: TYPE_COLORS[card.type], name: card.nameEn }`.
- `onSaveTemplate={(name) => save(name, deck)}`, `onLoadTemplate={(name) => { const t = get(name); if (t) setDeck({slots: t.slots, slotLb: t.slotLb}); }}`, `onDeleteTemplate={remove}`.
- **Also export `addCardToDeck(cardId)` from the page** (`setDeck(addCard(deck, cardId))`) — the public fill seam M1.6's "+ Add" button calls. For M1.5 it exists and is unit-tested; no button wires it yet.

### 5. Card type colors / labels

No existing card-type color map in the codebase (verified). Define in `deckOps.ts` (or a small `cardType.ts` sibling) covering **all 7** `CardType`s (`'speed'|'stamina'|'power'|'guts'|'wit'|'friend'|'group'`) — the prototype only colored 5:

```
speed   #3b82f6  SPD     stamina #ef4444  STA     power #ec4899  POW
guts    #f59e0b  GUT     wit     #10b981  WIT
friend  #f472b6  FRD     group   #a78bfa  GRP
```

(speed/stamina/power/guts/wit values are the prototype's exact type colors; friend/group are added.) Labels are the uppercase 3-letter tags shown on the slot tile.

## Visual recreation (handoff §"4. Your deck panel")

Add `.inh-deck-*` rules to `inheritance.css`, extending the existing `.inh-*` grammar:

- **Panel:** `.panel`, sticky `top:0.5rem`, elevated shadow `0 6px 18px rgb(36 54 78 / 0.08)`.
- **Header:** `<h2>` "Your deck" + muted "— 6 support slots"; right toolbar: template-name text input (placeholder "Template name"), `Save` (`cmp-small-btn`), `Load template…` `<select>`, `Del` (`cmp-small-btn`, disabled when no selection), `Clear` (`cmp-small-btn`).
- **Slots grid:** `repeat(6, 1fr)`, gap `0.5rem`; collapses to 3 cols below 640px (per handoff). Each slot: `1.5px dashed` border, `4px` type-colored left border, radius 10px, `min-height:86px`.
  - **Empty:** centered `＋` (1rem) over the slot number, muted, `var(--bg-2)` bg.
  - **Filled:** top-right `×` remove (transparent button); centered column = a 2.4rem type-colored rounded tile showing the 3-letter type label, then an `LB` mini-label + a row of **4 rhombus diamonds** (`clip-path: polygon(50% 0,100% 50%,50% 100%,0 50%)`), filled `linear-gradient(160deg,#ffe488,#e8a008)` up to `slotLb`, else `#d7dce4`. Clicking diamond L calls `toggleSlotLb`.
  - **Drag-over:** `.drag-over` → accent border + `#eef4ff` bg.

Use design-system tokens (`--bg-1/2`, `--border`, `--accent`, `--fg-muted`) so it tracks light/dark; the gold LB gradient + type colors are literal per the handoff palette.

## Interactions (behavioral spec)

- **Add (`addCardToDeck`):** fills first empty slot with the card at LB 4; no-op if the card is already decked or all slots full.
- **Drop:** dropping a card already in another slot **moves** it (old slot emptied); dropping onto a filled slot **replaces** the occupant; slot LB resets to 4 on drop.
- **Remove (`×`):** clears that slot to empty (its `slotLb` is left as-is — the next add/drop overwrites it).
- **LB stepper:** click diamond level L → set LB to L; clicking the current top diamond steps down one. Clamp 0–4.
- **Clear:** empties all 6 slots (resets LB to 4).
- **Save template:** upserts `{name, slots, slotLb}` into `scb_profiles` (replaces a same-name entry); clears the name input.
- **Load template…:** restores `slots` + `slotLb` from the selected template into the working deck (which then autosaves to the active plan).
- **Del:** removes the selected template from `scb_profiles`.

## Testing

- **`deckOps.test.ts`** (pure): add fills first empty / ignores duplicate / no-op when full; drop move + replace + LB reset; removeSlot; toggleSlotLb set / step-down / clamp 0–4; `isValidDeckState` accepts good shape, rejects wrong length / wrong types / non-array.
- **`useDeckState.test.ts`** (jsdom localStorage): loads stored deck on planId; falls back to empty on missing / corrupt; autosaves on change; planId change swaps decks; `undefined` planId = in-memory only (no write); template `save` upserts by name, `remove`, `get`; corrupt `scb_profiles` → `[]`.
- **`YourDeckCard.test.tsx`** (provider-free; inject `state` + `resolveCard` + template props): renders 6 slots; empty slot shows `＋` + number; filled slot shows type label + `×` + 4 diamonds; clicking `×`/diamond/Clear fires `onChange` with the expected `deckOps` result; `drop` with a mock `dataTransfer` (`getData('text/card-id')`) calls `onChange(dropCard(...))`; Save/Load/Del fire the template callbacks; Del disabled with no selection. Register `afterEach(cleanup)` (multiple render-and-query tests).

Per CLAUDE.md, trust `pnpm typecheck` + `pnpm build` (vitest can flake against a running dev server); run the new test files directly.

## Out of scope (later cards)

- The support-card **pool / browse** (drag source, "+ Add" button, filters, Icon/Art/Plot views) — **M1.6**.
- The **coverage matrix** that consumes the deck — **M1.7**.
- Per-card LB carried from the browse pool into the slot on add — wired when M1.6 provides per-card LB (M1.5's `addCard`/`dropCard` already accept an `lb` arg).
- Real card art (slots show the type-color tile placeholder, consistent with the rest of M1).
