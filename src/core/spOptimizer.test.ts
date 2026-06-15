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
