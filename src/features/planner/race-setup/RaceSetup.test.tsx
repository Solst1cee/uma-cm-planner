import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import { RaceSetup } from './RaceSetup';

afterEach(cleanup);

const CATALOG: CourseCatalogEntry[] = [
  { courseId: '10906', raceTrackId: 10009, surface: 'turf', distance: 2200, distanceClass: 'medium', turn: 1 },
  { courseId: '10501', raceTrackId: 10005, surface: 'turf', distance: 1200, distanceClass: 'sprint', turn: 1 },
  { courseId: '10601', raceTrackId: 10006, surface: 'turf', distance: 1400, distanceClass: 'sprint', turn: 2 },
  { courseId: '10602', raceTrackId: 10006, surface: 'turf', distance: 1600, distanceClass: 'mile', turn: 2 },
  { courseId: '10609', raceTrackId: 10006, surface: 'dirt', distance: 1300, distanceClass: 'sprint', turn: 2 },
];
const deps = { loadCatalog: () => Promise.resolve(CATALOG) };

describe('RaceSetup', () => {
  it('defaults to preset mode with CM15 and emits it on mount + shows its conditions', () => {
    const onChange = vi.fn();
    render(<RaceSetup onChange={onChange} deps={deps} />);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: '10906', presetCmId: 'CM15' }),
    );
    expect(screen.getByText('Hanshin')).toBeInTheDocument();
    expect(screen.getByText('2,200m (Medium)')).toBeInTheDocument();
    expect(screen.getByText('Inner')).toBeInTheDocument();
    expect(screen.getByText('Cloudy')).toBeInTheDocument();
  });

  it('switching the preset to CM16 emits Leo Cup (course 10501)', () => {
    const onChange = vi.fn();
    render(<RaceSetup onChange={onChange} deps={deps} />);
    fireEvent.change(screen.getByLabelText('CM preset'), { target: { value: 'CM16' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ courseId: '10501', presetCmId: 'CM16' }),
    );
    expect(screen.getByText('Nakayama')).toBeInTheDocument();
  });

  it('custom mode: choosing Tokyo turf 1600m emits course 10602 (left-handed)', async () => {
    const onChange = vi.fn();
    render(<RaceSetup onChange={onChange} deps={deps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    const track = await screen.findByLabelText('Track');
    fireEvent.change(track, { target: { value: '10006' } }); // Tokyo
    fireEvent.change(screen.getByLabelText('Distance'), { target: { value: '10602' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ courseId: '10602', racetrack: 'Tokyo', direction: 'left' }),
    );
  });

  it('custom mode: ground/weather/season selects update the emitted conditions', async () => {
    const onChange = vi.fn();
    render(<RaceSetup onChange={onChange} deps={deps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Custom' }));
    await screen.findByLabelText('Track');
    fireEvent.change(screen.getByLabelText('Weather'), { target: { value: 'rainy' } });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ weather: 'rainy' }));
  });
});
