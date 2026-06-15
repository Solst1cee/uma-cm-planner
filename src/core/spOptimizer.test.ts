/**
 * Tests for the Module 2 SP Purchase Optimizer core (pure, sim-free).
 * SP costs are the on-screen effective costs entered by the user (no cost
 * calculation in v1 — see spec §2/§4). Mechanics refs cite
 * docs/mechanics-notes.md where relevant (retrieved 2026-06-15).
 */
import { describe, expect, it } from 'vitest';

import { basketSpCost, prereqClosure, type BuyableSkill } from '@/core/spOptimizer';

// --- test helpers ---
function buy(skillId: string, screenSpCost: number, prereqSkillId?: string): BuyableSkill {
  return { skillId, rarity: prereqSkillId ? 'gold' : 'white', screenSpCost, prereqSkillId };
}

const CANDS: BuyableSkill[] = [
  buy('w1', 100),
  buy('w2', 200),
  buy('g1', 150, 'w1'), // gold needs white w1
];

// --- prereqClosure ---
describe('prereqClosure', () => {
  it('adds a gold skill’s white prereq when present in candidates', () => {
    expect(prereqClosure(['g1'], CANDS).sort()).toEqual(['g1', 'w1']);
  });

  it('is a no-op when there is no prereq', () => {
    expect(prereqClosure(['w2'], CANDS)).toEqual(['w2']);
  });

  it('dedupes when the prereq is already selected', () => {
    expect(prereqClosure(['g1', 'w1'], CANDS).sort()).toEqual(['g1', 'w1']);
  });

  it('adds a prereq id even when that prereq is absent from candidates', () => {
    const orphan: BuyableSkill[] = [buy('g_orphan', 200, 'w_missing')];
    expect(prereqClosure(['g_orphan'], orphan)).toContain('w_missing');
  });
});

// --- basketSpCost ---
describe('basketSpCost', () => {
  it('sums the on-screen costs of the given skills', () => {
    // w1 100 + w2 200 = 300
    expect(basketSpCost(['w1', 'w2'], CANDS)).toBe(300);
  });

  it('ignores skill ids not in the candidate list (owned/unknown cost 0)', () => {
    expect(basketSpCost(['w1', 'owned'], CANDS)).toBe(100);
  });
});

import { enumerateFeasibleBaskets } from '@/core/spOptimizer';

// --- enumerateFeasibleBaskets ---
describe('enumerateFeasibleBaskets', () => {
  const cands: BuyableSkill[] = [buy('a', 100), buy('b', 100), buy('c', 100)];

  it('returns the empty basket plus every affordable subset (budget 200)', () => {
    const baskets = enumerateFeasibleBaskets(cands, 200, []);
    const asSets = baskets.map((b) => b.slice().sort().join(','));
    expect(asSets).toContain(''); // spend nothing
    expect(asSets).toContain('a');
    expect(asSets).toContain('a,b');
    expect(asSets).not.toContain('a,b,c'); // 300 > 200
  });

  it('forces pinned ids into every basket and deducts their cost first', () => {
    const baskets = enumerateFeasibleBaskets(cands, 200, ['a']);
    expect(baskets.every((b) => b.includes('a'))).toBe(true);
    // 'a' is pinned (100), so only one more 100 skill fits
    expect(baskets.some((b) => b.length === 3)).toBe(false);
  });

  it('keeps a gold and its white prereq together as one feasible unit', () => {
    const gold: BuyableSkill[] = [buy('w', 100), buy('g', 100, 'w')];
    const baskets = enumerateFeasibleBaskets(gold, 150, []);
    const asSets = baskets.map((b) => b.slice().sort().join(','));
    expect(asSets).toContain('w'); // white alone fits (100)
    expect(asSets).not.toContain('g'); // gold pulls in w → 200 > 150, infeasible
    expect(asSets).not.toContain('g,w'); // also 200 > 150
  });
});

import { type ScoredBasket, selectTopDiverse, skillSetDistance } from '@/core/spOptimizer';

// --- skillSetDistance ---
describe('skillSetDistance', () => {
  it('counts symmetric-difference size', () => {
    expect(skillSetDistance(['a', 'b'], ['a', 'c'])).toBe(2); // b out, c in
    expect(skillSetDistance(['a', 'b'], ['a', 'b'])).toBe(0);
  });
});

// --- selectTopDiverse ---
describe('selectTopDiverse', () => {
  const scored: ScoredBasket[] = [
    { skills: ['a', 'b'], score: 10, spUsed: 0, spLeft: 0 },
    { skills: ['a', 'b', 'c'], score: 9.9, spUsed: 0, spLeft: 0 }, // dist 1 from best → too similar
    { skills: ['d', 'e'], score: 9, spUsed: 0, spLeft: 0 }, // diverse
    { skills: ['f', 'g'], score: 1, spUsed: 0, spLeft: 0 }, // outside band
  ];

  it('ranks by score, enforces ≥2-skill diversity, and applies the bashin band', () => {
    const top = selectTopDiverse(scored, { k: 3, bandBashin: 2, minDistance: 2 });
    expect(top.map((b) => b.skills.join(','))).toEqual(['a,b', 'd,e']);
  });

  it('returns fewer than k when diversity/band cannot be satisfied', () => {
    const top = selectTopDiverse(scored, { k: 3, bandBashin: 2, minDistance: 2 });
    expect(top.length).toBeLessThanOrEqual(3);
  });
});

import { shortlistByProxy } from '@/core/spOptimizer';

// --- shortlistByProxy ---
describe('shortlistByProxy', () => {
  const cands: BuyableSkill[] = [buy('a', 100), buy('b', 100), buy('c', 100), buy('d', 100)];
  const deltaL: Record<string, number> = { a: 1, b: 1, c: 5, d: 0.5 };

  it('produces budget-feasible baskets including the proxy-optimal one', () => {
    const lists = shortlistByProxy(cands, 200, [], deltaL, { limit: 10, minDistance: 2 });
    expect(lists.length).toBeGreaterThan(0);
    expect(lists.every((b) => basketSpCost(b, cands) <= 200)).toBe(true);
    const top = lists[0]!.slice().sort().join(',');
    expect(['a,c', 'b,c']).toContain(top);
  });

  it('beats naive greedy-by-cost: a knapsack counterexample', () => {
    const kn: BuyableSkill[] = [buy('x', 2), buy('y', 1), buy('z', 2)];
    const d: Record<string, number> = { x: 3, y: 2, z: 2.9 };
    const lists = shortlistByProxy(kn, 3, [], d, { limit: 10, minDistance: 1 });
    const proxySum = (b: string[]) => b.reduce((s, id) => s + (d[id] ?? 0), 0);
    const best = Math.max(...lists.map(proxySum));
    expect(best).toBe(5); // x+y, not the greedy-ratio trap
  });

  it('respects pins and the shortlist limit', () => {
    const lists = shortlistByProxy(cands, 300, ['a'], deltaL, { limit: 3, minDistance: 1 });
    expect(lists.length).toBeLessThanOrEqual(3);
    expect(lists.every((b) => b.includes('a'))).toBe(true);
  });
});
