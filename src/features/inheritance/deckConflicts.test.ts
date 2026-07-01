import { describe, expect, it } from 'vitest';
import { canAddCard, duplicateCharSlots, isTraineeConflict } from './deckConflicts';

describe('isTraineeConflict', () => {
  it('flags the trainee’s own character', () => {
    expect(isTraineeConflict('Special Week', 'Special Week')).toBe(true);
    expect(isTraineeConflict('Silence Suzuka', 'Special Week')).toBe(false);
  });
  it('is false when no trainee is resolved', () => {
    expect(isTraineeConflict('Special Week', null)).toBe(false);
    expect(isTraineeConflict('Special Week', undefined)).toBe(false);
  });
});

describe('duplicateCharSlots', () => {
  it('marks the 2nd+ copy of a character (keeps the first)', () => {
    const dupes = duplicateCharSlots(['Oguri Cap', 'Maruzensky', 'Oguri Cap', null, 'Oguri Cap']);
    expect([...dupes].sort()).toEqual([2, 4]);
  });
  it('ignores empty slots and unique characters', () => {
    expect(duplicateCharSlots([null, 'A', undefined, 'B']).size).toBe(0);
  });
});

describe('canAddCard', () => {
  const base = { cardCharName: 'Tokai Teio', traineeCharName: 'Special Week', deckCharNames: new Set<string>(), inDeck: false };
  it('allows a fresh, non-trainee card', () => {
    expect(canAddCard(base)).toBe(true);
  });
  it('blocks a card already in the deck', () => {
    expect(canAddCard({ ...base, inDeck: true })).toBe(false);
  });
  it('blocks the trainee’s own character', () => {
    expect(canAddCard({ ...base, cardCharName: 'Special Week' })).toBe(false);
  });
  it('blocks a sibling card of a character already in the deck', () => {
    expect(canAddCard({ ...base, deckCharNames: new Set(['Tokai Teio']) })).toBe(false);
  });
});
