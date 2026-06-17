import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import { RaceSetup } from './RaceSetup';

afterEach(cleanup);

const CATALOG: CourseCatalogEntry[] = [
  { courseId: '10906', raceTrackId: 10009, surface: 'turf', distance: 2200, distanceClass: 'medium', course: 2, turn: 1 },
  { courseId: '10501', raceTrackId: 10005, surface: 'turf', distance: 1200, distanceClass: 'sprint', course: 3, turn: 1 },
  { courseId: '10601', raceTrackId: 10006, surface: 'turf', distance: 1400, distanceClass: 'sprint', course: 1, turn: 2 },
  { courseId: '10602', raceTrackId: 10006, surface: 'turf', distance: 1600, distanceClass: 'mile', course: 1, turn: 2 },
  { courseId: '10609', raceTrackId: 10006, surface: 'dirt', distance: 1300, distanceClass: 'sprint', course: 1, turn: 2 },
];
const deps = { loadCatalog: () => Promise.resolve(CATALOG) };

describe('RaceSetup', () => {
  it('defaults to CM15: preset selected, controls show its track data, emits CM15', async () => {
    const onChange = vi.fn();
    render(<RaceSetup onChange={onChange} deps={deps} />);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: '10906', presetCmId: 'CM15' }),
    );
    expect(screen.getByLabelText('CM preset')).toHaveValue('CM15');
    // controls populate once the catalog loads, showing the preset's track data
    const track = await screen.findByLabelText('Track');
    expect(track).toHaveValue('10009'); // Hanshin
    expect(screen.getByLabelText('Distance')).toHaveValue('10906');
    expect(screen.getByRole('option', { name: '2,200m (Inner)' })).toBeInTheDocument();
    // (the condition chips moved to the track card in CmPlannerPage; tested via describeSelection)
  });

  it('selecting CM16 fills the track data and emits Leo Cup', async () => {
    const onChange = vi.fn();
    render(<RaceSetup onChange={onChange} deps={deps} />);
    await screen.findByLabelText('Track');
    fireEvent.change(screen.getByLabelText('CM preset'), { target: { value: 'CM16' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ courseId: '10501', presetCmId: 'CM16' }),
    );
    expect(screen.getByLabelText('Track')).toHaveValue('10005'); // Nakayama
    expect(screen.getByLabelText('CM preset')).toHaveValue('CM16');
  });

  it('editing a condition away from the preset blanks the preset (— Custom —)', async () => {
    const onChange = vi.fn();
    render(<RaceSetup onChange={onChange} deps={deps} />);
    await screen.findByLabelText('Track');
    fireEvent.change(screen.getByLabelText('Weather'), { target: { value: 'rainy' } });
    const last = onChange.mock.lastCall![0];
    expect(last.weather).toBe('rainy');
    expect(last.presetCmId).toBeUndefined();
    expect(screen.getByLabelText('CM preset')).toHaveValue('');
  });

  it('changing the Track to Tokyo turf emits a custom left-handed course (preset blanks)', async () => {
    const onChange = vi.fn();
    render(<RaceSetup onChange={onChange} deps={deps} />);
    await screen.findByLabelText('Track');
    fireEvent.change(screen.getByLabelText('Track'), { target: { value: '10006' } }); // Tokyo
    const last = onChange.mock.lastCall![0];
    expect(last.racetrack).toBe('Tokyo');
    expect(last.direction).toBe('left');
    expect(last.presetCmId).toBeUndefined();
    expect(screen.getByLabelText('CM preset')).toHaveValue('');
  });

  it('treats an empty catalog as not-ready: still emits CM15 and disables the cascade selects', async () => {
    const onChange = vi.fn();
    render(<RaceSetup onChange={onChange} deps={{ loadCatalog: () => Promise.resolve([]) }} />);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: '10906', presetCmId: 'CM15' }),
    );
    await waitFor(() => expect(screen.getByLabelText('Track')).toBeDisabled());
    expect(screen.getByLabelText('Surface')).toBeDisabled();
    expect(screen.getByLabelText('Distance')).toBeDisabled();
  });

  it('syncs its controls from an externally loaded selection', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<RaceSetup onChange={onChange} deps={deps} />);
    await screen.findByLabelText('Track');

    rerender(
      <RaceSetup
        onChange={onChange}
        deps={deps}
        selection={{
          courseId: '10602',
          racetrack: 'Tokyo',
          surface: 'turf',
          distance: 1600,
          distanceClass: 'mile',
          direction: 'left',
          ground: 'soft',
          weather: 'rainy',
          season: 'winter',
        }}
      />,
    );

    await waitFor(() => expect(screen.getByLabelText('Distance')).toHaveValue('10602'));
    expect(screen.getByLabelText('Ground')).toHaveValue('soft');
    expect(screen.getByLabelText('Weather')).toHaveValue('rainy');
    expect(screen.getByLabelText('Season')).toHaveValue('winter');
  });
});
