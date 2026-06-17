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

  it('LengthDistanceChart renders the gain polyline', () => {
    const { container } = render(<LengthDistanceChart run={run} />);
    expect(container.querySelector('polyline')).not.toBeNull();
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
