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
import type { Grade, UmaRecord } from '@/core/types';
import type { Calibration } from '@/core/foresight';
import type { GtCharacterCard, UmalatorUmasJson } from './lib/upstream-types';
import { projectReleaseDate } from './lib/foresight-build';

const GRADE_SET = new Set(['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S']);

function gradeAt(aptitude: string[] | undefined, index: number, umaId: string): Grade {
  const value = aptitude?.[index];
  if (!GRADE_SET.has(value ?? '')) {
    throw new Error(`umas: outfit ${umaId} has invalid/missing GameTora aptitude at index ${index}`);
  }
  return value as Grade;
}

function baseAptitudesFromGt(gt: GtCharacterCard, umaId: string): NonNullable<UmaRecord['baseAptitudes']> {
  return {
    surface: {
      turf: gradeAt(gt.aptitude, 0, umaId),
      dirt: gradeAt(gt.aptitude, 1, umaId),
    },
    distance: {
      short: gradeAt(gt.aptitude, 2, umaId),
      mile: gradeAt(gt.aptitude, 3, umaId),
      medium: gradeAt(gt.aptitude, 4, umaId),
      long: gradeAt(gt.aptitude, 5, umaId),
    },
    strategy: {
      front: gradeAt(gt.aptitude, 6, umaId),
      pace: gradeAt(gt.aptitude, 7, umaId),
      late: gradeAt(gt.aptitude, 8, umaId),
      end: gradeAt(gt.aptitude, 9, umaId),
    },
  };
}

function statGrowthFromGt(gt: GtCharacterCard, umaId: string): NonNullable<UmaRecord['statGrowth']> {
  if (!gt.stat_bonus || gt.stat_bonus.length < 5) {
    throw new Error(`umas: outfit ${umaId} has invalid/missing GameTora stat_bonus`);
  }
  return {
    spd: gt.stat_bonus[0] ?? 0,
    sta: gt.stat_bonus[1] ?? 0,
    pow: gt.stat_bonus[2] ?? 0,
    gut: gt.stat_bonus[3] ?? 0,
    wit: gt.stat_bonus[4] ?? 0,
  };
}

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

      const record: UmaRecord = {
        umaId,
        charaId,
        nameEn,
        server: 'global',
        dataVersion,
        ...(gt ? { statGrowth: statGrowthFromGt(gt, umaId), baseAptitudes: baseAptitudesFromGt(gt, umaId) } : {}),
      };
      if (epithet !== '') record.epithet = epithet;
      records.push(record);
    }
  }

  records.sort((a, b) => Number(a.umaId) - Number(b.umaId));
  return records;
}

/** JP-ahead umas: gametora chars absent from the Global master extract (server:'jp'). */
export function buildJpUmas(inputs: {
  gametoraChars: GtCharacterCard[];
  masterUmaIds: ReadonlySet<string>;
  cal: Calibration | null;
  dataVersion: string;
}): UmaRecord[] {
  const { gametoraChars, masterUmaIds, cal, dataVersion } = inputs;
  const records: UmaRecord[] = [];
  for (const gt of gametoraChars) {
    const umaId = String(gt.card_id);
    if (masterUmaIds.has(umaId)) continue; // Global uma
    const charaId = String(Math.floor(gt.card_id / 100));
    const { releaseDate, predicted } = projectReleaseDate(gt.release, gt.release_en, cal);
    const epithet = stripTitleBrackets(gt.title_en_gl ?? gt.title ?? '');
    const rec: UmaRecord = {
      umaId,
      charaId,
      nameEn: gt.name_en ?? `Uma ${umaId}`,
      server: 'jp',
      dataVersion,
      ...(gt.aptitude && gt.stat_bonus
        ? { statGrowth: statGrowthFromGt(gt, umaId), baseAptitudes: baseAptitudesFromGt(gt, umaId) }
        : {}),
    };
    if (epithet !== '') rec.epithet = epithet;
    if (releaseDate !== undefined) rec.releaseDate = releaseDate;
    if (predicted) rec.releaseDatePredicted = true;
    records.push(rec);
  }
  records.sort((a, b) => Number(a.umaId) - Number(b.umaId));
  return records;
}
