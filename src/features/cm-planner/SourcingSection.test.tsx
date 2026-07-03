import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render } from '@testing-library/react';
import type { SupportCardRecord } from '@/core/types';
import { SourcingSection } from './SourcingSection';

afterEach(cleanup);

// Icons need the GameData provider; stub them so the test focuses on the sourcing join.
vi.mock('@/features/data/GameIcon', () => ({ GameIcon: () => null }));

const card = (cardId: string, nameEn: string, skills: SupportCardRecord['skills'], server: SupportCardRecord['server'] = 'global'): SupportCardRecord =>
  ({
    cardId, nameEn, charName: '', rarity: 'SSR', type: 'speed',
    perLevel: [{ limitBreak: 4, hintFrequency: 30, specialtyPriority: 0 }],
    skills, hintPoolSize: 5, server, dataVersion: 'x',
  } as SupportCardRecord);

const cards: SupportCardRecord[] = [
  card('30002', 'Hinter', [{ skillId: 'S1', sourceType: 'hint_pool', hintLevels: 1 }]),
  card('30001', 'Chainer', [{ skillId: 'S1', sourceType: 'chain' }]),
];

let gameData: { cards: SupportCardRecord[] } = { cards };
vi.mock('@/features/data/gameData', () => ({ useGameData: () => gameData }));

// The reverse card-hint index reads the shared app-wide planning horizon; default
// mirrors "current" (global only). Tests can swap `availabilityFixture` for a
// cm-like predicate that also admits released-by-cutoff JP-ahead cards.
let availabilityFixture: {
  visible: (r: { server: string; releaseDate?: string }) => boolean;
  tierOf: (r: { server: string; releaseDate?: string }) => 'now' | 'upcoming' | 'future';
} = {
  visible: (r) => r.server === 'global',
  tierOf: () => 'now',
};
vi.mock('@/app/useAvailability', () => ({
  useAvailability: () => availabilityFixture,
}));

describe('SourcingSection', () => {
  it('lists the cards that hint a white skill, best tier first, with a tier badge', () => {
    const { container } = render(<SourcingSection skillId="S1" rarity="white" />);
    expect(container.textContent).toMatch(/Where to get it/i);
    expect(container.textContent).toContain('Chainer');
    expect(container.textContent).toContain('Hinter');
    const badges = Array.from(container.querySelectorAll('.cmp-tier-badge'));
    expect(badges).toHaveLength(2);
    expect(badges[0]?.className).toContain('is-tier-chain');       // chain ranks above any hint
    expect(badges[1]?.className).toContain('is-tier-hint_strong');  // 30 freq + pool 5 → reliable
  });

  it('shows a gap warning when no card hints the skill', () => {
    const { container } = render(<SourcingSection skillId="UNHINTED" rarity="gold" />);
    expect(container.textContent).toMatch(/No support card hints/i);
    expect(container.querySelector('.cmp-sourcing-cards')).toBeNull();
  });

  it('renders nothing for a unique skill (innate, not card-sourced)', () => {
    const { container } = render(<SourcingSection skillId="S1" rarity="unique" />);
    expect(container.querySelector('.cmp-sourcing')).toBeNull();
  });

  it('excludes JP-ahead cards from the sourcing index (availability gate)', () => {
    // A global card and a JP-ahead card both hint skill S2.
    // Only the global card should appear as a source.
    const prevData = gameData;
    gameData = {
      cards: [
        card('40001', 'GlobalCard', [{ skillId: 'S2', sourceType: 'chain' }], 'global'),
        card('40002', 'JpCard',     [{ skillId: 'S2', sourceType: 'chain' }], 'jp'),
      ],
    };
    const { container } = render(<SourcingSection skillId="S2" rarity="white" />);
    expect(container.textContent).toContain('GlobalCard');
    expect(container.textContent).not.toContain('JpCard');
    gameData = prevData;
  });

  it('includes an upcoming JP-ahead card as a source when the horizon predicate admits it', () => {
    const prevData = gameData;
    const prevAvailability = availabilityFixture;
    gameData = {
      cards: [
        card('40001', 'GlobalCard', [{ skillId: 'S3', sourceType: 'chain' }], 'global'),
        card('40003', 'JpUpcoming', [{ skillId: 'S3', sourceType: 'chain' }], 'jp'),
      ],
    };
    // A cm-like predicate: released by the plan's CM cutoff, regardless of server.
    availabilityFixture = { visible: () => true, tierOf: () => 'now' };
    const { container } = render(<SourcingSection skillId="S3" rarity="white" />);
    expect(container.textContent).toContain('GlobalCard');
    expect(container.textContent).toContain('JpUpcoming');
    gameData = prevData;
    availabilityFixture = prevAvailability;
  });

  it('marks a JP-ahead source row with its availability tier chip (P3: never an unmarked source)', () => {
    const prevData = gameData;
    const prevAvailability = availabilityFixture;
    const jp = card('40003', 'JpUpcoming', [{ skillId: 'S3', sourceType: 'chain' }], 'jp');
    jp.releaseDate = '2026-09-01';
    jp.releaseDatePredicted = true;
    gameData = {
      cards: [card('40001', 'GlobalCard', [{ skillId: 'S3', sourceType: 'chain' }], 'global'), jp],
    };
    availabilityFixture = {
      visible: () => true,
      tierOf: (r) => (r.server === 'jp' ? 'upcoming' : 'now'),
    };
    const { container } = render(<SourcingSection skillId="S3" rarity="white" />);
    const chips = Array.from(container.querySelectorAll('.tier-chip'));
    expect(chips).toHaveLength(1); // only the JP row is chipped; 'now' renders nothing
    expect(chips[0]?.textContent).toBe('upcoming');
    // and the projected date is shown, labeled as a projection
    expect(container.textContent).toContain('~2026-09-01');
    gameData = prevData;
    availabilityFixture = prevAvailability;
  });
});
