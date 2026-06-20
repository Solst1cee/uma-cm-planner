import { describe, it, expect } from 'vitest';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadUpcomingCards } from './lib/upcoming-cards';

function tmpFile(contents: object): string {
  const dir = mkdtempSync(join(tmpdir(), 'upcard-'));
  const p = join(dir, 'upcoming_cards.json');
  writeFileSync(p, JSON.stringify(contents), 'utf8');
  return p;
}

const perLevel = [0, 1, 2, 3, 4].map((lb) => ({ limitBreak: lb, hintFrequency: 1, hintLevels: 1, specialtyPriority: 1 }));
const valid = {
  cardId: '40001', nameEn: 'Preview SSR', charName: 'Someone', rarity: 'SSR', type: 'speed',
  perLevel, skills: [{ skillId: '200001', sourceType: 'hint_pool', hintLevels: 1 }], hintPoolSize: 1,
  server: 'jp', dataVersion: 'global-76214c82', releaseDate: '2026-07-30', releaseDatePredicted: true,
};

describe('loadUpcomingCards', () => {
  it('returns [] when the file is missing', () => {
    expect(loadUpcomingCards(join(tmpdir(), 'nope-upcoming_cards.json'), { existingCardIds: new Set() })).toEqual([]);
  });
  it('inserts a valid server:jp upcoming card', () => {
    const recs = loadUpcomingCards(tmpFile({ records: [valid] }), { existingCardIds: new Set() });
    expect(recs).toHaveLength(1);
    expect(recs[0]?.cardId).toBe('40001');
  });
  it('accepts an upcoming card that grants a non-cutover (upcoming) skill', () => {
    const withUpcomingSkill = {
      ...valid,
      skills: [{ skillId: '999001', sourceType: 'hint_pool', hintLevels: 1 }],
    };
    const recs = loadUpcomingCards(tmpFile({ records: [withUpcomingSkill] }), { existingCardIds: new Set() });
    expect(recs[0]?.skills[0]?.skillId).toBe('999001');
  });
  it('rejects server:global (use card_additions instead)', () => {
    expect(() => loadUpcomingCards(tmpFile({ records: [{ ...valid, server: 'global' }] }), { existingCardIds: new Set() })).toThrow(/server must be "jp"/);
  });
  it('rejects a card missing releaseDate', () => {
    const { releaseDate: _omit, ...noDate } = valid;
    expect(() => loadUpcomingCards(tmpFile({ records: [noDate] }), { existingCardIds: new Set() })).toThrow(/releaseDate/);
  });
  it('rejects a bad hintPoolSize', () => {
    expect(() => loadUpcomingCards(tmpFile({ records: [{ ...valid, hintPoolSize: 5 }] }), { existingCardIds: new Set() })).toThrow(/hintPoolSize/);
  });
  it('rejects collision with an already-emitted Global card', () => {
    expect(() => loadUpcomingCards(tmpFile({ records: [valid] }), { existingCardIds: new Set(['40001']) })).toThrow(/already emitted/);
  });
});
