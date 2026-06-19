import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, within } from '@testing-library/react';
import type { SkillImpact, SkillTraceRun } from '@/sim';
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
const impact: SkillImpact = { samples: [{ horseLength: 2, positions: [800] }], nsamples: 10, distance: 1200 };

const base: SkillTraceState = {
  status: 'done', run, runChoice: 'median', setRunChoice: vi.fn(),
  impact: null, impactStatus: 'running', rate: null,
};
let current: SkillTraceState = base;
vi.mock('./useSkillTrace', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useSkillTrace')>()),
  useSkillTrace: () => current,
}));

describe('SkillTraceSection', () => {
  it('auto-shows the velocity chart + a simulating note while the impact runs', () => {
    current = base;
    const { container } = render(<SkillTraceSection skillId="200332" ctx={ctx} enabled />);
    expect(container.textContent).toMatch(/Velocity vs time/i);
    expect(container.textContent).toMatch(/Simulating activation impact/i);
    expect(container.textContent).not.toMatch(/L gained by activation position/i);
  });

  it('shows the impact + frequency charts and the derived rate when the impact finishes', () => {
    current = { ...base, impact, impactStatus: 'done', rate: 0.7 };
    const { container } = render(<SkillTraceSection skillId="200332" ctx={ctx} enabled />);
    expect(container.textContent).toMatch(/L gained by activation position/i);
    expect(container.textContent).toMatch(/Activation frequency by position/i);
    expect(within(container).getByText('70%')).toBeInTheDocument();
  });

  it('renders the na message when the trace is empty', () => {
    current = { ...base, status: 'na', run: null };
    const { container } = render(<SkillTraceSection skillId="200332" ctx={ctx} enabled />);
    expect(container.textContent).toMatch(/No simulated trace for this skill/i);
  });

  it('captions velocity with the context buildLabel (P3 honesty)', () => {
    current = base;
    const { container } = render(<SkillTraceSection skillId="200332" ctx={{ ...ctx, buildLabel: 'the reference' }} enabled />);
    expect(container.textContent).toMatch(/single typical run of the reference/i);
  });
});
