// Builds the vendored umalator engine into one self-contained ESM bundle.
// Source: spikes/repos/umalator-global @ v0.14.2 (c1fa2107), GPL-3.0-only.
// The engine runs headless given the import.meta.env define (proven by its own
// adversarial-smoke). We re-export only the surface src/sim needs.
import { build } from 'esbuild';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = path.join(ROOT, 'spikes/repos/umalator-global');
const ENTRY = path.join(ENGINE, '__sim_entry.ts'); // temp entry inside engine (for @/ + node_modules resolution)
const OUT = path.join(ROOT, 'src/sim/vendor/umalator.bundle.mjs');

const entrySource = [
  "import '@/polyfills';",
  "export { runSkillComparison } from '@/modules/simulation/simulators/skill-compare';",
  "export { runComparison } from '@/modules/simulation/simulators/vacuum-compare';",
  "export { runPlannerComparison } from '@/modules/simulation/simulators/skill-planner-compare';",
  "export { coursesService } from '@/modules/data/services/CourseService';",
  "export { skillsService } from '@/modules/data/services/SkillService';",
].join('\n');

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(ENTRY, entrySource);
try {
  await build({
    entryPoints: [ENTRY],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    outfile: OUT,
    absWorkingDir: ENGINE,                       // resolve node_modules + alias against the engine
    alias: { '@': path.join(ENGINE, 'src') },    // the engine's @/* → its src
    define: { 'import.meta.env': '{"DEV":false}', 'import.meta.main': 'false' },
    mainFields: ['module', 'main'],
    loader: { '.json': 'json' },
    legalComments: 'none',
    logLevel: 'info',
  });
  console.log('[build-sim] wrote', path.relative(ROOT, OUT));
} finally {
  rmSync(ENTRY, { force: true });
}
