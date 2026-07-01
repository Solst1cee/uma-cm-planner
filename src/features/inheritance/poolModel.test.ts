// src/features/inheritance/poolModel.test.ts
import { describe, expect, it } from 'vitest';
import { buildPoolItem, cardStatLines, filterPool, sortPool } from './poolModel';
import type { PoolFilters, PoolItem } from './poolModel';
import type { SupportCardRecord } from '@/core/types';

const mk = (id: string, type: SupportCardRecord['type'], rarity: SupportCardRecord['rarity'], name: string, skills: { skillId: string; sourceType: string }[] = []) =>
  ({ cardId: id, nameEn: name, charName: name, rarity, type, skills, server: 'global' } as unknown as SupportCardRecord);

describe('poolModel', () => {
  const wishlist = new Set(['s1']);
  const a = buildPoolItem(mk('1', 'speed', 'SSR', 'Alpha', [{ skillId: 's1', sourceType: 'chain' }]), { score: 10, wishlist, lb: 4 });
  const b = buildPoolItem(mk('2', 'stamina', 'SR', 'Beta'), { score: 20, wishlist, lb: 4 });
  const c = buildPoolItem(mk('3', 'speed', 'SSR', 'Gamma'), { wishlist, lb: 4 }); // no score → null

  it('builds an item with match + chain classification', () => {
    expect(a.matchCount).toBe(1);
    expect(a.chain).toEqual(['s1']);
    expect(c.score).toBeNull();
    expect(a.stats).toEqual([]); // no statsRow → no stat lines
  });
  it('cardStatLines converts multipliers to % and passes raw values (Kitasan LB4)', () => {
    // Real euophrys values: tb/fs_bonus/mb/hint_rate are multipliers; race_bonus/
    // specialty_rate are raw; sb = starting bond (init gauge).
    const lines = cardStatLines({
      tb: 1.15, fs_bonus: 1.25, mb: 1.3, hint_rate: 1.3, race_bonus: 5, specialty_rate: 80, sb: 35,
    });
    const m = Object.fromEntries(lines.map((l) => [l.label, l.value]));
    expect(m).toEqual({
      Training: '+15%', Friendship: '+25%', Mood: '+30%', 'Hint freq': '+30%',
      'Race bonus': '5%', Specialty: '80', 'Init. gauge': '35',
    });
    expect(cardStatLines(undefined)).toEqual([]);
  });
  it('filters by rarity/type/search', () => {
    const all = [a, b, c];
    expect(filterPool(all, { rarity: 'SSR', type: 'all', skill: null, search: '', showUpcoming: false }).map((i) => i.cardId)).toEqual(['1', '3']);
    expect(filterPool(all, { rarity: 'all', type: 'speed', skill: null, search: 'gam', showUpcoming: false }).map((i) => i.cardId)).toEqual(['3']);
  });
  it('sorts by matches then effect', () => {
    expect(sortPool([b, a, c], 'matches').map((i) => i.cardId)).toEqual(['1', '2', '3']); // a matches → first
    expect(sortPool([a, b, c], 'effect').map((i) => i.cardId)).toEqual(['2', '1', '3']); // 20,10,null
  });
});

describe('filterPool — availability gating', () => {
  const base = { cardId: 'x', name: 'X', charName: 'X', rarity: 'SSR', type: 'speed', typeColor: '', typeLabel: '', score: null, matchCount: 0, matchedIds: [], chain: [], random: [], hint: [], stats: [], server: 'global' } as unknown as PoolItem;
  const globalItem: PoolItem = { ...base, cardId: 'g', server: 'global' };
  const jpSoon: PoolItem = { ...base, cardId: 'j1', server: 'jp', releaseDate: '2026-07-01', releaseDatePredicted: true };
  const jpLater: PoolItem = { ...base, cardId: 'j2', server: 'jp', releaseDate: '2027-01-01', releaseDatePredicted: true };
  const filters = { rarity: 'all', type: 'all', skill: null, search: '', showUpcoming: false } as PoolFilters;

  it('hides jp cards when showUpcoming is off', () => {
    const out = filterPool([globalItem, jpSoon], filters, '2026-08-01');
    expect(out.map((i) => i.cardId)).toEqual(['g']);
  });
  it('shows jp cards released by the CM date when showUpcoming is on', () => {
    const out = filterPool([globalItem, jpSoon, jpLater], { ...filters, showUpcoming: true }, '2026-08-01');
    expect(out.map((i) => i.cardId).sort()).toEqual(['g', 'j1']); // j2 not out by 2026-08-01
  });
});
