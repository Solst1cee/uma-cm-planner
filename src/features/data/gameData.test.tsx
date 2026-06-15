/**
 * Loader degradation contract (Phase 2): umas.json is an optional dataset —
 * its failure degrades to an empty uma list with a console warning, while a
 * failure of any of the four core datasets flips the provider to whole-set
 * fixture mode (P3 banner). The two paths must never mix.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { UmaRecord } from '@/core/types';
import { FIXTURE_CARDS, FIXTURE_SKILLS, FIXTURE_SPARK_RATES } from '@/core/fixtures';
import { GameDataProvider, useGameData } from '@/features/data/gameData';

const UMAS: UmaRecord[] = [
  {
    umaId: '100201',
    charaId: '1002',
    nameEn: 'Daiwa Scarlet',
    server: 'global',
    dataVersion: 'test',
  },
];

const DATASETS: Record<string, unknown> = {
  'skills.json': FIXTURE_SKILLS,
  'support_cards.json': FIXTURE_CARDS,
  'spark_rates.json': FIXTURE_SPARK_RATES,
  'cm_presets.json': [],
  'umas.json': UMAS,
  'timeline.json': { entries: [] },
};

function Probe() {
  const { status, umas, umaById } = useGameData();
  return (
    <div
      data-testid="probe"
      data-status={status}
      data-umas={(umas ?? []).length}
      data-uma-name={umaById?.get('100201')?.nameEn ?? ''}
    />
  );
}

function stubFetch(fails: (file: string) => boolean) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const file = url.slice(url.lastIndexOf('/') + 1);
      if (fails(file)) {
        return Promise.resolve({ ok: false, status: 404 } as Response);
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(DATASETS[file]),
      } as Response);
    }),
  );
}

function renderProbe() {
  return render(
    <GameDataProvider>
      <Probe />
    </GameDataProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('GameDataProvider umas loading', () => {
  it('exposes umas + umaById when umas.json loads', async () => {
    stubFetch(() => false);
    renderProbe();
    await waitFor(() =>
      expect(screen.getByTestId('probe')).toHaveAttribute('data-status', 'ready'),
    );
    expect(screen.getByTestId('probe')).toHaveAttribute('data-umas', '1');
    expect(screen.getByTestId('probe')).toHaveAttribute('data-uma-name', 'Daiwa Scarlet');
  });

  it('degrades to an empty uma list (with a warning) when only umas.json fails — NOT to fixture mode', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    stubFetch((file) => file === 'umas.json');
    renderProbe();
    await waitFor(() =>
      expect(screen.getByTestId('probe')).toHaveAttribute('data-status', 'ready'),
    );
    expect(screen.getByTestId('probe')).toHaveAttribute('data-umas', '0');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('umas.json'),
      expect.anything(),
    );
  });

  it('still flips to whole-set fixture mode when a core dataset fails', async () => {
    stubFetch((file) => file === 'skills.json');
    renderProbe();
    await waitFor(() =>
      expect(screen.getByTestId('probe')).toHaveAttribute('data-status', 'fixture'),
    );
    expect(screen.getByTestId('probe')).toHaveAttribute('data-umas', '0');
  });
});
