// src/features/inheritance/InheritancePage.pool.test.tsx
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan } from '@/core/types';

// A complete-enough plan so the merged page's M1.3 (uma-plan/plan-targets) AND
// M1.6 (pool) code paths both render. `umaId` resolves to no uma (placeholder).
const plan: CmPlan = {
  id: 'p1', name: 'Test plan', planNumber: 1,
  cmRef: { kind: 'cm', cmId: 'CM1', cmNumber: 1, courseId: '10906', surface: 'turf', distance: 2400 },
  scenarioId: 4, umaId: 'u1', uniqueSkillId: '', role: 'ace', strategy: 'late',
  statProfile: { stats: { spd: 1200, sta: 900, pow: 1000, gut: 600, wit: 1100 }, mood: 2 },
  sparkGoals: { pink: [], blue: {} }, wishlist: [], parents: {},
  patch: { version: 'x' }, server: 'global', dataVersion: 'x',
} as CmPlan;

vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({
    uma1Plan: plan, plan, uma2Plan: null, savedPlans: [plan],
    setPlan: vi.fn(), saveCurrentPlan: vi.fn(), loadPlanIntoSlot: vi.fn(),
    deleteSavedPlan: vi.fn(), importSavedPlans: vi.fn(), deleteAllSavedPlans: vi.fn(),
  }),
}));
vi.mock('@/features/parents/useUmas', () => ({ useUmas: () => ({ umas: [], umaById: new Map() }), umaName: (_: unknown, id: string) => id }));
// Heavy M1.3 components need providers — stub them; this test exercises the center-column pool.
vi.mock('@/features/cm-planner/PlanInventoryCard', () => ({ PlanInventoryCard: () => <div data-testid="inventory" /> }));
vi.mock('@/features/skill-planner/SkillPicker', () => ({ SkillPicker: () => <div data-testid="skill-picker" /> }));
vi.mock('@/features/data/gameData', () => ({
  BASE_URL: '/',
  useGameData: () => ({
    cardById: new Map(),
    skillById: new Map(),
    skills: [],
    cards: [{ cardId: '30028', nameEn: 'Kitasan', charName: 'Kitasan', rarity: 'SSR', type: 'speed', skills: [] }],
    // GameIcon resolves a card image only when the id is in the manifest.
    iconManifest: {
      dataVersion: 'test',
      format: 'webp',
      skill: [],
      card: ['30028'],
      uma: [],
      ui: ['stat-spd', 'stat-sta', 'stat-pow', 'stat-gut', 'stat-wit'],
    },
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
  // A stat-type badge (kind="ui") is overlaid top-right; Kitasan is a speed card.
  const typeBadge = container.querySelector('img.inh-pool-card-type-img') as HTMLImageElement | null;
  expect(typeBadge).not.toBeNull();
  expect(typeBadge!.getAttribute('src')).toContain('data/icons/ui/stat-spd.webp');
  // The badge body is filled with the card's in-game type color (set inline).
  const badge = container.querySelector('.inh-pool-card-type') as HTMLElement | null;
  expect(badge?.style.background).not.toBe('');
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
