import { describe, expect, it } from 'vitest';
import { shouldDuplicateForSlot } from './slotLoad';

describe('shouldDuplicateForSlot', () => {
  it('duplicates when loading uma2 with a plan already in uma1', () => {
    expect(shouldDuplicateForSlot('X', 'uma2', 'X', undefined)).toBe(true);
  });
  it('duplicates when loading uma1 with a plan already in uma2', () => {
    expect(shouldDuplicateForSlot('Y', 'uma1', 'A', 'Y')).toBe(true);
  });
  it('does not duplicate when the id is only in the target slot', () => {
    expect(shouldDuplicateForSlot('X', 'uma1', 'X', undefined)).toBe(false);
    expect(shouldDuplicateForSlot('Y', 'uma2', undefined, 'Y')).toBe(false);
  });
  it('does not duplicate when there is no opposite-slot collision', () => {
    expect(shouldDuplicateForSlot('Z', 'uma1', 'A', 'B')).toBe(false);
    expect(shouldDuplicateForSlot('Z', 'uma2', 'A', 'B')).toBe(false);
  });
});
