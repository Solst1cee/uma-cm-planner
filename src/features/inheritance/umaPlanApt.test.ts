import { describe, expect, it } from 'vitest';
import type { CmPlan } from '@/core/types';
import { umaPlanAptChips } from './umaPlanApt';

const plan = (over: Partial<CmPlan> = {}): CmPlan =>
  ({
    id: 'p1', name: 'x', planNumber: 1,
    cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
    scenarioId: 4, umaId: '106801', uniqueSkillId: '', role: 'ace', strategy: 'late',
    statProfile: { stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 }, mood: 2 },
    sparkGoals: { pink: [], blue: {} }, wishlist: [], parents: {},
    patch: { version: 'x' }, server: 'global', dataVersion: 'x', ...over,
  }) as CmPlan;

describe('umaPlanAptChips', () => {
  it('shows all three active aptitudes in surface/distance/strategy order with default grades', () => {
    // turf · 2200m (→ medium) · late, no stored pink goals →
    // surface A, distance defaults S, strategy A.
    expect(umaPlanAptChips(plan())).toEqual([
      { label: 'Turf', grade: 'A' },
      { label: 'Medium', grade: 'S' },
      { label: 'Late', grade: 'A' },
    ]);
  });

  it('reflects stored pink-goal targets over the defaults', () => {
    const p = plan({
      sparkGoals: {
        pink: [
          { aptKey: { kind: 'distance', key: 'medium' }, target: 'A' },
          { aptKey: { kind: 'surface', key: 'turf' }, target: 'S' },
        ],
        blue: {},
      },
    });
    expect(umaPlanAptChips(p)).toEqual([
      { label: 'Turf', grade: 'S' },
      { label: 'Medium', grade: 'A' },
      { label: 'Late', grade: 'A' },
    ]);
  });

  it('follows the plan race + strategy (dirt · 1600 mile · front)', () => {
    const p = plan({
      cmRef: { kind: 'cm', cmId: 'CM16', cmNumber: 16, courseId: '10609', surface: 'dirt', distance: 1600 },
      strategy: 'front',
    });
    expect(umaPlanAptChips(p)).toEqual([
      { label: 'Dirt', grade: 'A' },
      { label: 'Mile', grade: 'S' },
      { label: 'Front', grade: 'A' },
    ]);
  });
});
