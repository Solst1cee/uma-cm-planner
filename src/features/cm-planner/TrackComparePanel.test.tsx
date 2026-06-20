import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { makeDefaultPlan } from '@/app/ActivePlanContext';
import type { RaceCompareState } from './useRaceCompare';

vi.mock('@/features/planner/racetrack/RaceTrackView', () => ({
  RaceTrackView: (p: { trace?: unknown }) => <div data-testid="track" data-has-trace={p.trace ? '1' : '0'} />,
}));

import { TrackComparePanel } from './TrackComparePanel';

afterEach(cleanup);

const active = { ...makeDefaultPlan(), id: 'A', name: 'Active' };
const other = { ...makeDefaultPlan(), id: 'B', name: 'Rival B' };
const stubState = (over: Partial<RaceCompareState> = {}): RaceCompareState => ({
  status: 'done', run: { uma1Frames: [], uma2Frames: [], uma1Acts: [], uma2Acts: [], gap: [] },
  runChoice: 'median', setRunChoice: vi.fn(), distance: 1200, meanBashin: 1.3, ...over,
});

const renderPanel = (over: Partial<RaceCompareState> = {}) =>
  render(
    <TrackComparePanel
      plan={active}
      savedPlans={[active, other]}
      courseId="10101"
      trackTitle="Tokyo turf 2400m"
      conditionChips={['Turf', 'Firm']}
      skillName={(id) => id}
      deps={{ useRaceCompare: () => stubState(over) }}
    />,
  );

describe('TrackComparePanel', () => {
  it('renders the track title and condition chips', () => {
    renderPanel();
    expect(screen.getByText('Tokyo turf 2400m')).toBeTruthy();
    expect(screen.getByText('Turf')).toBeTruthy();
  });

  it('lists saved plans (excluding the active one) in the compare picker', () => {
    renderPanel();
    const select = screen.getByLabelText(/compare against/i) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.textContent);
    expect(values).toContain('Rival B');
    expect(values).not.toContain('Active');
  });

  it('shows the plain course (no trace, no headline) until a uma2 is picked', () => {
    renderPanel();
    expect(screen.getByTestId('track').getAttribute('data-has-trace')).toBe('0');
    expect(screen.queryByText(/バ身/)).toBeNull();
  });

  it('overlays the trace and shows the mean バ身 headline once a uma2 is picked', () => {
    renderPanel({ meanBashin: 2.5 });
    fireEvent.change(screen.getByLabelText(/compare against/i), { target: { value: 'B' } });
    expect(screen.getByTestId('track').getAttribute('data-has-trace')).toBe('1');
    const headline = screen.getByText(/バ身/);
    expect(headline.textContent).toMatch(/\+2\.50/);
  });
});
