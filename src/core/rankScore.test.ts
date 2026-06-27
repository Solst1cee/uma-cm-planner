import { describe, expect, it } from 'vitest';
import { rankLabelFromScore, rankLabelsOrdered } from './rankScore';

describe('rankLabelFromScore', () => {
  it('maps the sample dump (rank_score 9347) to B+', () => {
    // Global master.mdb single_mode_rank id 12 = [8200, 9999] = B+.
    expect(rankLabelFromScore(9347)).toBe('B+');
  });

  it('returns a band exactly at its minimum (inclusive lower bound)', () => {
    expect(rankLabelFromScore(0)).toBe('G');
    expect(rankLabelFromScore(8200)).toBe('B+');
    expect(rankLabelFromScore(19200)).toBe('SS+');
    expect(rankLabelFromScore(19600)).toBe('UG');
  });

  it('returns the lower band just below a boundary', () => {
    expect(rankLabelFromScore(8199)).toBe('B'); // one below B+
    expect(rankLabelFromScore(299)).toBe('G');
    expect(rankLabelFromScore(19599)).toBe('SS+'); // just under UG
  });

  it('clamps below 0 / NaN to the lowest rank, and saturates at LS24', () => {
    expect(rankLabelFromScore(-50)).toBe('G');
    expect(rankLabelFromScore(NaN)).toBe('G');
    expect(rankLabelFromScore(190400)).toBe('LS24');
    expect(rankLabelFromScore(9_999_999)).toBe('LS24');
  });

  it('exposes 298 labels matching the icon manifest order (G … LS24)', () => {
    const labels = rankLabelsOrdered();
    expect(labels).toHaveLength(298);
    expect(labels[0]).toBe('G');
    expect(labels.at(-1)).toBe('LS24');
    expect(labels).toContain('UG');
    expect(labels).toContain('SS+');
  });
});
