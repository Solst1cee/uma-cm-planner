import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/features/data/gameData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/data/gameData')>();
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { ...actual, useGameData: () => ({ ...fixtureGameData(), status: 'ready' as const }) };
});

import { BuildSpCard, type BuildSpCardProps } from '@/features/sp-optimizer/BuildSpCard';

afterEach(cleanup);
const ctx = {
  umaId: '100101', stats: { spd: 1240, sta: 720, pow: 940, gut: 480, wit: 660 },
  aptitudes: { distance: 'A' as const, surface: 'A' as const, strategy: 'A' as const },
  strategy: 'pace' as const, courseId: '10906', spBudget: 2400, ownedSkills: [], pinned: [], candidates: [],
};

function makeProps(overrides: Partial<BuildSpCardProps> = {}): BuildSpCardProps {
  return {
    context: ctx, source: 'memory',
    onImportFile: () => {}, onCarryFromM4: () => {}, onSpChange: () => {},
    matchSummary: null,
    ...overrides,
  };
}

describe('BuildSpCard', () => {
  it('renders the stat line and editable SP, and reports SP edits', () => {
    const onSpChange = vi.fn();
    render(<BuildSpCard {...makeProps({ onSpChange })} />);
    expect(screen.getByText(/SPD 1240/)).toBeInTheDocument();
    const sp = screen.getByLabelText('Available SP');
    fireEvent.change(sp, { target: { value: '2000' } });
    expect(onSpChange).toHaveBeenLastCalledWith(2000);
  });
  it('Import segment opens the in-card file picker and reports the chosen file', async () => {
    const onImportFile = vi.fn();
    render(<BuildSpCard {...makeProps({ onImportFile })} />);
    const fileInput = screen.getByLabelText<HTMLInputElement>(/Import capture/i);
    const click = vi.spyOn(fileInput, 'click');
    await userEvent.click(screen.getByRole('button', { name: /Import/i }));
    expect(click).toHaveBeenCalled();
    const file = new File(['{}'], 'capture.json', { type: 'application/json' });
    await userEvent.upload(fileInput, file);
    expect(onImportFile).toHaveBeenCalledWith(file);
  });
  it('Carry from M4 segment fires its action and honors carryDisabled', async () => {
    const onCarryFromM4 = vi.fn();
    const { unmount } = render(<BuildSpCard {...makeProps({ onCarryFromM4 })} />);
    await userEvent.click(screen.getByRole('button', { name: /Carry from M4/i }));
    expect(onCarryFromM4).toHaveBeenCalledOnce();
    unmount();
    render(<BuildSpCard {...makeProps({ onCarryFromM4, carryDisabled: true })} />);
    expect(screen.getByRole('button', { name: /Carry from M4/i })).toBeDisabled();
  });
  it('renders with context={null} without crashing', () => {
    render(<BuildSpCard {...makeProps({ context: null })} />);
    const sp = screen.getByLabelText('Available SP');
    expect(sp).toHaveValue(0);
    expect(screen.queryByText(/SPD/)).not.toBeInTheDocument();
  });
  it('has aria-pressed on the active segmented control button', () => {
    render(<BuildSpCard {...makeProps()} />);
    const importBtn = screen.getByRole('button', { name: /Import/i });
    const manualBtn = screen.getByRole('button', { name: /Manual/i });
    expect(importBtn).toHaveAttribute('aria-pressed', 'true');
    expect(manualBtn).toHaveAttribute('aria-pressed', 'false');
  });
  it('renders match-summary chips when provided', () => {
    const matchSummary = { locked: ['100001', '100002'], matched: 3, notBuyable: 1 };
    render(<BuildSpCard {...makeProps({ matchSummary })} />);
    expect(screen.getByText(/🔒 100001/)).toBeInTheDocument();
    expect(screen.getByText(/🔒 100002/)).toBeInTheDocument();
    expect(screen.getByText(/3 matched/)).toBeInTheDocument();
    expect(screen.getByText(/1 not yet buyable/)).toBeInTheDocument();
  });
  it('does not render match-summary chips when null', () => {
    render(<BuildSpCard {...makeProps()} />);
    expect(screen.queryByText(/🔒/)).not.toBeInTheDocument();
    expect(screen.queryByText(/matched/)).not.toBeInTheDocument();
  });
});
