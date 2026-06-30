// The typed contract between src/sim and its callers (features/core).
import type { Stat } from '@/core/types';

/** Our strategy labels (shared-data-model §2). The engine also has a 5th ('Runaway'/大逃げ); intentionally omitted — out of scope for the current Global meta. */
export type Strategy = 'front' | 'pace' | 'late' | 'end';

/** Aptitude letter grades (engine accepts these strings directly). */
export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

/** A runner build expressed in OUR domain terms. */
export interface SimBuild {
  umaId: string;
  stats: Record<Stat, number>;        // spd/sta/pow/gut/wit
  strategy: Strategy;
  /** Aptitude grades as letters, e.g. { distance: 'A', surface: 'A', strategy: 'A' }. */
  aptitudes: { distance: Grade; surface: Grade; strategy: Grade };
  /** Owned/learned skill ids (master.mdb string ids — same as the engine's). */
  skills: string[];
  /** Per-skill level (1–6). Skills absent here use Lv1 (engine default). Keyed by master.mdb skill id. */
  skillLevels?: Record<string, number>;
  /** -2..2; defaults to 2 (Great) at the adapter. */
  mood?: -2 | -1 | 0 | 1 | 2;
}

/** Race conditions in OUR terms; the adapter maps to the engine's numeric racedef. */
export interface SimRaceParams {
  courseId: string;            // matches CmPlan.race.courseId
  ground?: number;             // default 1 (firm)
  weather?: number;            // default 1 (sunny)
  season?: number;             // default 3
  time?: number;               // default 2
  grade?: number;              // default 100 (G1)
}

/** Bashin (horse-length) summary — the honest-numbers output (P3). */
export interface BashinStats {
  mean: number;
  median: number;
  min: number;
  max: number;
  nsamples: number;
  /** Per-sample bashin values, SORTED ascending (distribution/histogram use; not sample-ordered). */
  results: number[];
  /**
   * Whether the tracked skill activated in at least one sample (engine's
   * `skillActivations` was non-empty). Distinguishes "procced but ~0 length"
   * (e.g. recovery) from "can never proc on this track". Undefined when not
   * reported (e.g. nsamples 0 / not simulatable).
   */
  activated?: boolean;
}

/** Which representative run (by bashin L) the charts read. */
export type RunChoice = 'min' | 'max' | 'mean' | 'median';

/** One per-frame sample of a run. */
export interface SkillFrame {
  t: number;    // seconds
  v: number;    // m/s
  pos: number;  // course metres
  hp: number;
}

/** A single representative run mapped to clean arrays. */
export interface SkillTraceRun {
  withSkill: SkillFrame[];
  without: SkillFrame[];
  activation: { start: number; end: number }[]; // tracked-skill regions, course metres
  L: number;                                     // bashin for this run
}

/** The four representative runs + summary; min/max/mean/median come back in one sim. */
export interface SkillTrace {
  runs: Record<RunChoice, SkillTraceRun>;
  meanL: number;
  nsamples: number;
}

/** One activating sample: the バ身 it gained and where the tracked skill fired (metres). */
export interface SkillImpactSample {
  horseLength: number;
  positions: number[];
}

/** Position-resolved activation data from N samples — drives the "length impact" and
 *  "activation frequency" charts; the activation rate (発動率) is samples.length / nsamples. */
export interface SkillImpact {
  samples: SkillImpactSample[];
  nsamples: number;
  distance: number; // course distance (metres), for the position axis
}

/** One skill activation region on a full-race run (course metres), with its skill id. */
export interface RaceActivation { skillId: string; start: number; end: number; }

/** バ身 gap of uma1 over uma2 at uma1's course position (positive = uma1 ahead). */
export interface GapPoint { pos: number; bashin: number; }

/** One representative full-race run comparing two builds (umalator main view). */
export interface RaceCompareRun {
  uma1Frames: SkillFrame[];
  uma2Frames: SkillFrame[];
  uma1Acts: RaceActivation[];
  uma2Acts: RaceActivation[];
  gap: GapPoint[];
}

/** Two-build race comparison: 4 representative runs + summary, from one sim. */
export interface RaceCompare {
  runs: Record<RunChoice, RaceCompareRun>;
  distance: number;     // course metres (x-axis domain)
  nsamples: number;
  meanBashin: number;   // mean バ身 gap of uma1 over uma2
}

/** Worker request/response unions. */
export type SimRequest =
  | { id: number; kind: 'skillDelta'; build: SimBuild; race: SimRaceParams; skillId: string; nsamples: number; seed?: number }
  | { id: number; kind: 'vacuum'; a: SimBuild; b: SimBuild; race: SimRaceParams; nsamples: number; seed?: number; opts?: VacuumOpts }
  | { id: number; kind: 'planner'; build: SimBuild; race: SimRaceParams; candidateSkills: string[]; nsamples: number; seed?: number }
  | { id: number; kind: 'skillTrace'; build: SimBuild; race: SimRaceParams; skillId: string; nsamples: number; seed?: number }
  | { id: number; kind: 'skillImpact'; build: SimBuild; race: SimRaceParams; skillId: string; nsamples: number; seed?: number }
  | { id: number; kind: 'raceCompare'; uma1: SimBuild; uma2: SimBuild; race: SimRaceParams; nsamples: number; seed?: number };

export interface VacuumOpts {
  /** Apply downhill saving mode to both runners (allowDownhillUma1/2 in engine options). */
  downhill?: boolean;
  /** Inject debuffs at fixed positions for scenario modelling. Top-level runComparison param. */
  injectedDebuffs?: {
    uma1: Array<{ skillId: string; position: number }>;
    uma2: Array<{ skillId: string; position: number }>;
  };
  /** Per-skill stamina drain multiplier overrides. */
  staminaDrainOverrides?: Record<string, number>;
}

export interface VacuumResult extends BashinStats {
  /** Win-rate of A vs B and stamina survival, for the M2 compare panel. */
  aFirstPlaceRate: number;
  bFirstPlaceRate: number;
  aStaminaSurvival: number;
  bStaminaSurvival: number;
  /** Fraction of runs where the runner achieved full-spurt (0–1). */
  aFullSpurtRate: number;
  bFullSpurtRate: number;
  /** Per-sample finish HP for runner A and B (one entry per simulation run). */
  aFinalHp: number[];
  bFinalHp: number[];
}

export type SimResponse =
  | { id: number; ok: true; kind: 'skillDelta' | 'planner'; stats: BashinStats }
  | { id: number; ok: true; kind: 'vacuum'; stats: VacuumResult }
  | { id: number; ok: true; kind: 'skillTrace'; trace: SkillTrace }
  | { id: number; ok: true; kind: 'skillImpact'; impact: SkillImpact }
  | { id: number; ok: true; kind: 'raceCompare'; result: RaceCompare }
  | { id: number; ok: false; error: string };
