// Types for the generated umalator.bundle.mjs (hand-written; the bundle ships no .d.ts).
// Source shapes: jalbarrang/umalator-global v0.14.2.

/** Engine runner input. Strategy + aptitudes are STRING labels; mood is -2..2. */
export interface IRunnerState {
  outfitId: string;
  speed: number;
  stamina: number;
  power: number;
  guts: number;
  wisdom: number;
  strategy: 'Front Runner' | 'Pace Chaser' | 'Late Surger' | 'End Closer' | 'Runaway';
  distanceAptitude: string; // 'S'|'A'|'B'|'C'|'D'|'E'|'F'|'G'
  surfaceAptitude: string;
  strategyAptitude: string;
  mood: -2 | -1 | 0 | 1 | 2;
  skills: string[];
  randomMobId?: number;
  linkedRunnerId?: string;
}

/**
 * Course geometry produced by coursesService.getSimCourse. The named fields are
 * the ones we read for the §0 track diagram (verified present at runtime; the
 * bundle ships no .d.ts so these are hand-declared). The index signature keeps
 * the rest of the engine's record reachable as `unknown`.
 */
export interface CourseData {
  readonly courseId: number;
  readonly distance: number;
  readonly surface: number; // 1=Turf, 2=Dirt
  readonly turn: number; // 1=right-handed, 2=left-handed
  readonly corners: ReadonlyArray<{ readonly start: number; readonly length: number }>;
  readonly straights: ReadonlyArray<{ readonly start: number; readonly end: number; readonly frontType: number }>;
  readonly slopes: ReadonlyArray<{ readonly start: number; readonly length: number; readonly slope: number }>;
  readonly [key: string]: unknown;
}

/** Race conditions (engine accepts plain numbers; see adversarial-smoke). */
export interface RaceDef {
  ground: number;  // 1=firm
  weather: number; // 1=sunny
  season: number;
  time: number;
  grade: number;   // 100=G1
  [key: string]: unknown;
}

export interface SimOptions {
  seed?: number;
  ignoreStaminaConsumption?: boolean;
  [key: string]: unknown;
}

/** One recorded skill activation in a run (positions are course metres). */
export interface ActivationLog {
  skillId: string;
  start: number;
  end: number;
  [key: string]: unknown;
}
/** A full per-frame run trace. Each tuple is [runnerA, runnerB]. */
export interface SimulationRun {
  time: [number[], number[]];
  position: [number[], number[]];
  velocity: [number[], number[]];
  hp: [number[], number[]];
  skillActivations: [Record<string, ActivationLog[]>, Record<string, ActivationLog[]>];
  [key: string]: unknown;
}
export interface RunDataBundle {
  minrun: SimulationRun;
  maxrun: SimulationRun;
  meanrun: SimulationRun;
  medianrun: SimulationRun;
}

/** One activating sample for the tracked skill: バ身 gained + activation positions (metres). */
export interface TrackedActivationMeta {
  horseLength: number;
  positions: number[];
}
export interface SkillComparisonResult {
  results: number[];
  skillActivations: Record<string, TrackedActivationMeta[]>;
  runData: unknown;
  min: number; max: number; mean: number; median: number;
}
export interface PlannerCompareResult {
  results: number[];
  skillActivations: Record<string, unknown>;
  min: number; max: number; mean: number; median: number;
}
export interface CompareResult {
  results: number[];
  runData: RunDataBundle;
  rushedStats: unknown;
  leadCompetitionStats: unknown;
  spurtInfo: null;
  staminaStats: { uma1: { staminaSurvivalRate: number; fullSpurtRate: number }; uma2: { staminaSurvivalRate: number; fullSpurtRate: number } };
  firstUmaStats: { uma1: { firstPlaceRate: number }; uma2: { firstPlaceRate: number } };
}

export function runSkillComparison(params: {
  trackedSkillId: string; nsamples: number; course: CourseData; racedef: RaceDef;
  runnerA: IRunnerState; runnerB: IRunnerState; options: SimOptions;
}): SkillComparisonResult;

export function runComparison(params: {
  nsamples: number; course: CourseData; racedef: RaceDef;
  uma1: IRunnerState; uma2: IRunnerState; options: SimOptions;
}): CompareResult;

export function runPlannerComparison(params: {
  nsamples: number; course: CourseData; racedef: RaceDef;
  runnerA: IRunnerState; runnerB: IRunnerState; candidateSkills: string[];
  ignoreStaminaConsumption: boolean; options: SimOptions;
}): PlannerCompareResult;

/** A raw course-catalog entry (from coursesService enumeration; geometry omitted). */
export interface CourseEntry {
  readonly raceTrackId: number;
  readonly distance: number;
  readonly distanceType: number; // 1=sprint, 2=mile, 3=medium, 4=long, 5=extra
  readonly surface: number; // 1=Turf, 2=Dirt
  readonly turn: number; // 1=right-handed, 2=left-handed
  readonly [key: string]: unknown;
}
export const coursesService: {
  getSimCourse(courseId: number): CourseData;
  getAll(): CourseEntry[];
  getAllEntries(): Array<[string, CourseEntry]>;
  getByTrackId(trackId: number): CourseEntry[];
};
export const skillsService: {
  getById(skillId: string): { name?: string } | undefined;
  isSimulatable(skillId: string): boolean;
};
