import { describe, expect, it } from 'vitest';
import { PRESETS } from './presets';

describe('PRESETS', () => {
  it('has CM15 Cancer Cup — Hanshin turf 2200m (medium, right, inner), course 10906', () => {
    const cm15 = PRESETS.find((p) => p.cmId === 'CM15');
    expect(cm15).toMatchObject({
      cupName: 'Cancer Cup',
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
    });
  });

  it('has CM16 Leo Cup — Nakayama turf 1200m (sprint, right), course 10501', () => {
    const cm16 = PRESETS.find((p) => p.cmId === 'CM16');
    expect(cm16).toMatchObject({
      cupName: 'Leo Cup',
      courseId: '10501',
      racetrack: 'Nakayama',
      surface: 'turf',
      distance: 1200,
      distanceClass: 'sprint',
      direction: 'right',
      ground: 'firm',
      season: 'summer',
      weather: 'sunny',
    });
  });
});
