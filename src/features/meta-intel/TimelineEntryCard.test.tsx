import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { TimelineEntry } from '@/core/types';
import { TimelineEntryCard } from './TimelineEntryCard';

afterEach(cleanup);

const cm: TimelineEntry = {
  id: 'cm15-cancer-cup',
  type: 'cm',
  title: 'Cancer Cup',
  dates: { finals: '2026-06-30' },
  cm: { cmNumber: 15, courseId: '10906', trackSummary: 'Hanshin turf 2200m' },
  tier: 'official',
  status: 'confirmed',
  source: { kind: 'official_news', url: 'https://umamusume.com/news/829/' },
  server: 'global',
  dataVersion: 'test',
};

function renderCard(over: Partial<Parameters<typeof TimelineEntryCard>[0]> = {}) {
  const onSelect = vi.fn();
  render(
    <TimelineEntryCard
      entry={cm}
      selected={false}
      past={false}
      current={false}
      onSelect={onSelect}
      {...over}
    />,
  );
  return onSelect;
}

describe('TimelineEntryCard', () => {
  it('shows title, confirmed badge, and the lane summary', () => {
    renderCard();
    expect(screen.getByText('Cancer Cup')).toBeInTheDocument();
    expect(screen.getByText(/✓ confirmed/)).toBeInTheDocument();
    expect(screen.getByText('Hanshin turf 2200m')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', async () => {
    const user = userEvent.setup();
    const onSelect = renderCard();
    await user.click(screen.getByRole('button', { name: /Cancer Cup/ }));
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('marks the selected card via aria-pressed', () => {
    renderCard({ selected: true });
    expect(screen.getByRole('button', { name: /Cancer Cup/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders a → M4 tag only on the current CM', () => {
    const onSelect = vi.fn();
    const { rerender } = render(
      <TimelineEntryCard entry={cm} selected={false} past={false} current onSelect={onSelect} />,
    );
    expect(screen.getByText('→ M4')).toBeInTheDocument();
    rerender(
      <TimelineEntryCard entry={cm} selected={false} past={false} current={false} onSelect={onSelect} />,
    );
    expect(screen.queryByText('→ M4')).not.toBeInTheDocument();
  });

  it('shows the predicted badge for an unconfirmed prediction', () => {
    renderCard({
      entry: { ...cm, tier: 'prediction', status: 'unconfirmed' },
    });
    expect(screen.getByText(/~ predicted/)).toBeInTheDocument();
  });
});
