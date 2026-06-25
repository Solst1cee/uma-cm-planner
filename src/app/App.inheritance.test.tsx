// src/app/App.inheritance.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Stub ActivePlan so no Dexie is needed; the page only reads uma1Plan here.
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
