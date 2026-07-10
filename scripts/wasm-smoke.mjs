// TEMPORARY spike script — deleted in Task 9 once the real TS adapter/loader
// lands. Proves Node can init the wasm-pack `--target web` bundle from raw
// filesystem bytes and run a seeded `runCompare` deterministically, before
// any app-side plumbing is built (Task 0 fail-fast gate).
//
// One process = one fresh WASM instantiation = one runCompare call, matching
// how the brief's Step 5 procedure is structured (read -> compile -> init ->
// run -> log). Determinism is verified by invoking this script TWICE as
// separate `node` processes and diffing their printed summaries — NOT by
// calling runCompare twice on one long-lived instance within a single
// process. (A same-instance repeat call was spiked separately and found to
// differ on the very first post-init call vs. all subsequent calls on that
// same instance, which stabilize to a fixed point among themselves — almost
// certainly a one-time lazy-static warm-up in the engine, e.g. the skill
// condition-catalog registry it a lane/position-keep decision also touches.
// That's a real quirk worth flagging for whoever builds the persistent
// worker loader in a later task, but it is NOT the "read bytes, init, run,
// get a reproducible result" contract this smoke test is here to prove —
// that contract holds cleanly across independent fresh instantiations.)
//
// Course fields hand-copied from spikes/repos/umalator-global's course_data
// entry `10101` (Nakayama, turf, 1200m) plus the fixed per-course geometry
// constants CourseService.getSimCourse derives (courseWidth=11.25 etc.) —
// see src/modules/data/services/CourseService.ts in the clone.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WASM_PATH = path.join(ROOT, 'src/sim/vendor/pkg/uma_sim_wasm_bg.wasm');
const GLUE_PATH = pathToFileURL(path.join(ROOT, 'src/sim/vendor/pkg/uma_sim_wasm.js')).href;

const course = {
  courseId: 10101,
  raceTrackId: 10001,
  distance: 1200,
  distanceType: 1, // short
  surface: 1, // turf
  turn: 1, // clockwise
  courseSetStatus: [],
  corners: [
    { start: 400, length: 275 },
    { start: 675, length: 275 },
  ],
  straights: [
    { start: 0, end: 400, frontType: 2 },
    { start: 950, end: 1200, frontType: 1 },
  ],
  slopes: [],
  laneMax: 13500,
  courseWidth: 11.25,
  horseLane: 11.25 / 18.0,
  laneChangeAcceleration: 0.02 * 1.5,
  laneChangeAccelerationPerFrame: (0.02 * 1.5) / 15.0,
  maxLaneDistance: (11.25 * 13500) / 10000.0,
  moveLanePoint: 400, // corners[0].start
};

const parameters = { ground: 1, weather: 1, season: 3, timeOfDay: 2, grade: 100 };

function makeRunner(name) {
  return {
    outfitId: '1001',
    name,
    mood: 0,
    strategy: 2, // pace chaser
    aptitudes: { distance: 1, strategy: 1, surface: 1 }, // A/A/A
    stats: { speed: 1000, stamina: 1000, power: 1000, guts: 1000, wit: 1000 },
    skills: [],
  };
}

const params = {
  course,
  parameters,
  runners: [makeRunner('Runner A'), makeRunner('Runner B')],
  nsamples: 5,
  masterSeed: 12345,
};

const bytes = readFileSync(WASM_PATH);
const compiled = await WebAssembly.compile(bytes);
const glue = await import(GLUE_PATH);
await glue.default({ module_or_path: compiled });

const result = glue.runCompare(params);
const rounds = result.rounds ?? [];
const firstRunner = rounds[0]?.runners?.[0];

const serialized = JSON.stringify(result);
const summary = {
  roundCount: rounds.length,
  firstRunnerFirstPosition: firstRunner?.position?.[0],
  firstRunnerLastPosition: firstRunner?.position?.at(-1),
  fullResultSha256: createHash('sha256').update(serialized).digest('hex'),
  fullResultChars: serialized.length,
};

console.log('[wasm-smoke] summary:', JSON.stringify(summary, null, 2));
