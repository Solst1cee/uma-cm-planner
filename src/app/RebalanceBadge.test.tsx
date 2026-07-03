import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { RebalanceInfo } from '@/core/types';
import { RebalanceBadge } from './RebalanceBadge';

afterEach(() => {
  cleanup();
});

describe('RebalanceBadge', () => {
  it('renders nothing when info is undefined', () => {
    const { container } = render(<RebalanceBadge info={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows "Δ?" with an uncurated-candidate title for an uncurated candidate', () => {
    const info: RebalanceInfo = {
      globalVer: 1,
      jpVer: 2,
      versions: [],
      uncuratedCandidate: true,
    };
    render(<RebalanceBadge info={info} />);
    const badge = screen.getByText('Δ?');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('title', 'JP conditions differ — not yet curated');
  });

  it('shows "Δv{jpVer} ~{arrival}" for a curated skill with a dated latest version', () => {
    const info: RebalanceInfo = {
      globalVer: 1,
      jpVer: 2,
      versions: [
        { ver: 2, globalArrival: '2026-08-10', note: 'reduced cooldown' },
      ],
    };
    render(<RebalanceBadge info={info} />);
    const badge = screen.getByText('Δv2 ~2026-08-10');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute('title', 'v2: reduced cooldown');
  });

  it('shows "Δv{jpVer}" (no arrival) for a curated skill with an undated latest version', () => {
    const info: RebalanceInfo = {
      globalVer: 1,
      jpVer: 2,
      versions: [{ ver: 2 }],
    };
    render(<RebalanceBadge info={info} />);
    expect(screen.getByText('Δv2')).toBeInTheDocument();
  });
});
