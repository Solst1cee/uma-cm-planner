// src/features/inheritance/CardDetailCard.test.tsx
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { CardDetailCard } from './SupportCardPoolCard';
import { buildPoolItem } from './poolModel';
import type { SupportCardRecord } from '@/core/types';

const card = {
  cardId: '1', nameEn: '[Alpha Title]', charName: 'Alpha', rarity: 'SSR', type: 'speed',
  skills: [
    { skillId: 's1', sourceType: 'chain' },
    { skillId: 's2', sourceType: 'random_event' },
    { skillId: 's3', sourceType: 'hint_pool' },
  ],
} as unknown as SupportCardRecord;
const item = buildPoolItem(card, { score: 12.3456, wishlist: new Set(['s1']), lb: 4 });

afterEach(cleanup);

it('shows art, name, 2dp score and split Chain/Random/Hint skill sections', () => {
  render(
    <CardDetailCard
      item={item} lb={4} onCardLb={vi.fn()} inDeck={false}
      onAdd={vi.fn()} onClose={vi.fn()} art={<i data-testid="art" />}
      skillName={(id) => `name-${id}`}
    />,
  );
  expect(screen.getByTestId('art')).toBeInTheDocument();
  expect(screen.getByText('[Alpha Title]')).toBeInTheDocument();
  expect(screen.getByText('E 12.35')).toBeInTheDocument(); // rounded to 2dp
  expect(screen.getByText('Chain')).toBeInTheDocument();
  expect(screen.getByText('Random')).toBeInTheDocument();
  expect(screen.getByText('Hint')).toBeInTheDocument();
  expect(screen.getByText('name-s1')).toBeInTheDocument();
});

it('Add fires onAdd, close fires onClose, and deck members show Added', () => {
  const onAdd = vi.fn();
  const onClose = vi.fn();
  const { rerender } = render(
    <CardDetailCard item={item} lb={4} onCardLb={vi.fn()} inDeck={false} onAdd={onAdd} onClose={onClose} art={null} />,
  );
  fireEvent.click(screen.getByRole('button', { name: /add to deck/i }));
  expect(onAdd).toHaveBeenCalledWith('1');
  fireEvent.click(screen.getByRole('button', { name: /close card details/i }));
  expect(onClose).toHaveBeenCalled();

  rerender(<CardDetailCard item={item} lb={4} onCardLb={vi.fn()} inDeck onAdd={onAdd} onClose={onClose} art={null} />);
  expect(screen.getByText(/added/i)).toBeInTheDocument();
});

it('renders the full base-effect list at the selected LB (skips 0-value effects)', () => {
  render(
    <CardDetailCard
      item={item} lb={2} onCardLb={vi.fn()} inDeck={false} onAdd={vi.fn()} onClose={vi.fn()} art={null}
      baseEffects={[
        { type: 8, nameEn: 'Training Effectiveness', descEn: '', symbol: 'percent', valuesByLb: [5, 5, 5, 10, 10] },
        { type: 19, nameEn: 'Specialty Priority', descEn: '', symbol: 'none', valuesByLb: [0, 0, 0, 40, 80] },
      ]}
    />,
  );
  expect(screen.getByText('Training Effectiveness')).toBeInTheDocument();
  expect(screen.getByText('+5%')).toBeInTheDocument(); // LB2 value of type 8
  // Specialty Priority is 0 at LB2 → not shown.
  expect(screen.queryByText('Specialty Priority')).not.toBeInTheDocument();
});

it('renders the Unique Effect lines (percent + raw) under the E value', () => {
  render(
    <CardDetailCard
      item={item} lb={4} onCardLb={vi.fn()} inDeck={false} onAdd={vi.fn()} onClose={vi.fn()} art={null}
      uniqueEffects={[
        { type: 7, nameEn: 'Wit Bonus', descEn: 'Increases Wit gain when training together', value: 1, symbol: 'none' },
        { type: 15, nameEn: 'Race Bonus', descEn: 'Increases stat gain from races', value: 5, symbol: 'percent' },
      ]}
    />,
  );
  expect(screen.getByText('Unique Effect')).toBeInTheDocument();
  expect(screen.getByText('Increases Wit gain when training together (1)')).toBeInTheDocument();
  expect(screen.getByText('Increases stat gain from races (5%)')).toBeInTheDocument();
});

it('when the deck is full, Add shows a notice and does not call onAdd', () => {
  const onAdd = vi.fn();
  render(<CardDetailCard item={item} lb={4} onCardLb={vi.fn()} inDeck={false} deckFull onAdd={onAdd} onClose={vi.fn()} art={null} />);
  fireEvent.click(screen.getByRole('button', { name: /add to deck/i }));
  expect(onAdd).not.toHaveBeenCalled();
  expect(screen.getByText(/deck is full/i)).toBeInTheDocument();
});

it('clicking the art opens a full-art viewer; clicking the backdrop closes it', () => {
  render(<CardDetailCard item={item} lb={4} onCardLb={vi.fn()} inDeck={false} onAdd={vi.fn()} onClose={vi.fn()} art={<i data-testid="art" />} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /view full art/i }));
  const dialog = screen.getByRole('dialog', { name: /full art/i });
  expect(dialog).toBeInTheDocument();
  // Backdrop click (on the dialog itself) closes; an inner click would not.
  fireEvent.click(dialog);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
