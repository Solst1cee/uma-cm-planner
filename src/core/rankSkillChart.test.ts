import { describe, expect, it, vi } from 'vitest';
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';
import { rankSkillChart, compareSkillChartRows, DEAD_L } from './rankSkillChart';

const build = {} as SimBuild;
const race = { courseId: '10906' } as SimRaceParams;
function stats(mean: number, nsamples = 200): BashinStats {
  return { mean, median: mean, min: mean, max: mean, nsamples, results: [] };
}

describe('rankSkillChart', () => {
  it('ranks live skills by L desc, flags 0 L vs n/a, sorts dead/na last', async () => {
    const deltas: Record<string, BashinStats> = {
      a: stats(2.1), b: stats(0.4), z: stats(0.02), n: stats(0, 0), // n = nsamples 0 → n/a
    };
    const dep = vi.fn((_b, _r, id: string) => deltas[id]!);
    const rows = await rankSkillChart(build, race, ['z', 'a', 'n', 'b'], { skillDelta: dep, nsamples: 200 });
    expect(rows.map((r) => r.skillId)).toEqual(['a', 'b', 'z', 'n']);
    expect(rows[0]).toMatchObject({ skillId: 'a', status: 'live', L: 2.1 });
    expect(rows.find((r) => r.skillId === 'z')).toMatchObject({ status: 'zero', L: 0.02 });
    expect(rows.find((r) => r.skillId === 'n')).toMatchObject({ status: 'na', L: null });
  });

  it('streams progress via onRow as each skill resolves', async () => {
    const dep = vi.fn(() => stats(1));
    const seen: string[] = [];
    await rankSkillChart(build, race, ['a', 'b'], { skillDelta: dep, nsamples: 50 }, (row) => seen.push(row.skillId));
    expect(seen.sort()).toEqual(['a', 'b']);
  });

  it('DEAD_L threshold is 0.1', () => { expect(DEAD_L).toBe(0.1); });

  it('treats a skill the engine throws on as n/a, without crashing the stream', async () => {
    const dep = vi.fn((_b, _r, id: string) => {
      if (id === 'boom') throw new Error('Cannot set properties of undefined');
      return stats(1.5);
    });
    const rows = await rankSkillChart(build, race, ['a', 'boom', 'b'], { skillDelta: dep, nsamples: 10 });
    expect(rows.find((r) => r.skillId === 'boom')).toMatchObject({ status: 'na', L: null });
    expect(rows.filter((r) => r.status === 'live').map((r) => r.skillId).sort()).toEqual(['a', 'b']);
  });

  it('carries the engine distribution (min/max/median) on live rows; null on n/a', async () => {
    const dep = vi.fn((_b: SimBuild, _r: SimRaceParams, id: string): BashinStats =>
      id === 'n'
        ? { mean: 0, median: 0, min: 0, max: 0, nsamples: 0, results: [] }
        : { mean: 1.5, median: 1.4, min: 0.9, max: 2.2, nsamples: 30, results: [] },
    );
    const rows = await rankSkillChart(build, race, ['a', 'n'], { skillDelta: dep, nsamples: 30 });
    expect(rows.find((r) => r.skillId === 'a')).toMatchObject({ min: 0.9, max: 2.2, median: 1.4 });
    expect(rows.find((r) => r.skillId === 'n')).toMatchObject({ min: null, max: null, median: null });
  });

  it('stops early when shouldContinue() returns false', async () => {
    const seen: string[] = [];
    const dep = vi.fn((_b: SimBuild, _r: SimRaceParams, id: string): BashinStats => {
      seen.push(id);
      return stats(1);
    });
    await rankSkillChart(build, race, ['a', 'b', 'c'], { skillDelta: dep, nsamples: 10 }, undefined, () => seen.length < 2);
    expect(seen).toEqual(['a', 'b']); // 'c' never evaluated
  });

  it('compareSkillChartRows is NaN-safe when both rows are n/a', () => {
    const na = { skillId: 'x', L: null, min: null, max: null, median: null, status: 'na' as const, nsamples: 0 };
    expect(Number.isNaN(compareSkillChartRows(na, { ...na, skillId: 'y' }))).toBe(false);
  });
});
