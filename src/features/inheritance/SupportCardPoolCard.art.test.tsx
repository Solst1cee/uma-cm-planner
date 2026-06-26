// src/features/inheritance/SupportCardPoolCard.art.test.tsx
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SupportCardPoolCard } from './SupportCardPoolCard';
import { buildPoolItem } from './poolModel';
import type { SupportCardRecord } from '@/core/types';

const card = { cardId: '1', nameEn: 'Alpha', charName: 'Alpha', rarity: 'SSR', type: 'speed',
  skills: [{ skillId: 's1', sourceType: 'chain' }, { skillId: 's2', sourceType: 'random_event' }] } as unknown as SupportCardRecord;
const item = buildPoolItem(card, { score: 10, wishlist: new Set(), lb: 4 });
const props = { items: [item], wishlistSkillNames: [], statsShown: [], cardLb: {}, onCardLb: vi.fn(),
  deckCardIds: new Set<string>(), onAdd: vi.fn(), renderIcon: () => <i />, skillName: (id: string) => `name-${id}` };
afterEach(cleanup);

it('art view shows chain + random event skills', () => {
  render(<SupportCardPoolCard {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /^art$/i }));
  expect(screen.getByText('name-s1')).toBeInTheDocument();
  expect(screen.getByText('name-s2')).toBeInTheDocument();
});
