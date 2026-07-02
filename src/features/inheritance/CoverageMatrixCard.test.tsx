// src/features/inheritance/CoverageMatrixCard.test.tsx
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CoverageMatrixCard } from './CoverageMatrixCard';
import type { CoverageResult } from '@/core/coverageMatrix';

afterEach(cleanup);

const result: CoverageResult = {
  rows: [
    { skillId: '200011', name: 'Corner Adept', isGold: false,
      cells: { innate: [{ kind: 'innate', label: 'TR', title: 'Trainee' }], event: [], parent: [], gp: [], hint: [], chain: [], random: [] }, covered: true },
    { skillId: '200022', name: 'Slick Surge', isGold: true,
      cells: { innate: [], event: [], parent: [], gp: [], hint: [], chain: [], random: [] }, covered: false },
  ],
  bars: [
    { column: 'innate', count: 1, pct: 50 },
    { column: 'uncovered', count: 1, pct: 50 },
  ],
  bonus: [{ skillId: '200099', name: 'Bonus Skill', chips: [{ kind: 'chain', label: 'SP', title: 'Speedy', cardType: 'speed' }] }],
};

describe('CoverageMatrixCard', () => {
  it('renders wishlist skill names in the matrix', () => {
    render(<CoverageMatrixCard result={result} hasWishlist hasPlanUma />);
    expect(screen.getByText('Corner Adept')).toBeTruthy();
    expect(screen.getByText('Slick Surge')).toBeTruthy();
  });

  it('marks the uncovered row with the row-uncovered class', () => {
    const { container } = render(<CoverageMatrixCard result={result} hasWishlist hasPlanUma />);
    expect(container.querySelector('.row-uncovered')).toBeTruthy();
  });

  it('toggles to the Coverage (bars) view', () => {
    render(<CoverageMatrixCard result={result} hasWishlist hasPlanUma />);
    fireEvent.click(screen.getByRole('button', { name: /coverage/i }));
    expect(screen.getByText(/uncovered/i)).toBeTruthy();
  });

  it('renders the bonus list', () => {
    render(<CoverageMatrixCard result={result} hasWishlist hasPlanUma />);
    expect(screen.getByText('Bonus Skill')).toBeTruthy();
  });

  it('shows an empty state when there is no wishlist', () => {
    render(<CoverageMatrixCard result={{ rows: [], bars: [], bonus: [] }} hasWishlist={false} hasPlanUma />);
    expect(screen.getByText(/add skills to your wishlist/i)).toBeTruthy();
  });

  it('renders the event hint button (not the initials chip) when renderEventHint returns a node', () => {
    const evResult: CoverageResult = {
      rows: [
        { skillId: '201902', name: 'Head-On', isGold: false,
          cells: { innate: [], event: [{ kind: 'event', label: 'TS', title: 'Taiki — training event', skillId: '201902' }],
            parent: [], gp: [], hint: [], chain: [], random: [] },
          covered: true },
      ],
      bars: [], bonus: [],
    };
    render(
      <CoverageMatrixCard
        result={evResult}
        hasWishlist
        hasPlanUma
        renderEventHint={(skillId) => <button type="button" data-testid="ev-hint" data-skill-id={skillId}>?</button>}
      />,
    );
    expect(screen.getByTestId('ev-hint').getAttribute('data-skill-id')).toBe('201902');
    expect(screen.queryByText('TS')).toBeNull(); // initials fallback replaced by the hint button
  });

  it('falls back to the plain event chip when renderEventHint returns null', () => {
    const evResult: CoverageResult = {
      rows: [
        { skillId: '201902', name: 'Head-On', isGold: false,
          cells: { innate: [], event: [{ kind: 'event', label: 'TS', title: 'Taiki — training event', skillId: '201902' }],
            parent: [], gp: [], hint: [], chain: [], random: [] },
          covered: true },
      ],
      bars: [], bonus: [],
    };
    render(<CoverageMatrixCard result={evResult} hasWishlist hasPlanUma renderEventHint={() => null} />);
    expect(screen.getByText('TS')).toBeTruthy();
  });

  it('renders the support-card icon (not initials) for a deck-source chip when renderCardIcon is supplied', () => {
    const iconResult: CoverageResult = {
      rows: [
        { skillId: '200033', name: 'Straightaway', isGold: false,
          cells: { innate: [], event: [], parent: [], gp: [], hint: [],
            chain: [{ kind: 'chain', label: 'SP', title: 'Speedy', cardType: 'speed', cardId: '30001' }], random: [] },
          covered: true },
      ],
      bars: [], bonus: [],
    };
    render(
      <CoverageMatrixCard
        result={iconResult}
        hasWishlist
        hasPlanUma
        renderCardIcon={(cardId, size) => <img data-testid="card-icon" data-card-id={cardId} width={size} alt="" />}
      />,
    );
    const icon = screen.getByTestId('card-icon');
    expect(icon.getAttribute('data-card-id')).toBe('30001');
    // The initials fallback ("SP") is NOT rendered when the icon is present.
    expect(screen.queryByText('SP')).toBeNull();
  });
});
