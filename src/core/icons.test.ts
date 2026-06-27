/**
 * Pure resolver tests (P6): present ids resolve to a base-relative WebP path
 * in the contracted directory; absent ids resolve to undefined; the resolver
 * keys off iconId for skills (not skillId) and tolerates a partial manifest.
 */
import { describe, expect, it } from 'vitest';
import type { IconManifest } from '@/core/icons';
import { cardArtPath, cardIconPath, rankIconPath, skillIconPath, umaIconPath } from '@/core/icons';

const MANIFEST: IconManifest = {
  dataVersion: 'test',
  format: 'webp',
  skill: ['10011', '20012'],
  card: ['30028', '10001'],
  uma: ['100201', '100101'],
  rank: ['G', 'SS+', 'LS24'],
  cardArt: ['10001', '30028'],
};

describe('skillIconPath', () => {
  it('resolves a present iconId to data/icons/skill/<iconId>.webp', () => {
    expect(skillIconPath('10011', MANIFEST)).toBe('data/icons/skill/10011.webp');
  });
  it('returns undefined for an absent iconId', () => {
    expect(skillIconPath('99999', MANIFEST)).toBeUndefined();
  });
});

describe('cardIconPath', () => {
  it('resolves a present cardId to data/icons/support/<cardId>.webp', () => {
    expect(cardIconPath('30028', MANIFEST)).toBe('data/icons/support/30028.webp');
  });
  it('returns undefined for an absent cardId', () => {
    expect(cardIconPath('40000', MANIFEST)).toBeUndefined();
  });
});

describe('umaIconPath', () => {
  it('resolves a present umaId to data/icons/uma/<umaId>.webp', () => {
    expect(umaIconPath('100201', MANIFEST)).toBe('data/icons/uma/100201.webp');
  });
  it('returns undefined for an absent umaId', () => {
    expect(umaIconPath('109901', MANIFEST)).toBeUndefined();
  });
});

describe('rankIconPath', () => {
  it('resolves a present rank label to data/icons/rank/<label>.webp', () => {
    expect(rankIconPath('G', MANIFEST)).toBe('data/icons/rank/G.webp');
    expect(rankIconPath('LS24', MANIFEST)).toBe('data/icons/rank/LS24.webp');
  });
  it('escapes the + suffix to -plus', () => {
    expect(rankIconPath('SS+', MANIFEST)).toBe('data/icons/rank/SS-plus.webp');
  });
  it('returns undefined for an absent rank label', () => {
    expect(rankIconPath('UA7', MANIFEST)).toBeUndefined();
  });
});

describe('cardArtPath', () => {
  it('resolves a present cardId to data/card-art/<cardId>.webp', () => {
    expect(cardArtPath('30028', MANIFEST)).toBe('data/card-art/30028.webp');
  });
  it('returns undefined for a cardId without extracted art', () => {
    expect(cardArtPath('99999', MANIFEST)).toBeUndefined();
  });
});

describe('manifest edge cases', () => {
  it('returns undefined when an id array is missing entirely', () => {
    const partial = { dataVersion: 't', format: 'webp' } as unknown as IconManifest;
    expect(skillIconPath('10011', partial)).toBeUndefined();
    expect(cardIconPath('30028', partial)).toBeUndefined();
    expect(umaIconPath('100201', partial)).toBeUndefined();
  });
  it('keys skills off iconId, not skillId — a skillId that is not an iconId misses', () => {
    // 200012 is a real skillId whose iconId is 10011; the resolver must not
    // treat the skillId as an iconId.
    expect(skillIconPath('200012', MANIFEST)).toBeUndefined();
    expect(skillIconPath('10011', MANIFEST)).toBe('data/icons/skill/10011.webp');
  });
});
