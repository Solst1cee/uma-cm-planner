import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';
import { useSkillChart } from './useSkillChart';

afterEach(cleanup);
const S = (m: number, n = 200): BashinStats => ({ mean: m, median: m, min: m, max: m, nsamples: n, results: [] });

function Probe({ dep }: { dep: (b: SimBuild, r: SimRaceParams, id: string, n: number) => BashinStats }) {
  const build = { umaId: '', stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 }, strategy: 'pace',
    aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, skills: [] } as SimBuild;
  const race = { courseId: '10906' } as SimRaceParams;
  const { rows, status, done, total } = useSkillChart(build, race, ['a', 'b', 'c'], { skillDelta: dep, nsamples: 10 });
  return <div><span data-testid="status">{status}</span><span data-testid="prog">{done}/{total}</span>
    <ol>{rows.map((r) => <li key={r.skillId}>{r.skillId}:{r.L ?? 'na'}</li>)}</ol></div>;
}

describe('useSkillChart', () => {
  it('streams rows and finishes sorted by L', async () => {
    const dep = vi.fn((_b, _r, id: string) => ({ a: S(0.5), b: S(2.0), c: S(0.9) }[id]!));
    render(<Probe dep={dep} />);
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('done'));
    expect(screen.getByTestId('prog')).toHaveTextContent('3/3');
    const order = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(order).toEqual(['b:2', 'c:0.9', 'a:0.5']);
  });
});
