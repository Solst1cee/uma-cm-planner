// src/features/inheritance/planContextHeader.test.ts
import { describe, expect, it } from 'vitest';
import type { CmPlan } from '@/core/types';
import { planContextView } from './planContextHeader';

const basePlan = (over: Partial<CmPlan> = {}): CmPlan =>
  ({
    id: 'p1',
    name: 'Cancer Cup — Late ace',
    planNumber: 1,
    cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
    scenarioId: 4,
    umaId: '106801',
    uniqueSkillId: '',
    role: 'ace',
    strategy: 'late',
    statProfile: { stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 }, mood: 2 },
    sparkGoals: { pink: [], blue: {} },
    wishlist: [],
    parents: {},
    patch: { version: 'x' },
    server: 'global',
    dataVersion: 'x',
    ...over,
  }) as CmPlan;

describe('planContextView', () => {
  it('derives label, name, source, and chips from a plan + track name', () => {
    // 2200m → core distanceClass 'medium' (1801–2400). We follow OUR thresholds
    // (game-correct, P3) — NOT the handoff sample data's loose "Long · 2400m".
    const v = planContextView(basePlan(), 'Hanshin');
    expect(v.planLabel).toBe('PLAN #1');
    expect(v.name).toBe('Cancer Cup — Late ace');
    expect(v.source).toBe('From CM Planner · Hanshin Racecourse');
    expect(v.chips).toEqual({ surface: 'Turf', distance: 'Medium · 2200m', strategy: 'Late' });
  });

  it('drops the racetrack suffix when the track name is not yet resolved', () => {
    expect(planContextView(basePlan(), null).source).toBe('From CM Planner');
  });

  it('classifies distance via core thresholds (1600 → Mile, 2500 → Long)', () => {
    const mile = planContextView(
      basePlan({ cmRef: { kind: 'cm', cmId: 'CM16', cmNumber: 16, courseId: '10501', surface: 'dirt', distance: 1600 } }),
      'Nakayama',
    );
    expect(mile.chips).toEqual({ surface: 'Dirt', distance: 'Mile · 1600m', strategy: 'Late' });
    const long = planContextView(
      basePlan({ cmRef: { kind: 'cm', cmId: 'CM17', cmNumber: 17, courseId: '10913', surface: 'turf', distance: 2500 } }),
      'Kyoto',
    );
    expect(long.chips.distance).toBe('Long · 2500m');
  });

  it('falls back to "Untitled plan" when the name is blank', () => {
    expect(planContextView(basePlan({ name: '' }), 'Tokyo').name).toBe('Untitled plan');
  });
});
