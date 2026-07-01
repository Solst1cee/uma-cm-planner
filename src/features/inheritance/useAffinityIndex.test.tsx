import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { aff2 } from '@/core/affinity';
import { useAffinityIndex } from './useAffinityIndex';

afterEach(cleanup);

function Probe() {
  const idx = useAffinityIndex();
  return <div data-testid="aff">{idx ? `score:${aff2(idx, 1000, 1007)}` : 'loading'}</div>;
}

const GOOD_FETCH = vi.fn(async () => ({
  ok: true,
  json: async () => ({ server: 'global', dataVersion: 'x', groups: [{ relationType: 101, point: 5, members: [1000, 1007] }] }),
})) as unknown as typeof fetch;

describe('useAffinityIndex', () => {
  it('loads affinity.json and builds a working index', async () => {
    vi.stubGlobal('fetch', GOOD_FETCH);
    render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('aff')).toHaveTextContent('score:5'));
    vi.unstubAllGlobals();
  });

  it('retries after a failed fetch — inflight is cleared on failure', async () => {
    // Because cached/inflight are module-scope, this test uses vi.resetModules()
    // to get a fresh module instance with null cached/inflight.
    vi.resetModules();

    // First mount: fetch rejects → hook stays null
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })) as unknown as typeof fetch);

    const { useAffinityIndex: useIdx } = await import('./useAffinityIndex');
    function ProbeRetry() {
      const idx = useIdx();
      return <div data-testid="aff2">{idx ? `score:${aff2(idx, 1000, 1007)}` : 'loading'}</div>;
    }

    const { unmount } = render(<ProbeRetry />);
    // Wait a tick to let the promise settle
    await waitFor(() => expect(screen.getByTestId('aff2')).toHaveTextContent('loading'));
    unmount();
    cleanup();

    // Second mount: now fetch succeeds → inflight was cleared so it re-fetches
    vi.stubGlobal('fetch', GOOD_FETCH);
    render(<ProbeRetry />);
    await waitFor(() => expect(screen.getByTestId('aff2')).toHaveTextContent('score:5'));

    vi.unstubAllGlobals();
    vi.resetModules();
  });
});
