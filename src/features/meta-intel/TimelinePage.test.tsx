import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import type { TimelineEntry } from '@/core/types';
import { TimelinePage } from './TimelinePage';

function te(over: Partial<TimelineEntry> & { id: string; type: TimelineEntry['type'] }): TimelineEntry {
  return {
    title: over.id,
    dates: { finals: '2026-06-30' },
    tier: 'official',
    status: 'confirmed',
    source: { kind: 'manual', url: '' },
    server: 'global',
    dataVersion: 'test',
    ...over,
  } as TimelineEntry;
}

const ENTRIES: TimelineEntry[] = [
  te({ id: 'cm14', type: 'cm', title: 'Gemini Cup', dates: { finals: '2026-05-30' }, cm: { cmNumber: 14 } }),
  te({
    id: 'cm15',
    type: 'cm',
    title: 'Cancer Cup',
    dates: { finals: '2026-06-30' },
    cm: { cmNumber: 15, courseId: '10906', trackSummary: 'Hanshin turf 2200m' },
    source: { kind: 'official_news', url: 'https://umamusume.com/news/829/' },
  }),
  te({ id: 'banner-x', type: 'banner', title: 'Maruzensky Banner', dates: { start: '2026-06-25' }, status: 'unconfirmed', tier: 'prediction', banner: { kind: 'char' } }),
  te({ id: 'patch-1', type: 'patch', title: 'v2.1 Balance', dates: { start: '2026-07-05' }, patch: { version: '2.1' } }),
];

const mockGameData = vi.fn();
vi.mock('@/features/data/gameData', () => ({ useGameData: () => mockGameData() }));

afterEach(cleanup);

function renderPage() {
  // currentCm is pre-resolved in the context (Task 6). Supply the entry that
  // would be "current" at now="2026-06-15" — Cancer Cup (cm15).
  mockGameData.mockReturnValue({ status: 'ready', timeline: ENTRIES, currentCm: ENTRIES[1] });
  render(<TimelinePage now="2026-06-15" />);
}

describe('TimelinePage', () => {
  it('renders all three lanes with their entries', () => {
    renderPage();
    expect(screen.getByRole('region', { name: 'Champions Meetings' })).toBeInTheDocument();
    expect(screen.getByText('Cancer Cup')).toBeInTheDocument();
    expect(screen.getByText('Maruzensky Banner')).toBeInTheDocument();
    expect(screen.getByText('v2.1 Balance')).toBeInTheDocument();
  });

  it('marks the next CM (Cancer Cup) as current with a → M4 tag', () => {
    renderPage();
    const cmLane = screen.getByRole('region', { name: 'Champions Meetings' });
    expect(within(cmLane).getByText('→ M4')).toBeInTheDocument();
  });

  it('selecting an entry populates the detail panel', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /Cancer Cup/ }));
    const detail = screen.getByRole('complementary', { name: 'Entry detail' });
    expect(within(detail).getByRole('heading', { name: 'Cancer Cup' })).toBeInTheDocument();
    expect(within(detail).getByText(/Feeds Skill Planner/)).toBeInTheDocument();
  });

  it('confirmed-only hides unconfirmed entries', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByText('Maruzensky Banner')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Confirmed only' }));
    expect(screen.queryByText('Maruzensky Banner')).not.toBeInTheDocument();
    expect(screen.getByText('Cancer Cup')).toBeInTheDocument();
  });

  it('unchecking a lane hides that whole lane', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('checkbox', { name: 'Patches' }));
    expect(screen.queryByRole('region', { name: 'Patches' })).not.toBeInTheDocument();
    expect(screen.queryByText('v2.1 Balance')).not.toBeInTheDocument();
  });

  it('renders a now marker', () => {
    renderPage();
    expect(screen.getAllByText(/now/i).length).toBeGreaterThan(0);
  });

  it('shows an empty message when there is no timeline data', () => {
    mockGameData.mockReturnValue({ status: 'ready', timeline: [] });
    render(<TimelinePage now="2026-06-15" />);
    expect(screen.getByText(/No timeline data/)).toBeInTheDocument();
  });

  it('does not fade an undated (TBD) entry as past', async () => {
    const user = userEvent.setup();
    mockGameData.mockReturnValue({
      status: 'ready',
      timeline: [te({ id: 'cm-tbd', type: 'cm', title: 'Future Cup', dates: {} })],
    });
    render(<TimelinePage now="2026-06-15" />);
    // Undated entries only surface under the All range (default is Upcoming).
    await user.selectOptions(screen.getByLabelText('Date range'), 'all');
    expect(screen.getByRole('button', { name: /Future Cup/ })).not.toHaveClass('past');
  });

  it('defaults to the Upcoming range, hiding past entries', () => {
    renderPage();
    expect(screen.queryByText('Gemini Cup')).not.toBeInTheDocument(); // cm14, 2026-05-30 (past)
    expect(screen.getByText('Cancer Cup')).toBeInTheDocument();       // cm15, 2026-06-30 (upcoming)
  });

  it('switching range to All reveals past entries', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.selectOptions(screen.getByLabelText('Date range'), 'all');
    expect(screen.getByText('Gemini Cup')).toBeInTheDocument();
  });
});
