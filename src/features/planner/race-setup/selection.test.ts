import { describe, expect, it } from 'vitest';
import type { CourseCatalogEntry } from '@/sim/courseCatalog';
import { PRESETS } from './presets';
import { presetToSelection, courseToSelection, describeSelection } from './selection';

describe('presetToSelection', () => {
  it('maps the CM15 preset to a full selection', () => {
    const sel = presetToSelection(PRESETS[0]!);
    expect(sel).toMatchObject({
      courseId: '10906',
      racetrack: 'Hanshin',
      surface: 'turf',
      distance: 2200,
      distanceClass: 'medium',
      direction: 'right',
      inOut: 'inner',
      ground: 'good',
      season: 'summer',
      weather: 'cloudy',
      presetCmId: 'CM15',
    });
  });
});

describe('courseToSelection', () => {
  it('maps a catalog course + conditions to a selection (left-handed, no preset/inOut)', () => {
    const course: CourseCatalogEntry = {
      courseId: '10602',
      raceTrackId: 10006,
      surface: 'turf',
      distance: 1600,
      distanceClass: 'mile',
      turn: 2,
    };
    const sel = courseToSelection(course, { ground: 'firm', weather: 'sunny', season: 'spring' });
    expect(sel).toMatchObject({
      courseId: '10602',
      racetrack: 'Tokyo',
      surface: 'turf',
      distance: 1600,
      distanceClass: 'mile',
      direction: 'left',
      ground: 'firm',
      weather: 'sunny',
      season: 'spring',
    });
    expect(sel.presetCmId).toBeUndefined();
    expect(sel.inOut).toBeUndefined();
  });
});

describe('describeSelection', () => {
  it('produces readable condition chips for CM15', () => {
    const chips = describeSelection(presetToSelection(PRESETS[0]!));
    expect(chips).toEqual([
      'Hanshin',
      'Turf',
      '2,200m (Medium)',
      'Right-Handed',
      'Inner',
      'Good',
      'Summer',
      'Cloudy',
    ]);
  });
});
