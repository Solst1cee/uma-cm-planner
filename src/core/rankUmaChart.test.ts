import { describe, expect, it, vi } from 'vitest';
import type { BashinStats, SimBuild } from '@/sim';
import { rankUmaChart, REFERENCE_STATS, type UmaChartCandidate } from './rankUmaChart';

const bs = (mean: number, nsamples = 30): BashinStats => ({
  mean,
  median: mean,
  min: mean,
  max: mean,
  nsamples,
  results: [],
});

// skillDelta keyed by (uniqueSkillId -> per-strategy mean L)
function deltaFrom(table: Record<string, Partial<Record<SimBuild['strategy'], number>>>) {
  return vi.fn(async (b: SimBuild, _r, id: string, _n, _s) => {
    const v = table[id]?.[b.strategy];
    if (v === undefined) return bs(0, 0); // engine "can't evaluate" this style
    return bs(v);
  });
}

describe('rankUmaChart', () => {
  const race = { courseId: '10906' };

  it('ranks by best (max) L across styles and records the winning style + per-style values', async () => {
    const skillDelta = deltaFrom({
      uA: { front: 0.4, pace: 0.4, late: 0.4, end: 2.0 }, // end-closer unique
      uB: { front: 1.2, pace: 0.9, late: 0.1, end: 0.0 }, // front unique
    });
    const cands: UmaChartCandidate[] = [
      { outfitId: 'A', uniqueSkillId: 'uA' },
      { outfitId: 'B', uniqueSkillId: 'uB' },
    ];
    const rows = await rankUmaChart(cands, race, { skillDelta, seed: 1 });
    expect(rows.map((r) => r.outfitId)).toEqual(['A', 'B']); // A's 2.0 > B's 1.2
    expect(rows[0]).toMatchObject({ outfitId: 'A', bestStrategy: 'end', status: 'live' });
    expect(rows[0]!.L).toBeCloseTo(2.0);
    expect(rows[0]!.perStyle).toHaveLength(4);
    expect(rows[1]).toMatchObject({ outfitId: 'B', bestStrategy: 'front' });
    // every style was simmed once per uma
    expect(skillDelta).toHaveBeenCalledTimes(8);
    // reference stats are passed unchanged
    expect(skillDelta.mock.calls[0]![0].stats).toEqual(REFERENCE_STATS);
  });

  it('returns na (without simming) when the uma has no unique', async () => {
    const skillDelta = deltaFrom({});
    const rows = await rankUmaChart([{ outfitId: 'X', uniqueSkillId: null }], race, { skillDelta });
    expect(rows[0]).toMatchObject({ status: 'na', L: null, bestStrategy: null });
    expect(skillDelta).not.toHaveBeenCalled();
  });

  it('skips a throwing style but still counts the others', async () => {
    const skillDelta = vi.fn(async (b: SimBuild) => {
      if (b.strategy === 'front') throw new Error('firstPositionInLateRace');
      return bs(b.strategy === 'end' ? 1.5 : 0.5);
    });
    const rows = await rankUmaChart([{ outfitId: 'A', uniqueSkillId: 'uA' }], race, { skillDelta });
    expect(rows[0]!.perStyle).toHaveLength(3); // front dropped
    expect(rows[0]).toMatchObject({ bestStrategy: 'end', status: 'live' });
  });

  it('is na when every style throws / cannot evaluate', async () => {
    const skillDelta = vi.fn(async () => {
      throw new Error('nope');
    });
    const rows = await rankUmaChart([{ outfitId: 'A', uniqueSkillId: 'uA' }], race, { skillDelta });
    expect(rows[0]).toMatchObject({ status: 'na', L: null });
  });

  it('classifies a best L <= DEAD_L as zero, and sorts na last', async () => {
    const skillDelta = deltaFrom({ low: { front: 0.05, pace: 0.0, late: 0.0, end: 0.0 } });
    const rows = await rankUmaChart(
      [
        { outfitId: 'Z', uniqueSkillId: null },
        { outfitId: 'L', uniqueSkillId: 'low' },
      ],
      race,
      { skillDelta },
    );
    expect(rows.map((r) => r.outfitId)).toEqual(['L', 'Z']); // zero ranks above na
    expect(rows[0]).toMatchObject({ outfitId: 'L', status: 'zero' });
    expect(rows[1]).toMatchObject({ outfitId: 'Z', status: 'na' });
  });

  it('streams one row per uma via onRow', async () => {
    const skillDelta = deltaFrom({ uA: { end: 1 }, uB: { front: 1 } });
    const seen: string[] = [];
    await rankUmaChart(
      [
        { outfitId: 'A', uniqueSkillId: 'uA' },
        { outfitId: 'B', uniqueSkillId: 'uB' },
      ],
      race,
      { skillDelta },
      (row) => seen.push(row.outfitId),
    );
    expect(seen).toEqual(['A', 'B']);
  });
});
