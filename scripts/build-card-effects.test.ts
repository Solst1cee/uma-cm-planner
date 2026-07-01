import { describe, expect, it } from 'vitest';
import { buildCardEffects } from './build-card-effects';

const enums = [
  { id: 7, name_en: 'Wit Bonus', desc_en: 'Increases Wit gain', symbol: 'none' },
  { id: 8, name_en: 'Training Effectiveness', desc_en: 'Increases training', symbol: 'percent' },
  { id: 20, name_en: 'Max Speed', desc_en: 'legacy', symbol: 'none', inactive: true },
];

describe('buildCardEffects', () => {
  it('resolves the value at each LB and labels via the enum (SSR)', () => {
    // row = [type, init, lv5, lv10, lv15, lv20, lv25, lv30, lv35, lv40, lv45, lv50]
    const out = buildCardEffects(
      [{ support_id: 30028, rarity: 3, effects: [[8, -1, -1, 1, -1, -1, 5, 5, -1, -1, 10, -1]] }],
      enums,
    );
    // SSR caps → LB0 = lv30 (idx7) = 5; LB3 = lv45 (idx10) = 10; LB4 = lv50 (idx11, -1 → carry 10).
    expect(out['30028']).toEqual([
      { type: 8, nameEn: 'Training Effectiveness', descEn: 'Increases training', symbol: 'percent', valuesByLb: [5, 5, 5, 10, 10] },
    ]);
  });

  it('drops inactive (legacy) and all-zero effects', () => {
    const out = buildCardEffects(
      [{ support_id: 2, rarity: 3, effects: [[20, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], [7, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1]] }],
      enums,
    );
    // type 20 inactive → dropped; type 7 all -1 (0) → dropped → card omitted.
    expect(out['2']).toBeUndefined();
  });
});
