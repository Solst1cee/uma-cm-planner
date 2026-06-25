// src/app/App.inheritance.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Stub ActivePlan with a null plan → the inventory card is not rendered, so the
// route smoke test needs no GameData provider. (Real @/db settings resolve fine.)
vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({ uma1Plan: null, plan: null }),
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
