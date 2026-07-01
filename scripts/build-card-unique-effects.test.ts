import { describe, expect, it } from 'vitest';
import { buildCardUniqueEffects, type EffectType, type UniqueEffectRow } from './build-card-unique-effects';

const enumTypes: EffectType[] = [
  { id: 7, name_en: 'Wit Bonus', desc_en: 'Increases Wit gain when training together', symbol: 'none' },
  { id: 8, name_en: 'Training Effectiveness', desc_en: 'Increases the effectiveness of training performed together', symbol: 'percent' },
  { id: 15, name_en: 'Race Bonus', desc_en: 'Increases stat gain from races', symbol: 'percent' },
  { id: 19, name_en: 'Specialty Priority', desc_en: 'Increases preferred-training placement frequency', symbol: 'none' },
];

const row = (over: Partial<UniqueEffectRow>): UniqueEffectRow => ({
  id: 1, lv: 30,
  type_0: 0, value_0: 0, value_0_1: 0, value_0_2: 0, value_0_3: 0, value_0_4: 0,
  type_1: 0, value_1: 0, value_1_1: 0, value_1_2: 0, value_1_3: 0, value_1_4: 0,
  ...over,
});

describe('buildCardUniqueEffects', () => {
  it('joins both slots with the enum (percent + raw values)', () => {
    const out = buildCardUniqueEffects([row({ id: 30028, type_0: 8, value_0: 5, type_1: 19, value_1: 20 })], enumTypes);
    expect(out['30028']).toEqual([
      { type: 8, nameEn: 'Training Effectiveness', descEn: 'Increases the effectiveness of training performed together', value: 5, symbol: 'percent' },
      { type: 19, nameEn: 'Specialty Priority', descEn: 'Increases preferred-training placement frequency', value: 20, symbol: 'none' },
    ]);
  });

  it('skips empty (type 0) slots and unknown (<101) type ids', () => {
    // type 88 is < 101 (not "conditional") and absent from the enum → skipped.
    const out = buildCardUniqueEffects([row({ id: 2, type_0: 7, value_0: 1, type_1: 88, value_1: 3 })], enumTypes);
    expect(out['2']).toEqual([
      { type: 7, nameEn: 'Wit Bonus', descEn: 'Increases Wit gain when training together', value: 1, symbol: 'none' },
    ]);
  });

  it('emits a generic conditional line (with raw sub-values) for type >= 101 when no override', () => {
    const out = buildCardUniqueEffects(
      [row({ id: 3, type_0: 101, value_0: 80, value_0_1: 3, value_0_2: 1, value_0_3: 30, value_0_4: 1 })],
      enumTypes,
    );
    expect(out['3']![0]).toMatchObject({ type: 101, nameEn: 'Conditional effect', conditional: [3, 1, 30, 1] });
  });

  it('uses the hand-written override lines for a conditional (type >= 101) card', () => {
    const out = buildCardUniqueEffects(
      [row({ id: 30053, type_0: 101, value_0: 80, value_0_1: 3, value_0_2: 1, value_0_3: 30, value_0_4: 1 })],
      enumTypes,
      { '30053': ['When bond gauge is 80 or higher: Speed Bonus +1, Skill Point Bonus +1'] },
    );
    expect(out['30053']).toEqual([
      { type: 101, nameEn: 'Unique Effect', descEn: 'When bond gauge is 80 or higher: Speed Bonus +1, Skill Point Bonus +1', value: 0, symbol: 'none', conditional: [] },
    ]);
  });

  it('omits cards with no unique effect', () => {
    const out = buildCardUniqueEffects([row({ id: 4 })], enumTypes);
    expect(out['4']).toBeUndefined();
  });
});
