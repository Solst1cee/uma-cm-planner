import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Parent } from '@/core/types';
import { ParentCardView } from './ParentCardView';

afterEach(cleanup);
const p: Parent = {
  id: '1', umaId: '101501', blueSpark: { stat: 'spd', stars: 3 }, pinkSpark: { aptitude: 'long', stars: 2 },
  whiteSparks: [{ skillId: '200361', stars: 1 }], source: 'mine',
};

describe('ParentCardView', () => {
  it('renders the empty state with Find candidates + Change', () => {
    render(<ParentCardView label="Parent 1" parent={null} onFindCandidates={vi.fn()} onChange={vi.fn()} />);
    expect(screen.getByText('Parent 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /find candidates/i })).toBeInTheDocument();
  });

  it('renders blue + pink chips and a white-spark chip (skillId fallback) when filled', () => {
    render(<ParentCardView label="Parent 1" parent={p} onClear={vi.fn()} />);
    expect(screen.getByText(/Speed/)).toBeInTheDocument();
    expect(screen.getByText(/Long/)).toBeInTheDocument();
    expect(screen.getByText('200361')).toBeInTheDocument(); // no skillName → falls back to the id
  });

  it('resolves the white-spark chip to a skill NAME and the uma name via the resolvers', () => {
    render(
      <ParentCardView
        label="Parent 1"
        parent={p}
        name="Kitasan Black"
        skillName={(id) => (id === '200361' ? 'Groundwork' : id)}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText('Groundwork')).toBeInTheDocument(); // chip shows the name, not the code
    expect(screen.queryByText('200361')).not.toBeInTheDocument();
    expect(screen.getByText(/Kitasan Black/)).toBeInTheDocument(); // uma name, not the umaId code
    expect(screen.queryByText(/^101501/)).not.toBeInTheDocument();
  });

  it('shows the full lineage incl. grandparent sparks with grey GP stars', () => {
    const withGp = {
      ...p,
      grandparents: [
        { umaId: '100701', blueSpark: { stat: 'pow', stars: 2 }, whiteSparks: [{ skillId: '200999', stars: 1 }] },
        undefined,
      ],
    } as Parent;
    render(
      <ParentCardView
        label="Parent 1"
        parent={withGp}
        skillName={(id) => (id === '200999' ? 'Corner Adept' : id)}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText(/Power/)).toBeInTheDocument(); // grandparent's blue chip
    const gpChip = screen.getByText('Corner Adept').closest('.inh-white-chip')!;
    expect(gpChip.querySelector('.inh-star-gp')).toBeTruthy(); // grey grandparent star
    const ownChip = screen.getByText('200361').closest('.inh-white-chip')!;
    expect(ownChip.querySelector('.inh-star-own')).toBeTruthy(); // gold own star
  });

  it('shows the green inherited-unique spark as a green chip', () => {
    const withGreen = { ...p, greenSpark: { skillId: '100151', stars: 2 } } as Parent;
    render(
      <ParentCardView
        label="Parent 1"
        parent={withGreen}
        skillName={(id) => (id === '100151' ? 'Triumphant Pulse' : id)}
        onClear={vi.fn()}
      />,
    );
    const chip = screen.getByText('Triumphant Pulse').closest('.badge')!;
    expect(chip.classList.contains('spark-green')).toBe(true);
  });

  it('glows a white/green spark whose skill is on the wishlist (is-wishlisted)', () => {
    const withGreen = { ...p, greenSpark: { skillId: '100151', stars: 2 } } as Parent;
    render(
      <ParentCardView
        label="Parent 1"
        parent={withGreen}
        skillName={(id) => (id === '200361' ? 'Groundwork' : id === '100151' ? 'Triumphant Pulse' : id)}
        isWishlisted={(id) => id === '200361'} // only the white spark is wishlisted
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText('Groundwork').closest('.badge')!.classList.contains('is-wishlisted')).toBe(true);
    expect(screen.getByText('Triumphant Pulse').closest('.badge')!.classList.contains('is-wishlisted')).toBe(false);
  });

  it('shows the rental stub when rentalStub is set', () => {
    render(<ParentCardView label="Parent 2" parent={null} rentalStub />);
    expect(screen.getByText(/coming in m1\.4b/i)).toBeInTheDocument();
  });
});
