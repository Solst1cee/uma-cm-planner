// src/core/cardScore.test.ts
import { describe, expect, it } from 'vitest';
import cards from '@/vendor/uma-tiers/gl';
import { DEFAULT_SCENARIO, cardRowsByKey, resolveDeckObjects, scoreCards } from './cardScore';
import { emptyDeck } from '@/features/inheritance/deckOps';

describe('cardScore', () => {
  it('scores every requested row, keyed by card id', () => {
    const lb4 = cards.filter((c) => c.limit_break === 4);
    const scores = scoreCards(DEFAULT_SCENARIO, [], lb4);
    expect(scores.size).toBe(226);
    for (const c of lb4) expect(scores.get(String(c.id))).toBeDefined();
  });

  it('ranks Kitasan Black SSR (30028) near the top of speed cards', () => {
    const speedLb4 = cards.filter((c) => c.type === 0 && c.limit_break === 4);
    const scores = scoreCards(DEFAULT_SCENARIO, [], speedLb4);
    const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score).map(([id]) => id);
    expect(ranked.indexOf('30028')).toBeLessThan(5); // top 5 of speed SSRs
  });

  it('resolveDeckObjects maps filled slots to gl rows at slot LB', () => {
    const byKey = cardRowsByKey();
    const deck = { ...emptyDeck(), slots: ['30028', null, null, null, null, null], slotLb: [2, 4, 4, 4, 4, 4] as const };
    const objs = resolveDeckObjects(deck as never, byKey);
    expect(objs).toHaveLength(1);
    expect(objs[0]!.id).toBe(30028);
    expect(objs[0]!.limit_break).toBe(2);
  });

  it('omits ids absent from the vendored set', () => {
    const scores = scoreCards(DEFAULT_SCENARIO, [], []);
    expect(scores.size).toBe(0);
  });
});
