/**
 * Core domain types — the frozen contract between the data pipeline (scripts/),
 * the pure-function core (src/core/), storage (src/db/) and UI (src/features/).
 *
 * Shapes follow plan §5, amended by Phase 0 findings (docs/provenance.md,
 * docs/mechanics-notes.md). Changes here ripple everywhere: discuss before editing.
 */

export type Server = 'global' | 'jp';

export type Stat = 'spd' | 'sta' | 'pow' | 'gut' | 'wit';

// ---------------------------------------------------------------------------
// Canonical primitive tokens + forward types (shared-types-reconciliation)
// ---------------------------------------------------------------------------

export type Grade = 'G' | 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
export type Role = 'ace' | 'debuffer' | 'hybrid';
export type Strategy = 'front' | 'pace' | 'late' | 'end';
export type Mood = -2 | -1 | 0 | 1 | 2;
export type AptKey =
  | { kind: 'distance'; key: 'short' | 'mile' | 'medium' | 'long' }
  | { kind: 'surface'; key: 'turf' | 'dirt' }
  | { kind: 'strategy'; key: Strategy };
export type CmId = `CM${number}`;
export interface CmRef {
  cmId: CmId;
  cmNumber: number;
  courseId: string;
  // Superset of the minimal spec CmRef: geometry carried until M3's cm_schedule derives it.
  surface: 'turf' | 'dirt';
  distance: number;
  condition?: string;
  season?: string;
}
export interface ParentSparks {
  pink: Array<{ aptKey: AptKey; stars: 1 | 2 | 3 }>;
  blue: Array<{ stat: Stat; stars: 1 | 2 | 3 }>;
  green: Array<{ uniqueSkillId: string; stars: 1 | 2 | 3 }>;
  white: Array<{ skillId: string; stars: 1 | 2 | 3 }>;
}
/** UmaExtractor roster target — M1-owned (its Dexie store + the nested Parent land in Plan 2). Forward type. */
export interface RosterEntry {
  id: string;
  umaId: string;
  stats: Record<Stat, number>;
  aptitudes: Array<{ aptKey: AptKey; grade: Grade }>;
  learnedSkills: string[];
  sparks: ParentSparks;
  tags: string[];
  source: 'mine' | 'friend_rental' | 'dummy';
  importSource: 'umaextractor' | 'paste' | 'roster' | 'dummy';
  trainerId?: string;
}
/** M4 wishlist item. `priority` retained (reconciliation: shared-data-model §4 omitted it but M4 weights by it). */
export interface WishlistItem {
  skillId: string;
  priority: Priority;
  source: 'targeted';
  projectedL?: number;
  projectedLStale?: boolean;
  needsInheriting?: boolean;
  doubleUp?: boolean;
  manualAdd?: boolean;
}

// ---------------------------------------------------------------------------
// Generated datasets (public/data/*.json)
// ---------------------------------------------------------------------------

export type SkillRarity = 'white' | 'gold' | 'unique' | 'inherited_unique';

export interface SkillRecord {
  /** master.mdb skill id, as string (e.g. "200012"; inherited uniques are 9xxxxx). */
  skillId: string;
  nameEn: string;
  nameJp: string;
  /** SP shop cost before hint discounts; 0 for uniques. */
  baseSpCost: number;
  rarity: SkillRarity;
  /**
   * Shared skill-icon id (master.mdb / upstream skills.json `iconId`) — many
   * skills map to one icon (~56 distinct). Resolves to icons/skill/<iconId>.webp.
   * See plan §4 "Image assets" + docs/provenance.md §2.
   */
  iconId: string;
  /** Gold skills require their white base (counted/bundled by SP math). */
  prereqSkillId?: string;
  /**
   * Game-internal scenario id (single_mode_scenario.id — NOT GameTora release
   * order; id 3 does not exist). Set only for scenario-exclusive skills.
   * See docs/provenance.md §3.1.
   */
  scenarioId?: number;
  /** Raw activation-condition DSL string (engine format), Global variant. */
  conditions: string;
  server: Server;
  dataVersion: string;
}

export type SkillSourceType = 'chain' | 'hint_pool' | 'random_event' | 'date_event';

export type CardType = 'speed' | 'stamina' | 'power' | 'guts' | 'wit' | 'friend' | 'group';

export type LimitBreak = 0 | 1 | 2 | 3 | 4;

export interface CardPerLevel {
  limitBreak: LimitBreak;
  /** Passive effect 18 at this LB's level cap (0 if the card lacks it). */
  hintFrequency: number;
  /** Passive effect 17 at this LB's level cap. */
  hintLevels: number;
  /** Passive effect 19 at this LB's level cap. */
  specialtyPriority: number;
}

export interface CardSkill {
  skillId: string;
  /** Overrides-patchable; 'date_event' = friend/group card date events. */
  sourceType: SkillSourceType;
  /** Hint levels granted per hint take (master.mdb hint_value_2), hint_pool only. */
  hintLevels?: number;
}

export interface SupportCardRecord {
  /** master.mdb support card id, as string (e.g. "30028"). */
  cardId: string;
  nameEn: string;
  charName: string;
  rarity: 'R' | 'SR' | 'SSR';
  type: CardType;
  perLevel: CardPerLevel[];
  skills: CardSkill[];
  /** Derived: count of skills with sourceType === 'hint_pool'. */
  hintPoolSize: number;
  server: Server;
  dataVersion: string;
}

/**
 * Hand-encoded from docs/mechanics-notes.md (Phase 0 verified values).
 * `provisional` fields are single-origin/disputed numbers (P3: render as
 * approximate in UI until in-game verification — mechanics-notes §10).
 */
export interface SparkRates {
  /** % per inspiration event by star count [1★,2★,3★], before affinity scaling. */
  baseProcPctByStars: {
    blue: [number, number, number];
    pink: [number, number, number];
    green: [number, number, number];
    whiteSkill: [number, number, number];
    whiteRace: [number, number, number];
    whiteScenario: [number, number, number];
  };
  /** Probabilistic inspiration events per career (Classic + Senior April). */
  inspirationEvents: 2;
  /**
   * chance = base × (1 + memberAffinity/100), clamped at 100%.
   * Affinity is the individual lineage member's score, NOT the displayed total.
   * NO flat grandparent multiplier exists (mechanics-notes §4).
   */
  affinityScaling: 'per_member_multiplicative_pct';
  pink: {
    /** Cumulative-star thresholds for +1/+2/+3/+4 career-start grades. */
    careerStartStepThresholds: [number, number, number, number];
    careerStartMaxSteps: 4;
    /** Career start cannot raise an aptitude above A. */
    careerStartCap: 'A';
    sToSRequiresInRunProcAtA: true;
  };
  /** Deterministic career-start stat points per blue spark by stars. */
  blueCareerStartByStars: [number, number, number];
  /** PROVISIONAL (mechanics-notes §6): in-run roll ranges by stars. */
  blueInRunRollRange: { 1: [number, number]; 2: [number, number]; 3: [number, number] };
  blueInRunRollRangeProvisional: true;
  /** Cumulative SP discount % at hint Lv1–5 (increments 10/10/10/5/5, cap 40). */
  hintDiscountCumulativePct: [number, number, number, number, number];
  /** Fast Learner / 切れ者: additional ×0.9 on SP cost. */
  fastLearnerMultiplier: number;
  dataVersion: string;
}

/** Playable uma outfit (public/data/umas.json) — picker data for parents entry. */
export interface UmaRecord {
  /** Character card id (master.mdb card_data id, e.g. "100201") — matches Parent.umaId. */
  umaId: string;
  /** Character id (= floor(umaId/100) as string). */
  charaId: string;
  nameEn: string;
  /** Outfit epithet, e.g. "Special Dreamer". */
  epithet?: string;
  server: Server;
  dataVersion: string;
}

/** Champions Meeting race preset (public/data/cm_presets.json), normalized from umalator cm-presets. */
export interface CmPreset {
  name: string;
  /** ISO date of the CM (finals) or month, e.g. "2026-03". */
  date: string;
  /** 'jp' = JP CM history (preview-only labeling per P4); 'global' = ran/announced on Global. */
  server: Server;
  dataVersion: string;
  courseId: string;
  surface: 'turf' | 'dirt';
  distance: number;
  season?: string;
  ground?: string;
  weather?: string;
  time?: string;
}

// ---------------------------------------------------------------------------
// User data (Dexie)
// ---------------------------------------------------------------------------

export interface OwnedCard {
  id?: number; // Dexie auto-increment
  cardId: string;
  limitBreak: LimitBreak;
}

export interface ParentRef {
  umaId: string;
  blueSpark?: { stat: Stat; stars: 1 | 2 | 3 };
  pinkSpark?: { aptitude: string; stars: 1 | 2 | 3 };
  whiteSparks?: Array<{ skillId: string; stars: 1 | 2 | 3 }>;
}

export interface Parent {
  id: string;
  /** Character card id (master.mdb card_data id as string). */
  umaId: string;
  blueSpark: { stat: Stat; stars: 1 | 2 | 3 };
  pinkSpark: { aptitude: string; stars: 1 | 2 | 3 };
  /** skillId = the 9xxxxx inherited-unique id (what the child gains). */
  greenSpark?: { skillId: string; stars: 1 | 2 | 3; sourceCardId?: string };
  whiteSparks: Array<{ skillId: string; stars: 1 | 2 | 3 }>;
  grandparents?: [ParentRef?, ParentRef?];
  /** Manual v1; computed affinity lands with Module 1 (plan §14.4). */
  affinityHint?: number;
  notes?: string;
  source: 'mine' | 'friend_rental';
  importSource?: 'umaextractor' | 'manual';
  stats?: Record<Stat, number>;
  rating?: string;
}

export type Priority = 1 | 2 | 3; // 1 = core target

export interface CmPlan {
  id: string;
  name: string;
  /** e.g. "2026-07" */
  month: string;
  scenario: {
    /** Game-internal id (1 URA, 2 Unity Cup, 4 Trackblazer — see provenance §3.1). */
    id: number;
    /** True when following the app-level "latest Global scenario" default. */
    isDefault: boolean;
  };
  race: {
    courseId: string;
    surface: 'turf' | 'dirt';
    distance: number;
    condition?: string;
    season?: string;
  };
  targetUmaId?: string;
  requiredAptitudes: Array<{ kind: 'surface' | 'distance' | 'style'; key: string; target: 'A' | 'S' }>;
  /** Variable length 1–7+; priority drives weighting, never list size. */
  targetSkills: Array<{ skillId: string; priority: Priority }>;
  lockedDeckSlots: Array<{ slot: 0 | 1 | 2 | 3 | 4 | 5; cardType?: CardType; cardId?: string }>;
  chosenParents: [string?, string?];
  spBudgetEstimate?: number;
}

// ---------------------------------------------------------------------------
// Coverage (Module 4 core output)
// ---------------------------------------------------------------------------

/** Reliability tiers, best → worst (plan §6 mechanics basis). */
export type Tier =
  | 'chain'
  | 'scenario'
  | 'date_event'
  | 'hint_strong'
  | 'hint_weak'
  | 'random'
  | 'spark'
  | 'uncovered';

export interface CoverageSource {
  kind: Tier;
  cardId?: string;
  /** Owning inventory row (OwnedCard.id) — disambiguates duplicate copies of a card. */
  ownedId?: number;
  /** The owning copy's limit break (denormalized for UI display). */
  limitBreak?: LimitBreak;
  parentId?: string;
  /** Spark probability % (whole career, all opportunities combined). */
  sparkPct?: number;
  /**
   * True when the number rests on a documented approximation (e.g. grandparent
   * affinity unknown — mechanics-notes §4 fallback). P3: render as "≈".
   */
  approximate?: boolean;
  /** Supporting evidence for the tier (P3): pool size, hint frequency, etc. */
  detail?: {
    hintPoolSize?: number;
    hintFrequency?: number;
    specialtyPriority?: number;
    sparkStars?: number;
    grandparent?: boolean;
    /** Affinity score used in the spark math (per-member where known). */
    affinityUsed?: number;
  };
}

export interface CoverageRow {
  skillId: string;
  priority: Priority;
  sources: CoverageSource[];
  bestTier: Tier;
}

// ---------------------------------------------------------------------------
// Deck suggester + contingency (Module 4 steps 4–5)
// ---------------------------------------------------------------------------

export interface DeckSuggestion {
  /** All 6 slots; locked slots echo their constraint, free slots get picks. */
  deck: Array<{
    slot: 0 | 1 | 2 | 3 | 4 | 5;
    cardId?: string;
    /** Why this slot is fixed, when it came from CmPlan.lockedDeckSlots. */
    lockedBy?: 'cardId' | 'cardType';
  }>;
  /** Σ(priorityWeight × tierWeight) over target skills, for comparing decks. */
  coverageScore: number;
  /** Target skillIds with no source in the suggested deck (+ parents). */
  uncovered: string[];
  /** Human-readable: which target(s) each pick covers, and at what tier. */
  rationale: string[];
}

/** Static contingency branch for a spark-covered target (plan §6, links M4→M2). */
export interface SparkContingency {
  skillId: string;
  /** Career-long proc chance %, from sparkChance. */
  sparkPct: number;
  /** True when sparkPct includes documented approximations (P3: render ≈). */
  approximate: boolean;
  /** SP cost if the spark procs (bought at the proc-granted hint discount). */
  spIfProc: number;
  /** The hint-level assumption behind spIfProc, shown verbatim in UI (P3). */
  spIfProcAssumption: string;
  /** SP cost if it misses (card-derived hint level, else full price). */
  spIfMiss: number;
  /** spIfMiss − spIfProc: the SP you must budget for the miss branch. */
  deltaSp: number;
}
