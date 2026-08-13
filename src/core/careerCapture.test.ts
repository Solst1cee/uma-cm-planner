import { describe, expect, it } from 'vitest';

import { parseCareerCapture } from '@/core/careerCapture';
import type { SkillRecord } from '@/core/types';

function skill(skillId: string, rarity: SkillRecord['rarity'], prereqSkillId?: string): SkillRecord {
  return {
    skillId, nameEn: skillId, nameJp: '', baseSpCost: 100, rarity, iconId: '1',
    conditions: '', server: 'global', dataVersion: 'fixture',
    ...(prereqSkillId ? { prereqSkillId } : {}),
  };
}

const skillById = new Map<string, SkillRecord>([
  ['200011', skill('200011', 'white')],
  ['200441', skill('200441', 'gold', '200442')],
  ['200442', skill('200442', 'white')],
  ['100591', skill('100591', 'unique')],
  ['900061', skill('900061', 'inherited_unique')],
]);

const raw = {
  capturedAt: '2026-07-10T12:00:00',
  spBudget: 2325,
  stats: { spd: 1034, sta: 420, pow: 654, gut: 354, wit: 1308 },
  aptitudes: {
    surface: { turf: 'A', dirt: 'G' },
    distance: { short: 'E', mile: 'S', middle: 'A', long: 'E' },
    style: { front: 'C', pace: 'A', late: 'A', end: 'G' },
  },
  strategy: 'late',
  skills: [
    { skillId: 100591, isAcquired: 1, needPoint: 0, hintLv: 0 },
    { skillId: 200011, isAcquired: 0, needPoint: 99, hintLv: 1 },
    { skillId: 200441, isAcquired: 0, needPoint: 144, hintLv: 1 },
    { skillId: 900061, isAcquired: 0, needPoint: 160, hintLv: 1 },
    { skillId: 210131, isAcquired: 0, needPoint: null, hintLv: 2 },
  ],
};

describe('parseCareerCapture', () => {
  it('imports raw context and maps only optimizer-compatible purchases', () => {
    const bundle = parseCareerCapture(raw, {
      skillById, courseId: '10906', umaId: '105901', dataVersion: 'global-test',
    });

    expect(bundle.source).toBe('memory');
    expect(bundle.dataVersion).toBe('global-test');
    expect(bundle.context).toMatchObject({
      umaId: '105901', courseId: '10906', spBudget: 2325, strategy: 'late',
      stats: raw.stats,
      aptitudes: { surface: 'A', distance: 'S', strategy: 'A' },
      ownedSkills: ['100591'],
    });
    expect(bundle.context.candidates).toEqual([
      { skillId: '200011', rarity: 'white', screenSpCost: 99, hintLevel: 1, matchTier: 'exact' },
      { skillId: '200441', rarity: 'gold', screenSpCost: 144, hintLevel: 1,
        matchTier: 'exact', prereqSkillId: '200442' },
    ]);
    expect(bundle.context.aptitudesAll).toEqual(raw.aptitudes);
  });

  it('dedupes a duplicated skill row first-wins (dup candidates break React keys downstream)', () => {
    const withDup = { ...raw, skills: [...raw.skills, { skillId: 200011, isAcquired: 0, needPoint: 50, hintLv: 0 }] };
    const bundle = parseCareerCapture(withDup, { skillById, courseId: '10906' });
    const ids = bundle.context.candidates.map((c) => c.skillId);
    expect(ids).toEqual([...new Set(ids)]);
    expect(bundle.context.candidates.find((c) => c.skillId === '200011')!.screenSpCost).toBe(99); // first wins
  });

  it('rejects malformed raw data', () => {
    expect(() => parseCareerCapture({ ...raw, stats: null }, { skillById, courseId: '10906' }))
      .toThrow(/stats must be an object/);
  });
});
