import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { VelocityTimeChart, LengthDistanceChart, ActivationRateBadge, RunChoiceToggle } from './SkillTraceCharts';
import type { SkillTraceRun } from '@/sim';

const run: SkillTraceRun = {
  without: [ { t: 0, v: 0, pos: 0, hp: 100 }, { t: 1, v: 10, pos: 5, hp: 90 } ],
  withSkill: [ { t: 0, v: 0, pos: 0, hp: 100 }, { t: 1, v: 12, pos: 7.5, hp: 88 } ],
  activation: [ { start: 5, end: 7.5 } ],
  L: 1,
};

describe('SkillTraceCharts', () => {
  it('VelocityTimeChart renders two polylines (with + without)', () => {
    const { container } = render(<VelocityTimeChart run={run} />);
    expect(container.querySelectorAll('polyline').length).toBe(2);
  });

  it('LengthDistanceChart renders gain columns, not a connecting line', () => {
    const { container } = render(<LengthDistanceChart run={run} />);
    expect(container.querySelectorAll('rect.cmp-trace-col').length).toBeGreaterThan(0);
    expect(container.querySelector('polyline')).toBeNull(); // bars, so inactive distances show nothing
  });

  it('LengthDistanceChart labels distance ticks at the phase transitions', () => {
    // distMax = 7.5 → ticks at 1/6 (≈1m), 2/3 (5m), plus 0 and round(7.5)=8m.
    const { container } = render(<LengthDistanceChart run={run} />);
    const ticks = Array.from(container.querySelectorAll('.cmp-xtick')).map((t) => t.textContent);
    expect(ticks).toEqual(['0', '1m', '5m', '8m']);
  });

  it('both charts render 3 race-phase bands and axis labels', () => {
    for (const chart of [<VelocityTimeChart run={run} />, <LengthDistanceChart run={run} />]) {
      const { container, unmount } = render(chart);
      expect(container.querySelectorAll('rect.cmp-trace-phase').length).toBe(3);
      expect(container.querySelector('.cmp-axis-x')).not.toBeNull();
      expect(container.querySelector('.cmp-axis-ytitle')).not.toBeNull();
      unmount();
    }
  });

  it('LengthDistanceChart labels the auto-scaled Y max in バ身', () => {
    // gain reaches (7.5-5)/2.5 = 1 L → niceCeil(1) = 1 → "1L"
    const { container } = render(<LengthDistanceChart run={run} />);
    expect(container.querySelector('.cmp-axis-ymax')?.textContent).toBe('1L');
    expect(container.querySelector('.cmp-axis-ytitle')?.textContent).toBe('バ身');
  });

  it('ActivationRateBadge shows a Compute button when idle, fires onCompute', async () => {
    const onCompute = vi.fn();
    render(<ActivationRateBadge status="idle" rate={null} onCompute={onCompute} />);
    screen.getByRole('button', { name: /activation rate/i }).click();
    expect(onCompute).toHaveBeenCalled();
  });

  it('ActivationRateBadge shows a percentage when done', () => {
    render(<ActivationRateBadge status="done" rate={0.73} onCompute={() => {}} />);
    expect(screen.getByText('73%')).toBeInTheDocument();
  });

  it('RunChoiceToggle reports the chosen run', () => {
    const onChange = vi.fn();
    render(<RunChoiceToggle value="median" onChange={onChange} />);
    screen.getByRole('button', { name: /best/i }).click();
    expect(onChange).toHaveBeenCalledWith('max');
  });
});
