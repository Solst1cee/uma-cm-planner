/**
 * Parents page: form assembles + persists a complete Parent, edit upserts by
 * id, two-step delete confirm, P4/rarity gating in the spark pickers.
 * '@/db' and useGameData are mocked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { Parent } from '@/core/types';
import type { ParentDraft } from '@/db';
import { deleteParent, listParents, saveParent } from '@/db';
import { ParentsPage } from '@/features/parents/ParentsPage';

vi.mock('@/features/data/gameData', async () => {
  const { parentsTestGameData } = await import('@/features/parents/testGameData');
  return { useGameData: () => parentsTestGameData() };
});

vi.mock('@/db', () => ({
  listParents: vi.fn(async (): Promise<Parent[]> => []),
  saveParent: vi.fn(
    async (draft: ParentDraft): Promise<Parent> => ({ ...draft, id: draft.id ?? 'generated-id' }),
  ),
  deleteParent: vi.fn(async () => undefined),
}));

const SAVED: Parent = {
  id: 'parent-1',
  umaId: '100101', // Special Week
  blueSpark: { stat: 'pow', stars: 2 },
  pinkSpark: { aptitude: 'long', stars: 3 },
  whiteSparks: [{ skillId: '200012', stars: 1 }],
  source: 'mine',
};

afterEach(cleanup);

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  render(<ParentsPage />);
  await screen.findByText(/No parents yet/);
  await user.click(screen.getByRole('button', { name: 'Add parent' }));
}

describe('ParentsPage form', () => {
  it('saves a complete parent', async () => {
    const user = userEvent.setup();
    await openForm(user);

    // Uma picker (name + epithet searchable).
    await user.type(screen.getByLabelText('Uma'), 'suzuka');
    await user.click(screen.getByRole('button', { name: /Silence Suzuka/ }));

    // Blue + pink sparks.
    await user.selectOptions(screen.getByLabelText('Blue spark stat'), 'spd');
    await user.selectOptions(screen.getByLabelText('Blue spark stars'), '3');
    await user.selectOptions(screen.getByLabelText('Pink spark aptitude'), 'turf');
    await user.selectOptions(screen.getByLabelText('Pink spark stars'), '2');

    // Green spark (inherited unique, 9xxxxx id) at ★2.
    await user.type(screen.getByLabelText('Green spark'), 'giving up');
    await user.click(screen.getByRole('button', { name: /Not Giving Up the Lead/ }));
    await user.selectOptions(screen.getByLabelText('Green spark stars'), '2');

    // One white spark at ★2.
    await user.type(screen.getByLabelText('Add white spark'), 'corner');
    await user.click(screen.getByRole('button', { name: /Corner Adept ○/ }));
    await user.selectOptions(screen.getByLabelText('Stars for Corner Adept ○'), '2');

    await user.type(screen.getByLabelText('Affinity hint (total)'), '152');
    await user.type(screen.getByLabelText('Notes'), 'CM anchor');
    await user.click(screen.getByRole('button', { name: 'Friend rental' }));

    await user.click(screen.getByRole('button', { name: 'Save parent' }));

    expect(saveParent).toHaveBeenCalledWith({
      id: undefined,
      umaId: '100201',
      blueSpark: { stat: 'spd', stars: 3 },
      pinkSpark: { aptitude: 'turf', stars: 2 },
      greenSpark: { skillId: '900021', stars: 2 },
      whiteSparks: [{ skillId: '200332', stars: 2 }],
      grandparents: undefined,
      affinityHint: 152,
      notes: 'CM anchor',
      source: 'friend_rental',
      importSource: 'manual',
      stats: undefined,
      rating: undefined,
    });

    // Form closes; the new parent shows up with summary chips + source badge.
    const list = await screen.findByRole('list', { name: 'Saved parents' });
    expect(within(list).getByText(/Silence Suzuka/)).toBeInTheDocument();
    expect(within(list).getByText('Rental')).toBeInTheDocument();
    expect(within(list).getByText('Speed ★★★')).toBeInTheDocument();
    expect(within(list).getByText('Turf ★★')).toBeInTheDocument();
    expect(within(list).getByText('Corner Adept ○ ★★')).toBeInTheDocument();
  });

  it('records a grandparent with its own white spark', async () => {
    const user = userEvent.setup();
    await openForm(user);

    await user.type(screen.getByLabelText('Uma'), 'suzuka');
    await user.click(screen.getByRole('button', { name: /Silence Suzuka/ }));

    await user.type(screen.getByLabelText('Grandparent 1 uma'), 'special week');
    await user.click(screen.getByRole('button', { name: /Special Week/ }));
    await user.type(screen.getByLabelText('Add grandparent 1 white spark'), 'right turns ○');
    await user.click(screen.getByRole('button', { name: /Right Turns ○/ }));

    await user.click(screen.getByRole('button', { name: 'Save parent' }));

    expect(saveParent).toHaveBeenCalledWith(
      expect.objectContaining({
        umaId: '100201',
        grandparents: [
          {
            umaId: '100101',
            blueSpark: undefined,
            pinkSpark: undefined,
            whiteSparks: [{ skillId: '200012', stars: 3 }],
          },
          undefined,
        ],
      }),
    );
  });

  it('requires an uma before saving', async () => {
    const user = userEvent.setup();
    await openForm(user);
    await user.click(screen.getByRole('button', { name: 'Save parent' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Pick the uma/);
    expect(saveParent).not.toHaveBeenCalled();
  });

  it('green spark picker only offers inherited uniques; white picker hides JP skills (P4)', async () => {
    const user = userEvent.setup();
    await openForm(user);

    // 'Corner Adept ○' is a white skill — not offered as a green spark.
    await user.type(screen.getByLabelText('Green spark'), 'corner');
    expect(
      within(screen.getByRole('list', { name: 'Green spark results' })).getByText('No matches.'),
    ).toBeInTheDocument();

    // JP-server white skill never offered (P4).
    await user.type(screen.getByLabelText('Add white spark'), 'jp-only');
    expect(
      within(screen.getByRole('list', { name: 'Add white spark results' })).getByText(
        'No matches.',
      ),
    ).toBeInTheDocument();

    // JP-server uma never offered (P4).
    await user.type(screen.getByLabelText('Uma'), 'jp-only');
    expect(
      within(screen.getByRole('list', { name: 'Uma results' })).getByText('No matches.'),
    ).toBeInTheDocument();
  });
});

describe('ParentsPage list', () => {
  it('edit pre-populates the form and upserts with the same id', async () => {
    const user = userEvent.setup();
    vi.mocked(listParents).mockResolvedValue([SAVED]);
    render(<ParentsPage />);

    await user.click(await screen.findByRole('button', { name: 'Edit Special Week' }));
    expect(screen.getByLabelText('Blue spark stat')).toHaveValue('pow');
    expect(screen.getByLabelText('Pink spark aptitude')).toHaveValue('long');

    await user.selectOptions(screen.getByLabelText('Blue spark stat'), 'wit');
    await user.click(screen.getByRole('button', { name: 'Save parent' }));

    expect(saveParent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'parent-1',
        blueSpark: { stat: 'wit', stars: 2 },
      }),
    );
  });

  it('deletes only after the confirm step', async () => {
    const user = userEvent.setup();
    vi.mocked(listParents).mockResolvedValue([SAVED]);
    render(<ParentsPage />);

    await user.click(await screen.findByRole('button', { name: 'Delete Special Week' }));
    expect(deleteParent).not.toHaveBeenCalled();

    // Cancel first — nothing deleted.
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(deleteParent).not.toHaveBeenCalled();
    expect(screen.getByText(/Special Week/)).toBeInTheDocument();

    // Now confirm for real.
    await user.click(screen.getByRole('button', { name: 'Delete Special Week' }));
    await user.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(deleteParent).toHaveBeenCalledWith('parent-1');
    expect(screen.queryByRole('button', { name: 'Delete Special Week' })).not.toBeInTheDocument();
  });
});
