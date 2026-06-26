// src/features/inheritance/InheritancePage.pool.test.tsx
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('@/app/ActivePlanContext', () => ({ useActivePlan: () => ({ uma1Plan: { umaId: 'u1', name: 'Test plan', planNumber: 1, wishlist: [], sparkGoals: { blue: [], pink: [] }, cmRef: { kind: 'cm', cmId: 'CM1', cmNumber: 1, courseId: '10906', surface: 'turf', distance: 2400 } }, plan: null, setPlan: vi.fn() }) }));
vi.mock('@/features/parents/useUmas', () => ({ useUmas: () => ({ umas: [], umaById: new Map() }), umaName: (_: unknown, id: string) => id }));
vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({
    cardById: new Map(),
    skillById: new Map(),
    cards: [{ cardId: '30028', nameEn: 'Kitasan', charName: 'Kitasan', rarity: 'SSR', type: 'speed', skills: [] }],
  }),
}));
import { InheritancePage } from './InheritancePage';
afterEach(cleanup);

it('renders the support-card pool with a card', async () => {
  render(<InheritancePage deps={{ loadCatalog: () => Promise.resolve([]) }} />);
  await waitFor(() => expect(screen.getByText('Support cards')).toBeInTheDocument());
  expect(screen.getByText('Kitasan')).toBeInTheDocument();
});
