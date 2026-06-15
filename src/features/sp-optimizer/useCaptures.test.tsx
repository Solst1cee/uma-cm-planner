import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import { useCaptures } from '@/features/sp-optimizer/useCaptures';

vi.mock('@/db', () => ({
  listCaptures: vi.fn(async () => []),
  saveCapture: vi.fn(async (d: { label: string; bundle: unknown }) => ({ id: 'id1', ...d })),
  deleteCapture: vi.fn(async () => undefined),
}));

afterEach(cleanup);

describe('useCaptures', () => {
  it('loads captures and exposes save/remove', async () => {
    const { result } = renderHook(() => useCaptures());
    await waitFor(() => expect(result.current.items).not.toBeNull());
    expect(result.current.items).toEqual([]);
    await act(async () => { await result.current.save('CM14', { schemaVersion: 1 } as never); });
    expect(result.current.error).toBeNull();
  });
});
