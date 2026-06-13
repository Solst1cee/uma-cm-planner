/**
 * Deck suggester rendering contract: the locked-slot editor persists to
 * plan.lockedDeckSlots; suggestions render locked badges, rationale lines,
 * the coverage score and the uncovered ("what am I missing") list.
 * suggestDeck itself is mocked — its math is covered by core deck tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { CmPlan, DeckSuggestion, OwnedCard } from '@/core/types';
import { FIXTURE_PLAN } from '@/core/fixtures';
import { suggestDeck } from '@/core/deck';
import { DeckSuggesterPanel } from '@/features/skill-planner/DeckSuggesterPanel';

vi.mock('@/features/data/gameData', async () => {
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { useGameData: () => fixtureGameData() };
});

vi.mock('@/db', () => ({
  listParents: vi.fn(async () => []),
}));

const mocked = vi.hoisted(() => ({
  suggestion: {
    deck: [
      { slot: 0, cardId: '30028', lockedBy: 'cardType' },
      { slot: 1, cardId: '99999', lockedBy: 'cardId' }, // unknown id — echoed raw
      { slot: 2, cardId: '30016' },
      { slot: 3, cardId: '10001' },
      { slot: 4 },
      { slot: 5 },
    ],
    coverageScore: 18,
    uncovered: ['210061'], // Shooting for the Top
    rationale: [
      'Slot 1 Kitasan Black: covers Professor of Curvature (chain)',
      'Slot 3 Tazuna Hayakawa: covers Right Turns ○ (date event)',
    ],
  },
}));

vi.mock('@/core/deck', () => ({
  suggestDeck: vi.fn(() => mocked.suggestion as unknown as DeckSuggestion),
}));

const INVENTORY: OwnedCard[] = [
  { id: 1, cardId: '30028', limitBreak: 3 }, // Kitasan Black
  { id: 2, cardId: '30016', limitBreak: 0 }, // Tazuna Hayakawa
];

afterEach(cleanup);

describe('DeckSuggesterPanel', () => {
  it('persists a type lock to plan.lockedDeckSlots', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DeckSuggesterPanel plan={FIXTURE_PLAN} onChange={onChange} inventory={INVENTORY} />,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Slot 1 lock' }), 'speed');
    expect(onChange).toHaveBeenCalledWith({
      ...FIXTURE_PLAN,
      lockedDeckSlots: [{ slot: 0, cardType: 'speed' }],
    });
  });

  it('locks a slot to a specific owned card via the searchable picker', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DeckSuggesterPanel plan={FIXTURE_PLAN} onChange={onChange} inventory={INVENTORY} />,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Slot 2 lock' }), 'card');
    // No plan write until a card is actually picked.
    expect(onChange).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Lock slot 2 to card'), 'kita');
    const choices = screen.getByRole('list', { name: 'Card choices for slot 2' });
    expect(within(choices).queryByRole('button', { name: /Tazuna/ })).not.toBeInTheDocument();
    await user.click(within(choices).getByRole('button', { name: /Kitasan Black/ }));
    expect(onChange).toHaveBeenCalledWith({
      ...FIXTURE_PLAN,
      lockedDeckSlots: [{ slot: 1, cardId: '30028' }],
    });
  });

  it('flags a cardId lock that names an unowned card', () => {
    const plan: CmPlan = {
      ...FIXTURE_PLAN,
      lockedDeckSlots: [{ slot: 1, cardId: '99999' }],
    };
    render(<DeckSuggesterPanel plan={plan} onChange={vi.fn()} inventory={INVENTORY} />);
    expect(screen.getByText('(not in inventory)')).toBeInTheDocument();
  });

  it('renders the suggested deck with locked badges, rationale, score and missing list', async () => {
    const user = userEvent.setup();
    const plan: CmPlan = {
      ...FIXTURE_PLAN,
      lockedDeckSlots: [
        { slot: 0, cardType: 'speed' },
        { slot: 1, cardId: '99999' },
      ],
    };
    render(<DeckSuggesterPanel plan={plan} onChange={vi.fn()} inventory={INVENTORY} />);
    await user.click(screen.getByRole('button', { name: 'Suggest deck' }));

    expect(vi.mocked(suggestDeck)).toHaveBeenCalledWith(
      expect.objectContaining({ plan, inventory: INVENTORY }),
    );

    const deck = screen.getByRole('list', { name: 'Suggested deck' });
    const items = within(deck).getAllByRole('listitem');
    expect(items).toHaveLength(6);
    expect(items[0]).toHaveTextContent('Kitasan Black');
    expect(items[0]).toHaveTextContent('locked: type');
    expect(items[1]).toHaveTextContent('99999');
    expect(items[1]).toHaveTextContent('locked: card');
    expect(items[2]).not.toHaveTextContent('locked');
    expect(items[4]).toHaveTextContent('— empty —');

    const rationale = screen.getByRole('list', { name: 'Why these picks' });
    expect(
      within(rationale)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(mocked.suggestion.rationale);

    expect(screen.getByText('18')).toBeInTheDocument();

    const missing = screen.getByRole('list', { name: 'Uncovered target skills' });
    expect(missing).toHaveClass('missing-list');
    expect(within(missing).getByText('Shooting for the Top')).toBeInTheDocument();
  });

  it('invalidates the suggestion when a lock changes', async () => {
    const user = userEvent.setup();
    render(
      <DeckSuggesterPanel plan={FIXTURE_PLAN} onChange={vi.fn()} inventory={INVENTORY} />,
    );
    await user.click(screen.getByRole('button', { name: 'Suggest deck' }));
    expect(screen.getByRole('list', { name: 'Suggested deck' })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Slot 1 lock' }), 'speed');
    expect(screen.queryByRole('list', { name: 'Suggested deck' })).not.toBeInTheDocument();
  });

  it('disables Suggest deck when the plan has no target skills', () => {
    render(
      <DeckSuggesterPanel
        plan={{ ...FIXTURE_PLAN, targetSkills: [] }}
        onChange={vi.fn()}
        inventory={INVENTORY}
      />,
    );
    expect(screen.getByRole('button', { name: 'Suggest deck' })).toBeDisabled();
    expect(screen.getByText('Add target skills above to get a suggestion.')).toBeInTheDocument();
  });
});
