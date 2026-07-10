// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { toRunnerState, STRATEGY_LABEL } from './adapter';
import type { SimBuild } from './types';

const build: SimBuild = {
  umaId: '100201',
  stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
  strategy: 'pace',
  aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
  skills: ['200332'],
};

describe('toRunnerState', () => {
  it('maps our stat keys to engine fields (wit -> wisdom)', () => {
    const r = toRunnerState(build);
    expect(r.speed).toBe(1150);
    expect(r.stamina).toBe(800);
    expect(r.power).toBe(1000);
    expect(r.guts).toBe(500);
    expect(r.wisdom).toBe(850); // 'wit' maps to engine 'wisdom'
  });

  it('maps strategy label and passes aptitudes + skills through', () => {
    const r = toRunnerState(build);
    expect(r.strategy).toBe('Pace Chaser');
    expect(r.distanceAptitude).toBe('A');
    expect(r.skills).toEqual(['200332']);
    expect(r.outfitId).toBe('100201');
    expect(r.mood).toBe(2); // default Great
  });

  it('STRATEGY_LABEL covers all four of our strategies', () => {
    expect(STRATEGY_LABEL).toEqual({ front: 'Front Runner', pace: 'Pace Chaser', late: 'Late Surger', end: 'End Closer' });
  });
});

import { toRaceDef, resolveCourse, bashinStatsFrom } from './adapter';

describe('toRaceDef', () => {
  it('applies sensible defaults (firm/sunny/G1)', () => {
    const d = toRaceDef({ courseId: '10101' });
    expect(d).toEqual({ ground: 1, weather: 1, season: 3, time: 2, grade: 100 });
  });
  it('lets callers override conditions', () => {
    const d = toRaceDef({ courseId: '10101', ground: 2, grade: 999 });
    expect(d.ground).toBe(2);
    expect(d.grade).toBe(999);
  });
});

describe('resolveCourse', () => {
  it('looks up real engine course geometry by string courseId', () => {
    const c = resolveCourse('10101'); // Sapporo turf 1200m in the engine data
    expect(c.distance).toBe(1200);
    expect(c.surface).toBe(1); // turf
  });
  it('throws a clear error for an unknown course', () => {
    expect(() => resolveCourse('99999999')).toThrow(/course/i);
  });
});

describe('bashinStatsFrom', () => {
  it('projects the engine result onto our BashinStats; empty skillActivations -> activated false', () => {
    const stats = bashinStatsFrom({ results: [1, 2, 3], min: 1, max: 3, mean: 2, median: 2, skillActivations: {}, runData: null });
    expect(stats).toEqual({ mean: 2, median: 2, min: 1, max: 3, nsamples: 3, results: [1, 2, 3], activated: false });
  });
  it('sets activated when the engine recorded an activation for the tracked skill', () => {
    const stats = bashinStatsFrom({ results: [1], min: 1, max: 1, mean: 1, median: 1, skillActivations: { '200332': [{}] }, runData: null });
    expect(stats.activated).toBe(true);
  });
});

const buildWithLevels: SimBuild = {
  umaId: '106801',
  stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 },
  strategy: 'front',
  aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
  skills: ['100011'],
  skillLevels: { '100011': 6 },
};

describe('toRunnerState skillLevels', () => {
  it('maps skillLevels onto the runner state', () => {
    expect(toRunnerState(buildWithLevels).skillLevels).toEqual({ '100011': 6 });
  });
  it('omits skillLevels when not provided', () => {
    const { skillLevels, ...rest } = buildWithLevels;
    expect(toRunnerState(rest).skillLevels).toBeUndefined();
  });
});

// ===========================================================================
// NEW (v0.27.0 WASM) adapter — transform-level tests, ported from the deleted
// engine-patches/2026-06-29-skill-level-scaling.patch + 2026-07-03-skill-patches.patch
// (via src/sim/skillLevel.test.ts / skillPatches.test.ts, which exercised the same
// semantics at the run.ts/evalSkillDelta level against the old TS engine).
// ===========================================================================
import { applySkillLevel, applySkillPatch, toWasmRunner, toWasmRace } from './wasmAdapter';
import { resolveSkillInput } from '@/sim/vendor/umalator-wasm.bundle.mjs';
import type { WasmSkillInput } from '@/sim/vendor/umalator-wasm.bundle.mjs';
import type { SkillPatch } from '@/core/rebalance';

// Fixture with a known coef-table type (27, Lv6 -> 11300), a known coef-table type
// (1, Lv6 -> 10500), and an unknown type (coef falls back to 10000 = identity value).
const levelFixture: WasmSkillInput = {
  skillId: 'FIXTURE-LEVEL',
  rarity: 3,
  alternatives: [
    {
      baseDuration: 30000,
      cooldownTime: 5000000,
      condition: 'phase==1',
      precondition: '',
      effects: [
        { modifier: 3500, target: 1, type: 27 },
        { modifier: 2000, target: 2, type: 1 },
      ],
    },
    {
      baseDuration: 20000,
      cooldownTime: 5000000,
      condition: 'phase==2',
      effects: [{ modifier: 1000, target: 1, type: 999 }],
    },
  ],
};

describe('applySkillLevel', () => {
  it('Lv1 is the identity case (same object reference)', () => {
    expect(applySkillLevel(levelFixture, 1)).toBe(levelFixture);
  });

  it('scales every effect modifier by coef(type, level)/10000, rounded to an integer', () => {
    const r = applySkillLevel(levelFixture, 6);
    expect(r).not.toBe(levelFixture);
    // type 27 @ Lv6: coef 11300 -> 3500 * 11300 / 10000 = 3955
    expect(r.alternatives[0]!.effects[0]!.modifier).toBe(3955);
    // type 1 @ Lv6: coef 10500 -> 2000 * 10500 / 10000 = 2100
    expect(r.alternatives[0]!.effects[1]!.modifier).toBe(2100);
    // type 999 is not in the coef table -> falls back to 10000 (unchanged value)
    expect(r.alternatives[1]!.effects[0]!.modifier).toBe(1000);
  });

  it('does not scale baseDuration, cooldownTime, or condition', () => {
    const r = applySkillLevel(levelFixture, 6);
    expect(r.alternatives[0]!.baseDuration).toBe(30000);
    expect(r.alternatives[0]!.cooldownTime).toBe(5000000);
    expect(r.alternatives[0]!.condition).toBe('phase==1');
  });
});

const patchFixture: WasmSkillInput = {
  skillId: 'FIXTURE-PATCH',
  rarity: 1,
  alternatives: [
    {
      baseDuration: 30000,
      cooldownTime: 5000000,
      condition: 'distance_rate<=50',
      effects: [
        { modifier: 1000, target: 1, type: 1 },
        { modifier: 500, target: 2, type: 2 },
      ],
    },
    {
      baseDuration: 20000,
      cooldownTime: 300000,
      condition: 'phase==2',
      effects: [{ modifier: 800, target: 1, type: 3 }],
    },
  ],
};

describe('applySkillPatch', () => {
  it('absent patch returns the input UNCHANGED by reference (identity backstop)', () => {
    expect(applySkillPatch(patchFixture, undefined)).toBe(patchFixture);
  });

  it('an empty patch object also returns the input UNCHANGED by reference', () => {
    expect(applySkillPatch(patchFixture, {})).toBe(patchFixture);
  });

  it('modifier override (human units * 10000) replaces EVERY effect on EVERY alternative', () => {
    const r = applySkillPatch(patchFixture, { modifier: 0.7 });
    expect(r).not.toBe(patchFixture);
    for (const alt of r.alternatives) {
      for (const eff of alt.effects) expect(eff.modifier).toBe(7000);
    }
    // conditions/durations/cooldowns untouched by a modifier-only patch
    expect(r.alternatives[0]!.condition).toBe('distance_rate<=50');
    expect(r.alternatives[0]!.baseDuration).toBe(30000);
    expect(r.alternatives[1]!.cooldownTime).toBe(300000);
  });

  it('duration override (seconds * 10000) replaces baseDuration on every alternative', () => {
    const r = applySkillPatch(patchFixture, { duration: 10 });
    for (const alt of r.alternatives) expect(alt.baseDuration).toBe(100000);
  });

  it('cooldown override (seconds * 10000) replaces cooldownTime on every alternative', () => {
    // Worked example from the reference test (skillPatches.test.ts): cooldown 499 -> 4,990,000.
    const r = applySkillPatch(patchFixture, { cooldown: 499 });
    for (const alt of r.alternatives) expect(alt.cooldownTime).toBe(4990000);
  });

  it('conditions override: "@"-split, non-empty parts replace pairwise by alternative index', () => {
    const r1 = applySkillPatch(patchFixture, { conditions: 'distance_rate>=101@' });
    expect(r1.alternatives[0]!.condition).toBe('distance_rate>=101');
    expect(r1.alternatives[1]!.condition).toBe('phase==2'); // empty part -> unchanged

    const r2 = applySkillPatch(patchFixture, { conditions: '@phase==3' });
    expect(r2.alternatives[0]!.condition).toBe('distance_rate<=50'); // empty part -> unchanged
    expect(r2.alternatives[1]!.condition).toBe('phase==3');
  });
});

describe('toWasmRunner', () => {
  const wasmBuild: SimBuild = {
    umaId: '100201',
    stats: { spd: 1150, sta: 800, pow: 1000, gut: 500, wit: 850 },
    strategy: 'pace',
    aptitudes: { distance: 'A', surface: 'A', strategy: 'A' },
    skills: ['200332'],
  };

  it('maps stat keys / strategy / aptitude / mood onto the wasm runner', () => {
    const r = toWasmRunner(wasmBuild, 'uma1');
    expect(r.stats).toEqual({ speed: 1150, stamina: 800, power: 1000, guts: 500, wit: 850 });
    expect(r.strategy).toBe(2); // 'pace' -> 'Pace Chaser' -> numeric 2
    expect(r.aptitudes).toEqual({ distance: 1, surface: 1, strategy: 1 }); // 'A' -> 1
    expect(r.mood).toBe(2); // default Great
    expect(r.outfitId).toBe('100201');
    expect(r.name).toBe('uma1');
  });

  it('resolves owned skills into WasmSkillInput entries', () => {
    const r = toWasmRunner(wasmBuild, 'uma1');
    expect(r.skills?.map((s) => s.skillId)).toEqual(['200332']);
  });

  it('drops unresolvable skill ids silently (no throw)', () => {
    const r = toWasmRunner({ ...wasmBuild, skills: ['200332', 'no-such-skill'] }, 'uma1');
    expect(r.skills?.map((s) => s.skillId)).toEqual(['200332']);
  });

  it('applies skillLevels only to the matching id', () => {
    const raw200332 = resolveSkillInput('200332');
    const raw100011 = resolveSkillInput('100011');
    expect(raw200332).not.toBeNull();
    expect(raw100011).not.toBeNull();
    const r = toWasmRunner(
      { ...wasmBuild, skills: ['200332', '100011'], skillLevels: { '200332': 6 } },
      'uma1',
    );
    expect(r.skills?.find((s) => s.skillId === '200332')).toEqual(applySkillLevel(raw200332!, 6));
    expect(r.skills?.find((s) => s.skillId === '100011')).toEqual(raw100011);
  });

  it('applies skillPatches only to the matching id', () => {
    const patch: SkillPatch = { modifier: 0.7 };
    const raw200332 = resolveSkillInput('200332');
    const raw100011 = resolveSkillInput('100011');
    expect(raw200332).not.toBeNull();
    expect(raw100011).not.toBeNull();
    const r = toWasmRunner(
      { ...wasmBuild, skills: ['200332', '100011'], skillPatches: { '100011': patch } },
      'uma1',
    );
    expect(r.skills?.find((s) => s.skillId === '200332')).toEqual(raw200332);
    expect(r.skills?.find((s) => s.skillId === '100011')).toEqual(applySkillPatch(raw100011!, patch));
  });

  it('threads extras.injectedDebuffs through toCreateRunner', () => {
    const r = toWasmRunner(wasmBuild, 'uma1', { injectedDebuffs: [{ skillId: '200332', position: 500 }] });
    expect(r.injectedDebuffs).toHaveLength(1);
    expect(r.injectedDebuffs?.[0]?.position).toBe(500);
    expect(r.injectedDebuffs?.[0]?.skill.skillId).toBe('200332');
  });
});

describe('toWasmRace', () => {
  it('resolves real course geometry + default race parameters', () => {
    const { course, parameters } = toWasmRace({ courseId: '10101' }); // Sapporo turf 1200m
    expect(course.distance).toBe(1200);
    expect(course.surface).toBe(1); // turf
    expect(parameters).toEqual({ ground: 1, weather: 1, season: 3, timeOfDay: 2, grade: 100 });
  });

  it('lets callers override conditions', () => {
    const { parameters } = toWasmRace({ courseId: '10101', ground: 2, grade: 999 });
    expect(parameters.ground).toBe(2);
    expect(parameters.grade).toBe(999);
  });

  it('throws a clear error for an unknown course', () => {
    expect(() => toWasmRace({ courseId: '99999999' })).toThrow(/course/i);
  });
});
