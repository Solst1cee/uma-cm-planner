// src/features/inheritance/InheritanceCard.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan, Parent } from '@/core/types';
import { InheritanceCard } from './InheritanceCard';

const ROSTER: Parent[] = [
  { id: 'a', umaId: '101501', blueSpark: { stat: 'spd', stars: 3 }, pinkSpark: { aptitude: 'long', stars: 3 }, whiteSparks: [], source: 'mine' },
  { id: 'b', umaId: '100601', blueSpark: { stat: 'sta', stars: 1 }, pinkSpark: { aptitude: 'mile', stars: 1 }, whiteSparks: [], source: 'mine' },
];
const setPlan = vi.fn();
const plan = {
  id: 'p1', parents: {}, sparkGoals: { blue: { spd: 3 }, pink: [{ aptKey: { kind: 'distance', key: 'long' }, target: 'A' }] },
} as unknown as CmPlan;
// Mutable so a test can simulate uma1Plan loading from null → set (read lazily in the factory).
let activePlan: CmPlan | null = plan;

vi.mock('@/app/ActivePlanContext', () => ({ useActivePlan: () => ({ uma1Plan: activePlan, setPlan }) }));
vi.mock('./useRoster', () => ({ useRoster: () => ({ roster: ROSTER, importedAt: '2026-06-26T10:00:00.000Z', importFromFile: vi.fn() }) }));
vi.mock('@/features/parents/useUmas', () => ({ useUmas: () => ({ umas: [], umaById: new Map() }), umaName: (_m: unknown, id: string) => `Uma ${id}` }));
vi.mock('@/features/data/GameIcon', () => ({ GameIcon: () => null }));
vi.mock('./UploadDataButton', () => ({ UploadDataButton: () => null }));
vi.mock('./useAffinityIndex', () => ({ useAffinityIndex: () => null }));
vi.mock('@/features/data/gameData', () => ({ useGameData: () => ({ skills: [], skillById: new Map() }) }));

afterEach(() => { cleanup(); setPlan.mockClear(); activePlan = plan; });

describe('InheritanceCard', () => {
  it('survives uma1Plan loading from null → set without a hooks-order error', () => {
    activePlan = null;
    const { rerender } = render(<InheritanceCard />);
    expect(screen.queryByText('Inheritance')).not.toBeInTheDocument(); // null plan → renders nothing
    activePlan = plan;
    rerender(<InheritanceCard />); // all hooks run before the null-guard, so no "rendered more hooks" crash
    expect(screen.getByText('Inheritance')).toBeInTheDocument();
  });

  it('ranks candidates and persists a pick to plan.parents.a', () => {
    render(<InheritanceCard />);
    expect(screen.getByText(/Updated 2026-06-26/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /find candidates/i })[0]!);
    // top candidate is 'a' (spd 3 + long 3 = 6); click it
    fireEvent.click(screen.getByRole('button', { name: /Uma 101501/i }));
    expect(setPlan).toHaveBeenCalledWith(expect.objectContaining({ parents: { a: 'a' } }));
  });

  it('switches Parent 2 to a rental stub', () => {
    render(<InheritanceCard />);
    fireEvent.click(screen.getByRole('switch', { name: /rental/i }));
    expect(screen.getByText(/coming in m1\.4b/i)).toBeInTheDocument();
  });

  it('opens the picker modal on Change and persists the pick', () => {
    render(<InheritanceCard />);
    // Parent 1 starts empty → its action button reads "Pick"
    fireEvent.click(screen.getAllByRole('button', { name: /^Pick$/i })[0]!);
    // modal lists the roster (Uma 101501 from the ROSTER fixture)
    const dialog = screen.getByRole('dialog', { name: /pick a parent/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /Uma 101501/ }));
    expect(setPlan).toHaveBeenCalledWith(expect.objectContaining({ parents: { a: 'a' } }));
  });
});
