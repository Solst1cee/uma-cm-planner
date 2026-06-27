// src/features/inheritance/UploadDataButton.test.tsx
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UploadDataButton } from './UploadDataButton';

const sample = [{
  trained_chara_id: 47, card_id: 101501, speed: 991, stamina: 677, power: 632, wiz: 450, guts: 398,
  rank: 12, factor_id_array: [202, 2201], succession_chara_array: [],
}];

vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ skills: [] }),
}));
const bulk = vi.fn(async (p: unknown[]) => p.length);
vi.mock('@/db', () => ({
  bulkUpsertParents: (p: unknown[]) => bulk(p),
  listParents: async () => [],
  getSetting: async () => null,
  setSetting: async () => undefined,
}));

afterEach(cleanup);

describe('UploadDataButton', () => {
  it('parses an uploaded file and upserts the roster', async () => {
    const onImported = vi.fn();
    render(<UploadDataButton onImported={onImported} />);
    const file = new File([JSON.stringify(sample)], 'data.json', { type: 'application/json' });
    const input = screen.getByLabelText(/upload data/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(bulk).toHaveBeenCalled());
    expect(bulk.mock.calls[0]![0]).toHaveLength(1);
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(screen.getByText(/imported 1/i)).toBeInTheDocument();
  });
});
