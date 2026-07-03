import { describe, expect, it } from 'vitest';
import type { CmPlan, SkillRecord } from '@/core/types';
import { buildTargetSpark } from './targetSpark';

const plan = (over: Partial<CmPlan> = {}): CmPlan =>
  ({
    id: 'p1', name: 'x', planNumber: 1,
    cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
    scenarioId: 4, umaId: '106801', uniqueSkillId: '', role: 'ace', strategy: 'late',
    statProfile: { stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 }, mood: 2 },
    sparkGoals: { pink: [], blue: {} }, wishlist: [], parents: {},
    patch: { version: 'x' }, server: 'global', dataVersion: 'x', ...over,
  }) as CmPlan;

// Minimal skill-map helper — only the field the builder reads (nameEn).
function skillMap(entries: Array<[string, string]>): Map<string, SkillRecord> {
  const m = new Map<string, SkillRecord>();
  for (const [id, nameEn] of entries) m.set(id, { nameEn } as SkillRecord);
  return m;
}

const withBlue = plan({ sparkGoals: { pink: [], blue: { pow: 3, sta: 6 } } });

describe('buildTargetSpark', () => {
  it('passes blue goals through from blueSparkRows (verbatim, canonical order)', () => {
    const out = buildTargetSpark(withBlue, null, skillMap([]), undefined);
    expect(out.blue).toEqual([
      { stat: 'sta', label: 'Stamina', stars: 6 },
      { stat: 'pow', label: 'Power', stars: 3 },
    ]);
  });

  it('coverage is "pending" when uncoveredSkillIds is undefined', () => {
    const out = buildTargetSpark(plan(), null, skillMap([]), undefined);
    expect(out.coverage).toBe('pending');
    expect(out.white).toEqual([]);
  });

  it('coverage is "covered" when uncoveredSkillIds is empty', () => {
    const out = buildTargetSpark(plan(), null, skillMap([]), []);
    expect(out.coverage).toBe('covered');
    expect(out.white).toEqual([]);
  });

  it('coverage is "gaps" with resolved white rows; unknown ids are skipped', () => {
    const out = buildTargetSpark(plan(), null, skillMap([['s1', 'Slick Surge']]), ['s1', 'unknown-id']);
    expect(out.coverage).toBe('gaps');
    expect(out.white).toEqual([{ id: 's1', name: 'Slick Surge' }]);
  });

  it('pink is empty when no uma resolves', () => {
    const out = buildTargetSpark(plan(), null, skillMap([]), undefined);
    expect(out.pink).toEqual([]);
  });
});
