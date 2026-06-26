// src/features/inheritance/SupportCardPoolCard.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SupportCardPoolCard } from './SupportCardPoolCard';
import { buildPoolItem } from './poolModel';
import type { SupportCardRecord } from '@/core/types';

const mk = (id: string, type: SupportCardRecord['type'], rarity: SupportCardRecord['rarity'], name: string) =>
  ({ cardId: id, nameEn: name, charName: name, rarity, type, skills: [] } as unknown as SupportCardRecord);
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
  it('shows the count and both cards', () => {
    render(<SupportCardPoolCard {...base} />);
    expect(screen.getByText(/2 shown/i)).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });
  it('filters by rarity SSR', () => {
    render(<SupportCardPoolCard {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /^SSR$/ }));
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });
  it('Add calls onAdd; deck members show Added', () => {
    const onAdd = vi.fn();
    render(<SupportCardPoolCard {...base} onAdd={onAdd} deckCardIds={new Set(['2'])} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^add$/i })[0]!);
    expect(onAdd).toHaveBeenCalledWith('1');
    expect(screen.getByText(/added/i)).toBeInTheDocument();
  });
  it('sort toggle reorders to effect (Beta first)', () => {
    render(<SupportCardPoolCard {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /effect/i }));
    const names = screen.getAllByTestId('pool-card-name').map((e) => e.textContent);
    expect(names[0]).toBe('Beta');
  });
  it('Icon view is an accordion: clicking an icon expands one tile at a time', () => {
    render(<SupportCardPoolCard {...base} />);
    const toggles = screen.getAllByRole('button', { name: /details$/i });
    // Nothing expanded initially.
    expect(toggles.every((b) => b.getAttribute('aria-expanded') === 'false')).toBe(true);
    // Expand the first tile.
    fireEvent.click(toggles[0]!);
    expect(toggles[0]!.getAttribute('aria-expanded')).toBe('true');
    expect(toggles[1]!.getAttribute('aria-expanded')).toBe('false');
    // Expanding the second collapses the first (one at a time).
    fireEvent.click(toggles[1]!);
    expect(toggles[0]!.getAttribute('aria-expanded')).toBe('false');
    expect(toggles[1]!.getAttribute('aria-expanded')).toBe('true');
    // Clicking the open tile again collapses it.
    fireEvent.click(toggles[1]!);
    expect(toggles[1]!.getAttribute('aria-expanded')).toBe('false');
  });
});
