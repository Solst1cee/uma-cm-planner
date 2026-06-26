// src/features/inheritance/poolModel.test.ts
import { describe, expect, it } from 'vitest';
import { buildPoolItem, filterPool, sortPool } from './poolModel';
import type { SupportCardRecord } from '@/core/types';

const mk = (id: string, type: SupportCardRecord['type'], rarity: SupportCardRecord['rarity'], name: string, skills: { skillId: string; sourceType: string }[] = []) =>
  ({ cardId: id, nameEn: name, charName: name, rarity, type, skills } as unknown as SupportCardRecord);

describe('poolModel', () => {
  const wishlist = new Set(['s1']);
  const a = buildPoolItem(mk('1', 'speed', 'SSR', 'Alpha', [{ skillId: 's1', sourceType: 'chain' }]), { score: 10, wishlist, lb: 4 });
  const b = buildPoolItem(mk('2', 'stamina', 'SR', 'Beta'), { score: 20, wishlist, lb: 4 });
  const c = buildPoolItem(mk('3', 'speed', 'SSR', 'Gamma'), { wishlist, lb: 4 }); // no score → null

  it('builds an item with match + chain classification', () => {
    expect(a.matchCount).toBe(1);
    expect(a.chain).toEqual(['s1']);
    expect(c.score).toBeNull();
  });
  it('filters by rarity/type/search', () => {
    const all = [a, b, c];
    expect(filterPool(all, { rarity: 'SSR', type: 'all', skill: null, search: '' }).map((i) => i.cardId)).toEqual(['1', '3']);
    expect(filterPool(all, { rarity: 'all', type: 'speed', skill: null, search: 'gam' }).map((i) => i.cardId)).toEqual(['3']);
  });
  it('sorts by matches then effect', () => {
    expect(sortPool([b, a, c], 'matches').map((i) => i.cardId)).toEqual(['1', '2', '3']); // a matches → first
    expect(sortPool([a, b, c], 'effect').map((i) => i.cardId)).toEqual(['2', '1', '3']); // 20,10,null
  });
});
