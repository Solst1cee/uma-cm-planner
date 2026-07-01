// src/features/inheritance/deckOps.ts
/** M1.5 "Your deck" — pure, immutable deck state + ops (no React/DOM).
 *  Semantics lifted from the handoff prototype (addCard/dropOn/removeSlot/toggleSlotLb).
 *  This deck is its OWN model — NOT CmPlan.lockedDeckSlots (that is M4's suggester concept). */
import type { CardType, LimitBreak } from '@/core/types';

export const DECK_SLOTS = 6;
export const DEFAULT_SLOT_LB: LimitBreak = 4;

export interface DeckState {
  /** length 6; null = empty. cardId = SupportCardRecord.cardId. */
  slots: Array<string | null>;
  /** length 6; per-slot limit break, parallel to slots. */
  slotLb: LimitBreak[];
}

/** Support-card type → display color, sampled from the in-game type tiles
 *  (public/data/icons/ui/stat-*.webp) so chips/borders match the icons exactly. */
export const TYPE_COLORS: Record<CardType, string> = {
  speed: '#007eda', // blue
  stamina: '#da4427', // red-orange
  power: '#eb7300', // orange
  guts: '#f0357e', // pink
  wit: '#00c885', // green
  friend: '#ffb709', // gold (Pal)
  group: '#4ecd00', // green
};

/** Support-card type → 3-letter uppercase tag shown on the slot tile. */
export const TYPE_LABEL: Record<CardType, string> = {
  speed: 'SPD',
  stamina: 'STA',
  power: 'POW',
  guts: 'GUT',
  wit: 'WIT',
  friend: 'FRD',
  group: 'GRP',
};

const inRange = (i: number) => Number.isInteger(i) && i >= 0 && i < DECK_SLOTS;
const clampLb = (n: number): LimitBreak => Math.max(0, Math.min(4, n)) as LimitBreak;

export function emptyDeck(): DeckState {
  return { slots: Array(DECK_SLOTS).fill(null), slotLb: Array(DECK_SLOTS).fill(DEFAULT_SLOT_LB) };
}

export function clearDeck(): DeckState {
  return emptyDeck();
}

export function addCard(s: DeckState, cardId: string, lb: LimitBreak = DEFAULT_SLOT_LB): DeckState {
  if (s.slots.includes(cardId)) return s;
  const i = s.slots.indexOf(null);
  if (i === -1) return s;
  const slots = s.slots.slice();
  const slotLb = s.slotLb.slice();
  slots[i] = cardId;
  slotLb[i] = clampLb(lb);
  return { slots, slotLb };
}

export function dropCard(s: DeckState, index: number, cardId: string, lb: LimitBreak = DEFAULT_SLOT_LB): DeckState {
  if (!inRange(index)) return s;
  const slots = s.slots.slice();
  const slotLb = s.slotLb.slice();
  const existing = slots.indexOf(cardId);
  if (existing !== -1) slots[existing] = null; // move
  slots[index] = cardId;
  slotLb[index] = clampLb(lb);
  return { slots, slotLb };
}

/** Swap slots `from` and `to` (cards + their LBs) — used for drag-reordering the
 *  deck. If `to` is empty the card just moves there; no-op for out-of-range or equal. */
export function moveSlot(s: DeckState, from: number, to: number): DeckState {
  if (!inRange(from) || !inRange(to) || from === to) return s;
  const slots = s.slots.slice();
  const slotLb = s.slotLb.slice();
  const cardFrom = slots[from] ?? null;
  const lbFrom = slotLb[from] ?? DEFAULT_SLOT_LB;
  slots[from] = slots[to] ?? null;
  slotLb[from] = slotLb[to] ?? DEFAULT_SLOT_LB;
  slots[to] = cardFrom;
  slotLb[to] = lbFrom;
  return { slots, slotLb };
}

export function removeSlot(s: DeckState, index: number): DeckState {
  if (!inRange(index)) return s;
  const slots = s.slots.slice();
  slots[index] = null; // slotLb left as-is; next add/drop overwrites it
  return { slots, slotLb: s.slotLb.slice() };
}

export function toggleSlotLb(s: DeckState, index: number, level: 1 | 2 | 3 | 4): DeckState {
  if (!inRange(index)) return s;
  const slotLb = s.slotLb.slice();
  slotLb[index] = clampLb(slotLb[index] === level ? level - 1 : level);
  return { slots: s.slots.slice(), slotLb };
}

/** True when no slot is filled (used to decide whether an unnamed deck is worth preserving). */
export function isDeckEmpty(s: DeckState): boolean {
  return s.slots.every((x) => x === null);
}

export function isValidDeckState(v: unknown): v is DeckState {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  const { slots, slotLb } = o;
  if (!Array.isArray(slots) || slots.length !== DECK_SLOTS) return false;
  if (!Array.isArray(slotLb) || slotLb.length !== DECK_SLOTS) return false;
  const slotsOk = slots.every((x) => x === null || typeof x === 'string');
  const lbOk = slotLb.every((x) => typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 4);
  return slotsOk && lbOk;
}
