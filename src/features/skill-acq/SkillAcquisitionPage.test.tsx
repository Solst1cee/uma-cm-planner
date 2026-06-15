import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan } from '@/core/types';
import { SkillAcquisitionPage } from './SkillAcquisitionPage';

const PLAN = {
  id: 'p',
  name: 'My Plan',
  planNumber: 1,
  cmRef: { cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200, condition: 'good' },
  umaId: '',
  uniqueSkillId: '',
  role: 'ace',
  strategy: 'pace',
  statProfile: { stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 }, mood: 0 },
  sparkGoals: { pink: [], blue: {} },
  wishlist: [],
  lockedDeckSlots: [],
  parents: {},
  patch: { version: 't' },
  server: 'global',
  dataVersion: 't',
} as CmPlan;

vi.mock('@/features/data/gameData', async () => {
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { useGameData: () => fixtureGameData() };
});
vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({ plan: PLAN, setPlan: vi.fn(), loadError: null }),
}));
// Mock the chart hook so the page test never touches the Web Worker.
vi.mock('@/features/skill-acq/useSkillChart', () => ({
  useSkillChart: () => ({ rows: [], status: 'idle', done: 0, total: 0 }),
}));
afterEach(cleanup);

describe('SkillAcquisitionPage', () => {
  it('renders the 2-column shell with runner config, race, skill chart and sourcing', () => {
    render(<SkillAcquisitionPage />);
    expect(screen.getByRole('heading', { name: 'Runner' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Race' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Skill chart' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Where do I get these?' })).toBeInTheDocument();
    expect(screen.getByText(/CM15/)).toBeInTheDocument();
  });
});
