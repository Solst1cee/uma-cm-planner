// src/features/inheritance/SupportCardPoolCard.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { SupportCardPoolCard } from './SupportCardPoolCard';
import { buildPoolItem } from './poolModel';
import type { SupportCardRecord } from '@/core/types';

const mk = (id: string, type: SupportCardRecord['type'], rarity: SupportCardRecord['rarity'], name: string) =>
  ({ cardId: id, nameEn: name, charName: name, rarity, type, skills: [], server: 'global' } as unknown as SupportCardRecord);
const items = [
  buildPoolItem(mk('1', 'speed', 'SSR', 'Alpha'), { score: 10, wishlist: new Set(), lb: 4 }),
  buildPoolItem(mk('2', 'stamina', 'SR', 'Beta'), { score: 20, wishlist: new Set(), lb: 4 }),
];
const base = {
  items, wishlistSkillNames: [], statsShown: [], cardLb: {}, onCardLb: vi.fn(),
  deckCardIds: new Set<string>(), onAdd: vi.fn(), renderIcon: () => <i />,
};
afterEach(cleanup);

describe('SupportCardPoolCard', () => {
  it('shows both cards', () => {
    render(<SupportCardPoolCard {...base} />);
    // Tiles are icon-only; identify cards by their icon button labels.
    expect(screen.getByRole('button', { name: /alpha details/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /beta details/i })).toBeInTheDocument();
  });
  it('filters by rarity SSR', () => {
    render(<SupportCardPoolCard {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /^SSR$/ }));
    expect(screen.queryByRole('button', { name: /beta details/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /alpha details/i })).toBeInTheDocument();
  });
  it('clicking an icon fires onSelectCard with the card id', () => {
    const onSelectCard = vi.fn();
    render(<SupportCardPoolCard {...base} onSelectCard={onSelectCard} />);
    fireEvent.click(screen.getByRole('button', { name: /alpha details/i }));
    expect(onSelectCard).toHaveBeenCalledWith('1');
  });
  it('the hover quick-add "+" fires onAdd; deck members have none', () => {
    const onAdd = vi.fn();
    render(<SupportCardPoolCard {...base} onAdd={onAdd} deckCardIds={new Set(['2'])} />);
    fireEvent.click(screen.getByRole('button', { name: /add alpha to deck/i }));
    expect(onAdd).toHaveBeenCalledWith('1');
    // Beta is already in the deck → no quick-add button.
    expect(screen.queryByRole('button', { name: /add beta to deck/i })).not.toBeInTheDocument();
  });
  it('blocks the trainee’s own character — greyed, no quick-add', () => {
    const { container } = render(<SupportCardPoolCard {...base} traineeCharName="Alpha" />);
    expect(container.querySelector('[data-testid="pool-tile-1"]')).toHaveClass('is-blocked');
    expect(screen.queryByRole('button', { name: /add alpha to deck/i })).not.toBeInTheDocument();
    // Its badge reads "Trainee"; Beta stays addable.
    expect(screen.getByText('Trainee')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add beta to deck/i })).toBeInTheDocument();
  });
  it('blocks a sibling of a character already in the deck', () => {
    const { container } = render(
      <SupportCardPoolCard {...base} deckCharNames={new Set(['Beta'])} />,
    );
    // Beta's character is in the deck → Beta (id 2) is blocked; Alpha stays addable.
    expect(container.querySelector('[data-testid="pool-tile-2"]')).toHaveClass('is-blocked');
    expect(screen.queryByRole('button', { name: /add beta to deck/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add alpha to deck/i })).toBeInTheDocument();
  });
  it('selected card gets is-selected; deck members get is-in-deck', () => {
    const { container } = render(
      <SupportCardPoolCard {...base} selectedCardId="1" deckCardIds={new Set(['2'])} />,
    );
    expect(container.querySelector('[data-testid="pool-tile-1"]')).toHaveClass('is-selected');
    expect(container.querySelector('[data-testid="pool-tile-2"]')).toHaveClass('is-in-deck');
    // The selected tile's icon button reports aria-pressed.
    expect(screen.getByRole('button', { name: /alpha details/i })).toHaveAttribute('aria-pressed', 'true');
  });
  it('sort toggle reorders to effect (Beta first)', () => {
    render(<SupportCardPoolCard {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /effect/i }));
    // Order is read from the icon buttons' labels ("<name> details"), in grid order.
    const order = screen.getAllByRole('button', { name: /details$/i }).map((b) => b.getAttribute('aria-label'));
    expect(order[0]).toBe('Beta details');
  });

  it('hides upcoming JP cards by default and shows them + the predicted badge after toggling', async () => {
    const mkJp = (id: string, name: string) =>
      ({ cardId: id, nameEn: name, charName: name, rarity: 'SSR', type: 'speed', skills: [],
         server: 'jp', releaseDate: '2026-07-01', releaseDatePredicted: true } as unknown as SupportCardRecord);
    const jpItem = buildPoolItem(mkJp('j', 'Fuji'), { score: 15, wishlist: new Set(), lb: 4 });
    const mixedItems = [...items, jpItem];

    render(<SupportCardPoolCard {...base} items={mixedItems} asOfISO="2026-08-01" />);
    // JP card is hidden by default (showUpcoming: false).
    expect(screen.queryByRole('button', { name: /fuji details/i })).not.toBeInTheDocument();
    // Global cards still show.
    expect(screen.getByRole('button', { name: /alpha details/i })).toBeInTheDocument();

    // Toggle "show upcoming" — the JP card (released 2026-07-01, asOf 2026-08-01) appears.
    await userEvent.click(screen.getByLabelText(/show upcoming/i));
    expect(screen.getByRole('button', { name: /fuji details/i })).toBeInTheDocument();

    // The predicted date badge renders.
    expect(screen.getByText(/~2026-07-01/)).toBeInTheDocument();
  });
});
