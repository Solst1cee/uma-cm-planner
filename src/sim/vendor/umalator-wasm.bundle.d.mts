// Types for the generated umalator-wasm.bundle.mjs (hand-written; the bundle
// ships no .d.ts of its own — its exports are either re-exported wasm-pack
// glue, whose real types live in ./pkg/uma_sim_wasm.d.ts, or plain re-exports
// of upstream TS functions). Source shapes: jalbarrang/umalator-global v0.27.0
// (484539f5c67e7aea8ef3715443d66602d871902d) + our
// engine-patches/2026-07-10-multifire-rust.patch.
//
// Kept minimal per the shared convention: real fields for what src/sim reads
// today, `unknown`/index-signature catch-alls for the rest.

// ============
// wasm-pack pkg glue (bundled, not external)
// ============

/** wasm-bindgen's `init`; accepts the options-object form only (we never pass a bare arg). */
export function initWasm(source?: {
  module_or_path?: WebAssembly.Module | BufferSource | Promise<WebAssembly.Module | BufferSource>;
}): Promise<unknown>;

/** Run a batch vacuum compare-family simulation. Synchronous after `initWasm`. */
export function runCompare(params: WasmCompareParams): WasmCompareData;

// ============
// WASM boundary DTOs (packages/uma-sim-wasm/src/dto.rs mirrors)
// ============

export interface WasmCorner {
  start: number;
  length: number;
}
export interface WasmStraight {
  start: number;
  end: number;
  frontType?: number;
}
export interface WasmSlope {
  start: number;
  length: number;
  slope: number;
}

export interface WasmCourseData {
  courseId: number;
  raceTrackId: number;
  distance: number;
  distanceType: number; // 1 short, 2 mile, 3 mid, 4 long
  surface: number; // 1 turf, 2 dirt
  turn: number; // 1 cw, 2 ccw, 3 unused, 4 none
  courseSetStatus?: number[]; // 1..5 (speed..wit)
  corners?: WasmCorner[];
  straights?: WasmStraight[];
  slopes?: WasmSlope[];
  laneMax: number;
  courseWidth: number;
  horseLane: number;
  laneChangeAcceleration: number;
  laneChangeAccelerationPerFrame: number;
  maxLaneDistance: number;
  moveLanePoint: number;
  isAbroad?: boolean;
}

export interface WasmRawEffect {
  modifier: number; // raw x10000 units
  target: number; // numeric SkillTarget
  type: number; // numeric SkillType
  valueUsage?: number;
  valueLevelUsage?: number;
}
export interface WasmSkillAlternative {
  baseDuration: number; // raw x10000 units
  cooldownTime?: number;
  condition: string;
  precondition?: string;
  effects: WasmRawEffect[];
}
export interface WasmSkillInput {
  skillId: string;
  rarity: number; // 1 white, 2 gold, 3/4/5 unique, 6 evolution
  alternatives: WasmSkillAlternative[];
}

export interface WasmCreateRunner {
  outfitId: string;
  name: string;
  mood: number; // -2..2
  strategy: number; // 1 front, 2 pace, 3 late, 4 end, 5 runaway
  popularity?: number;
  aptitudes: { distance: number; strategy: number; surface: number }; // 0 S .. 7 G
  stats: { speed: number; stamina: number; power: number; guts: number; wit: number };
  skills?: WasmSkillInput[];
  forcedPositions?: Record<string, number>;
  injectedDebuffs?: Array<{ skill: WasmSkillInput; position: number }>;
  forcedRushedRegions?: Array<{ start: number; end: number }>;
  forcedDuelingRegions?: Array<{ start: number; end: number }>;
  forcedSpotStruggleRegions?: Array<{ start: number; end: number }>;
  forcedRank?: Array<{ start: number; end: number; rank: number }>;
}

export interface WasmRaceParameters {
  ground: number; // 1 firm .. 4 heavy
  weather: number;
  season: number;
  timeOfDay: number;
  grade: number; // 100 G1 .. 999 daily
}

export interface WasmSettings {
  mode?: 'normal' | 'compare';
  healthSystem?: boolean;
  rushed?: boolean;
  downhill?: boolean;
  conservePower?: boolean;
  spotStruggle?: boolean;
  dueling?: boolean;
  witChecks?: boolean;
  skillSamples?: number;
  sectionModifier?: boolean;
  positionKeepMode?: number;
  staminaDrainOverrides?: Record<string, number>;
  /** Cooldown-aware multi-fire flag (our 2026-07-10 Rust patch). Default true. */
  cooldownReactivation?: boolean;
}

export interface WasmCompareParams {
  course: WasmCourseData;
  parameters: WasmRaceParameters;
  settings?: WasmSettings;
  runners: WasmCreateRunner[];
  nsamples: number;
  masterSeed: number;
}

/** One self/targeted skill-effect activation log entry. */
export interface WasmSkillEffectLog {
  executionId: string;
  skillId: string;
  start: number;
  end: number;
  perspective: number; // 1 self, 2 other
  effectType: number;
  effectTarget: number;
}

export interface WasmCompareRoundData {
  runnerId: number;
  time: number[];
  position: number[];
  velocity: number[];
  hp: number[];
  currentLane: number[];
  pacerGap: number[];
  order: number[];
  skillActivations: Record<string, WasmSkillEffectLog[]>;
  targetedSkillActivations: Record<string, WasmSkillEffectLog[]>;
  startDelay: number;
  rushed: Array<[number, number]>;
  duelingRegion?: [number, number];
  spotStruggleRegion?: [number, number];
  fullyChargedRegion?: [number, number];
  fullyChargedAccel?: number;
  hasAchievedFullSpurt: boolean;
  outOfHp: boolean;
  outOfHpPosition?: number;
  nonFullSpurtVelocityDiff?: number;
  nonFullSpurtDelayDistance?: number;
  firstPositionInLateRace: boolean;
  usedSkills: string[];
  finished: boolean;
  finishPosition: number;
}

export interface WasmCompareRound {
  seed: number;
  primaryRunnerId?: number;
  runners: WasmCompareRoundData[];
}

export interface WasmCompareData {
  rounds: WasmCompareRound[];
}

// ============
// App-domain shapes (upstream `@/lib/uma-domain` + `@/modules/simulation`)
// ============

/**
 * Course geometry produced by coursesService.getSimCourse — the CourseData
 * shape courseDataToWasm consumes. The bundle ships no .d.ts so this is
 * hand-declared; extra fields fall through the index signature.
 */
export interface CourseData {
  readonly courseId: number;
  readonly raceTrackId: number;
  readonly distance: number;
  readonly distanceType: number;
  readonly surface: number; // 1=Turf, 2=Dirt
  readonly turn: number; // 1=right-handed, 2=left-handed
  readonly courseSetStatus: ReadonlyArray<number>;
  readonly corners: ReadonlyArray<{ readonly start: number; readonly length: number }>;
  readonly straights: ReadonlyArray<{
    readonly start: number;
    readonly end: number;
    readonly frontType?: number;
  }>;
  readonly slopes: ReadonlyArray<{
    readonly start: number;
    readonly length: number;
    readonly slope: number;
  }>;
  readonly laneMax: number;
  readonly courseWidth: number;
  readonly horseLane: number;
  readonly laneChangeAcceleration: number;
  readonly laneChangeAccelerationPerFrame: number;
  readonly maxLaneDistance: number;
  readonly moveLanePoint: number;
  readonly isAbroad?: boolean;
  readonly [key: string]: unknown;
}

/** A raw course-catalog entry (from coursesService enumeration; geometry omitted). */
export interface CourseEntry {
  readonly raceTrackId: number;
  readonly distance: number;
  readonly distanceType: number; // 1=sprint, 2=mile, 3=medium, 4=long, 5=extra
  readonly surface: number; // 1=Turf, 2=Dirt
  readonly turn: number; // 1=right-handed, 2=left-handed
  readonly course: number; // uma-tools in/out code: 1=none, 2=inner, 3=outer, 4=outer->inner
  readonly [key: string]: unknown;
}

export const coursesService: {
  getSimCourse(courseId: number): CourseData;
  getAll(): CourseEntry[];
  getAllEntries(): Array<[string, CourseEntry]>;
  getByTrackId(trackId: number): CourseEntry[];
};

/** A resolved skill record (only the fields resolveSkillInput/isSimulatable read). */
export interface SkillRecord {
  id: string;
  rarity: number;
  alternatives: WasmSkillAlternative[];
  [key: string]: unknown;
}
export const skillsService: {
  getById(skillId: string): SkillRecord | undefined;
  isSimulatable(skillId: string): boolean;
};

/** Re-export of `skillsService.isSimulatable`, bound; matches the old bundle's exported name. */
export function isSimulatable(skillId: string): boolean;

/** Engine runner input (upstream `IRunnerState`). Strategy + aptitudes are STRING labels. */
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
  gate?: number | null; // 1-based post; toCreateRunner converts to 0-based
  [key: string]: unknown;
}

/** Upstream `CreateRunner` — the intermediate shape between IRunnerState and the WASM DTO. */
export interface CreateRunner {
  outfitId: string;
  mood: number;
  strategy: number; // numeric IStrategy (1 front .. 5 runaway)
  popularity?: number;
  aptitudes: { distance: number; surface: number; strategy: number };
  stats: { speed: number; stamina: number; power: number; guts: number; wit: number };
  skills: string[];
  gate?: number;
  forcedPositions?: Record<string, number>;
  injectedDebuffs?: Array<{ skillId: string; position: number }>;
  forcedRushedRegions?: Array<{ start: number; end: number }>;
  forcedDuelingRegions?: Array<{ start: number; end: number }>;
  forcedSpotStruggleRegions?: Array<{ start: number; end: number }>;
  forcedRank?: Array<{ start: number; end: number; rank: number }>;
}

export function toCreateRunner(
  runner: IRunnerState,
  sortedSkills: Array<string>,
  forcedPositions?: Record<string, number>,
  injectedDebuffs?: Array<{ skillId: string; position: number }>,
  scenarioOverrides?: {
    forcedRushed?: { start: number; end: number };
    forcedDueling?: { start: number; end: number };
    forcedSpotStruggle?: { start: number; end: number };
    forcedRank?: Array<{ start: number; end: number; rank: number }>;
  },
  popularity?: number
): CreateRunner;

export function sundayRunnerToWasm(runner: CreateRunner, name: string): WasmCreateRunner;

/** Resolve a skill id (possibly with a `-suffix`) to its WASM input DTO. */
export function resolveSkillInput(skillId: string): WasmSkillInput | null;

export function courseDataToWasm(course: CourseData): WasmCourseData;

/** Race conditions the engine accepts. `time`/`timeOfDay` are interchangeable inputs. */
export interface RaceDef {
  ground: number; // 1=firm
  weather: number; // 1=sunny
  season: number;
  time?: number;
  timeOfDay?: number;
  grade: number; // 100=G1
  [key: string]: unknown;
}

/** Upstream `RaceParameters` (aka SundayRaceParameters) — the resolved race-condition shape. */
export interface SundayRaceParameters {
  ground: number;
  weather: number;
  season: number;
  timeOfDay: number;
  grade: number;
}

/** Throws if any of ground/weather/season/timeOfDay(or time)/grade is missing. */
export function toSundayRaceParameters(racedef: RaceDef): SundayRaceParameters;

export function raceParametersToWasm(parameters: SundayRaceParameters): WasmRaceParameters;

/** Upstream `SimulationSettings`. */
export interface SimulationSettings {
  mode: 'compare' | 'normal';
  healthSystem: boolean;
  sectionModifier: boolean;
  rushed: boolean;
  downhill: boolean;
  conservePower?: boolean;
  spotStruggle: boolean;
  dueling: boolean;
  witChecks: boolean;
  positionKeepMode: number;
  staminaDrainOverrides?: Record<string, number>;
  cooldownReactivation?: boolean;
}

/** Defaults: `mode:'compare'`, everything else false/0/{} unless overridden. */
export function createCompareSettings(
  overrides?: Partial<Omit<SimulationSettings, 'mode'>>
): SimulationSettings;

export function compareSettingsToWasm(settings: SimulationSettings): WasmSettings;

/** One recorded skill activation, reshaped from the WASM log (`ActivationLog`-equivalent). */
export interface SkillEffectLog {
  executionId: string;
  skillId: string;
  start: number;
  end: number;
  perspective: number;
  effectType: number;
  effectTarget: number;
}

/** Upstream `CollectedRunnerRoundData` — one runner's per-round telemetry. */
export interface CollectedRunnerRoundData {
  runnerId: number;
  time: number[];
  position: number[];
  velocity: number[];
  hp: number[];
  currentLane: number[];
  pacerGap: number[];
  order: number[];
  skillActivations: Record<string, SkillEffectLog[]>;
  targetedSkillActivations: Record<string, SkillEffectLog[]>;
  startDelay: number;
  rushed: Array<[number, number]>;
  duelingRegion: [number, number] | [];
  spotStruggleRegion: [number, number] | [];
  fullyChargedRegion: [number, number] | [];
  fullyChargedAccel: number | null;
  hasAchievedFullSpurt: boolean;
  outOfHp: boolean;
  outOfHpPosition: number | null;
  nonFullSpurtVelocityDiff: number | null;
  nonFullSpurtDelayDistance: number | null;
  firstPositionInLateRace: boolean;
  usedSkills: string[];
  finished: boolean;
  finishPosition: number;
}

export function wasmCompareRoundDataToCollected(data: WasmCompareRoundData): CollectedRunnerRoundData;

/** Primary-runner round telemetry for both contestants, aligned by round index. */
export interface CompareRounds {
  roundsA: CollectedRunnerRoundData[];
  roundsB: CollectedRunnerRoundData[];
}

/** One full per-frame run trace. Each array is `[runnerA, runnerB]`. */
export interface SimulationRun {
  time: [number[], number[]];
  position: [number[], number[]];
  velocity: [number[], number[]];
  hp: [number[], number[]];
  currentLane: [number[], number[]];
  pacerGap: [number[], number[]];
  order: [number[], number[]];
  skillActivations: [Record<string, SkillEffectLog[]>, Record<string, SkillEffectLog[]>];
  targetedSkillActivations: [Record<string, SkillEffectLog[]>, Record<string, SkillEffectLog[]>];
  startDelay: [number, number];
  rushed: [Array<[number, number]>, Array<[number, number]>];
  duelingRegions: [[number, number] | [], [number, number] | []];
  spotStruggleRegions: [[number, number] | [], [number, number] | []];
  fullyChargedRegions: [[number, number] | [], [number, number] | []];
  fullyChargedAccel: [number | null, number | null];
}

export interface RunDataBundle {
  minrun: SimulationRun;
  maxrun: SimulationRun;
  meanrun: SimulationRun;
  medianrun: SimulationRun;
}

export interface CompareStatsSummary {
  min: number;
  max: number;
  mean: number;
  frequency: number;
}
export interface CompareStats {
  uma1: CompareStatsSummary;
  uma2: CompareStatsSummary;
}
export interface StaminaStats {
  uma1: { staminaSurvivalRate: number; fullSpurtRate: number };
  uma2: { staminaSurvivalRate: number; fullSpurtRate: number };
}
export interface FirstUmaStats {
  uma1: { firstPlaceRate: number };
  uma2: { firstPlaceRate: number };
}

export interface CompareResult {
  results: number[];
  runData: RunDataBundle;
  rushedStats: CompareStats;
  fullyChargedStats: CompareStats;
  leadCompetitionStats: CompareStats;
  duelingStats: CompareStats;
  spurtInfo: null;
  staminaStats: StaminaStats;
  firstUmaStats: FirstUmaStats;
}

export function reduceCompareRoundsPublic(rounds: CompareRounds, nsamples: number): CompareResult;

/** `a === b` or their `-suffix`-stripped base ids match. */
export function isSameSkill(skillIdA: string, skillIdB: string): boolean;

export function computePositionDiff(positionA: number[], positionB: number[]): number;
