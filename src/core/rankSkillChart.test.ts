import { describe, expect, it, vi } from 'vitest';
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';
import { rankSkillChart, DEAD_L } from './rankSkillChart';

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
});
