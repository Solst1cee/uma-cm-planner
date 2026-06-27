// src/app/App.inheritance.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Stub ActivePlan with a null plan → the uma-plan card is not rendered, so the
// route smoke test needs no GameData provider. (Real @/db settings resolve fine.)
vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({ uma1Plan: null, plan: null }),
}));
// useUmas + useGameData are called unconditionally by the page; stub both so it needs no provider.
vi.mock('@/features/parents/useUmas', () => ({
  useUmas: () => ({ umas: [], umaById: new Map() }),
  umaName: (_m: unknown, id: string) => `Uma ${id}`,
}));
// The page resolves wishlist skills (skillById) and the M1.5 Deck card art
// (cardById) through useGameData; stub both so the route needs no GameData provider.
vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ skillById: new Map(), cardById: new Map(), cards: [] }),
  BASE_URL: '',
}));

import { InheritancePage } from '@/features/inheritance/InheritancePage';

afterEach(cleanup);

describe('Inheritance route', () => {
  it('mounts InheritancePage at /inheritance', async () => {
    render(
      <MemoryRouter initialEntries={['/inheritance']}>
        <Routes>
          <Route path="/inheritance" element={<InheritancePage deps={{ loadCatalog: () => Promise.resolve([]) }} />} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByText(/loading plan/i)).toBeInTheDocument());
  });
});
