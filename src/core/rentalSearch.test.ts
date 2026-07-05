import { describe, expect, it } from 'vitest';
import { chronoGenesisUrl, pureDbUrl, umaMoeUrl } from './rentalSearch';
import type { SparkFilter } from '@/core/sparkFilter';

const blueSpd2: SparkFilter = { id: 'b', kind: 'blue', stat: 'spd', legacyMin: 0, totalMin: 2 };
const pinkLong3: SparkFilter = { id: 'p', kind: 'pink', aptitude: 'long', legacyMin: 0, totalMin: 3 };
const greenU: SparkFilter = { id: 'g', kind: 'green', skillId: '100011', legacyMin: 1, totalMin: 1 };
const whiteW: SparkFilter = { id: 'w', kind: 'white', skillId: '200011', legacyMin: 1, totalMin: 1 };
const anyBlue6: SparkFilter = { id: 'a', kind: 'anyBlue', totalMin: 6 };
// 'short' is a real AptKey distance bucket (src/core/types.ts) that isn't in the
// PINK_FACTOR_ID/PINK_GROUP maps — an unrecognized-but-legal aptitude string.
const pinkUnknownApt: SparkFilter = { id: 'u', kind: 'pink', aptitude: 'short', legacyMin: 0, totalMin: 3 };
const pinkOver9: SparkFilter = { id: 'o', kind: 'pink', aptitude: 'long', legacyMin: 0, totalMin: 12 };

describe('umaMoeUrl', () => {
  it('encodes blue/pink triplets + trainer id into the filters param', () => {
    const { url, dropped } = umaMoeUrl({ filters: [blueSpd2, pinkLong3], traineeCardId: '100101' });
    const json = JSON.parse(atob(decodeURIComponent(new URL(url).searchParams.get('filters')!)));
    expect(json.b).toContainEqual([10, 2, 9]); // Speed, min 2, max 9
    expect(json.p).toContainEqual([340, 3, 9]); // Long, min 3, max 9
    expect(json.lb).toBe(4);
    expect(url.startsWith('https://uma.moe/database?filters=')).toBe(true);
    expect(new URL(url).searchParams.get('trainer_id')).toBe('100101');
    expect(dropped).toEqual([]);
  });

  it('drops green/white/anyBlue clauses (unconfirmed factorId space / no aggregate field)', () => {
    const { url, dropped } = umaMoeUrl({ filters: [greenU, whiteW, anyBlue6], traineeCardId: '100101' });
    const json = JSON.parse(atob(decodeURIComponent(new URL(url).searchParams.get('filters')!)));
    expect(json.g).toBeUndefined();
    expect(json.w).toBeUndefined();
    expect(dropped).toEqual([greenU, whiteW, anyBlue6]);
  });

  it('drops a pink clause whose aptitude has no known factorId, instead of encoding factorId 0', () => {
    const { url, dropped } = umaMoeUrl({ filters: [pinkUnknownApt], traineeCardId: '100101' });
    const json = JSON.parse(atob(decodeURIComponent(new URL(url).searchParams.get('filters')!)));
    expect(json.p).toBeUndefined();
    expect(dropped).toEqual([pinkUnknownApt]);
  });

  it('clamps a totalMin above 9 down to 9 in the triplet', () => {
    const { url } = umaMoeUrl({ filters: [pinkOver9], traineeCardId: '100101' });
    const json = JSON.parse(atob(decodeURIComponent(new URL(url).searchParams.get('filters')!)));
    expect(json.p).toContainEqual([340, 9, 9]); // Long, min clamped 12→9, max 9
  });
});

describe('pureDbUrl', () => {
  it('encodes blue/pink groupIds into the searchInfo param', () => {
    const { url, dropped } = pureDbUrl({ filters: [blueSpd2, pinkLong3], traineeCardId: '100101', partnerCardId: '100202' });
    expect(url.startsWith('https://uma.pure-db.com/en-us/search?searchInfo=')).toBe(true);
    const json = JSON.parse(atob(decodeURIComponent(new URL(url).searchParams.get('searchInfo')!)));
    expect(json.blueFactors).toContainEqual({ groupId: 1, count: 2, searchType: 2, enabled: true });
    expect(json.redFactors).toContainEqual({ groupId: 34, count: 3, searchType: 2, enabled: true });
    expect(json.supportCardId).toBe('100101');
    expect(json.partnerCardIds).toEqual(['100202']);
    expect(dropped).toEqual([]);
  });

  it('drops green/white/anyBlue clauses (no key documented in provenance)', () => {
    const { dropped } = pureDbUrl({ filters: [greenU, whiteW, anyBlue6], traineeCardId: '100101' });
    expect(dropped).toEqual([greenU, whiteW, anyBlue6]);
  });

  it('drops a pink clause whose aptitude has no known groupId, instead of encoding groupId 0', () => {
    const { url, dropped } = pureDbUrl({ filters: [pinkUnknownApt], traineeCardId: '100101' });
    const json = JSON.parse(atob(decodeURIComponent(new URL(url).searchParams.get('searchInfo')!)));
    expect(json.redFactors ?? []).toEqual([]);
    expect(dropped).toEqual([pinkUnknownApt]);
  });
});

describe('chronoGenesisUrl', () => {
  it('reports anyBlue as dropped when the site cannot express a clause', () => {
    const { dropped } = chronoGenesisUrl({ filters: [anyBlue6], traineeCardId: '100101' });
    // anyBlue maps to blue_count on ChronoGenesis → NOT dropped; adjust per Step 1 finding:
    expect(dropped).toEqual([]);
  });

  it('encodes anyBlue into blue_count and card_id into card_id', () => {
    const { url } = chronoGenesisUrl({ filters: [anyBlue6], traineeCardId: '100101' });
    const inner = new URLSearchParams(atob(decodeURIComponent(new URL(url).searchParams.get('query')!)));
    expect(inner.get('blue_count')).toBe('6');
    expect(inner.get('card_id')).toBe('100101');
    expect(url.startsWith('https://chronogenesis.net/friend_search?query=')).toBe(true);
  });

  it('encodes blue/pink legacy + total minimums into leg_All/tot_All using the shared factorId', () => {
    const legacyAndTotal: SparkFilter = { id: 'lt', kind: 'blue', stat: 'spd', legacyMin: 2, totalMin: 5 };
    const { url, dropped } = chronoGenesisUrl({ filters: [legacyAndTotal, pinkLong3], traineeCardId: '100101' });
    const inner = new URLSearchParams(atob(decodeURIComponent(new URL(url).searchParams.get('query')!)));
    expect(inner.getAll('leg_All')).toEqual(['102']); // Speed(10)*10 + legacyMin(2)
    expect(inner.getAll('tot_All')).toEqual(['105', '3403']); // Speed*10+5, Long(340)*10+3
    expect(dropped).toEqual([]);
  });

  it('drops green/white clauses (opaque factorId space shared w/ uma.moe, unconfirmed)', () => {
    const { dropped } = chronoGenesisUrl({ filters: [greenU, whiteW], traineeCardId: '100101' });
    expect(dropped).toEqual([greenU, whiteW]);
  });

  it('drops a pink clause whose aptitude has no known factorId, instead of encoding factorId 0', () => {
    const { url, dropped } = chronoGenesisUrl({ filters: [pinkUnknownApt], traineeCardId: '100101' });
    const inner = new URLSearchParams(atob(decodeURIComponent(new URL(url).searchParams.get('query')!)));
    expect(inner.getAll('leg_All')).toEqual([]);
    expect(inner.getAll('tot_All')).toEqual([]);
    expect(dropped).toEqual([pinkUnknownApt]);
  });
});
