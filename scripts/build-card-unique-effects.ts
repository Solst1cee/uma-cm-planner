/**
 * public/data/card_unique_effects.json — per-support-card "Unique Effect" block,
 * shaped as { [cardId]: CardEffect[] } (CardUniqueEffects).
 *
 * Sources (provenance §6b):
 * - the numbers come from master.mdb `support_card_unique_effect`
 *   (scripts/borrowed/support-card-unique-effects.json — one row per card, two
 *   effect slots `_0`/`_1`, `type_N=0` = empty);
 * - the id→English label + value formatting come from the effect-type enum
 *   derived from master.mdb `text_data`
 *   (scripts/borrowed/gametora/support-effects.json).
 * Both are Cygames game data (bundleable, same posture as our other baked
 * strings — NOT GameTora page content).
 *
 * Effects with `type >= 101` are compound/conditional and have no text_data
 * string; they're emitted with a generic label + the raw sub-values in
 * `conditional` (refine later via a data-override template file).
 */
import type { CardEffect, CardUniqueEffects } from '@/core/types';
import { existsSync } from 'node:fs';
import { readBorrowedJson, readJson, writeJsonDeterministic, OVERRIDES_DIR, PUBLIC_DATA_DIR } from './lib/io';
import { join } from 'node:path';

/** A row of master.mdb support_card_unique_effect. */
export interface UniqueEffectRow {
  id: number;
  lv: number;
  type_0: number; value_0: number;
  value_0_1: number; value_0_2: number; value_0_3: number; value_0_4: number;
  type_1: number; value_1: number;
  value_1_1: number; value_1_2: number; value_1_3: number; value_1_4: number;
}

/** An entry of the effect-type enum (support-effects.json). */
export interface EffectType {
  id: number;
  name_en: string;
  desc_en: string;
  symbol: string; // 'percent' | 'level' | 'none' | …
}

const asSymbol = (s: string): CardEffect['symbol'] =>
  s === 'percent' ? 'percent' : s === 'level' ? 'level' : 'none';

/**
 * Join the unique-effect rows with the type enum → cardId → CardEffect[].
 * `overrides` (data-overrides/unique_effect_text_overrides.json) supplies the
 * hand-written English lines for the compound/conditional (type >= 101) effects
 * that have no text_data string — one string per displayed line; when present
 * they replace the generic fallback for that card.
 */
export function buildCardUniqueEffects(
  rows: UniqueEffectRow[],
  effectTypes: EffectType[],
  overrides: Record<string, string[]> = {},
): CardUniqueEffects {
  const byType = new Map<number, EffectType>(effectTypes.map((e) => [e.id, e]));
  const out: CardUniqueEffects = {};

  for (const row of rows) {
    const cardId = String(row.id);
    const override = overrides[cardId];
    const slots = [
      { type: row.type_0, value: row.value_0, sub: [row.value_0_1, row.value_0_2, row.value_0_3, row.value_0_4] },
      { type: row.type_1, value: row.value_1, sub: [row.value_1_1, row.value_1_2, row.value_1_3, row.value_1_4] },
    ];
    const effects: CardEffect[] = [];
    for (const slot of slots) {
      if (slot.type === 0) continue; // empty slot
      if (slot.type >= 101) {
        // Compound/conditional — handled at the card level from `override` below.
        if (override && override.length > 0) continue;
        effects.push({
          type: slot.type,
          nameEn: 'Conditional effect',
          descEn: 'Special conditional effect (see in-game)',
          value: slot.value,
          symbol: 'none',
          conditional: slot.sub,
        });
        continue;
      }
      const e = byType.get(slot.type);
      if (!e) continue; // unknown type id — skip rather than fabricate
      effects.push({
        type: slot.type,
        nameEn: e.name_en,
        descEn: e.desc_en,
        value: slot.value,
        symbol: asSymbol(e.symbol),
      });
    }
    // Hand-written lines for the conditional effect (value is baked into the
    // text; `conditional: []` makes the UI render descEn verbatim, no "(N)").
    if (override && override.length > 0) {
      for (const line of override) {
        effects.push({ type: row.type_0, nameEn: 'Unique Effect', descEn: line, value: 0, symbol: 'none', conditional: [] });
      }
    }
    if (effects.length > 0) out[cardId] = effects;
  }
  return out;
}

/** Read the borrowed sources + overrides, build, and write the dataset. */
export function generateCardUniqueEffects(): CardUniqueEffects {
  const rows = readBorrowedJson<UniqueEffectRow[]>('support-card-unique-effects.json');
  const effectTypes = readBorrowedJson<EffectType[]>('gametora/support-effects.json');
  const overridePath = join(OVERRIDES_DIR, 'unique_effect_text_overrides.json');
  const overrides = existsSync(overridePath) ? readJson<Record<string, string[]>>(overridePath) : {};
  const data = buildCardUniqueEffects(rows, effectTypes, overrides);
  writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'card_unique_effects.json'), data);
  return data;
}

// Standalone runner: `tsx scripts/build-card-unique-effects.ts`
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('build-card-unique-effects.ts')) {
  const data = generateCardUniqueEffects();
  console.log(`card_unique_effects.json → ${Object.keys(data).length} cards`);
}
