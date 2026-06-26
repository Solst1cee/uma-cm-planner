// src/core/cardMatches.test.ts
import { describe, expect, it } from 'vitest';
import { matchCount, matchedSkillIds } from './cardMatches';
import type { SupportCardRecord } from '@/core/types';

const card = {
  cardId: '30028', skills: [
    { skillId: '200001', sourceType: 'hint_pool' },
    { skillId: '200002', sourceType: 'chain' },
    { skillId: '200001', sourceType: 'random_event' },
  ],
} as unknown as SupportCardRecord;

describe('cardMatches', () => {
  it('returns wishlist skills the card provides, de-duped', () => {
    expect(matchedSkillIds(card, new Set(['200001', '999']))).toEqual(['200001']);
  });
  it('counts matches', () => {
    expect(matchCount(card, new Set(['200001', '200002']))).toBe(2);
    expect(matchCount(card, new Set())).toBe(0);
  });
});
