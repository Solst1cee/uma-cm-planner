import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Capture GameIcon props so we can assert the rank kind + id without a provider.
const iconProps: Array<{ kind: string; id: string }> = [];
vi.mock('@/features/data/GameIcon', () => ({
  GameIcon: (p: { kind: string; id: string }) => {
    iconProps.push({ kind: p.kind, id: p.id });
    return <span data-testid="game-icon" data-kind={p.kind} data-id={p.id} />;
  },
}));

import { RankBadge } from './RankBadge';

afterEach(() => { cleanup(); iconProps.length = 0; });

describe('RankBadge', () => {
  it('renders the rank art only (kind="rank"), no visible text label', () => {
    render(<RankBadge rating="SS+" />);
    expect(screen.getByTestId('game-icon')).toHaveAttribute('data-kind', 'rank');
    expect(screen.getByTestId('game-icon')).toHaveAttribute('data-id', 'SS+');
    // Icon only — the badge art spells the rank; no separate text label.
    expect(screen.queryByText('SS+')).not.toBeInTheDocument();
  });

  it('renders nothing without a rating', () => {
    const { container } = render(<RankBadge rating={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
