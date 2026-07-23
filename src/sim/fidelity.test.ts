// @vitest-environment node
// Fidelity anchors for the v0.27.0 Rust/WASM engine (sim-wasm-replatform Task 6).
// Baseline provenance + the upstream parity spot-check record live in
// docs/mechanics-notes.md §"WASM re-platform parity (2026-07)".
//
// Scope note (Task-6 adjudicated): the engine's flag-OFF path is byte-identical
// to the pristine v0.27.0 pin for all outputs EXCEPT skills gated on the
// approximate conditions (`blocked_side`/`overtake` family), where the
// determinism sort fix picks a different — equally valid, expectation-equivalent —
// seeded realization (converging with n, within sampling noise). Every skill in
// this file (200332, all_corner_random) is NON-approximate, so these goldens are
// byte-identical to the pristine pin AND byte-stable across our own rebuilds.
import { describe, it, expect, beforeAll } from 'vitest';
import { evalSkillDelta, evalSkillDeltaWithSettings, skillImpact } from './run';
import { initEngineFromFs } from './init';
import type { SimBuild } from './types';

// Canonical skill-id names (shared with run.test.ts; kept here so the ids below
// read without a data lookup): 200332 = Corner Adept ○ (trigger all_corner_random),
// 200331 = Professor of Curvature (all_corner_random, short cooldown — multi-fire).
//
// Exact inputs from the old engine's scripts/adversarial-smoke.ts (kept identical
// across the re-platform so the anchors stay comparable release-over-release).
const smokeBuild: SimBuild = {
  umaId: '',
  stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
  strategy: 'pace',
  aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
  skills: [],
};

// Higher-stamina variant for the long-course multi-fire oracle (the smoke build's
// 800 stamina can run dry on 3200m, which would confound the fire-count read).
const stayerBuild: SimBuild = {
  ...smokeBuild,
  stats: { spd: 1150, sta: 1100, pow: 1000, gut: 600, wit: 900 },
};

// Warm-up: the FIRST runCompare on a fresh wasm instance can differ from later
// identical calls (one-time lazy-static warm-up inside the Rust engine, Task 0).
// One throwaway call right after init absorbs it, so every golden below is
// call-order-independent WITHIN this file; across files, each vitest test file
// gets its own module registry (and therefore its own wasm instance + its own
// warm-up), so suite-level test order cannot leak into these values either.
beforeAll(async () => {
  await initEngineFromFs();
  evalSkillDelta(smokeBuild, { courseId: '10101' }, '200332', 2, 1);
}, 30000);

// Test A goldens — flag-OFF (upstream-identical single-fire) anchors, threaded via
// the documented test-only `evalSkillDeltaWithSettings` seam.
// Recorded from wasm pkg (v0.37.0 + multifire patch, flag OFF) — re-record only deliberately, citing cause.
// Re-baselined 2026-07-23 at the v0.27.0 → v0.37.0 pin bump (was 0.3730486665111239):
// upstream pacing fixes (target-speed cap / force-in / solo-FR threshold), the
// 108-course geometry refresh, and skill value scaling all move sim numbers —
// deliberate P3 cutover, deltas recorded in docs/mechanics-notes.md §12.
const EXPECTED_MEAN = 0.25424664089619; // 200332 on 10101, 50 samples, seed 12345
// On 10101 the cooldown gate never re-opens (flag ON == OFF there), so the anchor
// above cannot detect a broken settings thread. This second golden pins a course
// where OFF genuinely differs from ON (10914), making the seam's flag-threading
// itself regression-tested.
// Recorded from wasm pkg (v0.37.0 + multifire patch, flag OFF) — re-record only
// deliberately, citing cause. Re-baselined 2026-07-23 (was 1.0918337778601457, see above).
const EXPECTED_MEAN_LONG_OFF = 0.3041163326954338; // 200332 on 10914, 50 samples, seed 12345

describe('wasm engine fidelity (v0.37.0 + multifire patch)', () => {
  it('Test A: flag-OFF anchor reproduces the recorded mean (200332 on 10101, seed 12345)', () => {
    const stats = evalSkillDeltaWithSettings(
      smokeBuild, { courseId: '10101' }, '200332', 50, 12345,
      { cooldownReactivation: false },
    );
    expect(stats.nsamples).toBe(50);
    expect(stats.activated).toBe(true);
    expect(stats.mean).toBe(EXPECTED_MEAN);
  });

  it('Test A2: flag-OFF anchor on a multi-fire-eligible course (pins the settings thread)', () => {
    const stats = evalSkillDeltaWithSettings(
      stayerBuild, { courseId: '10914' }, '200332', 50, 12345,
      { cooldownReactivation: false },
    );
    expect(stats.nsamples).toBe(50);
    expect(stats.mean).toBe(EXPECTED_MEAN_LONG_OFF);
    // and the flag genuinely changes this course's result when left ON (default):
    const onStats = evalSkillDelta(stayerBuild, { courseId: '10914' }, '200332', 50, 12345);
    expect(onStats.mean).not.toBe(stats.mean);
  });

  it('Test B: multi-fire oracle — doubles on Hanshin 3200 (10914), none on the mile (10602)', () => {
    // Flag ON (engine default). "Double" = a sample whose tracked-skill activation
    // log carries >= 2 DISTINCT fire starts (multiple effect-logs at one start are
    // one activation, so distinct-start counting is the honest fire count).
    const distinctStarts = (positions: number[]) =>
      new Set(positions.map((p) => Math.round(p))).size;

    const long = skillImpact(stayerBuild, { courseId: '10914' }, '200332', 200, 12345);
    expect(long.distance).toBe(3200);
    expect(long.samples.filter((s) => distinctStarts(s.positions) >= 2).length).toBeGreaterThanOrEqual(1);

    const mile = skillImpact(stayerBuild, { courseId: '10602' }, '200332', 200, 12345);
    expect(mile.distance).toBe(1600);
    expect(mile.samples.length).toBeGreaterThan(0); // fires (once) on the mile…
    expect(mile.samples.filter((s) => distinctStarts(s.positions) >= 2)).toHaveLength(0); // …but never twice
  });

  it('Test C: Corner Adept gives a non-negative mean on a cornered course (sanity)', () => {
    const stats = evalSkillDelta(smokeBuild, { courseId: '10101' }, '200332', 50, 12345);
    expect(stats.mean).toBeGreaterThanOrEqual(0);
  });
});
