import { describe, it, expect, vi, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, cleanup } from '@testing-library/react';

afterEach(cleanup); // file has multiple screen-based renders — isolate each test's DOM
import { VelocityTimeChart, LengthImpactChart, ActivationFrequencyChart, RunChoiceToggle } from './SkillTraceCharts';
import type { SkillImpact, SkillTraceRun } from '@/sim';

// 30 s race; the tracked skill fires at pos 150–160 (t 15–16) bumping velocity 20 → 25.
const run: SkillTraceRun = {
  without: Array.from({ length: 31 }, (_, i) => ({ t: i, v: 20, pos: i * 10, hp: 100 })),
  withSkill: Array.from({ length: 31 }, (_, i) => ({ t: i, v: (i >= 15 && i <= 16) ? 25 : 20, pos: i * 10, hp: 100 })),
  activation: [ { start: 150, end: 160 } ],
  L: 1,
};
const impact: SkillImpact = {
  nsamples: 10, distance: 1200,
  samples: [ { horseLength: 2, positions: [800] }, { horseLength: 3, positions: [820] } ],
};

describe('SkillTraceCharts', () => {
  it('VelocityTimeChart: zooms to the activation window (seconds), floors the y-axis, draws 2 lines', () => {
    const { container } = render(<VelocityTimeChart run={run} />);
    expect(container.querySelectorAll('polyline').length).toBe(2); // no-skill baseline + trimmed with-skill
    expect(container.querySelectorAll('rect.cmp-trace-phase').length).toBeGreaterThan(0);
    // x-axis is the zoomed window [5s, 26s] (activation 15–16 ± 10 s), not 0 → whole race
    expect(Array.from(container.querySelectorAll('.cmp-xlabel')).map((s) => s.textContent)).toEqual(['5s', '26s']);
    // y-axis is floored at 18 m/s (not 0): top = ceil(25)+1, bottom = floor
    expect(Array.from(container.querySelectorAll('.cmp-ylabel')).map((s) => s.textContent)).toEqual(['26', '18']);
    // the activation zone is labelled with its duration + fire position
    expect(container.querySelector('.cmp-zone-label')?.textContent).toBe('1s · ~150m');
  });

  it('VelocityTimeChart shows the run picker in the title when given runChoice/onRunChoice', () => {
    const onChange = vi.fn();
    render(<VelocityTimeChart run={run} runChoice="median" onRunChoice={onChange} />);
    screen.getByRole('button', { name: /best/i }).click();
    expect(onChange).toHaveBeenCalledWith('max');
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
    // 250 m minor lines render (250, 750 over 1200 m) but add no extra X labels.
    expect(container.querySelectorAll('line.cmp-trace-grid.is-minor').length).toBe(2);
  });

  it('ActivationFrequencyChart: % axis labels only 0/50/100, half-height box', () => {
    const { container } = render(<ActivationFrequencyChart impact={impact} />);
    expect(container.textContent).toMatch(/Activation frequency by position/i);
    expect(Array.from(container.querySelectorAll('.cmp-ylabel')).map((s) => s.textContent))
      .toEqual(['0%', '50%', '100%']);
    expect(container.querySelector('.cmp-trace-graph--short')).not.toBeNull();
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 280 48');
  });

  it('RunChoiceToggle reports the chosen run', () => {
    const onChange = vi.fn();
    render(<RunChoiceToggle value="median" onChange={onChange} />);
    screen.getByRole('button', { name: /best/i }).click();
    expect(onChange).toHaveBeenCalledWith('max');
  });
});
