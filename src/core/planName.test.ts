import { describe, expect, it } from 'vitest';
import type { CmPlan } from '@/core/types';
import { generatePlanName, uniquePlanName } from '@/core/planName';

function namedPlan(id: string, name: string): CmPlan {
  return {
    id,
    name,
    planNumber: 1,
    cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15 },
    scenarioId: 4,
    umaId: '100101',
    uniqueSkillId: '',
    role: 'ace',
    strategy: 'front',
    statProfile: { stats: { spd: 1200, sta: 650, pow: 900, gut: 400, wit: 600 }, mood: 2 },
    sparkGoals: { pink: [], blue: {} },
    wishlist: [],
    lockedDeckSlots: [],
    parents: {},
    patch: { version: 'test' },
    server: 'global',
    dataVersion: 'test',
  };
}

describe('uniquePlanName', () => {
  it('generates names without exposing the internal plan number', () => {
    expect(generatePlanName(namedPlan('p1', ''), 'Kitasan Black')).toBe(
      'CM15 / Kitasan Black / Ace / Front',
    );
  });

  it('uses the next suffix from the custom name root', () => {
    const plans = [
      namedPlan('p1', 'ABC'),
      namedPlan('p2', 'ABC (1)'),
    ];

    expect(uniquePlanName('ABC (1)', plans)).toBe('ABC (2)');
  });

  it('does not nest a suffix on a custom Plan-style name', () => {
    const plans = [
      namedPlan('p1', 'Plan 1'),
      namedPlan('p2', 'Plan 1 (1)'),
    ];

    expect(uniquePlanName('Plan 1 (1)', plans)).toBe('Plan 1 (2)');
  });

  it('fills the first missing suffix for an auto-generated name', () => {
    const baseName = 'CM15 / Kitasan Black / Ace / Front';
    const plans = [
      namedPlan('p1', baseName),
      namedPlan('p2', `${baseName} (1)`),
      namedPlan('p4', `${baseName} (3)`),
    ];

    expect(uniquePlanName(`${baseName} (1)`, plans)).toBe(`${baseName} (2)`);
  });

  it('preserves an unchanged suffixed name when saving over its own plan', () => {
    const plans = [
      namedPlan('active', 'ABC (1)'),
      namedPlan('other', 'ABC'),
    ];

    expect(uniquePlanName('ABC (1)', plans, 'active')).toBe('ABC (1)');
  });
});
