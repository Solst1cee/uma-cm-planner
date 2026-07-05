import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { TargetSpark } from './targetSpark';
import { TargetSparkCard } from './TargetSparkCard';

afterEach(cleanup);

const base: TargetSpark = {
  blue: [{ stat: 'sta', label: 'Stamina', stars: 6 }],
  pink: [{ label: 'Long', stars: 5 }],
  white: [],
  coverage: 'empty',
};

describe('TargetSparkCard', () => {
  it('renders the panel head + blue and pink chips', () => {
    render(<TargetSparkCard spark={base} />);
    expect(screen.getByText('Target spark')).toBeInTheDocument();
    expect(screen.getByText(/Stamina 6/)).toBeInTheDocument();
    expect(screen.getByText(/Long 5/)).toBeInTheDocument();
  });

  it('shows the empty-wishlist note (not a green check) for coverage "empty"', () => {
    render(<TargetSparkCard spark={base} />);
    expect(screen.getByText(/No wishlist skills yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/All wishlist skills obtainable/i)).not.toBeInTheDocument();
  });

  it('shows the all-obtainable note for coverage "covered"', () => {
    render(<TargetSparkCard spark={{ ...base, coverage: 'covered' }} />);
    expect(screen.getByText(/All wishlist skills obtainable/i)).toBeInTheDocument();
  });

  it('renders green white-skill chips for coverage "gaps"', () => {
    render(
      <TargetSparkCard
        spark={{ ...base, coverage: 'gaps', white: [{ id: 's1', name: 'Slick Surge' }] }}
      />,
    );
    expect(screen.getByText('Slick Surge')).toBeInTheDocument();
  });
});
