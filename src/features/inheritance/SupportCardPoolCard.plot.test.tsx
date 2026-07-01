// src/features/inheritance/SupportCardPoolCard.plot.test.tsx
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SupportCardPoolCard } from './SupportCardPoolCard';
import { buildPoolItem } from './poolModel';
import type { SupportCardRecord } from '@/core/types';
const mk = (id: string, name: string, score?: number) =>
  buildPoolItem({ cardId: id, nameEn: name, charName: name, rarity: 'SSR', type: 'speed', skills: [] } as unknown as SupportCardRecord, { score, wishlist: new Set(), lb: 4 });
const props = { items: [mk('1', 'Alpha', 10), mk('2', 'Beta')], wishlistSkillNames: [], statsShown: [],
  cardLb: {}, onCardLb: vi.fn(), deckCardIds: new Set<string>(), onAdd: vi.fn(), renderIcon: () => <i />, skillName: (id: string) => id };
afterEach(cleanup);
it('plot omits unscored cards and notes them; clicking a node adds', () => {
  const onAdd = vi.fn();
  render(<SupportCardPoolCard {...props} onAdd={onAdd} />);
  fireEvent.click(screen.getByRole('button', { name: /^plot$/i }));
  expect(screen.getByText(/1 cards have no score/i)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/add Alpha/i));
  expect(onAdd).toHaveBeenCalledWith('1');
});
