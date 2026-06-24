import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { SkillTraceRun } from '@/sim';
import type { SkillTraceState } from './useSkillTrace';
import { StaminaCheckerTab } from './StaminaCheckerTab';

afterEach(cleanup);

// --- mock plan fixture ---
const plan = {
  id: 'p',
  name: 'p',
  planNumber: 1,
  cmRef: { kind: 'cm' as const, cmId: 'CM15' as const, cmNumber: 15, courseId: '10906', surface: 'turf' as const, distance: 2200 },
  umaId: '100101',
  uniqueSkillId: 'u',
  role: 'ace' as const,
  strategy: 'front' as const,
  statProfile: { stats: { spd: 1200, sta: 650, pow: 900, gut: 400, wit: 600 }, mood: 0 as const },
  sparkGoals: { pink: [], blue: {} },
  wishlist: [],
  lockedDeckSlots: [],
  parents: {},
  patch: { version: 't' },
  server: 'global' as const,
  dataVersion: 't',
};

// --- useSkillTrace mock ---
// Module-level mutable var — each test sets `current` before render.
const makeRun = (without: SkillTraceRun['without']): SkillTraceRun => ({
  withSkill: without,
  without,
  activation: [],
  L: 0,
});

let current: SkillTraceState = {
  status: 'idle',
  run: null,
  runChoice: 'median',
  setRunChoice: vi.fn(),
  meanL: null,
  impact: null,
  impactStatus: 'idle',
};

vi.mock('./useSkillTrace', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useSkillTrace')>()),
  useSkillTrace: () => current,
}));

describe('StaminaCheckerTab', () => {
  it('shows a "Finishes" badge when min HP stays above 0 throughout', () => {
    const without = [
      { t: 0, v: 20, pos: 0, hp: 100 },
      { t: 10, v: 20, pos: 2200, hp: 30 },
    ];
    current = {
      status: 'done',
      run: makeRun(without),
      runChoice: 'median',
      setRunChoice: vi.fn(),
      meanL: null,
      impact: null,
      impactStatus: 'idle',
    };
    render(<StaminaCheckerTab plan={plan} />);
    expect(screen.getByLabelText('Finishes')).toBeInTheDocument();
    expect(screen.queryByLabelText('Runs out')).not.toBeInTheDocument();
  });

  it('shows a "Runs out" badge when HP reaches 0 before the line', () => {
    const without = [
      { t: 0, v: 20, pos: 0, hp: 100 },
      { t: 8, v: 18, pos: 1500, hp: 0 },
      { t: 12, v: 15, pos: 2200, hp: 0 },
    ];
    current = {
      status: 'done',
      run: makeRun(without),
      runChoice: 'median',
      setRunChoice: vi.fn(),
      meanL: null,
      impact: null,
      impactStatus: 'idle',
    };
    render(<StaminaCheckerTab plan={plan} />);
    expect(screen.getByLabelText('Runs out')).toBeInTheDocument();
    expect(screen.queryByLabelText('Finishes')).not.toBeInTheDocument();
  });

  it('shows min HP value and position in the details', () => {
    const without = [
      { t: 0, v: 20, pos: 0, hp: 100 },
      { t: 8, v: 18, pos: 1800, hp: 12 },
    ];
    current = {
      status: 'done',
      run: makeRun(without),
      runChoice: 'median',
      setRunChoice: vi.fn(),
      meanL: null,
      impact: null,
      impactStatus: 'idle',
    };
    render(<StaminaCheckerTab plan={plan} />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('1800 m')).toBeInTheDocument();
  });

  it('shows a simulating message while status is "running"', () => {
    current = {
      status: 'running',
      run: null,
      runChoice: 'median',
      setRunChoice: vi.fn(),
      meanL: null,
      impact: null,
      impactStatus: 'idle',
    };
    render(<StaminaCheckerTab plan={plan} />);
    expect(screen.getByText(/simulating/i)).toBeInTheDocument();
  });

  it('shows a guard message when speed is 0', () => {
    current = {
      status: 'idle',
      run: null,
      runChoice: 'median',
      setRunChoice: vi.fn(),
      meanL: null,
      impact: null,
      impactStatus: 'idle',
    };
    const zeroPlan = { ...plan, statProfile: { ...plan.statProfile, stats: { ...plan.statProfile.stats, spd: 0 } } };
    render(<StaminaCheckerTab plan={zeroPlan} />);
    expect(screen.getByText(/set a speed stat/i)).toBeInTheDocument();
  });
});
