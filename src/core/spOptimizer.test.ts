/**
 * Tests for the Module 2 SP Purchase Optimizer core (pure, sim-free).
 * SP costs are the on-screen effective costs entered by the user (no cost
 * calculation in v1 — see spec §2/§4). Mechanics refs cite
 * docs/mechanics-notes.md where relevant (retrieved 2026-06-15).
 */
import { describe, expect, it } from 'vitest';

import {
  basketSpCost,
  chooseBasketsToScore,
  enumerateFeasibleBaskets,
  parseCaptureBundle,
  prereqClosure,
  selectTopDiverse,
  shortlistByProxy,
  skillSetDistance,
  wishlistToCandidates,
  type BuyableSkill,
  type ScoredBasket,
} from '@/core/spOptimizer';
import { FIXTURE_SKILLS } from '@/core/fixtures';
import type { WishlistItem } from '@/core/types';

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
  it("adds a gold skill's white prereq when present in candidates", () => {
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

  it('beats greedy-by-density on a knapsack counterexample (finds the optimum)', () => {
    // budget 4; a:cost3/val5, b:cost2/val3, c:cost2/val3.
    // greedy-by-density picks a (5/3≈1.67) first → cost3, nothing else fits → val5.
    // optimal is b+c (cost4, val6); the exact DP must find 6.
    const kn: BuyableSkill[] = [buy('a', 3), buy('b', 2), buy('c', 2)];
    const d: Record<string, number> = { a: 5, b: 3, c: 3 };
    const lists = shortlistByProxy(kn, 4, [], d, { limit: 10, minDistance: 1 });
    const proxySum = (b: string[]) => b.reduce((s, id) => s + (d[id] ?? 0), 0);
    expect(Math.max(...lists.map(proxySum))).toBe(6); // b+c, not greedy's a=5
  });

  it('respects pins and the shortlist limit', () => {
    const lists = shortlistByProxy(cands, 300, ['a'], deltaL, { limit: 3, minDistance: 1 });
    expect(lists.length).toBeLessThanOrEqual(3);
    expect(lists.every((b) => b.includes('a'))).toBe(true);
  });
});

// --- chooseBasketsToScore ---
describe('chooseBasketsToScore', () => {
  const cands: BuyableSkill[] = [buy('a', 100), buy('b', 100), buy('c', 100)];

  it('uses the exact branch when feasible subsets are within the threshold', () => {
    const r = chooseBasketsToScore(
      { candidates: cands, spBudget: 200, pinned: [] },
      {},
      { exactThreshold: 100, shortlistLimit: 10, minDistance: 1 },
    );
    expect(r.mode).toBe('exact');
    expect(r.baskets.length).toBe(enumerateFeasibleBaskets(cands, 200, []).length);
  });

  it('falls back to the shortlist when the feasible count exceeds the threshold', () => {
    const r = chooseBasketsToScore(
      { candidates: cands, spBudget: 300, pinned: [] },
      { a: 1, b: 1, c: 1 },
      { exactThreshold: 3, shortlistLimit: 5, minDistance: 1 },
    );
    expect(r.mode).toBe('shortlist');
    expect(r.baskets.length).toBeLessThanOrEqual(5);
  });

  it('skips the exact branch (no 2^n blowup) when there are many optional candidates', () => {
    const many: BuyableSkill[] = Array.from({ length: 24 }, (_, i) => buy(`s${i}`, 10));
    const dl = Object.fromEntries(many.map((c) => [c.skillId, 1]));
    const r = chooseBasketsToScore(
      { candidates: many, spBudget: 1000, pinned: [] },
      dl,
      { exactThreshold: 256, shortlistLimit: 5, minDistance: 1 },
    );
    expect(r.mode).toBe('shortlist'); // returns fast, never enumerates 2^24
    expect(r.baskets.length).toBeLessThanOrEqual(5);
  });

  it('surfaces the forced pinned basket when must-buys exceed the budget', () => {
    const r = chooseBasketsToScore(
      { candidates: cands, spBudget: 150, pinned: ['a', 'b'] }, // 100 + 100 = 200 > 150
      {},
      { exactThreshold: 100, shortlistLimit: 5, minDistance: 1 },
    );
    expect(r.baskets).toEqual([['a', 'b']]);
  });
});

describe('parseCaptureBundle', () => {
  const valid = {
    schemaVersion: 1, source: 'ocr', capturedAt: '2026-06-15T00:00:00.000Z',
    server: 'global', dataVersion: 'v', seed: 12345,
    context: {
      umaId: '', stats: { spd: 1000, sta: 800, pow: 800, gut: 400, wit: 600 },
      aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, strategy: 'pace',
      courseId: '10101', spBudget: 2285, ownedSkills: [], pinned: [],
      candidates: [{ skillId: '200332', rarity: 'white', screenSpCost: 110, matchTier: 'exact' }],
    },
  };

  it('accepts a valid bundle through a JSON round-trip', () => {
    const b = parseCaptureBundle(JSON.parse(JSON.stringify(valid)));
    expect(b.source).toBe('ocr');
    expect(b.context.spBudget).toBe(2285);
    expect(b.context.candidates[0]!.skillId).toBe('200332');
    expect(b.context.candidates[0]!.matchTier).toBe('exact');
  });

  it('rejects a wrong schemaVersion', () => {
    expect(() => parseCaptureBundle({ ...valid, schemaVersion: 2 })).toThrow(/schemaVersion/);
  });

  it('rejects a non-object / missing context', () => {
    expect(() => parseCaptureBundle({ ...valid, context: undefined })).toThrow(/context/);
    expect(() => parseCaptureBundle(null)).toThrow(/bundle/);
  });

  it('rejects a non-string candidate skillId', () => {
    const bad = JSON.parse(JSON.stringify(valid));
    bad.context.candidates[0].skillId = 123;
    expect(() => parseCaptureBundle(bad)).toThrow(/skillId/);
  });

  it('rejects an invalid rarity', () => {
    const bad = JSON.parse(JSON.stringify(valid));
    bad.context.candidates[0].rarity = 'legendary';
    expect(() => parseCaptureBundle(bad)).toThrow(/rarity/);
  });

  it('rejects a non-finite cost (Infinity)', () => {
    const bad = JSON.parse(JSON.stringify(valid));
    bad.context.candidates[0].screenSpCost = Infinity;
    expect(() => parseCaptureBundle(bad)).toThrow(/finite/);
  });

  it('rejects an invalid strategy, aptitude grade, and server', () => {
    const badStrat = JSON.parse(JSON.stringify(valid)); badStrat.context.strategy = 'sprint';
    expect(() => parseCaptureBundle(badStrat)).toThrow(/strategy/);
    const badGrade = JSON.parse(JSON.stringify(valid)); badGrade.context.aptitudes.distance = 'Z';
    expect(() => parseCaptureBundle(badGrade)).toThrow(/aptitudes\.distance/);
    const badServer = JSON.parse(JSON.stringify(valid)); badServer.server = 'tw';
    expect(() => parseCaptureBundle(badServer)).toThrow(/server/);
  });
});

const SKILL_BY_ID = new Map(FIXTURE_SKILLS.map((s) => [s.skillId, s]));
const wl = (skillId: string): WishlistItem => ({ skillId, priority: 1, source: 'targeted' });

describe('wishlistToCandidates', () => {
  it('maps wishlist skills to BuyableSkills with dataset rarity/base cost/prereq', () => {
    expect(wishlistToCandidates([wl('200332'), wl('200331')], SKILL_BY_ID)).toEqual([
      { skillId: '200332', rarity: 'white', screenSpCost: 110, matchTier: 'manual' },
      { skillId: '200331', rarity: 'gold', screenSpCost: 160, prereqSkillId: '200332', matchTier: 'manual' },
    ]);
  });

  it('dedupes and skips ids absent from the dataset', () => {
    const out = wishlistToCandidates([wl('200332'), wl('200332'), wl('999999')], SKILL_BY_ID);
    expect(out.map((c) => c.skillId)).toEqual(['200332']);
  });
});
