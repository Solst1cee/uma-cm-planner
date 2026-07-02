/**
 * ParentForm: planning-horizon availability lens on the uma / white-spark /
 * green-spark (inherited-unique) search options. At the current (default)
 * horizon this degenerates to the old hardcoded server==='global' gate (P4);
 * a wider horizon reveals JP-ahead records. '@/features/data/gameData' and
 * '@/app/useAvailability' are mocked — no ActivePlanProvider needed.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { SkillRecord, UmaRecord } from '@/core/types';
import { parentsTestGameData, TEST_UMAS } from '@/features/parents/testGameData';
import { ParentForm } from '@/features/parents/ParentForm';

// The shared app-wide horizon lens — mocked with a mutable fixture so a test can
// simulate 'current' (default, ≡ Global-only) vs a cm-like horizon that reveals
// upcoming JP-ahead records, without a full ActivePlanContext/gameData provider stack.
const avail = vi.hoisted(() => ({
  visible: (r: { server: string; releaseDate?: string }) => r.server === 'global',
}));
vi.mock('@/app/useAvailability', () => ({
  useAvailability: () => ({ visible: avail.visible }),
}));

const JP_INHERITED_UNIQUE: SkillRecord = {
  skillId: '900099', nameEn: 'JP Inherited Unique', nameJp: '', baseSpCost: 0,
  rarity: 'inherited_unique', iconId: '1', conditions: '', server: 'jp',
  releaseDate: '2026-08-01', dataVersion: 'fixture',
};

// Mutable so a test can extend the fixture's umas/skills with an upcoming JP record.
let mockUmas: UmaRecord[] = TEST_UMAS;
let mockSkills: SkillRecord[] = parentsTestGameData().skills;

vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({
    ...parentsTestGameData(),
    umas: mockUmas,
    skills: mockSkills,
    skillById: new Map(mockSkills.map((s) => [s.skillId, s])),
  }),
}));

afterEach(() => {
  cleanup();
  avail.visible = (r) => r.server === 'global';
  mockUmas = TEST_UMAS;
  mockSkills = parentsTestGameData().skills;
});

describe('ParentForm — planning horizon', () => {
  it('current (default): JP uma / white are absent, Global ones present (P4 sanity)', async () => {
    const user = userEvent.setup();
    render(<ParentForm onSave={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Uma'), 'jp-only');
    expect(
      within(screen.getByRole('list', { name: 'Uma results' })).getByText('No matches.'),
    ).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Uma'));
    await user.type(screen.getByLabelText('Uma'), 'suzuka');
    expect(
      within(screen.getByRole('list', { name: 'Uma results' })).getByRole('button', {
        name: /Silence Suzuka/,
      }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Add white spark'), 'jp-only');
    expect(
      within(screen.getByRole('list', { name: 'Add white spark results' })).getByText('No matches.'),
    ).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Add white spark'));
    await user.type(screen.getByLabelText('Add white spark'), 'corner');
    expect(
      within(screen.getByRole('list', { name: 'Add white spark results' })).getByRole('button', {
        name: /Corner Adept/,
      }),
    ).toBeInTheDocument();
  });

  it('current (default): a JP inherited-unique is absent from the green-spark options', async () => {
    mockSkills = [...parentsTestGameData().skills, JP_INHERITED_UNIQUE];
    const user = userEvent.setup();
    render(<ParentForm onSave={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Green spark'), 'JP Inherited');
    expect(
      within(screen.getByRole('list', { name: 'Green spark results' })).getByText('No matches.'),
    ).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Green spark'));
    await user.type(screen.getByLabelText('Green spark'), 'giving up');
    expect(
      within(screen.getByRole('list', { name: 'Green spark results' })).getByRole('button', {
        name: /Not Giving Up the Lead/,
      }),
    ).toBeInTheDocument();
  });

  it('a wider (cm-like) horizon reveals the upcoming JP uma / white / inherited-unique', async () => {
    avail.visible = () => true; // simulate a cm/allJp horizon that reveals everything
    mockSkills = [...parentsTestGameData().skills, JP_INHERITED_UNIQUE];
    const user = userEvent.setup();
    render(<ParentForm onSave={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText('Uma'), 'jp-only');
    expect(
      within(screen.getByRole('list', { name: 'Uma results' })).getByRole('button', {
        name: /JP-Only Uma/,
      }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Add white spark'), 'jp-only');
    expect(
      within(screen.getByRole('list', { name: 'Add white spark results' })).getByRole('button', {
        name: /JP-Only Example/,
      }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText('Green spark'), 'JP Inherited');
    expect(
      within(screen.getByRole('list', { name: 'Green spark results' })).getByRole('button', {
        name: /JP Inherited Unique/,
      }),
    ).toBeInTheDocument();
  });
});
