import { describe, expect, it } from 'vitest';
import type { SupportCardRecord } from '@/core/types';
import { buildCardHintIndex, sourcingForSkill } from './sourcing';

function card(id: string, skills: Array<{ skillId: string; sourceType: 'hint_pool' | 'chain' }>): SupportCardRecord {
  return { cardId: id, nameEn: 'Card ' + id, charName: 'c', rarity: 'SSR', type: 'speed',
    perLevel: [{ limitBreak: 4, hintFrequency: 30, hintLevels: 2, specialtyPriority: 0 }],
    skills, hintPoolSize: skills.length, server: 'global', dataVersion: 't' };
}

describe('sourcing', () => {
  const cards = [card('1', [{ skillId: 'sx', sourceType: 'hint_pool' }]), card('2', [{ skillId: 'sx', sourceType: 'chain' }])];
  const byId = new Map(cards.map((c) => [c.cardId, c]));
  it('indexes skill -> cards and joins a sourcing row', () => {
    const idx = buildCardHintIndex(cards);
    expect(idx.get('sx')!.map((h) => h.cardId).sort()).toEqual(['1', '2']);
    const row = sourcingForSkill('sx', idx, byId, 4);
    expect(row.gap).toBe(false);
    expect(row.cardHints.map((h) => h.cardId)).toContain('1');
  });
  it('flags a gap when no card hints the skill', () => {
    expect(sourcingForSkill('nope', buildCardHintIndex(cards), byId, 4)).toMatchObject({ gap: true, cardHints: [] });
  });
});
