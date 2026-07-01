/**
 * Minimal typings for the borrowed upstream JSON (jalbarrang/umalator-global
 * pinned commit c1fa2107 — docs/provenance.md §3; jechto/Tachyons-lab pinned
 * commit 2ce0c8fe — provenance §4.1). Only the fields the pipeline reads;
 * shapes verified against the actual files on 2026-06-12.
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
  /** Umalator skill family id; skills with the same id are mutually exclusive variants. */
  groupId?: number;
  /** Other skill ids in the same family (gold↔white links). */
  versions: number[];
  baseCost: number;
  /** Shared skill-icon id (~56 distinct across all skills) → icons/skill/<iconId>.webp. */
  iconId: string;
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
  rarity: number; // 1=R 2=SR 3=SSR
  type: string; // speed|stamina|power|guts|intelligence|friend|group
  char_name: string;
  title_en?: string; // fan/EN card title; absent for JP-only
  title_ja?: string;
  hints?: { hint_skills?: number[]; hint_others?: unknown[] };
  event_skills?: number[];
  release?: string; // JP release date (ISO)
  title_en_gl?: string;
  release_en?: string; // Global release date, absent if unreleased
}

/** gametora/character-cards.json — full JP+Global catalog (254 playable outfits). */
export interface GtCharacterCard {
  /** Character card id (master.mdb card_data id), e.g. 100101. */
  card_id: number;
  char_id: number;
  /** [turf, dirt, sprint, mile, medium, long, front, pace, late, end]. */
  aptitude?: string[];
  /** [speed, stamina, power, guts, wit] growth bonuses as percentages. */
  stat_bonus?: number[];
  /** GameTora house-style EN name — may differ from official ("TM Opera O" vs "T.M. Opera O"). */
  name_en?: string;
  /** Fan-TL outfit title (no brackets) — present for the whole catalog incl. JP-only. */
  title?: string;
  /** OFFICIAL Global EN outfit title incl. brackets, e.g. "[Special Dreamer]"; absent if not Global-released. */
  title_en_gl?: string;
  /** Global release date (ISO), absent if unreleased on Global. */
  release_en?: string;
}

export type EventSkillSourcesJson = Record<
  string,
  { chain_event_skills: number[]; random_event_skills: number[] }
>;

// --- Tachyons-lab event-reward dataset (jechto/Tachyons-lab data.json) ------

/**
 * One event reward. Skill-bearing reward types (verified against the pinned
 * data, 2026-06-12): 'Skill Hint' (hint at `value` levels), 'Skill Choice'
 * (chain-finale pick-one), 'sg' (direct skill grant, no SP purchase). All
 * carry the skill id in `detail`; other reward types reuse `detail` for
 * non-skill payloads (bond chara ids, energy, ...) — always check `type`.
 */
export interface TachyonsReward {
  type: string;
  value?: string | null;
  detail?: number | null;
}

export interface TachyonsChoice {
  option?: string;
  rewards?: TachyonsReward[];
}

export interface TachyonsEvent {
  name?: string;
  choices?: TachyonsChoice[];
  /** Pre-anniversary versions of the event — superseded; never read. */
  history?: unknown;
}

export interface TachyonsHint {
  type: string;
  skill_id: number;
  /** Hint levels granted per training-hint take (= master.mdb hint_value_2). */
  hint_level?: number;
}

export interface TachyonsCard {
  id: number;
  rarity: number;
  card_chara_name?: string;
  /** Training hint pool with per-skill hint levels. */
  hints_table?: TachyonsHint[];
  all_events?: {
    /** Friend/group date (outing) events. */
    dates?: TachyonsEvent[];
    chain_events?: TachyonsEvent[];
    random_events?: TachyonsEvent[];
    /** Bond-line specials (e.g. "A Bond with Tazuna") — residual overrides, see data-overrides/. */
    special_events?: TachyonsEvent[];
  };
}

/** data.json is an object keyed by array index ("0".."216"), NOT by card id. */
export type TachyonsDataJson = Record<string, TachyonsCard>;

/** umas.json (Global cutover) — charaId → character; outfit titles are official EN (master.mdb text_data). */
export interface UmalatorUma {
  /** [jp, en] — the jp slot is empty in the Global cutover extract. */
  name: [string, string];
  /** umaId ("100101", = master.mdb card_data id) → official EN outfit title incl. brackets. */
  outfits: Record<string, string>;
}

export type UmalatorUmasJson = Record<string, UmalatorUma>;

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
