// src/features/inheritance/InheritanceCard.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan, Parent, SkillRecord, UmaRecord } from '@/core/types';
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
// Mutable so the availability test can inject umas with mixed server values.
let mockUmas: UmaRecord[] = [];
// Mutable so the availability gate test can inject skills with mixed server values.
let mockSkills: SkillRecord[] = [];

vi.mock('@/app/ActivePlanContext', () => ({ useActivePlan: () => ({ uma1Plan: activePlan, setPlan }) }));
vi.mock('./useRoster', () => ({ useRoster: () => ({ roster: ROSTER, importedAt: '2026-06-26T10:00:00.000Z', importFromFile: vi.fn() }) }));
vi.mock('@/features/parents/useUmas', () => ({
  useUmas: () => ({ umas: mockUmas, umaById: new Map() }),
  umaName: (_m: unknown, id: string) => `Uma ${id}`,
}));
// Spy: captures the `id` prop so we can assert which umaId was resolved.
const gameIconSpy = vi.fn((_props: { id: string }) => null);
vi.mock('@/features/data/GameIcon', () => ({ GameIcon: (props: { id: string }) => gameIconSpy(props) }));
vi.mock('./UploadDataButton', () => ({ UploadDataButton: () => null }));
vi.mock('./useAffinityIndex', () => ({ useAffinityIndex: () => null }));
vi.mock('@/features/data/gameData', () => ({ useGameData: () => ({ skills: mockSkills, skillById: new Map() }) }));

// Captures the greenIcon callback so we can invoke it directly.
let capturedGreenIcon: ((skillId: string) => React.ReactNode) | undefined;
// Captures the white/unique skill option lists offered to the green/white spark search.
let capturedWhiteOptions: Array<{ id: string; name: string }> | undefined;
let capturedUniqueOptions: Array<{ id: string; name: string }> | undefined;
vi.mock('./UmaPickerModal', () => ({
  UmaPickerModal: (props: {
    open: boolean;
    items: { id: string; name: string }[];
    onPick: (id: string) => void;
    onClose: () => void;
    greenIcon?: (id: string) => React.ReactNode;
    whiteSkillOptions?: Array<{ id: string; name: string }>;
    uniqueSkillOptions?: Array<{ id: string; name: string }>;
  }) => {
    if (props.greenIcon) capturedGreenIcon = props.greenIcon;
    capturedWhiteOptions = props.whiteSkillOptions;
    capturedUniqueOptions = props.uniqueSkillOptions;
    // Render a minimal dialog so existing "opens picker" test keeps working.
    if (!props.open) return null;
    return (
      <div role="dialog" aria-label="Pick a parent">
        {props.items.map((it) => (
          <button key={it.id} onClick={() => props.onPick(it.id)}>
            {it.name}
          </button>
        ))}
      </div>
    );
  },
}));

import React from 'react';

afterEach(() => {
  cleanup();
  setPlan.mockClear();
  gameIconSpy.mockClear();
  activePlan = plan;
  mockUmas = [];
  mockSkills = [];
  capturedGreenIcon = undefined;
  capturedWhiteOptions = undefined;
  capturedUniqueOptions = undefined;
});

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

  it('availability gate: charaToUma resolves representative portrait from Global uma, not JP uma', () => {
    // charaId '1001' → unique skillId = 90001 + 1001*10 = 100011
    // JP uma has a LOWER umaId ('100150') so it would win the !m.has race if unfiltered.
    // Global uma has a HIGHER umaId ('100199'). With the Global filter, we expect '100199'.
    mockUmas = [
      { umaId: '100150', charaId: '1001', nameEn: 'JP Uma', server: 'jp', dataVersion: 'jp-test' },
      { umaId: '100199', charaId: '1001', nameEn: 'Global Uma', server: 'global', dataVersion: 'gbl-test' },
    ] as UmaRecord[];
    render(<InheritanceCard />);
    // capturedGreenIcon is wired by UmaPickerModal mock on every render
    expect(capturedGreenIcon).toBeDefined();
    // Invoke the greenIcon callback for the unique skill owned by charaId '1001'.
    // greenIcon returns a React element; render it to trigger the GameIcon mock spy.
    const icon = capturedGreenIcon!('100011') as React.ReactElement;
    render(icon);
    // GameIcon should have been called with the Global uma's portrait id, not the JP one
    const calls = gameIconSpy.mock.calls.map((c) => c[0].id);
    expect(calls).toContain('100199');
    expect(calls).not.toContain('100150');
  });

  it('availability gate: white + unique (green) spark options exclude JP-ahead skills', () => {
    mockSkills = [
      { skillId: 'w-global', nameEn: 'Global White', rarity: 'white', server: 'global' } as SkillRecord,
      { skillId: 'w-jp', nameEn: 'JP White', rarity: 'white', server: 'jp' } as SkillRecord,
      { skillId: '100011', nameEn: 'Global Unique', rarity: 'unique', server: 'global' } as SkillRecord,
      { skillId: '100021', nameEn: 'JP Unique', rarity: 'unique', server: 'jp' } as SkillRecord,
    ];
    render(<InheritanceCard />);
    // Open the Parent 1 picker so UmaPickerModal renders (props captured either way,
    // but this also guards against a JP option leaking into the rendered dialog).
    fireEvent.click(screen.getAllByRole('button', { name: /^Pick$/i })[0]!);

    expect(capturedWhiteOptions?.map((o) => o.id)).toContain('w-global');
    expect(capturedWhiteOptions?.map((o) => o.id)).not.toContain('w-jp');

    expect(capturedUniqueOptions?.map((o) => o.id)).toContain('100011');
    expect(capturedUniqueOptions?.map((o) => o.id)).not.toContain('100021');
  });
});
