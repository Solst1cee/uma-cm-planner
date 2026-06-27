// src/app/App.inheritance.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Stub ActivePlan with a null plan → the uma-plan card is not rendered, so the
// route smoke test needs no GameData provider. (Real @/db settings resolve fine.)
vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({ uma1Plan: null, plan: null, setPlan: vi.fn() }),
}));
// useUmas + useGameData are called unconditionally by the page; stub both so it needs no provider.
vi.mock('@/features/parents/useUmas', () => ({
  useUmas: () => ({ umas: [], umaById: new Map() }),
  umaName: (_m: unknown, id: string) => `Uma ${id}`,
}));
// InheritanceCard (M1.4, wired in the center column) calls useRoster unconditionally
// before its uma1Plan null-guard → stub it so no Dexie/GameDataProvider is needed.
vi.mock('@/features/inheritance/useRoster', () => ({
  useRoster: () => ({ roster: [], importedAt: null, importFromFile: vi.fn() }),
  ROSTER_IMPORTED_AT_KEY: 'umaExtractorImportedAt',
  makeWhiteResolver: () => () => undefined,
}));
// The page resolves wishlist skills (skillById), the M1.5 Deck card art (cardById)
// and the M1.4 white-skill options (skills) through useGameData; stub all so the
// route needs no GameData provider.
vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ skillById: new Map(), cardById: new Map(), skills: [] }),
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
