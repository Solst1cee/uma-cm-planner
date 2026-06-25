import { describe, expect, it } from 'vitest';
import type { CmPlan, UmaRecord } from '@/core/types';
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

const uma: UmaRecord = {
  umaId: '106801', charaId: '1068', nameEn: 'Mejiro McQueen', epithet: 'Patrician Maiden',
  baseAptitudes: {
    surface: { turf: 'A', dirt: 'G' },
    distance: { short: 'C', mile: 'B', medium: 'A', long: 'A' },
    strategy: { front: 'C', pace: 'B', late: 'A', end: 'B' },
  },
  server: 'global', dataVersion: 'x',
};

describe('umaPlanAptChips', () => {
  it('grades the plan-relevant surface/distance/strategy keys from the uma aptitudes', () => {
    // turf · 2200m (→ medium) · late
    expect(umaPlanAptChips(plan(), uma)).toEqual([
      { label: 'Turf', grade: 'A' },
      { label: 'Medium', grade: 'A' },
      { label: 'Late', grade: 'A' },
    ]);
  });

  it('reflects a different race + strategy (dirt · 1600 mile · front)', () => {
    const p = plan({
      cmRef: { kind: 'cm', cmId: 'CM16', cmNumber: 16, courseId: '10609', surface: 'dirt', distance: 1600 },
      strategy: 'front',
    });
    expect(umaPlanAptChips(p, uma)).toEqual([
      { label: 'Dirt', grade: 'G' },
      { label: 'Mile', grade: 'B' },
      { label: 'Front', grade: 'C' },
    ]);
  });

  it('returns [] when the uma is null or lacks base aptitudes', () => {
    expect(umaPlanAptChips(plan(), null)).toEqual([]);
    expect(umaPlanAptChips(plan(), { ...uma, baseAptitudes: undefined })).toEqual([]);
  });
});
