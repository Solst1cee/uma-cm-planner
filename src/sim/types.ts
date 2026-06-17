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

/** Fraction of sampled runs in which the tracked skill actually procs (発動率). */
export interface SkillRate {
  rate: number;     // 0..1
  nsamples: number;
}

/** Worker request/response unions. */
export type SimRequest =
  | { id: number; kind: 'skillDelta'; build: SimBuild; race: SimRaceParams; skillId: string; nsamples: number; seed?: number }
  | { id: number; kind: 'vacuum'; a: SimBuild; b: SimBuild; race: SimRaceParams; nsamples: number; seed?: number }
  | { id: number; kind: 'planner'; build: SimBuild; race: SimRaceParams; candidateSkills: string[]; nsamples: number; seed?: number };

export interface VacuumResult extends BashinStats {
  /** Win-rate of A vs B and stamina survival, for the M2 compare panel. */
  aFirstPlaceRate: number;
  bFirstPlaceRate: number;
  aStaminaSurvival: number;
  bStaminaSurvival: number;
}

export type SimResponse =
  | { id: number; ok: true; kind: 'skillDelta' | 'planner'; stats: BashinStats }
  | { id: number; ok: true; kind: 'vacuum'; stats: VacuumResult }
  | { id: number; ok: false; error: string };
