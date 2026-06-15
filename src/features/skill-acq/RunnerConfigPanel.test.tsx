/** Runner config: stat edits, strategy segmented control, mood, target aptitudes. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { CmPlan } from '@/core/types';
import { simAptitudes } from '@/core/simBuild';
import { RunnerConfigPanel } from '@/features/skill-acq/RunnerConfigPanel';

function plan(over: Partial<CmPlan> = {}): CmPlan {
  return {
    id: 'p', name: 'p', planNumber: 1,
    cmRef: { cmId: 'CM15', cmNumber: 15, courseId: '10906', surface: 'turf', distance: 2200 },
    umaId: '100101', uniqueSkillId: '', role: 'ace', strategy: 'pace',
    statProfile: { stats: { spd: 1200, sta: 900, pow: 800, gut: 400, wit: 600 }, mood: 0 },
    sparkGoals: { pink: [], blue: {} }, wishlist: [], lockedDeckSlots: [], parents: {},
    patch: { version: 't' }, server: 'global', dataVersion: 't', ...over,
  } as CmPlan;
}

afterEach(cleanup);

function renderPanel(p: CmPlan = plan()) {
  const onChange = vi.fn<(next: CmPlan) => void>();
  render(<RunnerConfigPanel plan={p} onChange={onChange} />);
  return onChange;
}

describe('RunnerConfigPanel', () => {
  it('edits a stat', () => {
    // Controlled input + a plain vi.fn onChange (no re-render with the new
    // value), so emit a single change event rather than per-keystroke typing.
    const onChange = renderPanel();
    fireEvent.change(screen.getByLabelText('Speed'), { target: { value: '1234' } });
    expect(onChange.mock.lastCall![0].statProfile.stats.spd).toBe(1234);
  });

  it('sets strategy', async () => {
    const user = userEvent.setup();
    const onChange = renderPanel();
    await user.click(screen.getByRole('button', { name: 'Front' }));
    expect(onChange.mock.lastCall![0].strategy).toBe('front');
  });

  it('sets mood', async () => {
    const user = userEvent.setup();
    const onChange = renderPanel();
    await user.selectOptions(screen.getByLabelText('Mood'), '2');
    expect(onChange.mock.lastCall![0].statProfile.mood).toBe(2);
  });

  it('sets a target aptitude', async () => {
    const user = userEvent.setup();
    const onChange = renderPanel();
    await user.selectOptions(screen.getByLabelText('Distance aptitude'), 'S');
    expect(simAptitudes(onChange.mock.lastCall![0]).distance).toBe('S');
  });
});
