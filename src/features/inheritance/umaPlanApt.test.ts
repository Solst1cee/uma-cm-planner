import { describe, expect, it } from 'vitest';
import type { CmPlan } from '@/core/types';
import { umaPlanAptChips } from './umaPlanApt';

const plan = (over: Partial<CmPlan> = {}): CmPlan =>
  ({
    id: 'p1', name: 'x', planNumber: 1,
    cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
    scenarioId: 4, umaId: '106801', uniqueSkillId: '', role: 'ace', strategy: 'late',
    statProfile: { stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 }, mood: 2 },
    sparkGoals: { pink: [], blue: {} }, wishlist: [], lockedDeckSlots: [], parents: {},
    patch: { version: 'x' }, server: 'global', dataVersion: 'x', ...over,
  }) as CmPlan;

describe('umaPlanAptChips', () => {
  it('maps the plan pink spark goals to aptitude + target-grade chips', () => {
    const p = plan({
      sparkGoals: {
        pink: [
          { aptKey: { kind: 'surface', key: 'turf' }, target: 'A' },
          { aptKey: { kind: 'distance', key: 'long' }, target: 'S' },
          { aptKey: { kind: 'strategy', key: 'late' }, target: 'A' },
        ],
        blue: {},
      },
    });
    expect(umaPlanAptChips(p)).toEqual([
      { label: 'Turf', grade: 'A' },
      { label: 'Long', grade: 'S' },
      { label: 'Late', grade: 'A' },
    ]);
  });

  it('follows the selected plan (different goals → different chips)', () => {
    const p = plan({
      sparkGoals: {
        pink: [{ aptKey: { kind: 'distance', key: 'mile' }, target: 'B' }],
        blue: {},
      },
    });
    expect(umaPlanAptChips(p)).toEqual([{ label: 'Mile', grade: 'B' }]);
  });

  it('returns [] when the plan has no pink goals', () => {
    expect(umaPlanAptChips(plan())).toEqual([]);
  });
});
