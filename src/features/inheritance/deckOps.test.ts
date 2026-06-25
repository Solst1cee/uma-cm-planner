import { describe, expect, it } from 'vitest';
import {
  DECK_SLOTS, DEFAULT_SLOT_LB, TYPE_COLORS, TYPE_LABEL,
  emptyDeck, clearDeck, addCard, dropCard, removeSlot, toggleSlotLb, isValidDeckState,
} from './deckOps';

describe('emptyDeck', () => {
  it('is 6 null slots and 6 LB-4 entries', () => {
    const d = emptyDeck();
    expect(d.slots).toEqual([null, null, null, null, null, null]);
    expect(d.slotLb).toEqual([4, 4, 4, 4, 4, 4]);
    expect(DECK_SLOTS).toBe(6);
    expect(DEFAULT_SLOT_LB).toBe(4);
  });
  it('clearDeck equals emptyDeck', () => {
    expect(clearDeck()).toEqual(emptyDeck());
  });
  it('does not mutate a shared reference (fresh arrays each call)', () => {
    const a = emptyDeck();
    a.slots[0] = 'x';
    expect(emptyDeck().slots[0]).toBeNull();
  });
});

describe('addCard', () => {
  it('fills the first empty slot at LB 4', () => {
    const d = addCard(emptyDeck(), 'c1');
    expect(d.slots[0]).toBe('c1');
    expect(d.slotLb[0]).toBe(4);
  });
  it('uses the second slot when the first is taken', () => {
    const d = addCard(addCard(emptyDeck(), 'c1'), 'c2');
    expect(d.slots).toEqual(['c1', 'c2', null, null, null, null]);
  });
  it('ignores a card already in the deck', () => {
    const once = addCard(emptyDeck(), 'c1');
    expect(addCard(once, 'c1')).toEqual(once);
  });
  it('is a no-op when the deck is full', () => {
    let d = emptyDeck();
    ['a', 'b', 'c', 'd', 'e', 'f'].forEach((id) => (d = addCard(d, id)));
    expect(addCard(d, 'g')).toEqual(d);
  });
  it('honors an explicit LB', () => {
    expect(addCard(emptyDeck(), 'c1', 2).slotLb[0]).toBe(2);
  });
  it('does not mutate the input', () => {
    const input = emptyDeck();
    addCard(input, 'c1');
    expect(input.slots[0]).toBeNull();
  });
});

describe('dropCard', () => {
  it('places a card into the target slot at LB 4', () => {
    const d = dropCard(emptyDeck(), 2, 'c1');
    expect(d.slots[2]).toBe('c1');
    expect(d.slotLb[2]).toBe(4);
  });
  it('moves a card already in the deck (empties its old slot)', () => {
    const start = addCard(emptyDeck(), 'c1'); // slot 0
    const moved = dropCard(start, 3, 'c1');
    expect(moved.slots[0]).toBeNull();
    expect(moved.slots[3]).toBe('c1');
  });
  it('replaces the occupant of a filled target slot', () => {
    const start = dropCard(emptyDeck(), 1, 'c1');
    const replaced = dropCard(start, 1, 'c2');
    expect(replaced.slots[1]).toBe('c2');
  });
  it('is a no-op for an out-of-range index', () => {
    const d = emptyDeck();
    expect(dropCard(d, 9, 'c1')).toEqual(d);
  });
});

describe('removeSlot', () => {
  it('empties the slot', () => {
    const start = dropCard(emptyDeck(), 0, 'c1');
    expect(removeSlot(start, 0).slots[0]).toBeNull();
  });
  it('is a no-op for an out-of-range index', () => {
    const d = emptyDeck();
    expect(removeSlot(d, 9)).toEqual(d);
  });
});

describe('toggleSlotLb', () => {
  it('sets the LB to the clicked level', () => {
    expect(toggleSlotLb(emptyDeck(), 0, 2).slotLb[0]).toBe(2);
  });
  it('steps down by one when clicking the current top level', () => {
    const at3 = toggleSlotLb(emptyDeck(), 0, 3);
    expect(toggleSlotLb(at3, 0, 3).slotLb[0]).toBe(2);
  });
  it('clamps within 0..4', () => {
    const at1 = toggleSlotLb(emptyDeck(), 0, 1);
    expect(toggleSlotLb(at1, 0, 1).slotLb[0]).toBe(0); // 1 → step down → 0
  });
  it('is a no-op for an out-of-range index', () => {
    const d = emptyDeck();
    expect(toggleSlotLb(d, 9, 2)).toEqual(d);
  });
});

describe('isValidDeckState', () => {
  it('accepts a well-formed deck', () => {
    expect(isValidDeckState(emptyDeck())).toBe(true);
    expect(isValidDeckState({ slots: ['c1', null, null, null, null, null], slotLb: [4, 4, 4, 4, 4, 4] })).toBe(true);
  });
  it('rejects wrong slot length', () => {
    expect(isValidDeckState({ slots: [null], slotLb: [4] })).toBe(false);
  });
  it('rejects wrong member types', () => {
    expect(isValidDeckState({ slots: [1, null, null, null, null, null], slotLb: [4, 4, 4, 4, 4, 4] })).toBe(false);
    expect(isValidDeckState({ slots: [null, null, null, null, null, null], slotLb: [9, 4, 4, 4, 4, 4] })).toBe(false);
  });
  it('rejects non-objects', () => {
    expect(isValidDeckState(null)).toBe(false);
    expect(isValidDeckState('x')).toBe(false);
    expect(isValidDeckState({})).toBe(false);
  });
});

describe('card-type maps', () => {
  it('cover all 7 card types', () => {
    const types = ['speed', 'stamina', 'power', 'guts', 'wit', 'friend', 'group'] as const;
    for (const t of types) {
      expect(TYPE_COLORS[t]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(TYPE_LABEL[t]).toMatch(/^[A-Z]{3}$/);
    }
  });
});
