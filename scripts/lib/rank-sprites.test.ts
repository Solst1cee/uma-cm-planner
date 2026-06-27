import { describe, expect, it } from 'vitest';
import { computeRankSpriteMap, rankIconFilename, rankLabelsOrdered } from './rank-sprites';

describe('computeRankSpriteMap', () => {
  const map = computeRankSpriteMap();

  it('produces all 298 rank badges G → LS24', () => {
    const labels = Object.keys(map);
    expect(labels.length).toBe(298);
    expect(labels[0]).toBe('G');
    expect(labels.at(-1)).toBe('LS24');
  });

  it('keeps the explicit base rectangles for low ranks', () => {
    expect(map.G).toEqual({ x: 7, y: 1893, w: 148, h: 149 });
    expect(map['SS+']).toEqual({ x: 1112, y: 1419, w: 149, h: 149 });
  });

  it('computes high-rank rects from the grid (cell → pixel)', () => {
    // UG = family base, cell [10, 8]: x = 6 + 8*158, y = 155 + (10-1)*158
    expect(map.UG).toEqual({ x: 1270, y: 1577, w: 150, h: 153 });
    // LS24 = LS family idx 24, cell [9, 24]: x = 6 + 24*158, y = 155 + (9-1)*158
    expect(map.LS24).toEqual({ x: 3798, y: 1419, w: 150, h: 153 });
  });

  it('every rect fits inside the 4096×2048 atlas', () => {
    for (const [label, r] of Object.entries(map)) {
      expect(r.x + r.w, label).toBeLessThanOrEqual(4096);
      expect(r.y + r.h, label).toBeLessThanOrEqual(2048);
    }
  });
});

describe('rankLabelsOrdered', () => {
  it('returns labels in ascending-rating order including the +/numbered families', () => {
    const labels = rankLabelsOrdered();
    expect(labels.slice(0, 4)).toEqual(['G', 'G+', 'F', 'F+']);
    expect(labels).toContain('UG9');
    expect(labels).toContain('US');
    expect(labels).toContain('LG');
  });
});

describe('rankIconFilename', () => {
  it('escapes the + suffix and leaves alnum labels untouched', () => {
    expect(rankIconFilename('SS+')).toBe('SS-plus');
    expect(rankIconFilename('G+')).toBe('G-plus');
    expect(rankIconFilename('UG3')).toBe('UG3');
    expect(rankIconFilename('LS24')).toBe('LS24');
  });
});
