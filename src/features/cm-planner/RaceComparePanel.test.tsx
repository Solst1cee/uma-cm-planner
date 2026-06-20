import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';

afterEach(cleanup);
import { RaceComparePanel } from './RaceComparePanel';
import { makeDefaultPlan } from '@/app/ActivePlanContext';
import type { RaceCompareState } from './useRaceCompare';

vi.mock('@/features/planner/racetrack/RaceTrackView', () => ({
  RaceTrackView: (p: { trace?: unknown }) => <div data-testid="track" data-has-trace={p.trace ? '1' : '0'} />,
}));

const active = { ...makeDefaultPlan(), id: 'A', name: 'Active' };
const other = { ...makeDefaultPlan(), id: 'B', name: 'Rival B' };
const stubState = (over: Partial<RaceCompareState> = {}): RaceCompareState => ({
  status: 'done', run: { uma1Frames: [], uma2Frames: [], uma1Acts: [], uma2Acts: [], gap: [] },
  runChoice: 'median', setRunChoice: vi.fn(), distance: 1200, meanBashin: 1.3, ...over,
});

describe('RaceComparePanel', () => {
  it('lists saved plans (excluding the active one) as uma2 options', () => {
    render(<RaceComparePanel plan={active} savedPlans={[active, other]} courseId="10101"
      collapseSkillSignal={0} skillName={(id) => id} deps={{ useRaceCompare: () => stubState() }} />);
    const select = screen.getByLabelText(/compare against/i) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.textContent);
    expect(values).toContain('Rival B');
    expect(values).not.toContain('Active');
  });

  it('shows the mean バ身 headline when done', () => {
    render(<RaceComparePanel plan={active} savedPlans={[active, other]} courseId="10101"
      collapseSkillSignal={0} skillName={(id) => id} deps={{ useRaceCompare: () => stubState({ meanBashin: 2.5 }) }} />);
    expect(screen.getByText(/2\.5/)).toBeTruthy();
  });

  it('passes the trace to the track once a uma2 is picked', () => {
    render(<RaceComparePanel plan={active} savedPlans={[active, other]} courseId="10101"
      collapseSkillSignal={0} skillName={(id) => id} deps={{ useRaceCompare: () => stubState() }} />);
    fireEvent.change(screen.getByLabelText(/compare against/i), { target: { value: 'B' } });
    expect(screen.getByTestId('track').getAttribute('data-has-trace')).toBe('1');
  });
});
