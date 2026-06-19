import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan, SupportCardRecord, SkillRecord } from '@/core/types';
import { SourcingPanel } from './SourcingPanel';

const card: SupportCardRecord = { cardId: '1', nameEn: 'Kitasan SSR', charName: 'Kitasan', rarity: 'SSR', type: 'speed',
  perLevel: [{ limitBreak: 4, hintFrequency: 30, hintLevels: 2, specialtyPriority: 0 }],
  skills: [{ skillId: 'sx', sourceType: 'hint_pool' }], hintPoolSize: 1, server: 'global', dataVersion: 't' };
// Upcoming preview card (server:'jp') — must NOT appear as a source (P4 guard).
const jpCard: SupportCardRecord = { cardId: '2', nameEn: 'Upcoming SSR', charName: 'Future', rarity: 'SSR', type: 'speed',
  perLevel: [{ limitBreak: 4, hintFrequency: 30, hintLevels: 2, specialtyPriority: 0 }],
  skills: [{ skillId: 'sz', sourceType: 'hint_pool' }], hintPoolSize: 1, server: 'jp', dataVersion: 't', releaseDate: '2026-07-30' };
const skills: SkillRecord[] = [
  { skillId: 'sx', nameEn: 'Escape Artist', nameJp: '', baseSpCost: 200, rarity: 'white', iconId: '1', conditions: '', server: 'global', dataVersion: 't' },
  { skillId: 'sy', nameEn: 'Orphan Skill', nameJp: '', baseSpCost: 100, rarity: 'white', iconId: '1', conditions: '', server: 'global', dataVersion: 't' },
  { skillId: 'sz', nameEn: 'Upcoming Skill', nameJp: '', baseSpCost: 100, rarity: 'white', iconId: '1', conditions: '', server: 'jp', dataVersion: 't', releaseDate: '2026-07-30' },
];
const cards = [card, jpCard];
vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({
    cards,
    cardById: new Map(cards.map((c) => [c.cardId, c])),
    skillById: new Map(skills.map((s) => [s.skillId, s])),
  }),
}));
afterEach(cleanup);

function plan(wishlist: Array<{ skillId: string }>): CmPlan {
  return { wishlist: wishlist.map((w) => ({ skillId: w.skillId, priority: 1, source: 'targeted' })) } as unknown as CmPlan;
}

describe('SourcingPanel', () => {
  it('shows the hinting card for a sourced skill and a gap for an unsourced one', () => {
    render(<SourcingPanel plan={plan([{ skillId: 'sx' }, { skillId: 'sy' }])} />);
    expect(screen.getByText('Escape Artist')).toBeInTheDocument();
    expect(screen.getByText('Kitasan SSR')).toBeInTheDocument();        // card hint chip
    expect(screen.getByText('Orphan Skill')).toBeInTheDocument();
    expect(screen.getByText(/no source/i)).toBeInTheDocument();          // gap marker
  });

  it('prompts when the wishlist is empty', () => {
    render(<SourcingPanel plan={plan([])} />);
    expect(screen.getByText(/Add target skills/i)).toBeInTheDocument();
  });

  it('excludes upcoming (server:jp) cards from sourcing — they show as a gap (P4 guard)', () => {
    // sz is hinted ONLY by the jp preview card; the global-only guard must drop it.
    render(<SourcingPanel plan={plan([{ skillId: 'sz' }])} />);
    expect(screen.getByText('Upcoming Skill')).toBeInTheDocument();        // the skill row
    expect(screen.queryByText('Upcoming SSR')).not.toBeInTheDocument();    // jp card NOT shown as a source
    expect(screen.getByText(/no source/i)).toBeInTheDocument();            // gap, because jp was excluded
  });
});
