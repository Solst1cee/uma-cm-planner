import { describe, expect, it } from 'vitest';
import { toSingleCircle } from './skillCircle';
import type { SkillRecord } from './types';

const s = (skillId: string, nameEn: string, rarity: SkillRecord['rarity'], variants: string[]): SkillRecord =>
  ({ skillId, nameEn, nameJp: '', baseSpCost: 0, rarity, iconId: '0', server: 'global', dataVersion: 't', conditions: '', variantSkillIds: variants });

// Right-Handed family: ◎ / ○ / × (white) + Demon (gold).
const byId = new Map<string, SkillRecord>([
  ['200011', s('200011', 'Right-Handed ◎', 'white', ['200012', '200013', '200014'])],
  ['200012', s('200012', 'Right-Handed ○', 'white', ['200011', '200013', '200014'])],
  ['200013', s('200013', 'Right-Handed ×', 'white', ['200011', '200012', '200014'])],
  ['200014', s('200014', 'Right-Handed Demon', 'gold', ['200011', '200012', '200013'])],
  ['200099', s('200099', 'No Circles Here', 'white', [])],
]);

describe('toSingleCircle', () => {
  it('maps a white ◎ to its ○ family variant', () => {
    expect(toSingleCircle('200011', byId)).toBe('200012');
  });
  it('leaves the ○ unchanged', () => {
    expect(toSingleCircle('200012', byId)).toBe('200012');
  });
  it('leaves × and gold unchanged (not a ◎)', () => {
    expect(toSingleCircle('200013', byId)).toBe('200013');
    expect(toSingleCircle('200014', byId)).toBe('200014');
  });
  it('leaves a non-circle white / unknown id unchanged', () => {
    expect(toSingleCircle('200099', byId)).toBe('200099');
    expect(toSingleCircle('999999', byId)).toBe('999999');
  });
});
