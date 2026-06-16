import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const h = vi.hoisted(() => ({
  courseData: {
    courseId: 10906,
    distance: 2200,
    surface: 1,
    turn: 1,
    corners: [
      { start: 520, length: 190 },
      { start: 710, length: 190 },
      { start: 1250, length: 300 },
      { start: 1550, length: 300 },
    ],
    straights: [
      { start: 0, end: 520, frontType: 1 },
      { start: 900, end: 1250, frontType: 2 },
      { start: 1850, end: 2200, frontType: 1 },
    ],
    slopes: [
      { start: 0, length: 290, slope: -10000 },
      { start: 295, length: 125, slope: 20000 },
      { start: 1400, length: 595, slope: -10000 },
      { start: 2000, length: 125, slope: 20000 },
    ],
  },
}));

// The track + race-setup lazy-import the engine; mock them so the page test stays in jsdom.
vi.mock('@/sim/courseData', () => ({ courseDataFor: () => h.courseData }));
vi.mock('@/sim/courseCatalog', () => ({ courseCatalog: () => [] }));

import { CmPlannerPage } from './CmPlannerPage';

afterEach(cleanup);

describe('CmPlannerPage', () => {
  it('defaults to the CM15 preset in the race-setup chooser', () => {
    render(<CmPlannerPage />);
    expect(screen.getByRole('option', { name: /CM15.*Cancer Cup/ })).toBeInTheDocument();
  });

  it('renders the §0 track for the selected course (CM15)', async () => {
    render(<CmPlannerPage />);
    await waitFor(() => expect(document.querySelector('#race-phases')).toBeInTheDocument());
  });

  it('shows CM15 conditions in the readout (Hanshin, medium, inner)', () => {
    render(<CmPlannerPage />);
    const cond = within(screen.getByLabelText('Race conditions'));
    expect(cond.getByText('Hanshin')).toBeInTheDocument();
    expect(cond.getByText('2,200m (Medium)')).toBeInTheDocument();
    expect(cond.getByText('Inner')).toBeInTheDocument();
  });
});
