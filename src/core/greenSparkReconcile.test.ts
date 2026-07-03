// src/core/greenSparkReconcile.test.ts
import { describe, expect, it } from 'vitest';
import { buildUniqueToInheritedMap, reconcileGreenSkillId } from './greenSparkReconcile';
import type { SkillRecord } from './types';

const s = (skillId: string, nameEn: string, rarity: SkillRecord['rarity']): SkillRecord =>
  ({ skillId, nameEn, nameJp: '', baseSpCost: 0, rarity, iconId: '0', conditions: '', server: 'global', dataVersion: 't' });

const SKILLS: SkillRecord[] = [
  s('100011', 'Shooting Star', 'unique'),
  s('900011', 'Shooting Star', 'inherited_unique'),
  s('110011', "Dazzl'n Diver", 'unique'),
  s('910011', "Dazzl'n Diver", 'inherited_unique'),
  s('200012', 'Corner Recovery', 'white'), // unrelated
];

describe('buildUniqueToInheritedMap', () => {
  it('maps native unique → inherited-unique by prefix swap, validated by name', () => {
    const { map, unresolved } = buildUniqueToInheritedMap(SKILLS);
    expect(map.get('100011')).toBe('900011');
    expect(map.get('110011')).toBe('910011');
    expect(unresolved).toEqual([]);
  });

  it('reports a native unique with no matching inherited-unique as unresolved', () => {
    const orphan = [s('100999', 'Orphan Unique', 'unique')];
    const { map, unresolved } = buildUniqueToInheritedMap(orphan);
    expect(map.has('100999')).toBe(false);
    expect(unresolved).toEqual(['100999']);
  });
});

describe('reconcileGreenSkillId', () => {
  it('returns the inherited-unique id for a native unique id', () => {
    const { map } = buildUniqueToInheritedMap(SKILLS);
    expect(reconcileGreenSkillId('100011', map)).toBe('900011');
  });
  it('is idempotent on an already-inherited (9xxxxx) id', () => {
    const { map } = buildUniqueToInheritedMap(SKILLS);
    expect(reconcileGreenSkillId('900011', map)).toBe('900011');
  });
  it('returns the input unchanged when unmapped', () => {
    const { map } = buildUniqueToInheritedMap(SKILLS);
    expect(reconcileGreenSkillId('100999', map)).toBe('100999');
  });
});

