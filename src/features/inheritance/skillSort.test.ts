import { describe, expect, it } from 'vitest';
import { buildIconRank, buildSkillComparator, ICON_SUBCATEGORIES, type SortSkillMeta } from './skillSort';

const iconRank = buildIconRank();

// A tiny skill table exercising: uniques-top, icon order, gold-above-white, A-Z.
const S: Record<string, SortSkillMeta> = {
  // uniques (generic icons) — must sort first, A-Z, regardless of icon
  u_zeta: { iconId: '20011', rarity: 'unique', group: 1, name: 'Zeta Unique' },
  u_alpha: { iconId: '20041', rarity: 'inherited_unique', group: 2, name: 'Alpha Unique' },
  // green (icon 10011) two whites
  g_b: { iconId: '10011', rarity: 'white', group: 100, name: 'Bravo Green' },
  g_a: { iconId: '10011', rarity: 'white', group: 100, name: 'Alpha Green' },
  // velocity family (icons 20011/20012) gold + its white twin (same group)
  v_white: { iconId: '20011', rarity: 'white', group: 200, name: 'Forward March' },
  v_gold: { iconId: '20012', rarity: 'gold', group: 200, name: 'Lead the Charge' },
  // debuff (icon 30011) — near the end
  d1: { iconId: '30011', rarity: 'white', group: 300, name: 'Some Debuff' },
};
const whiteNameOfGroup = (g: number) => (g === 200 ? 'Forward March' : undefined);
const cmp = buildSkillComparator((id) => S[id], iconRank, whiteNameOfGroup);
const sorted = (ids: string[]) => ids.slice().sort(cmp);

describe('icon-spec skill sort', () => {
  it('subcategory ranks: green < velocity < debuff; white+gold of a family share a rank', () => {
    expect(iconRank.get('10011')).toBeLessThan(iconRank.get('20011')!); // green before velocity
    expect(iconRank.get('20011')).toBeLessThan(iconRank.get('30011')!); // velocity before debuff
    expect(iconRank.get('20011')).toBe(iconRank.get('20012')); // white + gold share subcategory
    expect(iconRank.get('20024')).toBeDefined(); // the 200224→20024 reconciliation
  });

  it('uniques + inherited sort FIRST, alphabetically, regardless of icon', () => {
    const out = sorted(['g_a', 'u_zeta', 'v_gold', 'u_alpha']);
    expect(out.slice(0, 2)).toEqual(['u_alpha', 'u_zeta']); // Alpha before Zeta, both ahead of non-uniques
  });

  it('within a subcategory, whites sort A-Z', () => {
    expect(sorted(['g_b', 'g_a'])).toEqual(['g_a', 'g_b']);
  });

  it('a gold skill sorts just ABOVE its white twin (gold-first within the family)', () => {
    expect(sorted(['v_white', 'v_gold'])).toEqual(['v_gold', 'v_white']);
  });

  it('full order: uniques → green → velocity(gold,white) → debuff', () => {
    expect(sorted(['d1', 'v_white', 'g_a', 'u_alpha', 'v_gold', 'g_b']))
      .toEqual(['u_alpha', 'g_a', 'g_b', 'v_gold', 'v_white', 'd1']);
  });

  it('every subcategory icon is unique across the spec (no double-listed icon)', () => {
    const all = ICON_SUBCATEGORIES.flat();
    expect(all.length).toBe(new Set(all).size);
  });
});
