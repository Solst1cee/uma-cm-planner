// src/features/inheritance/InheritanceCard.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan, Parent, SkillRecord, UmaRecord } from '@/core/types';
import { InheritanceCard } from './InheritanceCard';

const ROSTER: Parent[] = [
  { id: 'a', umaId: '101501', blueSpark: { stat: 'spd', stars: 3 }, pinkSpark: { aptitude: 'long', stars: 3 }, whiteSparks: [], source: 'mine' },
  { id: 'b', umaId: '100601', blueSpark: { stat: 'sta', stars: 1 }, pinkSpark: { aptitude: 'mile', stars: 1 }, whiteSparks: [], source: 'mine' },
];
const setPlan = vi.fn();
// Persists regardless of the planner's auto-save toggle (CLAUDE.md M1 gotcha #3) —
// InheritanceCard must route every mutation through both setPlan AND saveCurrentPlan.
const saveCurrentPlan = vi.fn().mockResolvedValue(undefined);
const plan = {
  id: 'p1', parents: {}, sparkGoals: { blue: { spd: 3 }, pink: [{ aptKey: { kind: 'distance', key: 'long' }, target: 'A' }] },
} as unknown as CmPlan;
// Mutable so a test can simulate uma1Plan loading from null → set (read lazily in the factory).
let activePlan: CmPlan | null = plan;
// Mutable so the availability test can inject umas with mixed server values.
let mockUmas: UmaRecord[] = [];
// Mutable so the availability gate test can inject skills with mixed server values.
let mockSkills: SkillRecord[] = [];

vi.mock('@/app/ActivePlanContext', () => ({ useActivePlan: () => ({ uma1Plan: activePlan, setPlan, saveCurrentPlan }) }));
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
// The shared app-wide horizon lens — mocked with a mutable fixture so a test can
// simulate 'current' (default, ≡ Global-only) vs a cm-like horizon that reveals
// upcoming JP-ahead records.
const avail = vi.hoisted(() => ({
  visible: (r: { server: string; releaseDate?: string }) => r.server === 'global',
}));
vi.mock('@/app/useAvailability', () => ({
  useAvailability: () => ({ visible: avail.visible }),
}));

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
  saveCurrentPlan.mockClear();
  gameIconSpy.mockClear();
  activePlan = plan;
  mockUmas = [];
  mockSkills = [];
  capturedGreenIcon = undefined;
  capturedWhiteOptions = undefined;
  capturedUniqueOptions = undefined;
  avail.visible = (r) => r.server === 'global';
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

  it('ranks candidates and persists a pick to plan.parents.a via BOTH setPlan and saveCurrentPlan (the owned select() shares the same persistence gap)', async () => {
    render(<InheritanceCard />);
    expect(screen.getByText(/Updated 2026-06-26/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /find candidates/i })[0]!);
    // top candidate is 'a' (spd 3 + long 3 = 6); click it
    fireEvent.click(screen.getByRole('button', { name: /Uma 101501/i }));
    const expected = expect.objectContaining({ parents: { a: 'a' } });
    expect(setPlan).toHaveBeenCalledWith(expected);
    // editPlan queues the persist through a promise chain — flush it.
    await waitFor(() => expect(saveCurrentPlan).toHaveBeenCalledTimes(1));
    expect(saveCurrentPlan).toHaveBeenCalledWith(expected, { commit: 'if-current' });
  });

  it('switching Parent 2 to Draft persists parent2Mode + seeds a default rentalDraft via BOTH setPlan and saveCurrentPlan (independent of the autosave toggle)', async () => {
    render(<InheritanceCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
    const expected = expect.objectContaining({
      parent2Mode: 'draft',
      rentalDraft: { filters: [], forcedTier: 'double' },
    });
    expect(setPlan).toHaveBeenCalledWith(expected);
    await waitFor(() => expect(saveCurrentPlan).toHaveBeenCalledTimes(1));
    expect(saveCurrentPlan).toHaveBeenCalledWith(expected, { commit: 'if-current' });
  });

  it('renders the RentalDraftPanel + the assumed-affinity mark when parent2Mode is draft', () => {
    activePlan = { ...plan, parent2Mode: 'draft', rentalDraft: { filters: [], forcedTier: 'double' } } as unknown as CmPlan;
    render(<InheritanceCard />);
    expect(screen.getByText('Load from Target spark')).toBeInTheDocument();
    // A draft never inflates the real numeric affinity — it's a separate "assumed" mark.
    expect(screen.getByTitle(/assumed \(draft\)/i)).toBeInTheDocument();
  });

  it('switching Parent 2 to Rental shows the manual editor when nothing is recorded yet', () => {
    activePlan = { ...plan, parent2Mode: 'rental' } as unknown as CmPlan;
    render(<InheritanceCard />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('saving a Rental parent persists rentalRecorded via BOTH setPlan and saveCurrentPlan', async () => {
    mockUmas = [
      { umaId: '100601', charaId: '1006', nameEn: 'Rental Uma', server: 'global', dataVersion: 'x' },
    ] as UmaRecord[];
    activePlan = { ...plan, parent2Mode: 'rental' } as unknown as CmPlan;
    render(<InheritanceCard />);
    fireEvent.change(screen.getByLabelText('Parent uma'), { target: { value: '100601' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const expected = expect.objectContaining({
      rentalRecorded: expect.objectContaining({ umaId: '100601', source: 'friend_rental' }),
    });
    expect(setPlan).toHaveBeenCalledWith(expected);
    await waitFor(() => expect(saveCurrentPlan).toHaveBeenCalledTimes(1));
    expect(saveCurrentPlan).toHaveBeenCalledWith(expected, { commit: 'if-current' });
  });

  it('same-character guard (spec §6): the Rental editor uma options exclude Parent 1\'s character (any outfit)', () => {
    // umaName is mocked to `Uma ${id}` (nameEn is ignored) — assert on the id-derived label.
    mockUmas = [
      { umaId: '101502', charaId: '1015', nameEn: 'Same Chara Alt Outfit', server: 'global', dataVersion: 'x' },
      { umaId: '100601', charaId: '1006', nameEn: 'Different Chara', server: 'global', dataVersion: 'x' },
    ] as UmaRecord[];
    // Parent 1 = ROSTER 'a' (umaId '101501' → charaId 1015, same family as '101502').
    activePlan = { ...plan, parents: { a: 'a' }, parent2Mode: 'rental' } as unknown as CmPlan;
    render(<InheritanceCard />);
    const options = within(screen.getByLabelText('Parent uma')).getAllByRole('option').map((o) => o.textContent);
    expect(options).not.toContain('Uma 101502');
    expect(options).toContain('Uma 100601');
  });

  it('mode switches Owned→Draft→Rental preserve parents.b, rentalDraft, and rentalRecorded untouched (only parent2Mode changes)', async () => {
    const recorded: Parent = {
      id: 'r1', umaId: '100601',
      blueSpark: { stat: 'sta', stars: 2 }, pinkSpark: { aptitude: 'mile', stars: 2 },
      whiteSparks: [], source: 'friend_rental',
    };
    const draft = { filters: [{ id: 'f1', kind: 'blue', stat: 'spd', legacyMin: 0, totalMin: 3 }], forcedTier: 'double' as const };
    activePlan = {
      ...plan,
      parents: { b: 'b' },
      parent2Mode: 'owned',
      rentalDraft: draft,
      rentalRecorded: recorded,
    } as unknown as CmPlan;
    const { rerender } = render(<InheritanceCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Draft' }));
    const afterDraft = expect.objectContaining({
      parents: { b: 'b' },
      parent2Mode: 'draft',
      rentalDraft: draft,
      rentalRecorded: recorded,
    });
    expect(setPlan).toHaveBeenLastCalledWith(afterDraft);
    await waitFor(() => expect(saveCurrentPlan).toHaveBeenCalledTimes(1));
    expect(saveCurrentPlan).toHaveBeenLastCalledWith(afterDraft, { commit: 'if-current' });
    activePlan = setPlan.mock.calls.at(-1)![0] as CmPlan;
    rerender(<InheritanceCard />);

    fireEvent.click(screen.getByRole('button', { name: 'Rental' }));
    const afterRental = expect.objectContaining({
      parents: { b: 'b' },
      parent2Mode: 'rental',
      rentalDraft: draft,
      rentalRecorded: recorded,
    });
    expect(setPlan).toHaveBeenLastCalledWith(afterRental);
    await waitFor(() => expect(saveCurrentPlan).toHaveBeenCalledTimes(2));
    expect(saveCurrentPlan).toHaveBeenLastCalledWith(afterRental, { commit: 'if-current' });
  });

  it('switching back to Owned persists parent2Mode: owned and (once applied) shows the roster picker UI again', () => {
    activePlan = { ...plan, parent2Mode: 'draft', rentalDraft: { filters: [], forcedTier: 'double' } } as unknown as CmPlan;
    const { rerender } = render(<InheritanceCard />);
    expect(screen.getByText('Load from Target spark')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Owned' }));
    expect(setPlan).toHaveBeenCalledWith(expect.objectContaining({ parent2Mode: 'owned' }));
    // Simulate the persisted plan flowing back down through the (mocked) context.
    activePlan = { ...activePlan, parent2Mode: 'owned' } as unknown as CmPlan;
    rerender(<InheritanceCard />);
    expect(screen.queryByText('Load from Target spark')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /find candidates/i }).length).toBeGreaterThan(0);
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

  it('planning horizon (current, default): charaToUma resolves representative portrait from Global uma, not JP uma', () => {
    // charaId '1001' → unique skillId = 90001 + 1001*10 = 100011
    // JP uma has a LOWER umaId ('100150') so it would win the !m.has race if unfiltered.
    // Global uma has a HIGHER umaId ('100199'). At the current horizon (visible ≡
    // Global-only), we expect '100199'.
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

  it('planning horizon (current, default): white + unique (green) spark options exclude JP-ahead skills', () => {
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

  it('planning horizon (cm-like): a wider lens reveals the upcoming JP white in the spark options', () => {
    avail.visible = () => true; // simulate a cm/allJp horizon that reveals everything
    mockSkills = [
      { skillId: 'w-global', nameEn: 'Global White', rarity: 'white', server: 'global' } as SkillRecord,
      { skillId: 'w-jp', nameEn: 'JP White', rarity: 'white', server: 'jp', releaseDate: '2026-08-01' } as SkillRecord,
      { skillId: '100011', nameEn: 'Global Unique', rarity: 'unique', server: 'global' } as SkillRecord,
      { skillId: '100021', nameEn: 'JP Unique', rarity: 'unique', server: 'jp', releaseDate: '2026-08-01' } as SkillRecord,
    ];
    render(<InheritanceCard />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Pick$/i })[0]!);

    expect(capturedWhiteOptions?.map((o) => o.id)).toContain('w-jp');
    expect(capturedUniqueOptions?.map((o) => o.id)).toContain('100021');
  });
});
