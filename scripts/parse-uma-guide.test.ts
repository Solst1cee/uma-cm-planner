import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseUmaGuideSchedule } from './parse-uma-guide';

const html = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__/uma-guide-cm.html'),
  'utf8',
);

describe('parseUmaGuideSchedule', () => {
  const tracks = parseUmaGuideSchedule(html);

  it('extracts the ordered CM list with all fields', () => {
    expect(tracks.length).toBeGreaterThanOrEqual(40);
    for (const t of tracks.slice(0, 5)) {
      expect(t.index).toBeGreaterThan(0);
      expect(t.cupName).toMatch(/Cup$/);
      expect(t.distance).toBeGreaterThanOrEqual(1000);
      expect(['sprint', 'mile', 'medium', 'long']).toContain(t.distanceClass);
      expect(['turf', 'dirt']).toContain(t.surface);
      expect(t.racetrack.length).toBeGreaterThan(0);
    }
  });

  it('#3 is Cancer Cup · Tokyo · 1600m · mile · turf (per the fixture)', () => {
    const c = tracks.find((t) => t.index === 3);
    expect(c).toMatchObject({
      cupName: 'Cancer Cup',
      racetrack: 'Tokyo',
      distance: 1600,
      distanceClass: 'mile',
      surface: 'turf',
    });
  });

  it('contains a Cancer Cup at Hanshin 2200m (the Global CM15 occurrence)', () => {
    expect(
      tracks.some((t) => t.cupName === 'Cancer Cup' && t.racetrack === 'Hanshin' && t.distance === 2200),
    ).toBe(true);
  });
});
