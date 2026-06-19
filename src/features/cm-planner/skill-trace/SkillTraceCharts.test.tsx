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
  nsamples: 10, distance: 1200,
  samples: [ { horseLength: 2, positions: [800] }, { horseLength: 3, positions: [820] } ],
};

describe('SkillTraceCharts', () => {
  it('VelocityTimeChart renders two polylines + 4 phase bands', () => {
    const { container } = render(<VelocityTimeChart run={run} />);
    expect(container.querySelectorAll('polyline').length).toBe(2);
    expect(container.querySelectorAll('rect.cmp-trace-phase').length).toBe(4);
  });

  it('LengthImpactChart: title, columns, 1L Y labels, 500m X labels, 4 phase labels + grid', () => {
    const { container } = render(<LengthImpactChart impact={impact} />);
    expect(container.textContent).toMatch(/L gained by activation position/i);
    expect(container.querySelectorAll('rect.cmp-trace-col').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('rect.cmp-trace-phase').length).toBe(4);
    expect(Array.from(container.querySelectorAll('.cmp-phase-label')).map((s) => s.textContent))
      .toEqual(['Early', 'Mid', 'Late', 'Spurt']);
    expect(Array.from(container.querySelectorAll('.cmp-ylabel')).map((s) => s.textContent))
      .toEqual(['0L', '1L', '2L', '3L']); // lAxisDomain ceil(max 3) = 3, 1L steps
    expect(Array.from(container.querySelectorAll('.cmp-xlabel')).map((s) => s.textContent))
      .toEqual(['0', '500m', '1000m']); // 500 m steps over 1200 m
    expect(container.querySelectorAll('line.cmp-trace-grid').length).toBeGreaterThan(0);
  });

  it('ActivationFrequencyChart: % axis with 25% Y labels', () => {
    const { container } = render(<ActivationFrequencyChart impact={impact} />);
    expect(container.textContent).toMatch(/Activation frequency by position/i);
    expect(Array.from(container.querySelectorAll('.cmp-ylabel')).map((s) => s.textContent))
      .toEqual(['0%', '25%', '50%', '75%', '100%']);
  });

  it('RunChoiceToggle reports the chosen run', () => {
    const onChange = vi.fn();
    render(<RunChoiceToggle value="median" onChange={onChange} />);
    screen.getByRole('button', { name: /best/i }).click();
    expect(onChange).toHaveBeenCalledWith('max');
  });
});
