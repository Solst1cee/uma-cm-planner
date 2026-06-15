import { describe, expect, it } from 'vitest';
import type { SkillRecord } from '@/core/types';
import {
  activationAnchor,
  activationBands,
  DEFAULT_BAND_WIDTH_M,
  pctOf,
  skillConditionToBand,
  trackSegments,
  type CourseGeometry,
} from './track';

// Real geometry for course 10906 (Hanshin turf 2200m = CM15 Cancer Cup),
// verified from the vendored engine's coursesService.getSimCourse.
const HANSHIN_2200: CourseGeometry = {
  distance: 2200,
  turn: 1,
  corners: [
    { start: 520, length: 190 },
    { start: 710, length: 190 },
    { start: 1250, length: 300 },
    { start: 1550, length: 300 },
  ],
  straights: [
    { start: 0, end: 520 },
    { start: 900, end: 1250 },
    { start: 1850, end: 2200 },
  ],
  slopes: [
    { start: 0, length: 290, slope: -10000 },
    { start: 295, length: 125, slope: 20000 },
    { start: 1400, length: 595, slope: -10000 },
    { start: 2000, length: 125, slope: 20000 },
  ],
};

function skill(
  over: Partial<SkillRecord> & { skillId: string; nameEn: string; conditions: string },
): SkillRecord {
  return {
    nameJp: '',
    baseSpCost: 0,
    rarity: 'white',
    iconId: '',
    server: 'global',
    dataVersion: 't',
    ...over,
  } as SkillRecord;
}

describe('pctOf', () => {
  it('converts metres to a percentage of course distance', () => {
    expect(pctOf(1100, 2200)).toBe(50);
    expect(pctOf(0, 2200)).toBe(0);
    expect(pctOf(2200, 2200)).toBe(100);
  });
  it('clamps to 0..100', () => {
    expect(pctOf(3000, 2200)).toBe(100);
    expect(pctOf(-50, 2200)).toBe(0);
  });
});

describe('trackSegments', () => {
  const segs = trackSegments(HANSHIN_2200);
  it('partitions the course into ordered straight/corner segments', () => {
    expect(segs.map((s) => s.kind)).toEqual([
      'straight',
      'corner',
      'corner',
      'straight',
      'corner',
      'corner',
      'straight',
    ]);
  });
  it('starts at 0 and widths sum to ~100%', () => {
    expect(segs[0]!.startPct).toBe(0);
    const total = segs.reduce((sum, s) => sum + s.widthPct, 0);
    expect(total).toBeCloseTo(100, 5);
  });
  it('has monotonically increasing start positions', () => {
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i]!.startPct).toBeGreaterThan(segs[i - 1]!.startPct);
    }
  });
  it('places the first corner at 520m', () => {
    expect(segs[1]).toMatchObject({ kind: 'corner', startPct: pctOf(520, 2200) });
  });
});

describe('activationAnchor', () => {
  it('reads the distance_rate lower bound as a position', () => {
    expect(activationAnchor('distance_rate>=50&distance_rate<=60&order_rate>50', HANSHIN_2200)).toBe(1100);
  });
  it('maps is_finalcorner to the last corner start', () => {
    expect(activationAnchor('is_finalcorner==1&order_rate>50', HANSHIN_2200)).toBe(1550);
  });
  it('maps phase>=2 / last spurt to two-thirds of the course', () => {
    expect(activationAnchor('phase>=2', HANSHIN_2200)).toBeCloseTo((2200 * 2) / 3, 5);
    expect(activationAnchor('is_lastspurt==1', HANSHIN_2200)).toBeCloseTo((2200 * 2) / 3, 5);
  });
  it('maps remain_distance to distance-from-finish', () => {
    expect(activationAnchor('remain_distance<=400', HANSHIN_2200)).toBe(1800);
  });
  it('maps a plain corner condition to the first corner start', () => {
    expect(activationAnchor('corner==1', HANSHIN_2200)).toBe(520);
  });
  it('returns null when no positional token is present', () => {
    expect(activationAnchor('order>=3&accumulatetime>=10', HANSHIN_2200)).toBeNull();
  });
});

describe('skillConditionToBand', () => {
  it('anchors the band at the parsed start with an approximate fixed width', () => {
    const band = skillConditionToBand(
      skill({ skillId: '100', nameEn: 'Escape Artist', conditions: 'distance_rate>=50' }),
      HANSHIN_2200,
      { isUnique: false },
    );
    expect(band).toMatchObject({
      skillId: '100',
      label: 'Escape Artist',
      isUnique: false,
      approximate: true,
      startPct: 50,
      widthPct: pctOf(DEFAULT_BAND_WIDTH_M, 2200),
    });
  });
  it('falls back to the start of the track when conditions have no position', () => {
    const band = skillConditionToBand(
      skill({ skillId: '101', nameEn: 'Mystery', conditions: 'order>=3' }),
      HANSHIN_2200,
      { isUnique: false },
    );
    expect(band.startPct).toBe(0);
    expect(band.approximate).toBe(true);
  });
});

describe('activationBands', () => {
  const skillById = new Map<string, SkillRecord>([
    ['u', skill({ skillId: 'u', nameEn: 'Victory Cheer!', conditions: 'phase>=2' })],
    ['a', skill({ skillId: 'a', nameEn: 'Escape Artist', conditions: 'distance_rate>=50' })],
    ['b', skill({ skillId: 'b', nameEn: 'Corner Recovery', conditions: 'corner==1' })],
  ]);

  it('always includes the unique plus every wishlist skill', () => {
    const bands = activationBands(['a', 'b'], 'u', HANSHIN_2200, skillById);
    expect(bands.map((bnd) => bnd.skillId).sort()).toEqual(['a', 'b', 'u']);
    expect(bands.find((bnd) => bnd.skillId === 'u')!.isUnique).toBe(true);
  });
  it('shows the unique even with an empty wishlist', () => {
    const bands = activationBands([], 'u', HANSHIN_2200, skillById);
    expect(bands).toHaveLength(1);
    expect(bands[0]!.skillId).toBe('u');
  });
  it('dedupes when the unique is also wishlisted', () => {
    const bands = activationBands(['u', 'a'], 'u', HANSHIN_2200, skillById);
    expect(bands.filter((bnd) => bnd.skillId === 'u')).toHaveLength(1);
  });
  it('skips ids missing from the skill map', () => {
    const bands = activationBands(['a', 'ghost'], undefined, HANSHIN_2200, skillById);
    expect(bands.map((bnd) => bnd.skillId)).toEqual(['a']);
  });
});
