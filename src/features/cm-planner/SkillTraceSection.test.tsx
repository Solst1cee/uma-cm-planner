import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type { SkillTraceRun } from '@/sim';
import type { SkillTraceState } from './useSkillTrace';
import { SkillTraceSection } from './SkillTraceSection';

const run: SkillTraceRun = {
  withSkill: [{ t: 0, v: 0, pos: 0, hp: 100 }, { t: 1, v: 12, pos: 7.5, hp: 88 }],
  without: [{ t: 0, v: 0, pos: 0, hp: 100 }, { t: 1, v: 10, pos: 5, hp: 90 }],
  activation: [{ start: 5, end: 7.5 }],
  L: 1,
};
const ctx = {
  build: { umaId: 'x', stats: { spd: 1000, sta: 1, pow: 1, gut: 1, wit: 1 }, strategy: 'pace' as const, aptitudes: { distance: 'A' as const, surface: 'A' as const, strategy: 'A' as const }, skills: [] },
  race: { courseId: '10101' },
};

const hookState: SkillTraceState = {
  status: 'done', run, runChoice: 'median', setRunChoice: vi.fn(),
  rate: null, rateStatus: 'idle', computeRate: vi.fn(),
};
let current: SkillTraceState = hookState;
vi.mock('./useSkillTrace', () => ({ useSkillTrace: () => current }));

describe('SkillTraceSection', () => {
  it('renders both charts + the activation-rate button when done', () => {
    current = hookState;
    render(<SkillTraceSection skillId="200332" ctx={ctx} enabled />);
    expect(screen.getByText(/Velocity vs time/i)).toBeInTheDocument();
    expect(screen.getByText(/Length gained vs distance/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /compute activation rate/i })).toBeInTheDocument();
  });

  it('renders the na message when the trace is empty', () => {
    current = { ...hookState, status: 'na', run: null };
    render(<SkillTraceSection skillId="200332" ctx={ctx} enabled />);
    expect(screen.getByText(/No simulated trace for this skill on this build\/course\./i)).toBeInTheDocument();
  });

  it('captions the run with the context buildLabel (honest-numbers, P3)', () => {
    current = hookState;
    render(<SkillTraceSection skillId="200332" ctx={{ ...ctx, buildLabel: 'the reference' }} enabled />);
    expect(screen.getByText(/Single typical run of the reference/i)).toBeInTheDocument();
  });
});
