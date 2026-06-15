import { describe, expect, it } from 'vitest';
import type { CmPlan } from '@/core/types';
import { distanceClass, planToSimBuild, simAptitudes, setTargetAptitude } from './simBuild';

function plan(over: Partial<CmPlan> = {}): CmPlan {
  return {
    id: 'p', name: 'p', planNumber: 1, cmRef: { cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
    umaId: '100101', uniqueSkillId: '', role: 'ace', strategy: 'pace',
    statProfile: { stats: { spd: 1200, sta: 900, pow: 800, gut: 400, wit: 600 }, mood: 0 },
    sparkGoals: { pink: [], blue: {} }, wishlist: [], lockedDeckSlots: [], parents: {},
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
  it('defaults every aptitude to A when no spark goals set', () => {
    expect(simAptitudes(plan())).toEqual({ distance: 'A', surface: 'A', strategy: 'A' });
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
});

describe('planToSimBuild', () => {
  it('maps stats/strategy/mood/aptitudes and uses an empty skill base (chart vacuum)', () => {
    const b = planToSimBuild(plan());
    expect(b.stats).toEqual({ spd: 1200, sta: 900, pow: 800, gut: 400, wit: 600 });
    expect(b.strategy).toBe('pace');
    expect(b.mood).toBe(0);
    expect(b.aptitudes).toEqual({ distance: 'A', surface: 'A', strategy: 'A' });
    expect(b.skills).toEqual([]);
    expect(b.umaId).toBe('100101');
  });
});
