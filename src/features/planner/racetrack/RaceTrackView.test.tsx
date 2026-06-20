import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { RaceTrackView } from './RaceTrackView';
import type { RaceCompareRun } from '@/sim';

afterEach(cleanup);

const HANSHIN_2200 = {
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
};

const deps = { loadCourse: () => Promise.resolve(HANSHIN_2200 as never) };

describe('RaceTrackView', () => {
  it('renders the race-phase, section, and slope bars for the course', async () => {
    render(<RaceTrackView courseId="10906" deps={deps} />);
    await waitFor(() => expect(document.querySelector('#race-phases')).toBeInTheDocument());
    expect(document.querySelector('#race-sections')).toBeInTheDocument();
    expect(document.querySelector('#racetrack-slope-visualization')).toBeInTheDocument();
  });

  it('labels the legs (Early-race … Last spurt) and section types', async () => {
    render(<RaceTrackView courseId="10906" deps={deps} />);
    expect(await screen.findByText('Last spurt')).toBeInTheDocument();
    expect(screen.getByText('Early-race')).toBeInTheDocument();
    expect(screen.getAllByText('Straight').length).toBeGreaterThan(0);
  });

  it('degrades gracefully when the course cannot be resolved', async () => {
    const failing = { loadCourse: () => Promise.reject(new Error('Unknown course: x')) };
    render(<RaceTrackView courseId="999" deps={failing} />);
    expect(await screen.findByText(/unavailable/i)).toBeInTheDocument();
    expect(document.querySelector('#race-phases')).not.toBeInTheDocument();
  });
});

const traceRun: RaceCompareRun = {
  uma1Frames: [{ t: 0, pos: 0, v: 18, hp: 100 }, { t: 1, pos: 1200, v: 16, hp: 10 }],
  uma2Frames: [{ t: 0, pos: 0, v: 17, hp: 100 }, { t: 1, pos: 1180, v: 15, hp: 20 }],
  uma1Acts: [], uma2Acts: [], gap: [{ pos: 0, bashin: 0 }, { pos: 1200, bashin: 1 }],
};

describe('RaceTrackView overlay', () => {
  it('renders the overlay when a trace is supplied', async () => {
    const { container } = render(
      <RaceTrackView courseId="10906" deps={deps} trace={traceRun} traceDistance={1200} showHp />,
    );
    await waitFor(() => expect(container.querySelector('.racetrackView')).toBeTruthy());
    expect(container.querySelector('.race-overlay')).toBeTruthy();
    expect(container.querySelectorAll('.ro-velo').length).toBe(2);
  });

  it('renders no overlay without a trace', async () => {
    const { container } = render(<RaceTrackView courseId="10906" deps={deps} />);
    await waitFor(() => expect(container.querySelector('.racetrackView')).toBeTruthy());
    expect(container.querySelector('.race-overlay')).toBeNull();
  });
});
