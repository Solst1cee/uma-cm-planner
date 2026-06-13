/**
 * public/data/umas.json — UmaRecord[] (plan §6 step 4: the parents-entry
 * picker). One record per GLOBAL-RELEASED playable outfit.
 *
 * Released = present in the umalator-global cutover umas.json (master.mdb
 * extract — provenance §3): 59 characters / 84 outfits at pin c1fa2107.
 * Names + epithets are OFFICIAL EN from that extract (master.mdb text_data
 * carries official EN on all Global extracts, provenance §3 "EN names" row) —
 * NOT GameTora house style (which renders "TM Opera O" for the official
 * "T.M. Opera O"). gametora/character-cards.json `title_en_gl` (also official
 * Global EN) serves as a build-time cross-check oracle + fallback; the fan-TL
 * `title` field is never used.
 *
 * umaId convention (provenance §5): master.mdb card_data id as string, one
 * per playable outfit, charaId = floor(umaId/100) — exactly what the
 * UmaExtractor importer maps `card_id` onto `Parent.umaId`.
 */
import type { UmaRecord } from '@/core/types';
import type { GtCharacterCard, UmalatorUmasJson } from './lib/upstream-types';

/** "[Special Dreamer]" → "Special Dreamer" (also trims stray whitespace, e.g. "[Saintly Jade Cleric ]"). */
export function stripTitleBrackets(title: string): string {
  const trimmed = title.trim();
  const inner =
    trimmed.startsWith('[') && trimmed.endsWith(']') ? trimmed.slice(1, -1) : trimmed;
  return inner.trim();
}

export function buildUmas(inputs: {
  umas: UmalatorUmasJson;
  gametoraChars: GtCharacterCard[];
  dataVersion: string;
}): UmaRecord[] {
  const { umas, gametoraChars, dataVersion } = inputs;
  const gtByCardId = new Map<string, GtCharacterCard>(
    gametoraChars.map((c) => [String(c.card_id), c]),
  );
  const records: UmaRecord[] = [];

  for (const [charaId, chara] of Object.entries(umas)) {
    const nameEn = chara.name[1];
    if (!nameEn) {
      throw new Error(`umas: chara ${charaId} has no EN name in the cutover umas.json`);
    }
    for (const [umaId, outfitTitle] of Object.entries(chara.outfits)) {
      // Enforce the Parent.umaId ↔ charaId convention (provenance §5) at
      // build time so the picker can never disagree with the importer.
      const derivedCharaId = String(Math.floor(Number(umaId) / 100));
      if (derivedCharaId !== charaId) {
        throw new Error(
          `umas: outfit ${umaId} listed under chara ${charaId} but floor(umaId/100) = ` +
            `${derivedCharaId} — provenance §5 convention violated; inspect the upstream cutover.`,
        );
      }

      const gt = gtByCardId.get(umaId);
      const official = stripTitleBrackets(outfitTitle);
      // Cross-check oracle: both strings are official Global EN; a mismatch
      // means one upstream drifted (e.g. an in-game rename) — fail the build
      // so a human reconciles instead of silently shipping either side.
      if (gt?.title_en_gl !== undefined && stripTitleBrackets(gt.title_en_gl) !== official) {
        throw new Error(
          `umas: outfit ${umaId} epithet disagrees between the cutover (${JSON.stringify(
            outfitTitle,
          )}) and gametora title_en_gl (${JSON.stringify(gt.title_en_gl)}) — reconcile upstreams.`,
        );
      }
      const epithet = official !== '' ? official : stripTitleBrackets(gt?.title_en_gl ?? '');

      const record: UmaRecord = { umaId, charaId, nameEn, server: 'global', dataVersion };
      if (epithet !== '') record.epithet = epithet;
      records.push(record);
    }
  }

  records.sort((a, b) => Number(a.umaId) - Number(b.umaId));
  return records;
}
