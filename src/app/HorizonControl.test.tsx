/**
 * HorizonControl: the header Current | CM ▾ | All JP segmented control +
 * foresight tooltip, and HorizonBanner: the hypothetical-horizon strip.
 * Mocks useAvailability (controllable horizon/futureCms/setHorizon) and
 * useGameData (foresight numbers) rather than a full provider stack.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

const setHorizon = vi.fn();
let mockHorizon: { kind: 'current' } | { kind: 'cm'; cmNumber: number } | { kind: 'allJp' } = {
  kind: 'current',
};
const mockFutureCms = [
  { cmNumber: 16, title: 'Leo Cup', date: '2026-07-30', predicted: false },
  { cmNumber: 17, title: 'Virgo Cup', date: '2026-08-26', predicted: true },
];
let mockForesight: { pace: number; gapDays: number; windowSteps: number } | null = {
  pace: 1.327,
  gapDays: 1441,
  windowSteps: 6,
};

vi.mock('@/app/useAvailability', () => ({
  useAvailability: () => ({
    horizon: mockHorizon,
    setHorizon,
    futureCms: mockFutureCms,
    planCmISO: '2026-07-30',
  }),
}));

vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ foresight: mockForesight }),
}));

import { HorizonBanner, HorizonControl } from '@/app/HorizonControl';

afterEach(cleanup);

beforeEach(() => {
  mockHorizon = { kind: 'current' };
  mockForesight = { pace: 1.327, gapDays: 1441, windowSteps: 6 };
  setHorizon.mockClear();
});

describe('HorizonControl', () => {
  it('renders Current | CM | All JP and switches', () => {
    render(<HorizonControl />);
    expect(screen.getByRole('button', { name: /current/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all jp/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /all jp/i }));
    expect(setHorizon).toHaveBeenCalledWith({ kind: 'allJp' });
  });

  it('CM segment opens the future-CM dropdown and picks one', () => {
    render(<HorizonControl />);
    fireEvent.click(screen.getByRole('button', { name: /^cm$/i }));
    expect(screen.getByText(/16 Leo Cup · 2026-07-30/)).toBeInTheDocument();
    expect(screen.getByText(/17 Virgo Cup · ~2026-08-26/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/17 Virgo Cup · ~2026-08-26/));
    expect(setHorizon).toHaveBeenCalledWith({ kind: 'cm', cmNumber: 17 });
  });

  it('foresight tooltip carries pace and gap', () => {
    render(<HorizonControl />);
    const help = screen.getByTitle(/1441/);
    expect(help.getAttribute('title')).toContain('1441');
    expect(help.getAttribute('title')).toContain('1.33');
  });

  it('foresight tooltip falls back when calibration is unavailable', () => {
    mockForesight = null;
    render(<HorizonControl />);
    expect(screen.getByTitle(/projection unavailable/i)).toBeInTheDocument();
  });
});

describe('HorizonBanner', () => {
  it('is absent for the current horizon', () => {
    mockHorizon = { kind: 'current' };
    render(<HorizonBanner />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('allJp shows the hypothetical banner naming the plan CM', () => {
    mockHorizon = { kind: 'allJp' };
    render(<HorizonBanner />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Hypothetical .* not achievable/i);
  });
});
