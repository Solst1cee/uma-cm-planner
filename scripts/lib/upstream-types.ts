/**
 * Minimal typings for the borrowed upstream JSON (jalbarrang/umalator-global,
 * pinned commit c1fa2107 — docs/provenance.md §3). Only the fields the
 * pipeline reads; shapes verified against the actual files on 2026-06-12.
 */

// --- master.mdb extracts (Global-released cutover) -------------------------

export interface MasterSkillEffect {
  type: number;
  modifier: number;
  target: number;
}

export interface MasterSkillAlternative {
  precondition: string;
  condition: string;
  effects: MasterSkillEffect[];
}

export interface MasterSkill {
  id: string;
  /** 1=white, 2=gold, 3–5=unique. Inherited uniques (9xxxxx) carry rarity 1 + unique_version. */
  rarity: number;
  /** Other skill ids in the same family (gold↔white links). */
  versions: number[];
  baseCost: number;
  /** Official EN name (Global master.mdb text_data). */
  name: string;
  alternatives: MasterSkillAlternative[];
  /** Present exactly on the 84 inherited-unique 9xxxxx skills. */
  unique_version?: { id: number };
}

export type MasterSkillsJson = Record<string, MasterSkill>;

export interface MasterCardSkillRef {
  id: number;
}

export interface MasterCard {
  id: number;
  /** Official EN card title, e.g. "[Fire at My Heels]". */
  name: string;
  charaName: string;
  /** 1=R, 2=SR, 3=SSR. */
  rarity: number;
  /** 1..7 = speed/stamina/power/guts/wit(=intelligence)/friend/group. */
  supportCardType: number;
  hintSkills: MasterCardSkillRef[];
  /** GameTora flat event list — disagrees with chain∪random for ~19 cards (provenance §4). */
  eventSkills: MasterCardSkillRef[];
}

export type MasterCardsJson = Record<string, MasterCard>;

export interface Course {
  distance: number;
  /** 1=turf, 2=dirt. */
  surface: number;
}

export type CourseDataJson = Record<string, Course>;

// --- GameTora snapshots (full JP+Global catalog) ---------------------------

export interface GtConditionGroup {
  condition?: string;
  precondition?: string;
}

/** Per-server (Global) overrides; a field's presence replaces the JP default. */
export interface GtLocEn {
  condition_groups?: GtConditionGroup[];
  gene_version?: { condition_groups?: GtConditionGroup[] };
  sup_hint?: number[][] | number[];
  sup_e?: number[][] | number[];
  char?: number[];
  char_e?: number[];
}

export interface GtSkill {
  id: number;
  jpname?: string;
  condition_groups?: GtConditionGroup[];
  /** The inherited 9xxxxx version of a unique skill (nested, never top-level). */
  gene_version?: { id: number; condition_groups?: GtConditionGroup[] };
  loc?: { en?: GtLocEn };
  /** GameTora release-order scenario numbers (GT#), NOT internal ids — provenance §3.1. */
  sce_e?: number[];
  sup_hint?: number[][] | number[];
  sup_e?: number[][] | number[];
  char?: number[];
  char_e?: number[];
}

export interface GtCard {
  support_id: number;
  /**
   * Passive matrix rows: [effect_type, lv1, lv5, lv10, ..., lv50] (11 value
   * columns, -1 = unspecified). Byte-identical to Global master.mdb
   * support_card_effect_table (docs/mechanics-notes.md §9).
   */
  effects?: number[][];
}

export type EventSkillSourcesJson = Record<
  string,
  { chain_event_skills: number[]; random_event_skills: number[] }
>;

// --- umalator race presets --------------------------------------------------

export interface UpstreamCmPreset {
  id: string;
  name: string;
  type: number;
  date: string;
  courseId: number;
  season?: number;
  ground?: number;
  weather?: number;
  time?: number;
}
