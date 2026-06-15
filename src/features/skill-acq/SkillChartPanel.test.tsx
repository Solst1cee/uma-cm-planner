import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { BashinStats, SimBuild, SimRaceParams } from '@/sim';
import type { CmPlan, SkillRecord } from '@/core/types';
import { FIXTURE_SPARK_RATES } from '@/core/fixtures';
import { SkillChartPanel } from './SkillChartPanel';

const skills: SkillRecord[] = [
  { skillId: 'a', nameEn: 'Escape Artist', nameJp: '', baseSpCost: 240, rarity: 'white', iconId: '1', conditions: 'phase>=1', server: 'global', dataVersion: 't' },
  { skillId: 'g', nameEn: 'Victory Cheer', nameJp: '', baseSpCost: 360, rarity: 'gold', iconId: '1', conditions: '', server: 'global', dataVersion: 't' },
  { skillId: 'n', nameEn: 'Weird Skill', nameJp: '', baseSpCost: 120, rarity: 'white', iconId: '1', conditions: '', server: 'global', dataVersion: 't' },
  { skillId: 'jp', nameEn: 'JP Only', nameJp: '', baseSpCost: 100, rarity: 'white', iconId: '1', conditions: '', server: 'jp', dataVersion: 't' },
];
vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ skills, skillById: new Map(skills.map((s) => [s.skillId, s])), sparkRates: FIXTURE_SPARK_RATES }),
}));
afterEach(cleanup);

const S = (m: number, n = 200): BashinStats => ({ mean: m, median: m, min: m, max: m, nsamples: n, results: [] });
const dep = (_b: SimBuild, _r: SimRaceParams, id: string): BashinStats =>
  ({ a: S(2.1), g: S(1.4), n: S(0, 0) }[id] ?? S(0));

function plan(): CmPlan {
  return { id: 'p', name: 'p', planNumber: 1, cmRef: { cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
    umaId: '', uniqueSkillId: '', role: 'ace', strategy: 'pace', statProfile: { stats: { spd: 1, sta: 1, pow: 1, gut: 1, wit: 1 }, mood: 0 },
    sparkGoals: { pink: [], blue: {} }, wishlist: [], lockedDeckSlots: [], parents: {}, patch: { version: 't' }, server: 'global', dataVersion: 't' } as CmPlan;
}

describe('SkillChartPanel', () => {
  it('ranks live skills, hides dead/na by default, never shows JP (P4)', async () => {
    render(<SkillChartPanel plan={plan()} onChange={vi.fn()} deps={{ skillDelta: dep, nsamples: 10 }} />);
    await waitFor(() => expect(screen.getByText('Escape Artist')).toBeInTheDocument());
    expect(screen.getByText('Victory Cheer')).toHaveClass('sk-gold');
    expect(screen.queryByText('Weird Skill')).not.toBeInTheDocument(); // n/a hidden by default
    expect(screen.queryByText('JP Only')).not.toBeInTheDocument();     // P4 excluded from catalog
  });

  it('reveals n/a skills when "show every skill" is toggled on', async () => {
    const user = userEvent.setup();
    render(<SkillChartPanel plan={plan()} onChange={vi.fn()} deps={{ skillDelta: dep, nsamples: 10 }} />);
    await waitFor(() => expect(screen.getByText('Escape Artist')).toBeInTheDocument());
    await user.click(screen.getByLabelText('Show every skill'));
    expect(screen.getByText('Weird Skill')).toBeInTheDocument();
    expect(screen.getByText('n/a')).toBeInTheDocument();
  });

  it('adds a skill to the wishlist via + target', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SkillChartPanel plan={plan()} onChange={onChange} deps={{ skillDelta: dep, nsamples: 10 }} />);
    await waitFor(() => expect(screen.getByText('Escape Artist')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Add Escape Artist' }));
    expect(onChange.mock.lastCall![0].wishlist).toContainEqual(expect.objectContaining({ skillId: 'a', priority: 1, source: 'targeted' }));
  });
});
