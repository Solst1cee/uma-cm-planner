import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MiniSimTab } from './MiniSimTab';
import type { RaceCompareController } from './useRaceCompareController';
import type { RaceCompareState } from './useRaceCompare';

afterEach(cleanup);

const idleState: RaceCompareState = {
  status: 'idle', run: null, runChoice: 'median', setRunChoice: vi.fn(), distance: 0, meanBashin: null,
};
const doneState = (meanBashin: number): RaceCompareState => ({
  status: 'done',
  run: { uma1Frames: [], uma2Frames: [], uma1Acts: [], uma2Acts: [], gap: [] },
  runChoice: 'median', setRunChoice: vi.fn(), distance: 1200, meanBashin,
});

const ctl = (over: Partial<RaceCompareController> = {}): RaceCompareController => ({
  showHp: true, setShowHp: vi.fn(), state: idleState, comparing: false, uma2Empty: false, ...over,
});

describe('MiniSimTab', () => {
  it('prompts to fill uma2 when empty', () => {
    render(<MiniSimTab ctl={ctl({ uma2Empty: true })} />);
    expect(screen.getByText(/load or duplicate a uma2/i)).toBeInTheDocument();
  });

  it('does not show the empty prompt when uma2 is set', () => {
    render(<MiniSimTab ctl={ctl({ uma2Empty: false })} />);
    expect(screen.queryByText(/load or duplicate a uma2/i)).toBeNull();
  });

  it('shows the Show HP checkbox when uma2 is set', () => {
    render(<MiniSimTab ctl={ctl({ uma2Empty: false })} />);
    expect(screen.getByRole('checkbox', { name: /show hp/i })).toBeInTheDocument();
  });

  it('calls setShowHp when the checkbox changes', () => {
    const setShowHp = vi.fn();
    render(<MiniSimTab ctl={ctl({ uma2Empty: false, showHp: true, setShowHp })} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /show hp/i }));
    expect(setShowHp).toHaveBeenCalledWith(false);
  });

  it('shows the mean バ身 headline when comparing + done', () => {
    render(
      <MiniSimTab ctl={ctl({ comparing: true, uma2Empty: false, state: doneState(2.5) })} />,
    );
    expect(screen.getByText(/バ身/)).toBeInTheDocument();
    expect(screen.getByText(/\+2\.50/)).toBeInTheDocument();
  });

  it('shows negative バ身 without a + prefix', () => {
    render(
      <MiniSimTab ctl={ctl({ comparing: true, uma2Empty: false, state: doneState(-1.23) })} />,
    );
    expect(screen.getByText(/-1\.23 バ身/)).toBeInTheDocument();
  });

  it('shows Simulating… when status is running', () => {
    render(
      <MiniSimTab
        ctl={ctl({
          comparing: true,
          uma2Empty: false,
          state: { ...idleState, status: 'running' },
        })}
      />,
    );
    expect(screen.getByText(/simulating/i)).toBeInTheDocument();
  });

  it('shows not-simulatable message when status is na', () => {
    render(
      <MiniSimTab
        ctl={ctl({
          comparing: true,
          uma2Empty: false,
          state: { ...idleState, status: 'na' },
        })}
      />,
    );
    expect(screen.getByText(/not simulatable/i)).toBeInTheDocument();
  });

  it('shows the caveat when comparing', () => {
    render(<MiniSimTab ctl={ctl({ comparing: true, uma2Empty: false })} />);
    expect(screen.getByText(/vacuum run/i)).toBeInTheDocument();
  });

  it('does not show the caveat when not comparing', () => {
    render(<MiniSimTab ctl={ctl({ comparing: false, uma2Empty: false })} />);
    expect(screen.queryByText(/vacuum run/i)).toBeNull();
  });
});
