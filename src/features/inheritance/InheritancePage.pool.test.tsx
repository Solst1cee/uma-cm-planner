// src/features/inheritance/InheritancePage.pool.test.tsx
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('@/app/ActivePlanContext', () => ({ useActivePlan: () => ({ uma1Plan: { umaId: 'u1', name: 'Test plan', planNumber: 1, wishlist: [], sparkGoals: { blue: [], pink: [] }, cmRef: { kind: 'cm', cmId: 'CM1', cmNumber: 1, courseId: '10906', surface: 'turf', distance: 2400 } }, plan: null, setPlan: vi.fn() }) }));
vi.mock('@/features/parents/useUmas', () => ({ useUmas: () => ({ umas: [], umaById: new Map() }), umaName: (_: unknown, id: string) => id }));
vi.mock('@/features/data/gameData', () => ({
  BASE_URL: '/',
  useGameData: () => ({
    cardById: new Map(),
    skillById: new Map(),
    cards: [{ cardId: '30028', nameEn: 'Kitasan', charName: 'Kitasan', rarity: 'SSR', type: 'speed', skills: [] }],
    // GameIcon resolves a card image only when the id is in the manifest.
    iconManifest: { dataVersion: 'test', format: 'webp', skill: [], card: ['30028'], uma: [] },
  }),
}));
import { InheritancePage } from './InheritancePage';
afterEach(cleanup);

it('renders the support-card pool with a card', async () => {
  render(<InheritancePage deps={{ loadCatalog: () => Promise.resolve([]) }} />);
  await waitFor(() => expect(screen.getByText('Support cards')).toBeInTheDocument());
  expect(screen.getByText('Kitasan')).toBeInTheDocument();
});

it('renders the real square card icon (GameIcon) for a manifest-present card', async () => {
  const { container } = render(<InheritancePage deps={{ loadCatalog: () => Promise.resolve([]) }} />);
  await waitFor(() => expect(screen.getByText('Kitasan')).toBeInTheDocument());
  // The tile's icon slot is a GameIcon kind="card" → a real <img>, NOT the old
  // type-letter placeholder. The src resolves to the bundled support webp.
  const img = container.querySelector('img.inh-pool-card-img') as HTMLImageElement | null;
  expect(img).not.toBeNull();
  expect(img!.getAttribute('src')).toContain('data/icons/support/30028.webp');
});

it('Add carries the tile LB into the deck slot — non-default LB 2 lands in deck', async () => {
  localStorage.clear();
  render(<InheritancePage deps={{ loadCatalog: () => Promise.resolve([]) }} />);
  await waitFor(() => expect(screen.getByText('Kitasan')).toBeInTheDocument());

  // The pool tile's diamond buttons are labelled "LB 1"–"LB 4".
  // Click "LB 2" to set Kitasan's limit-break to 2 on the tile.
  fireEvent.click(screen.getByRole('button', { name: 'LB 2' }));

  // Click Add to put the card into the deck.
  fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

  // The deck slot now contains Kitasan. Read localStorage to verify slotLb[0] === 2
  // (the slot the card lands in since it's the first empty slot).
  const raw = localStorage.getItem('scb_deck');
  expect(raw).not.toBeNull();
  const state = JSON.parse(raw!);
  expect(state.slots[0]).toBe('30028');
  // The bug was that Add always used DEFAULT_SLOT_LB (4) regardless of the tile LB.
  // This assertion proves the tile's chosen LB 2 was carried through.
  expect(state.slotLb[0]).toBe(2);
});
