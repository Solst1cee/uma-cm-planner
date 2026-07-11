// ===========================================================================
// NEW (v0.27.0 Rust/WASM) engine-facing exports.
// `SimBuild` -> `WasmCreateRunner`/`WasmCourseData`/`WasmRaceParameters`, plus the
// app-side skillLevel/skillPatch transforms applied on the resolved `WasmSkillInput`s
// (the old TS engine applied these internally via a vendored patch — see
// src/sim/skillLevelCoef.ts's header note for why that moved app-side).
//
// Deliberately kept OUT of `src/sim/adapter.ts` (the sim-wasm-replatform Task 3 brief's
// literal file list names `adapter.ts` for this) — `adapter.ts` is imported by
// `src/sim/courseData.ts`/`courseCatalog.ts`, which are meant to be lazily imported by
// UI code specifically so a course-geometry lookup doesn't drag in a multi-MB engine
// bundle (CLAUDE.md: "keep the engine lazy... UI chunks must not grow"). The new WASM
// wrapper bundle (`umalator-wasm.bundle.mjs`) has module-eval side effects (it bootstraps
// skillsService/coursesService from baked JSON — see Task 2's report), so Rollup can't
// tree-shake an unused import of it away; putting both old- and new-engine-facing code in
// one file measurably regressed the `adapter` chunk from ~1 kB to ~3.9 MB (verified via a
// real `pnpm build` A/B) because `courseData.ts`'s lazy chunk would then transitively pull
// in the entire new engine bundle just to resolve a course id. Splitting the new
// wasm-facing code into this sibling file keeps `adapter.ts`'s chunk exactly as small as
// before; this file only becomes reachable (and therefore only appears as its own chunk)
// once something imports it — Task 4's `run.ts` rewrite is expected to be that importer,
// inside the already-lazy worker bundle.
// ===========================================================================
import {
  coursesService as wasmCoursesService,
  toCreateRunner,
  sundayRunnerToWasm,
  courseDataToWasm,
  toSundayRaceParameters,
  raceParametersToWasm,
} from '@/sim/vendor/umalator-wasm.bundle.mjs';
import type {
  IRunnerState as WasmIRunnerState,
  WasmCreateRunner,
  WasmSkillInput,
  WasmCourseData,
  WasmRaceParameters,
  CourseData as WasmCourseGeometry,
} from '@/sim/vendor/umalator-wasm.bundle.mjs';
import type { SkillPatch } from '@/core/rebalance';
import type { SimBuild, SimRaceParams } from './types';
import { STRATEGY_LABEL, toRaceDef } from './adapter';
import { coef } from './skillLevelCoef';

/** Map OUR build to the WASM bundle's IRunnerState. Strategy is emitted as a
 *  'Pace Chaser'-style label (via STRATEGY_LABEL) and aptitudes as letter grades,
 *  because upstream's `toCreateRunner` still consumes those forms directly; our
 *  'wit' maps to the engine's 'wisdom'. */
function toWasmRunnerState(build: SimBuild): WasmIRunnerState {
  return {
    outfitId: build.umaId,
    speed: build.stats.spd,
    stamina: build.stats.sta,
    power: build.stats.pow,
    guts: build.stats.gut,
    wisdom: build.stats.wit, // our 'wit' -> engine 'wisdom'
    strategy: STRATEGY_LABEL[build.strategy],
    distanceAptitude: build.aptitudes.distance,
    surfaceAptitude: build.aptitudes.surface,
    strategyAptitude: build.aptitudes.strategy,
    mood: build.mood ?? 2,
    skills: [...build.skills],
  };
}

/** Scale a resolved skill's effect modifiers for unique-skill level L (1-6). The base
 *  `modifier` in a `WasmSkillInput` is the Lv1 value (raw x10000 units); level<=1 or
 *  undefined is the identity case and returns `input` UNCHANGED by reference (Lv1 baseline,
 *  same as `SkillPatch`'s identity backstop below). `baseDuration` is NOT scaled by level.
 *  Reference: engine-patches/2026-06-29-skill-level-scaling.patch (`buildSkillEffects`). */
export function applySkillLevel(input: WasmSkillInput, level: number): WasmSkillInput {
  if (level === undefined || level <= 1) return input;
  return {
    ...input,
    alternatives: input.alternatives.map((alt) => ({
      ...alt,
      effects: alt.effects.map((effect) => ({
        ...effect,
        modifier: Math.round((effect.modifier * coef(effect.type, level)) / 10000),
      })),
    })),
  };
}

/** Apply a rebalance-version parameter override to a resolved skill (availability #4b).
 *  Reference: engine-patches/2026-07-03-skill-patches.patch (`buildSkillData`/`buildSkillEffects`).
 *  - `conditions`: '@'-split; parts pair with alternatives in ORIGINAL-non-empty-condition
 *    order — the reference's `condIdx` only advances past alternatives whose original
 *    condition is non-empty (`if (condition === '') continue`), so an empty-condition
 *    alternative consumes no part. A non-empty part replaces; an empty/missing part leaves
 *    that alternative's condition unchanged.
 *  - `modifier`: human units * 10000, replaces EVERY effect's modifier on EVERY alternative
 *    (curators leave this unset for multi-effect skills).
 *  - `duration`: seconds * 10000 -> `baseDuration`, on every alternative.
 *  - `cooldown`: seconds * 10000 -> `cooldownTime`, on every alternative (same "human seconds,
 *    scaled by the engine's raw x10000 convention" treatment as duration — verified against
 *    the reference patch's `patch.cooldown * 10000` and the worked example in
 *    skillPatches.test.ts, "cooldown: 499 -> 4,990,000"; CLAUDE.md's 4b summary "cooldown
 *    ×10000" is the same operation, not a claim that the field is pre-multiplied).
 *  Absent/empty patch (no field set) -> returns `input` UNCHANGED by reference (identity
 *  backstop: a plan with no pins/no live rebalance must run byte-identical to unpatched). */
export function applySkillPatch(input: WasmSkillInput, patch: SkillPatch | undefined): WasmSkillInput {
  if (
    !patch ||
    (patch.conditions === undefined &&
      patch.modifier === undefined &&
      patch.duration === undefined &&
      patch.cooldown === undefined)
  ) {
    return input;
  }
  const conditionParts = patch.conditions !== undefined ? patch.conditions.split('@') : undefined;
  // Old-engine condIdx semantics: the parts index advances only over alternatives whose
  // ORIGINAL condition is non-empty (empty-condition alternatives are skipped in the
  // reference's trigger loop and never consume a part).
  let condIdx = -1;
  return {
    ...input,
    alternatives: input.alternatives.map((alt) => {
      let conditionOverride: string | undefined;
      if (conditionParts !== undefined && alt.condition !== '') {
        condIdx += 1;
        conditionOverride = conditionParts[condIdx];
      }
      return {
        ...alt,
        condition: conditionOverride ? conditionOverride : alt.condition,
        baseDuration: patch.duration !== undefined ? patch.duration * 10000 : alt.baseDuration,
        cooldownTime: patch.cooldown !== undefined ? patch.cooldown * 10000 : alt.cooldownTime,
        effects: alt.effects.map((effect) => ({
          ...effect,
          modifier: patch.modifier !== undefined ? patch.modifier * 10000 : effect.modifier,
        })),
      };
    }),
  };
}

/** Resolve our string courseId to the WASM bundle's course geometry. Throws if unknown —
 *  same contract as `courseData.ts`'s `resolveCourse` (both now hit the same v0.27.0
 *  `coursesService`). Kept as a small local helper so the worker path doesn't import the
 *  main-thread `courseData` module. */
function resolveWasmCourse(courseId: string): WasmCourseGeometry {
  const numeric = Number(courseId);
  const course = wasmCoursesService.getSimCourse(numeric);
  if (!course || typeof course.distance !== 'number') {
    throw new Error(`Unknown course: ${courseId}`);
  }
  return course;
}

/** `SimBuild` -> the WASM bundle's runner param, with skill resolution + our app-side
 *  skillLevel/skillPatch transforms applied. `extras.injectedDebuffs` threads straight into
 *  `toCreateRunner` (upstream resolves the debuff's skill id the same way as the main
 *  skills list, inside `sundayRunnerToWasm`). Unresolvable skill ids (e.g. an
 *  inherited-unique/JP-only/imported id the v0.27.0 data doesn't carry) are silently
 *  dropped by `sundayRunnerToWasm` itself (it calls `resolveSkillInput` per id and filters
 *  nulls) — no extra filtering needed here. */
export function toWasmRunner(
  build: SimBuild,
  name: string,
  extras?: { injectedDebuffs?: Array<{ skillId: string; position: number }> },
): WasmCreateRunner {
  const runnerState = toWasmRunnerState(build);
  const createRunner = toCreateRunner(runnerState, [...build.skills], undefined, extras?.injectedDebuffs);
  const wasmRunner = sundayRunnerToWasm(createRunner, name);
  const skills = (wasmRunner.skills ?? []).map((skill) => {
    let resolved = skill;
    // Order is load-bearing: PATCH first, then LEVEL. The reference engine patch composes
    // them in buildSkillEffects — the patch modifier replaces the base value and the level
    // coef ALWAYS scales on top (`modifier = (baseModifier * coef) / 10000`). Applying the
    // level first and the patch second would let patch.modifier overwrite (discard) the
    // level scaling, which is a behavior change vs the old engine.
    const patch = build.skillPatches?.[resolved.skillId];
    if (patch !== undefined) resolved = applySkillPatch(resolved, patch);
    const level = build.skillLevels?.[resolved.skillId];
    if (level !== undefined) resolved = applySkillLevel(resolved, level);
    return resolved;
  });
  return { ...wasmRunner, skills };
}

/** `SimRaceParams` -> the WASM bundle's course + race-parameters params. */
export function toWasmRace(race: SimRaceParams): { course: WasmCourseData; parameters: WasmRaceParameters } {
  const course = resolveWasmCourse(race.courseId);
  return {
    course: courseDataToWasm(course),
    parameters: raceParametersToWasm(toSundayRaceParameters(toRaceDef(race))),
  };
}
