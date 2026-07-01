/**
 * public/data/card_effects.json — every support card's BASE (always-on) effect
 * list, LB-aware. Shape: { [cardId]: CardBaseEffect[] } (CardBaseEffects).
 *
 * Source: the GameTora per-card effect matrix (`gametora/support-cards.json`
 * `effects` = master.mdb `support_card_effect_table`, byte-identical per
 * provenance §3) joined with the effect-type enum (`gametora/support-effects.json`).
 * Each effect row is `[type, init, lv5, lv10, … lv50]` (`-1` = carry the previous
 * value). We resolve the value at each LB's max level per rarity, and drop
 * `inactive` (legacy 20–24) types + all-zero effects. Cygames game data.
 */
import type { CardBaseEffect, CardBaseEffects } from '@/core/types';
import { readBorrowedJson, writeJsonDeterministic, PUBLIC_DATA_DIR } from './lib/io';
import { join } from 'node:path';

interface GtCardEffects {
  support_id: number;
  rarity: number; // 1=R, 2=SR, 3=SSR
  effects: number[][]; // [type, init, lv5, lv10, … lv50]
}
interface EffectType {
  id: number;
  name_en: string;
  desc_en: string;
  symbol: string;
  inactive?: boolean;
}

const asSymbol = (s: string): CardBaseEffect['symbol'] =>
  s === 'percent' ? 'percent' : s === 'level' ? 'level' : 'none';

// Max level per LB by rarity → the matrix column index (index = level/5 + 1;
// row[0] is the type, row[1] is `init`, row[2] is lv5, …, row[11] is lv50).
const CAP_INDEX_BY_RARITY: Record<number, number[]> = {
  1: [5, 6, 7, 8, 9], // R: lv 20/25/30/35/40
  2: [6, 7, 8, 9, 10], // SR: lv 25/30/35/40/45
  3: [7, 8, 9, 10, 11], // SSR: lv 30/35/40/45/50
};

/** Value at a given max-level column: the last non-(-1) entry in row[1..capIdx]. */
function valueAtCap(row: number[], capIdx: number): number {
  let v = 0;
  for (let i = 1; i <= capIdx && i < row.length; i++) {
    if (row[i] !== -1) v = row[i]!;
  }
  return v;
}

/** Build cardId → base CardBaseEffect[] (LB-aware) from the matrices + enum. */
export function buildCardEffects(cards: GtCardEffects[], effectTypes: EffectType[]): CardBaseEffects {
  const byType = new Map<number, EffectType>(effectTypes.map((e) => [e.id, e]));
  const out: CardBaseEffects = {};

  for (const card of cards) {
    const caps = CAP_INDEX_BY_RARITY[card.rarity];
    if (!caps || !Array.isArray(card.effects)) continue;
    const effects: CardBaseEffect[] = [];
    for (const row of card.effects) {
      const type = row[0]!;
      const e = byType.get(type);
      if (!e || e.inactive) continue; // unknown or legacy/inactive → skip
      const valuesByLb = caps.map((capIdx) => valueAtCap(row, capIdx));
      if (valuesByLb.every((v) => v === 0)) continue; // never present → skip
      effects.push({ type, nameEn: e.name_en, descEn: e.desc_en, symbol: asSymbol(e.symbol), valuesByLb });
    }
    if (effects.length > 0) out[String(card.support_id)] = effects;
  }
  return out;
}

/** Read the borrowed sources, build, and write the dataset. Used by build-all. */
export function generateCardEffects(): CardBaseEffects {
  const cards = readBorrowedJson<GtCardEffects[]>('gametora/support-cards.json');
  const effectTypes = readBorrowedJson<EffectType[]>('gametora/support-effects.json');
  const data = buildCardEffects(cards, effectTypes);
  writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'card_effects.json'), data);
  return data;
}

// Standalone runner: `tsx scripts/build-card-effects.ts`
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('build-card-effects.ts')) {
  const data = generateCardEffects();
  console.log(`card_effects.json → ${Object.keys(data).length} cards`);
}
