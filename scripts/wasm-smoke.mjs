// TEMPORARY spike script — deleted in Task 9 once the real TS adapter/loader
// lands. Proves Node can init the wasm-pack `--target web` bundle from raw
// filesystem bytes and run a seeded `runCompare` deterministically, before any
// app-side plumbing is built (Task 0 fail-fast gate), and drives the Task 1
// multi-fire identity backstop + acceptance oracle.
//
// One process = one fresh WASM instantiation = one runCompare call, matching
// how the identity procedure is structured (read -> compile -> init -> run ->
// log). Determinism is verified by invoking this script as separate `node`
// processes and diffing their printed summaries — NOT by calling runCompare
// twice on one long-lived instance within a single process. (A same-instance
// repeat call was spiked in Task 0 and found to differ on the very first
// post-init call vs. all subsequent calls on that same instance, which
// stabilize among themselves — almost certainly a one-time lazy-static warm-up
// in the engine. That's a real quirk for whoever builds the persistent worker
// loader, but it is NOT the "read bytes, init, run, get a reproducible result"
// contract this smoke proves — that holds cleanly across fresh instantiations.)
//
// Usage (all via env vars):
//   WASM_PKG=<dir>       pkg directory (default: src/sim/vendor/pkg)
//   SMOKE_MODE=default   the original Nakayama-1200 determinism run (default)
//   SMOKE_MODE=multifire drive skill 200332 on a course; the Task 1 fixtures
//     MF_COURSE=10914|10602   Hanshin 3200m / Kyoto-mile 1600m (default 10914)
//     MF_COOLDOWN=true|false  cooldownReactivation flag (default true)
//     MF_WITCHECKS=true|false wit checks (default true)
//     MF_SEED=<int>           master seed (default 12345)
//     MF_NSAMPLES=<int>       rounds (default 50)
//     MF_DUMP=<path>          if set, write the canonical full-result JSON there
//
// Course fields are hand-copied from spikes/repos/umalator-global's
// src/modules/data/json/course_data.json plus the fixed per-course geometry
// constants CourseService.getSimCourse derives (courseWidth=11.25 etc.).
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PKG_DIR = process.env.WASM_PKG
  ? path.resolve(process.env.WASM_PKG)
  : path.join(ROOT, 'src/sim/vendor/pkg');
const WASM_PATH = path.join(PKG_DIR, 'uma_sim_wasm_bg.wasm');
const GLUE_PATH = pathToFileURL(path.join(PKG_DIR, 'uma_sim_wasm.js')).href;

// Fixed geometry constants CourseService.getSimCourse derives per course.
function simGeometry(raw) {
  const courseWidth = 11.25;
  return {
    courseSetStatus: raw.courseSetStatus ?? [],
    courseWidth,
    horseLane: courseWidth / 18.0,
    laneChangeAcceleration: 0.02 * 1.5,
    laneChangeAccelerationPerFrame: (0.02 * 1.5) / 15.0,
    maxLaneDistance: (courseWidth * raw.laneMax) / 10000.0,
    moveLanePoint: raw.corners.length > 0 ? raw.corners[0].start : 30.0,
  };
}

// Nakayama turf 1200m (course_data entry 10101) — the Task 0 determinism course.
const NAKAYAMA_1200 = {
  courseId: 10101,
  raceTrackId: 10001,
  distance: 1200,
  distanceType: 1,
  surface: 1,
  turn: 1,
  laneMax: 13500,
  corners: [
    { start: 400, length: 275 },
    { start: 675, length: 275 },
  ],
  straights: [
    { start: 0, end: 400, frontType: 2 },
    { start: 950, end: 1200, frontType: 1 },
  ],
  slopes: [],
};

// Hanshin turf 3200m (course_data entry 10914) — Prof/Corner-Adept fires 2×.
const HANSHIN_3200 = {
  courseId: 10914,
  raceTrackId: 10009,
  distance: 3200,
  distanceType: 4,
  surface: 1,
  turn: 1,
  laneMax: 12500,
  corners: [
    { start: 370, length: 350 },
    { start: 720, length: 350 },
    { start: 1520, length: 190 },
    { start: 1710, length: 190 },
    { start: 2250, length: 300 },
    { start: 2550, length: 300 },
  ],
  straights: [
    { start: 0, end: 370, frontType: 2 },
    { start: 1070, end: 1520, frontType: 1 },
    { start: 1900, end: 2250, frontType: 2 },
    { start: 2850, end: 3200, frontType: 1 },
  ],
  slopes: [
    { start: 870, length: 400, slope: -10000 },
    { start: 1325, length: 120, slope: 20000 },
    { start: 2400, length: 595, slope: -10000 },
    { start: 3000, length: 125, slope: 20000 },
  ],
};

// Kyoto turf mile 1600m (course_data entry 10602) — corner fires exactly 1×.
const KYOTO_MILE = {
  courseId: 10602,
  raceTrackId: 10006,
  distance: 1600,
  distanceType: 2,
  surface: 1,
  turn: 2,
  laneMax: 15000,
  courseSetStatus: [2, 4],
  corners: [
    { start: 550, length: 275 },
    { start: 825, length: 275 },
  ],
  straights: [
    { start: 0, end: 550, frontType: 2 },
    { start: 1100, end: 1600, frontType: 1 },
  ],
  slopes: [
    { start: 325, length: 75, slope: 20000 },
    { start: 450, length: 250, slope: -15000 },
    { start: 1150, length: 150, slope: 15000 },
  ],
};

function toSimCourse(raw) {
  return { ...raw, ...simGeometry(raw) };
}

// Skill 200332 (Corner Adept ○): all_corner_random==1, short cooldown (300000).
const CORNER_ADEPT_200332 = {
  skillId: '200332',
  rarity: 1,
  alternatives: [
    {
      precondition: '',
      condition: 'all_corner_random==1',
      baseDuration: 24000,
      cooldownTime: 300000,
      effects: [{ type: 27, modifier: 1500, target: 1, valueUsage: 1, valueLevelUsage: 1 }],
    },
  ],
};

// Recursively key-sorted JSON so serde HashMap (skillActivations) iteration
// order can never make byte-identical data compare unequal across processes.
function stableStringify(value) {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.fromEntries(Object.keys(val).sort().map((k) => [k, val[k]]));
    }
    return val;
  });
}

const bytes = readFileSync(WASM_PATH);
const compiled = await WebAssembly.compile(bytes);
const glue = await import(GLUE_PATH);
await glue.default({ module_or_path: compiled });

const mode = process.env.SMOKE_MODE ?? 'default';
const parameters = { ground: 1, weather: 1, season: 3, timeOfDay: 2, grade: 100 };

if (mode === 'default') {
  const makeRunner = (name) => ({
    outfitId: '1001',
    name,
    mood: 0,
    strategy: 2,
    aptitudes: { distance: 1, strategy: 1, surface: 1 },
    stats: { speed: 1000, stamina: 1000, power: 1000, guts: 1000, wit: 1000 },
    skills: [],
  });
  const params = {
    course: toSimCourse(NAKAYAMA_1200),
    parameters,
    runners: [makeRunner('Runner A'), makeRunner('Runner B')],
    nsamples: 5,
    masterSeed: 12345,
  };
  const result = glue.runCompare(params);
  const rounds = result.rounds ?? [];
  const firstRunner = rounds[0]?.runners?.[0];
  const serialized = stableStringify(result);
  console.log(
    '[wasm-smoke] summary:',
    JSON.stringify(
      {
        mode,
        roundCount: rounds.length,
        firstRunnerFirstPosition: firstRunner?.position?.[0],
        firstRunnerLastPosition: firstRunner?.position?.at(-1),
        fullResultSha256: createHash('sha256').update(serialized).digest('hex'),
        fullResultChars: serialized.length,
      },
      null,
      2
    )
  );
} else if (mode === 'multifire') {
  const courseId = process.env.MF_COURSE ?? '10914';
  const raw = courseId === '10602' ? KYOTO_MILE : HANSHIN_3200;
  const cooldownReactivation = (process.env.MF_COOLDOWN ?? 'true') === 'true';
  const witChecks = (process.env.MF_WITCHECKS ?? 'true') === 'true';
  const seed = Number(process.env.MF_SEED ?? 12345);
  const nsamples = Number(process.env.MF_NSAMPLES ?? 50);

  const runnerWithSkill = (name) => ({
    outfitId: '1001',
    name,
    mood: 0,
    strategy: 2,
    aptitudes: { distance: 1, strategy: 1, surface: 1 },
    stats: { speed: 1200, stamina: 1200, power: 1000, guts: 1000, wit: 1000 },
    skills: [CORNER_ADEPT_200332],
  });
  const params = {
    course: toSimCourse(raw),
    parameters,
    settings: { cooldownReactivation, witChecks, skillSamples: 1 },
    runners: [runnerWithSkill('Runner A'), runnerWithSkill('Runner B')],
    nsamples,
    masterSeed: seed,
  };

  const result = glue.runCompare(params);
  const rounds = result.rounds ?? [];
  // Per round: number of distinct 200332 activations on the first runner.
  const fireCounts = rounds.map((r) => {
    const acts = r.runners?.[0]?.skillActivations?.['200332'] ?? [];
    const starts = new Set(acts.map((a) => Math.round(a.start)));
    return starts.size;
  });
  const withTwoPlus = fireCounts.filter((c) => c >= 2).length;
  const maxFires = fireCounts.reduce((m, c) => Math.max(m, c), 0);
  const serialized = stableStringify(result);
  const sha = createHash('sha256').update(serialized).digest('hex');

  if (process.env.MF_DUMP) {
    writeFileSync(process.env.MF_DUMP, serialized);
  }

  console.log(
    '[wasm-smoke] multifire:',
    JSON.stringify(
      {
        courseId,
        distance: raw.distance,
        cooldownReactivation,
        witChecks,
        seed,
        nsamples,
        fireCounts,
        roundsWithTwoPlusFires: withTwoPlus,
        doubleFireRate: Number((withTwoPlus / nsamples).toFixed(4)),
        maxFiresInAnyRound: maxFires,
        fullResultSha256: sha,
        fullResultChars: serialized.length,
      },
      null,
      2
    )
  );
} else {
  throw new Error(`unknown SMOKE_MODE: ${mode}`);
}
