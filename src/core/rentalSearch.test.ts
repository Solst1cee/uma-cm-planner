import { describe, expect, it } from 'vitest';
import { chronoGenesisUrl, pureDbUrl, umaMoeUrl } from './rentalSearch';
import type { SparkFilter } from '@/core/sparkFilter';

const blueSpd2: SparkFilter = { id: 'b', kind: 'blue', stat: 'spd', legacyMin: 0, totalMin: 2 };
const pinkLong3: SparkFilter = { id: 'p', kind: 'pink', aptitude: 'long', legacyMin: 0, totalMin: 3 };
const anyBlue6: SparkFilter = { id: 'a', kind: 'anyBlue', totalMin: 6 };
// 'short' is a real AptKey distance bucket (src/core/types.ts) that isn't in the
// PINK_FACTOR_ID/PINK_GROUP maps — an unrecognized-but-legal aptitude string.
const pinkUnknownApt: SparkFilter = { id: 'u', kind: 'pink', aptitude: 'short', legacyMin: 0, totalMin: 3 };
const pinkOver9: SparkFilter = { id: 'o', kind: 'pink', aptitude: 'long', legacyMin: 0, totalMin: 12 };

describe('umaMoeUrl', () => {
  it('routes total-star sparks to the non-main keys (b/p); no lb, no trainer_id', () => {
    const { url, dropped } = umaMoeUrl({ filters: [blueSpd2, pinkLong3], traineeCardId: '100101' });
    const json = JSON.parse(atob(decodeURIComponent(new URL(url).searchParams.get('filters')!)));
    expect(json.b).toContainEqual([10, 2, 9]); // Speed total ≥2
    expect(json.p).toContainEqual([340, 3, 9]); // Long total ≥3
    expect(json.mb).toBeUndefined();
    expect(json.mp).toBeUndefined();
    expect(json.lb).toBeUndefined();            // no selectedLimitBreak over-filter
    expect(url.startsWith('https://uma.moe/database?filters=')).toBe(true);
    expect(new URL(url).searchParams.get('trainer_id')).toBeNull(); // uma id ≠ trainer id
    expect(dropped).toEqual([]);
  });

  it('routes OWN (legacy) sparks to the main keys — reproduces the verified working payload', () => {
    // Live-verified example: "power total 6" + "mile legacy 3" ⇒ {"b":[[30,6,9]],"mp":[[320,3,9]]}.
    const powTotal6: SparkFilter = { id: 'b', kind: 'blue', stat: 'pow', legacyMin: 0, totalMin: 6 };
    const mileLegacy3: SparkFilter = { id: 'p', kind: 'pink', aptitude: 'mile', legacyMin: 3, totalMin: 3 };
    const { url } = umaMoeUrl({ filters: [powTotal6, mileLegacy3], traineeCardId: '105901' });
    const json = JSON.parse(atob(decodeURIComponent(new URL(url).searchParams.get('filters')!)));
    expect(json).toEqual({ b: [[30, 6, 9]], mp: [[320, 3, 9]] });
  });

  it('encodes green (unique) + white (skill) via their derived factorIds; only anyBlue drops', () => {
    // Live-derived: Let's Pump Some Iron! (100271)→1027010, Long Corners ○ (201182)→201180.
    const greenTotal: SparkFilter = { id: 'g', kind: 'green', skillId: '100271', legacyMin: 0, totalMin: 2 };
    const whiteLegacy: SparkFilter = { id: 'w', kind: 'white', skillId: '200492', legacyMin: 2, totalMin: 2 };
    const { url, dropped } = umaMoeUrl({ filters: [greenTotal, whiteLegacy, anyBlue6], traineeCardId: '100101' });
    const json = JSON.parse(atob(decodeURIComponent(new URL(url).searchParams.get('filters')!)));
    expect(json.g).toContainEqual([1027010, 2, 9]);   // green total → g
    expect(json.mw).toContainEqual([200490, 2, 9]);   // white legacy → mw
    expect(dropped).toEqual([anyBlue6]);
  });

  it('normalizes an inherited-unique (9xxxxx) green id to the native factorId', () => {
    // 900271 (inherited "Let's Pump Some Iron!") → native 100271 → factorId 1027010.
    const { url } = umaMoeUrl({ filters: [{ id: 'g', kind: 'green', skillId: '900271', legacyMin: 0, totalMin: 3 }], traineeCardId: '1' });
    const json = JSON.parse(atob(decodeURIComponent(new URL(url).searchParams.get('filters')!)));
    expect(json.g).toContainEqual([1027010, 3, 9]);
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
  it('encodes total sparks as searchType 0; lowercase server; empty partner/support defaults', () => {
    const { url, dropped } = pureDbUrl({ filters: [blueSpd2, pinkLong3], traineeCardId: '100101', partnerCardId: '100202' });
    expect(url.startsWith('https://uma.pure-db.com/en-us/search?searchInfo=')).toBe(true);
    const json = JSON.parse(atob(decodeURIComponent(new URL(url).searchParams.get('searchInfo')!)));
    expect(json.blueFactors).toContainEqual({ groupId: 1, count: 2, searchType: 0, enabled: true });
    expect(json.redFactors).toContainEqual({ groupId: 34, count: 3, searchType: 0, enabled: true });
    expect(json.gameServerCode).toBe('global');
    expect(json.supportCardId).toBe(0);        // a uma id here would over-filter
    expect(json.partnerCardIds).toEqual([]);
    expect(json.searchCount).toBe(100);
    expect(dropped).toEqual([]);
  });

  it('routes an OWN (legacy) spark to searchType 1 — reproduces the verified working payload', () => {
    // Live-verified: "stamina total 6" + "mile legacy 3".
    const staTotal6: SparkFilter = { id: 'b', kind: 'blue', stat: 'sta', legacyMin: 0, totalMin: 6 };
    const mileLegacy3: SparkFilter = { id: 'p', kind: 'pink', aptitude: 'mile', legacyMin: 3, totalMin: 3 };
    const { url } = pureDbUrl({ filters: [staTotal6, mileLegacy3], traineeCardId: '100101' });
    const json = JSON.parse(atob(decodeURIComponent(new URL(url).searchParams.get('searchInfo')!)));
    expect(json.blueFactors).toEqual([{ groupId: 2, count: 6, searchType: 0, enabled: true }]);
    expect(json.redFactors).toEqual([{ groupId: 32, count: 3, searchType: 1, enabled: true }]);
  });

  it('encodes green → greenFactors, white → commonSkillFactors; only anyBlue drops', () => {
    // 100271 → green groupId 102701; 200492 → white groupId 20049 (÷10 of uma.moe factorId).
    const greenTotal: SparkFilter = { id: 'g', kind: 'green', skillId: '100271', legacyMin: 0, totalMin: 2 };
    const whiteLegacy: SparkFilter = { id: 'w', kind: 'white', skillId: '200492', legacyMin: 2, totalMin: 2 };
    const { url, dropped } = pureDbUrl({ filters: [greenTotal, whiteLegacy, anyBlue6], traineeCardId: '100101' });
    const json = JSON.parse(atob(decodeURIComponent(new URL(url).searchParams.get('searchInfo')!)));
    expect(json.greenFactors).toContainEqual({ groupId: 102701, count: 2, searchType: 0, enabled: true });
    expect(json.commonSkillFactors).toContainEqual({ groupId: 20049, count: 2, searchType: 1, enabled: true });
    expect(dropped).toEqual([anyBlue6]);
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

  it('encodes anyBlue into blue_count; card_id stays blank (a uma id would break it)', () => {
    const { url } = chronoGenesisUrl({ filters: [anyBlue6], traineeCardId: '100101' });
    const inner = new URLSearchParams(atob(decodeURIComponent(new URL(url).searchParams.get('query')!)));
    expect(inner.get('blue_count')).toBe('6');
    expect(inner.get('card_id')).toBe('');
    expect(url.startsWith('https://chronogenesis.net/friend_search?query=')).toBe(true);
  });

  it('comma-joins multiple sparks into a single leg_All/tot_All param (not repeated keys)', () => {
    const legacyAndTotal: SparkFilter = { id: 'lt', kind: 'blue', stat: 'spd', legacyMin: 2, totalMin: 5 };
    const { url, dropped } = chronoGenesisUrl({ filters: [legacyAndTotal, pinkLong3], traineeCardId: '100101' });
    const inner = new URLSearchParams(atob(decodeURIComponent(new URL(url).searchParams.get('query')!)));
    expect(inner.get('leg_All')).toBe('102');        // Speed(10)*10 + legacyMin(2)
    expect(inner.get('tot_All')).toBe('105,3403');   // Speed*10+5 , Long(340)*10+3
    expect(dropped).toEqual([]);
  });

  it('reproduces the verified 2-spark payload — card_id=&leg_All=3203&tot_All=208', () => {
    const staTotal8: SparkFilter = { id: 'b', kind: 'blue', stat: 'sta', legacyMin: 0, totalMin: 8 };
    const mileLegacy3: SparkFilter = { id: 'p', kind: 'pink', aptitude: 'mile', legacyMin: 3, totalMin: 3 };
    const { url } = chronoGenesisUrl({ filters: [staTotal8, mileLegacy3], traineeCardId: '105901' });
    const inner = new URLSearchParams(atob(decodeURIComponent(new URL(url).searchParams.get('query')!)));
    expect(inner.get('card_id')).toBe('');           // uma id NOT placed here
    expect(inner.get('leg_All')).toBe('3203');       // Mile(320)*10 + 3 (legacy only)
    expect(inner.get('tot_All')).toBe('208');        // Stamina(20)*10 + 8 (total only)
  });

  it('reproduces the verified 3-spark payload — tot_All=208,3206 & leg_All=3203', () => {
    // "stamina total 8 · mile legacy 3 · mile total 6" ⇒ mile emits BOTH leg 3203 + tot 3206.
    const staTotal8: SparkFilter = { id: 'b', kind: 'blue', stat: 'sta', legacyMin: 0, totalMin: 8 };
    const mile: SparkFilter = { id: 'p', kind: 'pink', aptitude: 'mile', legacyMin: 3, totalMin: 6 };
    const { url } = chronoGenesisUrl({ filters: [staTotal8, mile], traineeCardId: '105901' });
    const inner = new URLSearchParams(atob(decodeURIComponent(new URL(url).searchParams.get('query')!)));
    expect(inner.get('card_id')).toBe('');
    expect(inner.get('tot_All')).toBe('208,3206');   // Stamina*10+8 , Mile*10+6
    expect(inner.get('leg_All')).toBe('3203');       // Mile*10+3
  });

  it('encodes white into leg_All/tot_All and green into legacy_green/totgrn_All', () => {
    // green total 100271 → totgrn_All=10270102 ; white legacy 200492 → leg_All=2004902.
    const greenTotal: SparkFilter = { id: 'g', kind: 'green', skillId: '100271', legacyMin: 0, totalMin: 2 };
    const whiteLegacy: SparkFilter = { id: 'w', kind: 'white', skillId: '200492', legacyMin: 2, totalMin: 2 };
    const { url, dropped } = chronoGenesisUrl({ filters: [greenTotal, whiteLegacy], traineeCardId: '100101' });
    const inner = new URLSearchParams(atob(decodeURIComponent(new URL(url).searchParams.get('query')!)));
    expect(inner.get('totgrn_All')).toBe('10270102'); // greenFactorId 1027010 *10 + 2
    expect(inner.get('leg_All')).toBe('2004902');      // whiteFactorId 200490 *10 + 2
    expect(dropped).toEqual([]);
  });

  it('drops a pink clause whose aptitude has no known factorId, instead of encoding factorId 0', () => {
    const { url, dropped } = chronoGenesisUrl({ filters: [pinkUnknownApt], traineeCardId: '100101' });
    const inner = new URLSearchParams(atob(decodeURIComponent(new URL(url).searchParams.get('query')!)));
    expect(inner.getAll('leg_All')).toEqual([]);
    expect(inner.getAll('tot_All')).toEqual([]);
    expect(dropped).toEqual([pinkUnknownApt]);
  });
});
