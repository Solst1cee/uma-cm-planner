import { describe, it, expect } from 'vitest';
import { resolveJpSkillDate, type DateEntry } from './jpSkillDate';

const cardDates = new Map<string, DateEntry>([
  ['30275', { date: '2026-09-01', predicted: true }],
  ['30100', { date: '2026-07-15', predicted: false }],
]);
const umaDates = new Map<string, DateEntry>([
  ['100301', { date: '2026-08-10', predicted: true }],
]);

describe('resolveJpSkillDate', () => {
  it('takes the earliest date across card + uma sources', () => {
    // card 30100 (2026-07-15, announced) is earliest → wins
    const r = resolveJpSkillDate(['30275', '30100'], ['100301'], cardDates, umaDates);
    expect(r.releaseDate).toBe('2026-07-15');
    expect(r.predicted).toBe(false);
  });
  it('propagates the predicted flag from the earliest source', () => {
    const r = resolveJpSkillDate(['30275'], ['100301'], cardDates, umaDates);
    // uma 100301 (2026-08-10) is earlier than card 30275 (2026-09-01)
    expect(r.releaseDate).toBe('2026-08-10');
    expect(r.predicted).toBe(true);
  });
  it('prefers an announced source over a predicted one on an equal date', () => {
    const cd = new Map<string, DateEntry>([
      ['a', { date: '2026-07-15', predicted: true }],
      ['b', { date: '2026-07-15', predicted: false }],
    ]);
    const r = resolveJpSkillDate(['a', 'b'], [], cd, new Map());
    expect(r.releaseDate).toBe('2026-07-15');
    expect(r.predicted).toBe(false);
  });
  it('returns undefined when no source resolves to a dated entry', () => {
    const r = resolveJpSkillDate(['999'], ['888'], cardDates, umaDates);
    expect(r.releaseDate).toBeUndefined();
    expect(r.predicted).toBe(false);
  });
  it('handles empty source lists', () => {
    const r = resolveJpSkillDate([], [], cardDates, umaDates);
    expect(r.releaseDate).toBeUndefined();
  });
});
