// Builds the v0.27.0 wrapper bundle: the wasm-pack pkg glue (bundled, not
// external) + the upstream TS adapters/reducers/data-services `src/sim` needs
// on top of it, into one self-contained ESM bundle.
//
// Source: spikes/repos/umalator-global @ v0.27.0 (484539f5c67e7aea8ef3715443d66602d871902d),
// GPL-3.0-only, branch `local-wasm-baseline` (carries our
// engine-patches/2026-07-10-multifire-rust.patch, applied as clone-local
// commits — see that patch file to re-apply on a fresh clone checkout).
//
// Run `node scripts/build-wasm.mjs` FIRST (produces src/sim/vendor/pkg/) —
// this script's entry statically imports that pkg's `uma_sim_wasm.js` glue via
// an esbuild alias (avoids embedding a Windows absolute path with backslashes
// in the generated import-specifier text). `pnpm sim:build` runs both in order.
//
// The data-service bootstrap (skillsService/coursesService) mirrors the
// clone's own `src/test-setup.ts`: synchronously feed the 8 baked-JSON raw
// datasets through `initDataFromRaw` so the live-binding service singletons
// are populated the moment this bundle is imported (no async fetch — the JSON
// is inlined at build time via esbuild's json loader). This is the same path
// the clone's own Node-environment vitest suite exercises, so it is proven to
// run headless (including the `i18n.use(initReactI18next).init(...)`
// side-effect `initDataFromRaw` triggers via `applySkillNameTranslations`).
import { build } from 'esbuild';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = path.join(ROOT, 'spikes/repos/umalator-global');
const ENTRY = path.join(ENGINE, '__sim_wasm_entry.ts'); // temp entry inside engine (for @/ + node_modules resolution)
const OUT = path.join(ROOT, 'src/sim/vendor/umalator-wasm.bundle.mjs');
const PKG_JS = path.join(ROOT, 'src/sim/vendor/pkg/uma_sim_wasm.js');

const entrySource = [
  // -- wasm-pack pkg glue (aliased below to the committed pkg build; bundled,
  // not external — its own `new URL('uma_sim_wasm_bg.wasm', import.meta.url)`
  // fallback fetch path is expected to stay unused, since src/sim/init.ts
  // always calls initWasm with an explicit precompiled module). --
  "export { default as initWasm, runCompare } from 'uma-sim-wasm-pkg';",
  '',
  '// -- data bootstrap (mirrors the clone\'s src/test-setup.ts, minus the DOM',
  '// storage polyfills that only matter for browser-only consumers) --',
  "import skillsJson from '@/modules/data/json/skills.json';",
  "import gametoraSkillsJson from '@/modules/data/json/gametora/skills.json';",
  "import masterSupportCardsJson from '@/modules/data/json/support-cards.json';",
  "import gametoraSupportCardsJson from '@/modules/data/json/gametora/support-cards.json';",
  "import masterUmasJson from '@/modules/data/json/umas.json';",
  "import characterCardsJson from '@/modules/data/json/gametora/character-cards.json';",
  "import eventSkillSourcesJson from '@/modules/data/json/gametora/event-skill-sources.json';",
  "import courseDataJson from '@/modules/data/json/course_data.json';",
  "import { initDataFromRaw } from '@/modules/data/bootstrap';",
  '',
  'initDataFromRaw({',
  '  skills: skillsJson,',
  '  gametoraSkills: gametoraSkillsJson,',
  '  masterSupportCards: masterSupportCardsJson,',
  '  gametoraSupportCards: gametoraSupportCardsJson,',
  '  masterUmas: masterUmasJson,',
  '  characterCards: characterCardsJson,',
  '  eventSkillSources: eventSkillSourcesJson,',
  '  courseData: courseDataJson,',
  '});',
  '',
  "import { skillsService } from '@/modules/data/services/SkillService';",
  "import { coursesService } from '@/modules/data/services/CourseService';",
  'export { skillsService, coursesService };',
  '',
  '// `SkillService.isSimulatable` is an arrow class field (already `this`-bound',
  "// to the live `skillsService` instance) — re-exported by name so run.ts's",
  '// simulatableBase guard keeps working unchanged.',
  'export function isSimulatable(skillId) {',
  '  return skillsService.isSimulatable(skillId);',
  '}',
  '',
  '// -- adapters (param-side; the only half that reads skill/course data) --',
  'export {',
  '  courseDataToWasm,',
  '  resolveSkillInput,',
  '  sundayRunnerToWasm,',
  '  raceParametersToWasm,',
  '  compareSettingsToWasm,',
  "} from '@/lib/uma-sim-wasm/adapter-params';",
  '',
  '// -- adapters (result-side; data-free) --',
  "export { wasmCompareRoundDataToCollected } from '@/lib/uma-sim-wasm/adapter-results';",
  '',
  '// -- reducer. NOTE: this pulls in the sibling `runComparisonRoundsFromPlan`',
  "// export (and its import of the upstream async `loader.ts`) from the same",
  '// module — esbuild tree-shakes it since nothing here calls it, but if a',
  '// future edit references it, drop this comment\'s assumption and split the',
  '// reducer out upstream instead. --',
  "export { reduceCompareRoundsPublic } from '@/modules/simulation/simulators/wasm-compare';",
  '',
  '// -- data-free pure helpers (worker-safe upstream, no @/modules/data imports) --',
  'export {',
  '  toCreateRunner,',
  '  toSundayRaceParameters,',
  '  createCompareSettings,',
  '  computePositionDiff,',
  '  isSameSkill,',
  "} from '@/modules/simulation/simulators/shared-pure';",
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
    absWorkingDir: ENGINE,                                  // resolve node_modules + alias against the engine
    alias: {
      '@': path.join(ENGINE, 'src'),                        // the engine's @/* -> its src
      'uma-sim-wasm-pkg': PKG_JS,                            // the committed wasm-pack pkg glue (built by build-wasm.mjs)
    },
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
