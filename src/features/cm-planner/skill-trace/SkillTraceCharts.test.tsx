import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { VelocityTimeChart, LengthImpactChart, ActivationFrequencyChart, RunChoiceToggle } from './SkillTraceCharts';
import type { SkillImpact, SkillTraceRun } from '@/sim';

const run: SkillTraceRun = {
  without: [ { t: 0, v: 0, pos: 0, hp: 100 }, { t: 1, v: 10, pos: 5, hp: 90 } ],
  withSkill: [ { t: 0, v: 0, pos: 0, hp: 100 }, { t: 1, v: 12, pos: 7.5, hp: 88 } ],
  activation: [ { start: 5, end: 7.5 } ],
  L: 1,
};

const impact: SkillImpact = {
  nsamples: 10,
  distance: 1200,
  samples: [ { horseLength: 2, positions: [800] }, { horseLength: 3, positions: [820] } ],
};

describe('SkillTraceCharts', () => {
  it('VelocityTimeChart renders two polylines + 3 phase bands', () => {
    const { container } = render(<VelocityTimeChart run={run} />);
    expect(container.querySelectorAll('polyline').length).toBe(2);
    expect(container.querySelectorAll('rect.cmp-trace-phase').length).toBe(3);
  });

  it('LengthImpactChart: columns, バ身 axis, auto Y max, phase-transition position ticks', () => {
    const { container } = render(<LengthImpactChart impact={impact} />);
    expect(container.querySelectorAll('rect.cmp-trace-col').length).toBeGreaterThan(0);
    expect(container.querySelector('.cmp-axis-ytitle')?.textContent).toBe('バ身');
    expect(container.querySelector('.cmp-axis-ymax')?.textContent).toBe('5L'); // niceCeil(max 3) = 5
    const ticks = Array.from(container.querySelectorAll('.cmp-xtick')).map((t) => t.textContent);
    expect(ticks).toEqual(['0', '200m', '800m', '1200m']); // 1/6, 2/3, end of 1200m
  });

  it('ActivationFrequencyChart: columns on a fixed 0–100% axis', () => {
    const { container } = render(<ActivationFrequencyChart impact={impact} />);
    expect(container.querySelectorAll('rect.cmp-trace-col').length).toBeGreaterThan(0);
    expect(container.querySelector('.cmp-axis-ytitle')?.textContent).toBe('%');
    expect(container.querySelector('.cmp-axis-ymax')?.textContent).toBe('100%');
  });

  it('RunChoiceToggle reports the chosen run', () => {
    const onChange = vi.fn();
    render(<RunChoiceToggle value="median" onChange={onChange} />);
    screen.getByRole('button', { name: /best/i }).click();
    expect(onChange).toHaveBeenCalledWith('max');
  });
});
