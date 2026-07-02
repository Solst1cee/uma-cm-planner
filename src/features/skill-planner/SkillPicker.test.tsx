import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

const skills = [
  { skillId: '200011', nameEn: 'Global White', nameJp: '', baseSpCost: 120, rarity: 'white', iconId: '20001', conditions: '', server: 'global', dataVersion: 't' },
  { skillId: '203441', nameEn: 'JP White', nameJp: '', baseSpCost: 100, rarity: 'white', iconId: '20042', conditions: '', server: 'jp', releaseDate: '2026-06-01', releaseDatePredicted: true, dataVersion: 't' },
];
vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ status: 'ready', skills, skillById: new Map(skills.map((s) => [s.skillId, s])), iconManifest: null }),
}));

// The shared app-wide horizon lens — mocked with a mutable fixture so individual
// tests can simulate 'current' (default) and 'cm' horizon behavior without a full
// ActivePlanContext/gameData provider stack.
const avail = vi.hoisted(() => ({
  visible: (r: { server: string; releaseDate?: string }) => r.server === 'global',
  tierOf: (r: { server: string; releaseDate?: string }): 'now' | 'upcoming' | 'future' =>
    r.server === 'global' ? 'now' : 'upcoming',
}));
vi.mock('@/app/useAvailability', () => ({
  useAvailability: () => ({
    visible: avail.visible,
    tierOf: avail.tierOf,
    horizon: { kind: 'current' },
    setHorizon: vi.fn(),
    cutoffISO: '2026-07-02',
    todayISO: '2026-07-02',
    planCmISO: '2026-07-02',
    futureCms: [],
  }),
}));

import { SkillPicker } from './SkillPicker';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  avail.visible = (r) => r.server === 'global';
  avail.tierOf = (r) => (r.server === 'global' ? 'now' : 'upcoming');
});

describe('SkillPicker availability gate', () => {
  it('current horizon: JP skill absent (behavior preservation)', async () => {
    render(<SkillPicker addedSkillIds={new Set()} onPick={vi.fn()} />);
    await userEvent.type(screen.getByRole('searchbox'), 'White');
    expect(screen.getByText('Global White')).toBeInTheDocument();
    expect(screen.queryByText('JP White')).not.toBeInTheDocument();
  });

  it('cm horizon reveals the JP skill with a tier chip', async () => {
    avail.visible = (r) => r.server === 'global' || r.server === 'jp';
    avail.tierOf = (r) => (r.server === 'global' ? 'now' : 'upcoming');
    render(<SkillPicker addedSkillIds={new Set()} onPick={vi.fn()} />);
    await userEvent.type(screen.getByRole('searchbox'), 'White');
    expect(screen.getByText('Global White')).toBeInTheDocument();
    const jp = screen.getByText('JP White');
    expect(jp).toBeInTheDocument();
    const row = jp.closest('li')!;
    expect(within(row).getByText('upcoming')).toBeInTheDocument();
  });
});
