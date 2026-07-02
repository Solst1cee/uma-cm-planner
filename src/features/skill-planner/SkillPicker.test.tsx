import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

const skills = [
  { skillId: '200011', nameEn: 'Global White', nameJp: '', baseSpCost: 120, rarity: 'white', iconId: '20001', conditions: '', server: 'global', dataVersion: 't' },
  { skillId: '203441', nameEn: 'JP White', nameJp: '', baseSpCost: 100, rarity: 'white', iconId: '20042', conditions: '', server: 'jp', releaseDate: '2026-06-01', releaseDatePredicted: true, dataVersion: 't' },
];
vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ status: 'ready', skills, skillById: new Map(skills.map((s) => [s.skillId, s])), iconManifest: null }),
}));

import { SkillPicker } from './SkillPicker';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('SkillPicker availability gate', () => {
  it('hides JP skills by default and shows them behind show-upcoming when released by the CM date', async () => {
    render(<SkillPicker addedSkillIds={new Set()} onPick={vi.fn()} asOfISO="2026-07-01" />);
    await userEvent.type(screen.getByRole('searchbox'), 'White');
    expect(screen.getByText('Global White')).toBeInTheDocument();
    expect(screen.queryByText('JP White')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/show upcoming/i));
    expect(screen.getByText('JP White')).toBeInTheDocument();
  });
  it('never shows JP skills when no asOfISO is provided (non-wishlist callers)', async () => {
    render(<SkillPicker addedSkillIds={new Set()} onPick={vi.fn()} />);
    await userEvent.type(screen.getByRole('searchbox'), 'White');
    expect(screen.queryByLabelText(/show upcoming/i)).not.toBeInTheDocument();
    expect(screen.queryByText('JP White')).not.toBeInTheDocument();
  });
});
