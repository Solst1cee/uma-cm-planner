import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CmPlan, SupportCardRecord, SkillRecord } from '@/core/types';
import { SourcingPanel } from './SourcingPanel';

const card: SupportCardRecord = { cardId: '1', nameEn: 'Kitasan SSR', charName: 'Kitasan', rarity: 'SSR', type: 'speed',
  perLevel: [{ limitBreak: 4, hintFrequency: 30, hintLevels: 2, specialtyPriority: 0 }],
  skills: [{ skillId: 'sx', sourceType: 'hint_pool' }], hintPoolSize: 1, server: 'global', dataVersion: 't' };
const skills: SkillRecord[] = [
  { skillId: 'sx', nameEn: 'Escape Artist', nameJp: '', baseSpCost: 200, rarity: 'white', iconId: '1', conditions: '', server: 'global', dataVersion: 't' },
  { skillId: 'sy', nameEn: 'Orphan Skill', nameJp: '', baseSpCost: 100, rarity: 'white', iconId: '1', conditions: '', server: 'global', dataVersion: 't' },
];
vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({
    cards: [card],
    cardById: new Map([[card.cardId, card]]),
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
});
