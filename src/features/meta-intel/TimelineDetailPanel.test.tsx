import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { TimelineEntry } from '@/core/types';
import { TimelineDetailPanel } from './TimelineDetailPanel';

afterEach(cleanup);

const cm: TimelineEntry = {
  id: 'cm15-cancer-cup',
  type: 'cm',
  title: 'Cancer Cup',
  dates: { start: '2026-06-21', finals: '2026-06-30' },
  cm: { cmNumber: 15, courseId: '10906', trackSummary: 'Hanshin turf 2200m' },
  tier: 'official',
  status: 'confirmed',
  source: { kind: 'official_news', url: 'https://umamusume.com/news/829/' },
  server: 'global',
  dataVersion: 'test',
};

describe('TimelineDetailPanel', () => {
  it('shows a placeholder when nothing is selected', () => {
    render(<TimelineDetailPanel entry={null} />);
    expect(screen.getByText(/Select an entry/)).toBeInTheDocument();
  });

  it('renders CM fields, the source link, and the M4 feed note', () => {
    render(<TimelineDetailPanel entry={cm} />);
    const panel = screen.getByRole('complementary', { name: 'Entry detail' });
    expect(within(panel).getByRole('heading', { name: 'Cancer Cup' })).toBeInTheDocument();
    expect(within(panel).getByText('Hanshin turf 2200m')).toBeInTheDocument();
    expect(within(panel).getByText('10906')).toBeInTheDocument();
    const link = within(panel).getByRole('link');
    expect(link).toHaveAttribute('href', 'https://umamusume.com/news/829/');
    expect(within(panel).getByText(/Feeds Skill Planner/)).toHaveTextContent('CM15');
  });

  it('shows the hand-confirm hint for an unconfirmed entry', () => {
    render(
      <TimelineDetailPanel
        entry={{ ...cm, tier: 'prediction', status: 'unconfirmed', source: { kind: 'game8', url: '' } }}
      />,
    );
    expect(screen.getByText(/timeline_overrides\.json/)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
