import { describe, expect, it } from 'vitest';
import type { CmPlan, SkillRecord } from '@/core/types';
import {
  chartBaselineBuild,
  distanceClass,
  planToSimBuild,
  planToOverlayBuild,
  simAptitudes,
  setTargetAptitude,
  setTargetAptitudeByKey,
  setStrategyTargetAptitude,
  targetAptitude,
} from './simBuild';

function plan(over: Partial<CmPlan> = {}): CmPlan {
  return {
    id: 'p', name: 'p', planNumber: 1,
    cmRef: { kind: 'custom', courseId: '10906', surface: 'turf', distance: 2200, ground: 'good', weather: 'sunny', season: 'summer' },
    umaId: '100101', uniqueSkillId: '', role: 'ace', strategy: 'pace',
    statProfile: { stats: { spd: 1200, sta: 900, pow: 800, gut: 400, wit: 600 }, mood: 0 },
    sparkGoals: { pink: [], blue: {} }, wishlist: [], parents: {},
    patch: { version: 't' }, server: 'global', dataVersion: 't', ...over,
  } as CmPlan;
}

describe('distanceClass', () => {
  it('buckets by distance', () => {
    expect(distanceClass(1200)).toBe('short');
    expect(distanceClass(1600)).toBe('mile');
    expect(distanceClass(2200)).toBe('medium');
    expect(distanceClass(3000)).toBe('long');
  });
});

describe('simAptitudes', () => {
  it('prefills active distance as S and active surface/strategy as A when no spark goals are set', () => {
    expect(simAptitudes(plan())).toEqual({ distance: 'S', surface: 'A', strategy: 'A' });
  });
  it('reads target grades from sparkGoals.pink by the course/strategy keys', () => {
    const p = plan({ sparkGoals: { pink: [
      { aptKey: { kind: 'distance', key: 'medium' }, target: 'S' },
      { aptKey: { kind: 'surface', key: 'turf' }, target: 'B' },
      { aptKey: { kind: 'strategy', key: 'pace' }, target: 'C' },
    ], blue: {} } });
    expect(simAptitudes(p)).toEqual({ distance: 'S', surface: 'B', strategy: 'C' });
  });
});

describe('setTargetAptitude', () => {
  it('upserts the matching pink goal keyed by course/strategy', () => {
    const p = setTargetAptitude(plan(), 'distance', 'S');
    expect(p.sparkGoals.pink).toContainEqual({ aptKey: { kind: 'distance', key: 'medium' }, target: 'S' });
    const p2 = setTargetAptitude(p, 'distance', 'B'); // replace, not duplicate
    expect(p2.sparkGoals.pink.filter((g) => g.aptKey.kind === 'distance')).toHaveLength(1);
    expect(simAptitudes(p2).distance).toBe('B');
  });

  it('sets and clears an explicit non-current aptitude target by key', () => {
    const p = setTargetAptitudeByKey(plan(), { kind: 'surface', key: 'dirt' }, 'B');
    expect(targetAptitude(p, { kind: 'surface', key: 'dirt' })).toBe('B');
    expect(simAptitudes(p).surface).toBe('A');

    const cleared = setTargetAptitudeByKey(p, { kind: 'surface', key: 'dirt' }, '');
    expect(targetAptitude(cleared, { kind: 'surface', key: 'dirt' })).toBeUndefined();
  });

  it('keeps only the selected strategy aptitude target', () => {
    const p = plan({
      strategy: 'front',
      sparkGoals: {
        blue: {},
        pink: [
          { aptKey: { kind: 'strategy', key: 'front' }, target: 'S' },
          { aptKey: { kind: 'strategy', key: 'late' }, target: 'B' },
          { aptKey: { kind: 'surface', key: 'turf' }, target: 'A' },
        ],
      },
    });

    const next = setStrategyTargetAptitude(p, 'pace', 'A');

    expect(next.strategy).toBe('pace');
    expect(next.sparkGoals.pink).toContainEqual({ aptKey: { kind: 'strategy', key: 'pace' }, target: 'A' });
    expect(next.sparkGoals.pink).toContainEqual({ aptKey: { kind: 'surface', key: 'turf' }, target: 'A' });
    expect(next.sparkGoals.pink.filter((goal) => goal.aptKey.kind === 'strategy')).toHaveLength(1);
  });
});

function skill(over: Partial<SkillRecord> & { skillId: string }): SkillRecord {
  return {
    nameEn: 'S', rarity: 'white', baseSpCost: 100, server: 'global',
    dataVersion: 't', iconId: '0', ...over,
  } as SkillRecord;
}

describe('chartBaselineBuild', () => {
  const white = skill({ skillId: '200332', rarity: 'white' });
  const skillById = new Map<string, SkillRecord>([[white.skillId, white]]);

  it('matches planToSimBuild but injects targeted wishlist ids as skills', () => {
    const p = plan({ wishlist: [{ skillId: '200332', priority: 1, source: 'targeted' }] });
    const b = chartBaselineBuild(p, skillById);
    expect(b.skills).toEqual(['200332']);
    // everything else identical to the vacuum build
    const { skills: _s, ...rest } = b;
    const { skills: _v, ...vac } = planToSimBuild(p);
    expect(rest).toEqual(vac);
  });

  it('is vacuum-equivalent for an empty wishlist (no regression)', () => {
    expect(chartBaselineBuild(plan(), skillById).skills).toEqual([]);
  });

  it('de-duplicates repeated wishlist ids', () => {
    const p = plan({ wishlist: [
      { skillId: '200332', priority: 1, source: 'targeted' },
      { skillId: '200332', priority: 1, source: 'targeted' },
    ] });
    expect(chartBaselineBuild(p, skillById).skills).toEqual(['200332']);
  });

  it('falls back to the raw id for an unresolvable wishlist id (no undefined injected)', () => {
    // wishlistSkillId returns the raw id when skillById has no entry; the engine-side
    // simulatableBase filter is what drops it later. Guards against a future null return.
    const p = plan({ wishlist: [{ skillId: 'nope', priority: 1, source: 'targeted' }] });
    expect(chartBaselineBuild(p, skillById).skills).toEqual(['nope']);
  });
});

describe('planToSimBuild', () => {
  it('maps stats/strategy/mood/aptitudes and uses an empty skill base (chart vacuum)', () => {
    const b = planToSimBuild(plan());
    expect(b.stats).toEqual({ spd: 1200, sta: 900, pow: 800, gut: 400, wit: 600 });
    expect(b.strategy).toBe('pace');
    expect(b.mood).toBe(0);
    expect(b.aptitudes).toEqual({ distance: 'S', surface: 'A', strategy: 'A' });
    expect(b.skills).toEqual([]);
    expect(b.umaId).toBe('100101');
  });
});

describe('planToOverlayBuild', () => {
  it('includes the unique skill and every wishlist skill, deduped', () => {
    const p = plan({
      uniqueSkillId: 'U1',
      wishlist: [
        { skillId: 'S1', priority: 1, source: 'targeted' },
        { skillId: 'S2', priority: 3, source: 'targeted' },
        { skillId: 'U1', priority: 3, source: 'targeted' }, // dup of unique
      ],
    });
    const build = planToOverlayBuild(p);
    expect(build.skills).toEqual(['U1', 'S1', 'S2']);
    expect(build.stats).toEqual(p.statProfile.stats);
    expect(build.strategy).toBe(p.strategy);
  });

  it('drops empty ids and a missing unique', () => {
    const p = plan({
      uniqueSkillId: '',
      wishlist: [{ skillId: 'S1', priority: 1, source: 'targeted' }],
    });
    expect(planToOverlayBuild(p).skills).toEqual(['S1']);
  });
});
