import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/features/data/GameIcon', () => ({
  GameIcon: () => <span data-testid="game-icon" />,
}));

import { RaceSimCard } from './RaceSimCard';
import type { RaceCompareController } from './useRaceCompareController';
import type { CmPlan } from '@/core/types';
import { makeDefaultPlan } from '@/app/ActivePlanContext';
import type { RaceCompareState } from './useRaceCompare';

afterEach(cleanup);

const other = { ...makeDefaultPlan(), id: 'B', name: 'Rival B' } as CmPlan;
const idleState: RaceCompareState = {
  status: 'idle', run: null, runChoice: 'median', setRunChoice: vi.fn(), distance: 0, meanBashin: null,
};
const doneState = (meanBashin: number): RaceCompareState => ({
  status: 'done', run: { uma1Frames: [], uma2Frames: [], uma1Acts: [], uma2Acts: [], gap: [] },
  runChoice: 'median', setRunChoice: vi.fn(), distance: 1200, meanBashin,
});
const ctl = (over: Partial<RaceCompareController> = {}): RaceCompareController => ({
  uma2Id: '', setUma2Id: vi.fn(), showHp: true, setShowHp: vi.fn(),
  others: [other], state: idleState, comparing: false, ...over,
});

describe('RaceSimCard', () => {
  it('opens an inventory-style popover and selects a plan', () => {
    const setUma2Id = vi.fn();
    render(<RaceSimCard ctl={ctl({ setUma2Id })} />);
    expect(screen.queryByText('Rival B')).toBeNull(); // closed initially
    fireEvent.click(screen.getByLabelText(/compare against/i)); // toggle the popover open
    expect(screen.getByText('Rival B')).toBeTruthy();
    fireEvent.click(screen.getByText('Rival B'));
    expect(setUma2Id).toHaveBeenCalledWith('B');
  });

  it('prompts to pick a plan and shows no headline before comparing', () => {
    render(<RaceSimCard ctl={ctl()} />);
    expect(screen.getByText(/pick a saved plan/i)).toBeTruthy();
    expect(screen.queryByText(/バ身/)).toBeNull();
  });

  it('shows the mean バ身 headline + HP toggle once comparing', () => {
    render(<RaceSimCard ctl={ctl({ comparing: true, uma2Id: 'B', state: doneState(2.5) })} />);
    const headline = screen.getByText(/バ身/);
    expect(headline.textContent).toMatch(/\+2\.50/);
    expect(screen.getByText(/show hp/i)).toBeTruthy();
  });
});
