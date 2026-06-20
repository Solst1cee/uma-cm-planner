import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';

afterEach(cleanup); // interactive help-popup test renders + queries — isolate each test's DOM
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
const impact: SkillImpact = {
  samples: [
    { horseLength: 2, positions: [800] },        // ×1
    { horseLength: 2.5, positions: [820] },      // ×1
    { horseLength: 3, positions: [400, 1100] },  // ×2 — biggest gain, fires first at 400 m
  ],
  nsamples: 4, distance: 1200,
};

const base: SkillTraceState = {
  status: 'done', run, runChoice: 'median', setRunChoice: vi.fn(),
  meanL: 2.3, impact: null, impactStatus: 'running', rate: null,
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

  it('shows the average-バ身 headline (2 dp, like the skill chart)', () => {
    current = base; // meanL 2.3
    const { container } = render(<SkillTraceSection skillId="200332" ctx={ctx} enabled />);
    expect(container.textContent).toMatch(/\+2\.30 L/);
    expect(container.textContent).toMatch(/average gain/i);
  });

  it('warns when the shown run did not fire the skill', () => {
    current = { ...base, run: { ...run, activation: [] } };
    const { container } = render(<SkillTraceSection skillId="200332" ctx={ctx} enabled />);
    expect(container.textContent).toMatch(/didn’t fire in this run/i);
  });

  it('shows the impact + frequency charts, fire-count breakdown, and peak when the impact finishes', () => {
    current = { ...base, impact, impactStatus: 'done', rate: 0.75 };
    const { container } = render(<SkillTraceSection skillId="200332" ctx={ctx} enabled />);
    expect(container.textContent).toMatch(/L gained by activation position/i);
    expect(container.textContent).toMatch(/Activation frequency by position/i);
    // integer fire-count breakdown (×1 in 2/4 runs, ×2 in 1/4) — no fractional average
    expect(container.textContent).toMatch(/50% of runs fire ×1/);
    expect(container.textContent).toMatch(/25% of runs fire ×2/);
    // peak-position summary line: biggest sample is the ×2 run, first fire at 400 m, L 3.00
    expect(container.textContent).toMatch(/biggest gain/i);
    expect(container.textContent).toMatch(/fires at 400m/i);
    expect(container.textContent).toMatch(/\+3\.00 L/);
  });

  it('renders the na message when the trace is empty', () => {
    current = { ...base, status: 'na', run: null };
    const { container } = render(<SkillTraceSection skillId="200332" ctx={ctx} enabled />);
    expect(container.textContent).toMatch(/No simulated trace for this skill/i);
  });

  it('the ? button toggles a help popup that explains the graphs (with the build label)', () => {
    current = base;
    const view = render(<SkillTraceSection skillId="200332" ctx={{ ...ctx, buildLabel: 'the reference' }} enabled />);
    expect(view.container.textContent).not.toMatch(/How these graphs work/i);
    fireEvent.click(view.getByRole('button', { name: /how these graphs work/i }));
    expect(view.container.textContent).toMatch(/How these graphs work/i);
    expect(view.container.textContent).toMatch(/with vs without/i);     // explains the sim method
    expect(view.container.textContent).toMatch(/the reference/i);       // build label folded in
    expect(view.container.textContent).toMatch(/L gained by activation position/i); // lists the graphs
    fireEvent.click(view.getByRole('button', { name: /how these graphs work/i }));
    expect(view.container.textContent).not.toMatch(/How these graphs work/i);
  });
});
