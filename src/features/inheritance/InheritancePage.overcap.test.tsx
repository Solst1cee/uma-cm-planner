import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan, UmaRecord } from '@/core/types';

// Mejiro McQueen-ish base aptitudes raced on a mismatched dirt/sprint/end card → over-cap.
const uma: UmaRecord = {
  umaId: '106801', charaId: '1068', nameEn: 'Mejiro McQueen', epithet: 'Patrician Maiden',
  baseAptitudes: {
    surface: { turf: 'A', dirt: 'G' },
    distance: { short: 'E', mile: 'C', medium: 'A', long: 'A' },
    strategy: { front: 'A', pace: 'B', late: 'C', end: 'G' },
  },
  server: 'global', dataVersion: 'x',
};

const plan: CmPlan = {
  id: 'p1', name: 'Overcap test', planNumber: 1,
  // dirt · 1200 (short) · end — McQueen is G/E/G here → big pink requirements
  cmRef: { kind: 'cm', cmId: 'CM15', cmNumber: 15, courseId: '10609', surface: 'dirt', distance: 1200 },
  scenarioId: 4, umaId: '106801', uniqueSkillId: '', role: 'ace', strategy: 'end',
  statProfile: { stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 }, mood: 2 },
  sparkGoals: { pink: [], blue: {} }, wishlist: [], parents: {},
  patch: { version: 'x' }, server: 'global', dataVersion: 'x',
} as CmPlan;

vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({
    uma1Plan: plan, plan, uma2Plan: null, savedPlans: [plan], setPlan: vi.fn(),
    loadPlanIntoSlot: vi.fn(), deleteSavedPlan: vi.fn(), importSavedPlans: vi.fn(), deleteAllSavedPlans: vi.fn(),
  }),
}));
vi.mock('@/features/parents/useUmas', () => ({
  useUmas: () => ({ umas: [uma], umaById: new Map([[uma.umaId, uma]]) }),
  umaName: (_m: unknown, id: string) => `Uma ${id}`,
}));
vi.mock('@/features/data/gameData', () => ({ useGameData: () => ({ skillById: new Map() }), BASE_URL: '' }));
vi.mock('@/features/cm-planner/PlanInventoryCard', () => ({ PlanInventoryCard: () => <div /> }));
vi.mock('@/features/data/GameIcon', () => ({ GameIcon: () => <span data-testid="icon" /> }));

import { InheritancePage } from './InheritancePage';

afterEach(cleanup);

describe('Plan targets — over-capped pink', () => {
  it('renders pink chips, the over-budget warning, and the mid-run readout when the uma resolves', () => {
    render(<InheritancePage deps={{ loadCatalog: () => Promise.resolve([]) }} />);
    // McQueen on dirt/short/end with default S/A/A targets → all three need sparks
    expect(screen.getByText('Dirt ★10')).toBeInTheDocument();
    expect(screen.getByText('Sprint ★10')).toBeInTheDocument();
    expect(screen.getByText('End Closer ★10')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/Needs 30★.*over the 18★/);
    expect(screen.getByText('Mid-run spark')).toBeInTheDocument();
    expect(screen.getByText('Dirt ×2')).toBeInTheDocument();
  });
});
