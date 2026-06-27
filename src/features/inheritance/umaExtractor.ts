/**
 * Pure UmaExtractor data.json → Parent[] parser (spec §3, provenance §5).
 * Source-agnostic: the caller persists. Privacy: drops every *viewer_id.
 * Green/unique (inherited-unique) sparks ARE stored — as the decoded base/alt
 * unique id (100xxx/110xxx) so the unique's NAME displays; M1.7 reconciles
 * 100xxx→9xxxxx before feeding them into coverage math (see Parent.greenSpark).
 * wonRaces are raw saddle ids (saddle→G1 filtering reconciled with winBonus.ts
 * later; never fabricate a G1 win).
 */
import type { Parent, ParentRef, Stat } from '@/core/types';
import { decodeFactor } from './factorDecode';

export interface ParseDeps {
  /** group base (floor(factorId/100)*10) → the white skill id, or undefined. */
  resolveWhiteSkill: (groupBase: number) => string | undefined;
}
export interface ParseResult {
  parents: Parent[];
  skipped: number;
}

type Json = Record<string, unknown>;
const isObj = (x: unknown): x is Json => typeof x === 'object' && x !== null;
const num = (x: unknown): number | undefined => (typeof x === 'number' ? x : undefined);

/** Best-effort single_mode_rank int → letter (display + tie-break only). */
const RANK_LETTERS: Record<number, string> = {
  1: 'G', 2: 'F', 3: 'F+', 4: 'E', 5: 'E+', 6: 'D', 7: 'D+', 8: 'C', 9: 'C+',
  10: 'B', 11: 'B', 12: 'B+', 13: 'A', 14: 'A+', 15: 'S', 16: 'S+', 17: 'SS',
};
export function ratingFromRank(rank: number): string {
  return RANK_LETTERS[rank] ?? String(rank);
}

function statsOf(v: Json): Record<Stat, number> | undefined {
  const spd = num(v.speed), sta = num(v.stamina), pow = num(v.power);
  const gut = num(v.guts), wit = num(v.wiz) ?? num(v.wisdom);
  if ([spd, sta, pow, gut, wit].some((n) => n === undefined)) return undefined;
  return { spd: spd!, sta: sta!, pow: pow!, gut: gut!, wit: wit! };
}

/** Decode a factor_id_array into the parent/ref spark fields. */
function decodeSparks(factorIds: number[], deps: ParseDeps) {
  let blueSpark: { stat: Stat; stars: 1 | 2 | 3 } | undefined;
  let pinkSpark: { aptitude: string; stars: 1 | 2 | 3 } | undefined;
  let greenSpark: { skillId: string; stars: 1 | 2 | 3 } | undefined;
  const whiteSparks: Array<{ skillId: string; stars: 1 | 2 | 3 }> = [];
  for (const id of factorIds) {
    const d = decodeFactor(id);
    if (d.kind === 'blue') blueSpark ??= { stat: d.stat, stars: d.star };
    else if (d.kind === 'pink') pinkSpark ??= { aptitude: d.aptitude, stars: d.star };
    else if (d.kind === 'green') greenSpark ??= { skillId: d.uniqueSkillId, stars: d.star };
    else if (d.kind === 'white') {
      const skillId = deps.resolveWhiteSkill(d.groupBase);
      if (skillId) whiteSparks.push({ skillId, stars: d.star });
    }
    // skip → omitted (race / scenario)
  }
  return { blueSpark, pinkSpark, greenSpark, whiteSparks };
}

function intArray(x: unknown): number[] {
  return Array.isArray(x) ? x.filter((n): n is number => typeof n === 'number') : [];
}
function wonRacesOf(v: Json): string[] | undefined {
  const arr = intArray(v.win_saddle_id_array);
  return arr.length ? arr.map(String) : undefined;
}

function toGrandparent(node: unknown, deps: ParseDeps): ParentRef | undefined {
  if (!isObj(node)) return undefined;
  const cardId = num(node.card_id);
  if (cardId === undefined) return undefined;
  const { blueSpark, pinkSpark, greenSpark, whiteSparks } = decodeSparks(intArray(node.factor_id_array), deps);
  const ref: ParentRef = { umaId: String(cardId) };
  if (blueSpark) ref.blueSpark = blueSpark;
  if (pinkSpark) ref.pinkSpark = pinkSpark;
  if (greenSpark) ref.greenSpark = greenSpark;
  if (whiteSparks.length) ref.whiteSparks = whiteSparks;
  const won = wonRacesOf(node);
  if (won) ref.wonRaces = won;
  return ref;
}

function toParent(v: Json, deps: ParseDeps): Parent | undefined {
  const charaId = num(v.trained_chara_id);
  const cardId = num(v.card_id);
  const stats = statsOf(v);
  if (charaId === undefined || cardId === undefined || !stats) return undefined;
  const { blueSpark, pinkSpark, greenSpark, whiteSparks } = decodeSparks(intArray(v.factor_id_array), deps);
  if (!blueSpark || !pinkSpark) return undefined; // every trained uma has both main sparks

  // grandparents = succession positions 10 (parent-1 side) and 20 (parent-2 side)
  const succ = Array.isArray(v.succession_chara_array) ? v.succession_chara_array : [];
  const at = (pos: number) => succ.find((n) => isObj(n) && num((n as Json).position_id) === pos);
  const g10 = toGrandparent(at(10), deps);
  const g20 = toGrandparent(at(20), deps);

  const parent: Parent = {
    id: String(charaId),
    umaId: String(cardId),
    blueSpark,
    pinkSpark,
    whiteSparks,
    source: 'mine',
    importSource: 'umaextractor',
    stats,
  };
  if (greenSpark) parent.greenSpark = greenSpark;
  if (g10 || g20) parent.grandparents = [g10, g20];
  const rank = num(v.rank);
  if (rank !== undefined) parent.rating = ratingFromRank(rank);
  const rankScore = num(v.rank_score);
  if (rankScore !== undefined) parent.rankScore = rankScore;
  const won = wonRacesOf(v);
  if (won) parent.wonRaces = won;
  return parent;
}

export function parseUmaExtractor(json: unknown, deps: ParseDeps): ParseResult {
  const list: unknown[] = Array.isArray(json)
    ? json
    : isObj(json) && Array.isArray(json.trained_chara_array)
      ? json.trained_chara_array
      : isObj(json) && Array.isArray(json.data)
        ? json.data
        : [];
  const parents: Parent[] = [];
  let skipped = 0;
  for (const v of list) {
    const p = isObj(v) ? toParent(v, deps) : undefined;
    if (p) parents.push(p);
    else skipped += 1;
  }
  return { parents, skipped };
}
