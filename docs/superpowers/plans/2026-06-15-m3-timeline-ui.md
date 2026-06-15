# M3 Timeline UI (browsable swimlane) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the read-only browsable M3 timeline — three swimlanes (Champions Meetings / Banners / Patches) on a shared time axis with a "now" marker, tier badges, lane + confirmed-only filters, and a detail panel — wired into the app as the `/meta-intel` route, replacing the disabled "Meta Intel" nav stub.

**Architecture:** A thin React feature in `src/features/meta-intel/` over the already-baked data. Pure view-model helpers (`timelineView.ts`) bucket/filter/locate-now and are unit-tested in isolation; presentational `TimelineEntryCard` + `TimelineDetailPanel` render one entry each; `TimelinePage` composes them, owns filter + selection state, and reads `useGameData().timeline`. All mechanics-style logic (`effectiveDate`, `timelineBadge`) is reused from `@/core/timeline` — no new core code. Confirming/editing entries stays out of scope (a static app can't write `timeline_overrides.json`); the detail panel instead points the user at the hand-edit workflow (P5).

**Tech Stack:** TypeScript (strict; `noUncheckedIndexedAccess`), React 19, React Router 7, Vitest + @testing-library/react + jsdom, plain per-feature CSS (`meta-intel.css`) reusing `src/styles/app.css` tokens.

---

## File Structure

- **Create** `src/features/meta-intel/timelineView.ts` — pure view-model: `LANES`, `filterTimeline`, `partitionByLane`, `nowIndex`, `currentCm`.
- **Create** `src/features/meta-intel/timelineView.test.ts` — unit tests for the above.
- **Create** `src/features/meta-intel/TimelineEntryCard.tsx` — one entry as a selectable card (badge + title + date + lane summary; `→ M4` tag on the current CM).
- **Create** `src/features/meta-intel/TimelineEntryCard.test.tsx`.
- **Create** `src/features/meta-intel/TimelineDetailPanel.tsx` — selected-entry detail (fields, source link, "feeds M4 §0", hand-confirm hint).
- **Create** `src/features/meta-intel/TimelineDetailPanel.test.tsx`.
- **Create** `src/features/meta-intel/TimelinePage.tsx` — composes lanes + controls + detail; owns filter/selection state.
- **Create** `src/features/meta-intel/TimelinePage.test.tsx`.
- **Create** `src/features/meta-intel/meta-intel.css` — feature styles.
- **Modify** `src/app/App.tsx` — drop "Meta Intel" from `STUB_MODULES`, add a `/meta-intel` `NavLink` + `Route` → `TimelinePage`.

**Reused (do not modify):** `@/core/timeline` (`effectiveDate`, `timelineBadge`), `@/core/types` (`TimelineEntry`), `@/features/data/gameData` (`useGameData` → `timeline`).

**Type reference — `TimelineEntry` (already defined in `src/core/types.ts`, do not redeclare):**
```ts
interface TimelineEntry {
  id: string;
  type: 'cm' | 'banner' | 'patch';
  title: string;
  dates: { start?: string; finals?: string; end?: string };   // ISO 'YYYY-MM-DD'
  cm?: { cmNumber?: number; courseId?: string; trackSummary?: string };
  banner?: { kind: 'char' | 'support'; umaId?: string; cardId?: string };
  patch?: { version?: string; summary?: string };
  tier: 'official' | 'datamined' | 'prediction';
  status: 'confirmed' | 'unconfirmed';
  source: { kind: 'official_news'|'game8'|'soulec'|'phoenix'|'umaguide'|'gametora'|'umalator'|'manual'; url: string };
  server: 'global' | 'jp';
  dataVersion: string;
}
```
`timelineBadge(e)` returns `{ symbol: '✓' | '◆' | '~'; label: 'confirmed' | 'datamined' | 'predicted' }`. `effectiveDate(e)` returns `e.dates.finals ?? e.dates.start ?? e.dates.end ?? ''` (ISO string, sortable/comparable as text).

---

## Task 1: View-model helpers (`timelineView.ts`)

**Files:**
- Create: `src/features/meta-intel/timelineView.ts`
- Test: `src/features/meta-intel/timelineView.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/meta-intel/timelineView.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { TimelineEntry } from '@/core/types';
import { currentCm, filterTimeline, nowIndex, partitionByLane } from './timelineView';

/** Minimal TimelineEntry builder — override only what a test cares about. */
function entry(over: Partial<TimelineEntry> & { id: string }): TimelineEntry {
  return {
    type: 'cm',
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

describe('partitionByLane', () => {
  it('buckets by type and sorts each lane ascending by effective date', () => {
    const out = partitionByLane([
      entry({ id: 'cmB', type: 'cm', dates: { finals: '2026-08-01' } }),
      entry({ id: 'patch1', type: 'patch', dates: { start: '2026-07-01' } }),
      entry({ id: 'cmA', type: 'cm', dates: { finals: '2026-06-01' } }),
      entry({ id: 'banner1', type: 'banner', dates: { start: '2026-06-15' } }),
    ]);
    expect(out.cm.map((e) => e.id)).toEqual(['cmA', 'cmB']);
    expect(out.banner.map((e) => e.id)).toEqual(['banner1']);
    expect(out.patch.map((e) => e.id)).toEqual(['patch1']);
  });
});

describe('filterTimeline', () => {
  const data = [
    entry({ id: 'cm1', type: 'cm', status: 'confirmed' }),
    entry({ id: 'banner1', type: 'banner', status: 'unconfirmed' }),
    entry({ id: 'patch1', type: 'patch', status: 'unconfirmed' }),
  ];

  it('keeps only enabled lanes', () => {
    const out = filterTimeline(data, { lanes: new Set(['cm', 'banner']), confirmedOnly: false });
    expect(out.map((e) => e.id)).toEqual(['cm1', 'banner1']);
  });

  it('drops unconfirmed entries when confirmedOnly is set', () => {
    const out = filterTimeline(data, { lanes: new Set(['cm', 'banner', 'patch']), confirmedOnly: true });
    expect(out.map((e) => e.id)).toEqual(['cm1']);
  });
});

describe('nowIndex', () => {
  const sorted = [
    entry({ id: 'a', dates: { finals: '2026-06-01' } }),
    entry({ id: 'b', dates: { finals: '2026-06-20' } }),
    entry({ id: 'c', dates: { finals: '2026-07-01' } }),
  ];

  it('returns the index of the first entry on/after now', () => {
    expect(nowIndex(sorted, '2026-06-15')).toBe(1);
  });

  it('returns 0 when every entry is upcoming', () => {
    expect(nowIndex(sorted, '2026-01-01')).toBe(0);
  });

  it('returns length when every entry is in the past', () => {
    expect(nowIndex(sorted, '2027-01-01')).toBe(3);
  });
});

describe('currentCm', () => {
  const cms = [
    entry({ id: 'cm1', dates: { finals: '2026-05-30' } }),
    entry({ id: 'cm2', dates: { finals: '2026-06-30' } }),
  ];

  it('picks the first CM on/after now', () => {
    expect(currentCm(cms, '2026-06-15')?.id).toBe('cm2');
  });

  it('falls back to the most recent past CM when none are upcoming', () => {
    expect(currentCm(cms, '2027-01-01')?.id).toBe('cm2');
  });

  it('returns null for an empty list', () => {
    expect(currentCm([], '2026-06-15')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/meta-intel/timelineView.test.ts`
Expected: FAIL — "Failed to resolve import './timelineView'" / functions not defined.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/meta-intel/timelineView.ts`:

```ts
/**
 * Pure view-model helpers for the M3 timeline UI. No React, no DOM — bucket,
 * filter, and locate "now" so the components stay presentational and these
 * stay unit-testable. Mechanics (effectiveDate, timelineBadge) come from
 * @/core/timeline; nothing game-rule lives here.
 */
import type { TimelineEntry } from '@/core/types';
import { effectiveDate } from '@/core/timeline';

export type LaneKey = TimelineEntry['type']; // 'cm' | 'banner' | 'patch'

export const LANES: readonly { key: LaneKey; label: string }[] = [
  { key: 'cm', label: 'Champions Meetings' },
  { key: 'banner', label: 'Banners' },
  { key: 'patch', label: 'Patches' },
];

export interface TimelineFilter {
  lanes: ReadonlySet<LaneKey>;
  confirmedOnly: boolean;
}

/** Keep entries in enabled lanes, optionally only confirmed ones. Order preserved. */
export function filterTimeline(entries: TimelineEntry[], filter: TimelineFilter): TimelineEntry[] {
  return entries.filter(
    (e) => filter.lanes.has(e.type) && (!filter.confirmedOnly || e.status === 'confirmed'),
  );
}

function byDateAsc(a: TimelineEntry, b: TimelineEntry): number {
  const da = effectiveDate(a);
  const db = effectiveDate(b);
  return da < db ? -1 : da > db ? 1 : 0;
}

/** Bucket into the three lanes, each sorted ascending by effective date. */
export function partitionByLane(entries: TimelineEntry[]): Record<LaneKey, TimelineEntry[]> {
  const out: Record<LaneKey, TimelineEntry[]> = { cm: [], banner: [], patch: [] };
  for (const e of entries) out[e.type].push(e);
  for (const key of Object.keys(out) as LaneKey[]) out[key].sort(byDateAsc);
  return out;
}

/**
 * Index in a date-sorted lane where the "now" marker belongs: the first entry
 * whose effective date is >= nowISO (the next upcoming entry). Returns
 * entries.length when every entry is in the past.
 */
export function nowIndex(sorted: TimelineEntry[], nowISO: string): number {
  const i = sorted.findIndex((e) => effectiveDate(e) >= nowISO);
  return i === -1 ? sorted.length : i;
}

/** The current/next CM: first CM on/after now, else the most recent past one. */
export function currentCm(cmEntries: TimelineEntry[], nowISO: string): TimelineEntry | null {
  if (cmEntries.length === 0) return null;
  const sorted = [...cmEntries].sort(byDateAsc);
  const upcoming = sorted.find((e) => effectiveDate(e) >= nowISO);
  return upcoming ?? sorted[sorted.length - 1] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/meta-intel/timelineView.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add src/features/meta-intel/timelineView.ts src/features/meta-intel/timelineView.test.ts
git commit -m "feat(m3): timeline view-model helpers (partition/filter/now)"
```

---

## Task 2: Entry card (`TimelineEntryCard.tsx`)

**Files:**
- Create: `src/features/meta-intel/TimelineEntryCard.tsx`
- Test: `src/features/meta-intel/TimelineEntryCard.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/meta-intel/TimelineEntryCard.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/meta-intel/TimelineEntryCard.test.tsx`
Expected: FAIL — cannot resolve `./TimelineEntryCard`.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/meta-intel/TimelineEntryCard.tsx`:

```tsx
/**
 * One timeline entry as a selectable card: tier badge + title + headline date
 * + a type-specific one-line summary. The current CM also carries a `→ M4` tag
 * (it's the CM the Skill Planner targets). Presentational — all state lives in
 * TimelinePage.
 */
import type { TimelineEntry } from '@/core/types';
import { effectiveDate, timelineBadge } from '@/core/timeline';

function laneSummary(e: TimelineEntry): string {
  if (e.type === 'cm') {
    return e.cm?.trackSummary ?? (e.cm?.cmNumber !== undefined ? `CM${e.cm.cmNumber}` : 'Champions Meeting');
  }
  if (e.type === 'banner') {
    return e.banner?.kind === 'support' ? 'Support banner' : 'Character banner';
  }
  return e.patch?.version !== undefined ? `Patch ${e.patch.version}` : 'Patch';
}

export function TimelineEntryCard({
  entry,
  selected,
  past,
  current,
  onSelect,
}: {
  entry: TimelineEntry;
  selected: boolean;
  past: boolean;
  current: boolean;
  onSelect: () => void;
}) {
  const badge = timelineBadge(entry);
  const date = effectiveDate(entry) || 'TBD';
  const className =
    'tl-card' +
    (selected ? ' selected' : '') +
    (past ? ' past' : '') +
    (current ? ' current' : '');
  return (
    <button type="button" className={className} aria-pressed={selected} onClick={onSelect}>
      <span className={`tl-badge ${badge.label}`}>
        {badge.symbol} {badge.label}
      </span>
      <span className="tl-card-title">{entry.title}</span>
      <span className="tl-card-date muted small">{date}</span>
      <span className="tl-card-summary small">{laneSummary(entry)}</span>
      {current && entry.type === 'cm' && (
        <span className="tl-m4-tag" title="The CM the Skill Planner targets">
          → M4
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/meta-intel/TimelineEntryCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add src/features/meta-intel/TimelineEntryCard.tsx src/features/meta-intel/TimelineEntryCard.test.tsx
git commit -m "feat(m3): timeline entry card"
```

---

## Task 3: Detail panel (`TimelineDetailPanel.tsx`)

**Files:**
- Create: `src/features/meta-intel/TimelineDetailPanel.tsx`
- Test: `src/features/meta-intel/TimelineDetailPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/meta-intel/TimelineDetailPanel.test.tsx`:

```tsx
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
    // No source link rendered when url is empty.
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/meta-intel/TimelineDetailPanel.test.tsx`
Expected: FAIL — cannot resolve `./TimelineDetailPanel`.

- [ ] **Step 3: Write minimal implementation**

Create `src/features/meta-intel/TimelineDetailPanel.tsx`:

```tsx
/**
 * Detail for the selected timeline entry: tier/lane/server badges, the date +
 * type-specific fields, the source permalink, what it feeds M4, and — for
 * anything not yet confirmed — how to hand-confirm it (P5; a static app can't
 * write timeline_overrides.json itself).
 */
import type { TimelineEntry } from '@/core/types';
import { timelineBadge } from '@/core/timeline';

const LANE_NAME: Record<TimelineEntry['type'], string> = {
  cm: 'Champions Meeting',
  banner: 'Banner',
  patch: 'Patch',
};

export function TimelineDetailPanel({ entry }: { entry: TimelineEntry | null }) {
  if (entry === null) {
    return (
      <aside className="panel tl-detail" aria-label="Entry detail">
        <p className="muted">Select an entry to see its dates, source, and what it feeds.</p>
      </aside>
    );
  }

  const badge = timelineBadge(entry);
  const isCm = entry.type === 'cm';
  return (
    <aside className="panel tl-detail" aria-label="Entry detail">
      <h3>{entry.title}</h3>
      <p className="tl-detail-meta">
        <span className="badge">{LANE_NAME[entry.type]}</span>
        <span className={`tl-badge ${badge.label}`}>
          {badge.symbol} {badge.label}
        </span>
        <span className="badge">{entry.server.toUpperCase()}</span>
      </p>

      <dl className="tl-detail-fields">
        {entry.dates.start !== undefined && (
          <>
            <dt>Signup</dt>
            <dd>{entry.dates.start}</dd>
          </>
        )}
        {entry.dates.finals !== undefined && (
          <>
            <dt>Finals</dt>
            <dd>{entry.dates.finals}</dd>
          </>
        )}
        {entry.dates.end !== undefined && (
          <>
            <dt>Ends</dt>
            <dd>{entry.dates.end}</dd>
          </>
        )}

        {isCm && entry.cm?.cmNumber !== undefined && (
          <>
            <dt>CM #</dt>
            <dd>{entry.cm.cmNumber}</dd>
          </>
        )}
        {isCm && entry.cm?.courseId !== undefined && (
          <>
            <dt>Course</dt>
            <dd>{entry.cm.courseId}</dd>
          </>
        )}
        {isCm && entry.cm?.trackSummary !== undefined && (
          <>
            <dt>Track</dt>
            <dd>{entry.cm.trackSummary}</dd>
          </>
        )}

        {entry.type === 'banner' && entry.banner?.kind !== undefined && (
          <>
            <dt>Banner</dt>
            <dd>{entry.banner.kind === 'support' ? 'Support card' : 'Character'}</dd>
          </>
        )}
        {entry.type === 'patch' && entry.patch?.version !== undefined && (
          <>
            <dt>Version</dt>
            <dd>{entry.patch.version}</dd>
          </>
        )}
        {entry.type === 'patch' && entry.patch?.summary !== undefined && (
          <>
            <dt>Summary</dt>
            <dd>{entry.patch.summary}</dd>
          </>
        )}
      </dl>

      {entry.source.url !== '' ? (
        <p className="tl-detail-source small">
          Source:{' '}
          <a href={entry.source.url} target="_blank" rel="noreferrer">
            {entry.source.kind} ↗
          </a>
        </p>
      ) : (
        <p className="tl-detail-source muted small">Source: {entry.source.kind} (no link yet)</p>
      )}

      {isCm && entry.cm?.cmNumber !== undefined && entry.cm.courseId !== undefined && (
        <p className="tl-feeds small">
          → Feeds Skill Planner §0 as CM{entry.cm.cmNumber} (course {entry.cm.courseId}).
        </p>
      )}

      {entry.status !== 'confirmed' && (
        <p className="tl-unconfirmed small">
          Not yet confirmed ({badge.label}). To confirm, hand-edit{' '}
          <code>data-overrides/timeline_overrides.json</code>: set{' '}
          <code>status: "confirmed"</code>, stamp an official <code>/news/&lt;id&gt;/</code> link,
          then run <code>pnpm data:build</code>.
        </p>
      )}
    </aside>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/meta-intel/TimelineDetailPanel.test.tsx`
Expected: PASS.

Note: `<aside aria-label="Entry detail">` exposes the ARIA role `complementary`; the test queries it via `getByRole('complementary', { name: 'Entry detail' })`.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add src/features/meta-intel/TimelineDetailPanel.tsx src/features/meta-intel/TimelineDetailPanel.test.tsx
git commit -m "feat(m3): timeline detail panel"
```

---

## Task 4: Timeline page (`TimelinePage.tsx`) + styles

**Files:**
- Create: `src/features/meta-intel/TimelinePage.tsx`
- Create: `src/features/meta-intel/meta-intel.css`
- Test: `src/features/meta-intel/TimelinePage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/features/meta-intel/TimelinePage.test.tsx`:

```tsx
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
  mockGameData.mockReturnValue({ status: 'ready', timeline: ENTRIES });
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/meta-intel/TimelinePage.test.tsx`
Expected: FAIL — cannot resolve `./TimelinePage`.

- [ ] **Step 3: Write the implementation**

Create `src/features/meta-intel/TimelinePage.tsx`:

```tsx
/**
 * M3 Meta Intel — browsable timeline. Three swimlanes (CM / Banners / Patches)
 * on a shared date axis with a "now" marker, tier badges, lane + confirmed-only
 * filters, and a detail panel. Read-only browsing (P2/P3): confirming an entry
 * is a hand-edit of timeline_overrides.json, surfaced in the detail panel.
 *
 * `now` is injectable for deterministic tests; it defaults to today.
 */
import { Fragment, useMemo, useRef, useState } from 'react';
import { effectiveDate } from '@/core/timeline';
import { useGameData } from '@/features/data/gameData';
import { LANES, type LaneKey, currentCm, filterTimeline, nowIndex, partitionByLane } from './timelineView';
import { TimelineEntryCard } from './TimelineEntryCard';
import { TimelineDetailPanel } from './TimelineDetailPanel';
import './meta-intel.css';

const ALL_LANE_KEYS: LaneKey[] = LANES.map((l) => l.key);

export function TimelinePage({ now }: { now?: string } = {}) {
  const { status, timeline } = useGameData();
  const entries = timeline ?? [];
  const nowISO = now ?? new Date().toISOString().slice(0, 10);

  const [enabledLanes, setEnabledLanes] = useState<Set<LaneKey>>(() => new Set(ALL_LANE_KEYS));
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lanesRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => filterTimeline(entries, { lanes: enabledLanes, confirmedOnly }),
    [entries, enabledLanes, confirmedOnly],
  );
  const partitioned = useMemo(() => partitionByLane(filtered), [filtered]);
  const currentCmId = useMemo(
    () => currentCm(partitionByLane(entries).cm, nowISO)?.id ?? null,
    [entries, nowISO],
  );
  const selected = useMemo(
    () => entries.find((e) => e.id === selectedId) ?? null,
    [entries, selectedId],
  );

  const toggleLane = (key: LaneKey) =>
    setEnabledLanes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const jumpToNow = () => {
    const marker = lanesRef.current?.querySelector('[data-now]');
    (marker as HTMLElement | null)?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  };

  if (status === 'loading') {
    return (
      <div className="page">
        <p className="muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="page tl-page">
      <section className="panel">
        <h2>Meta Intel — Timeline</h2>
        <p className="muted small">
          Champions Meetings, banners, and patches on one axis. Each entry shows its
          confidence tier — ✓ confirmed (official), ◆ datamined, ~ predicted. Predictions
          are estimates (P3), never guarantees; JP-ahead items are previews (P4).
        </p>

        <div className="timeline-controls" role="group" aria-label="Timeline filters">
          {LANES.map((l) => (
            <label key={l.key} className="tl-toggle">
              <input
                type="checkbox"
                checked={enabledLanes.has(l.key)}
                onChange={() => toggleLane(l.key)}
              />
              {l.label}
            </label>
          ))}
          <label className="tl-toggle">
            <input
              type="checkbox"
              checked={confirmedOnly}
              onChange={(e) => setConfirmedOnly(e.target.checked)}
            />
            Confirmed only
          </label>
          <button type="button" onClick={jumpToNow}>
            Jump to now
          </button>
        </div>
      </section>

      <div className="tl-body">
        <div className="timeline-lanes" ref={lanesRef}>
          {entries.length === 0 ? (
            <p className="muted">
              No timeline data yet — run <code>pnpm data:build</code> to bake it.
            </p>
          ) : (
            LANES.filter((l) => enabledLanes.has(l.key)).map((lane) => {
              const laneEntries = partitioned[lane.key];
              const marker = nowIndex(laneEntries, nowISO);
              return (
                <section key={lane.key} className="timeline-lane" aria-label={lane.label}>
                  <h3 className="lane-label">{lane.label}</h3>
                  <div className="lane-track">
                    {laneEntries.length === 0 && <span className="muted small">— none —</span>}
                    {laneEntries.map((entry, i) => (
                      <Fragment key={entry.id}>
                        {i === marker && (
                          <span className="now-marker" data-now aria-label="now">
                            now ▸
                          </span>
                        )}
                        <TimelineEntryCard
                          entry={entry}
                          selected={entry.id === selectedId}
                          past={effectiveDate(entry) < nowISO}
                          current={entry.id === currentCmId}
                          onSelect={() => setSelectedId(entry.id)}
                        />
                      </Fragment>
                    ))}
                    {marker === laneEntries.length && laneEntries.length > 0 && (
                      <span className="now-marker" data-now aria-label="now">
                        now ▸
                      </span>
                    )}
                  </div>
                </section>
              );
            })
          )}
        </div>
        <TimelineDetailPanel entry={selected} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create the stylesheet**

Create `src/features/meta-intel/meta-intel.css`:

```css
/* Meta Intel (M3) timeline styles. Shared primitives (panel, badge, muted,
   small) live in src/styles/app.css — only timeline-specific layout here. */

.tl-page {
  gap: 0.75rem;
}

.timeline-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
.tl-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--fg-muted);
  font-size: 0.9rem;
}

.tl-body {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}
@media (min-width: 920px) {
  .tl-body {
    grid-template-columns: 1fr minmax(240px, 320px);
    align-items: start;
  }
}

.timeline-lanes {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
}

.timeline-lane {
  background: var(--bg-1);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.6rem 0.7rem;
}
.lane-label {
  margin: 0 0 0.5rem;
  font-size: 0.95rem;
  color: var(--fg-muted);
}
.lane-track {
  display: flex;
  align-items: stretch;
  gap: 0.5rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.tl-card {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 150px;
  max-width: 220px;
  text-align: left;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 0.5rem 0.55rem;
  color: var(--fg);
  cursor: pointer;
}
.tl-card:hover {
  border-color: var(--accent);
}
.tl-card.selected {
  border-color: var(--accent);
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.tl-card.past {
  opacity: 0.55;
}
.tl-card.current {
  border-color: var(--accent);
}
.tl-card-title {
  font-weight: 600;
}
.tl-card-summary {
  color: var(--fg-muted);
}
.tl-m4-tag {
  align-self: flex-start;
  font-size: 0.75rem;
  color: var(--accent);
  border: 1px solid var(--accent);
  border-radius: 6px;
  padding: 0 0.3rem;
}

/* Tier badges — symbol + label; dashed/dotted echo datamined/predicted. */
.tl-badge {
  align-self: flex-start;
  font-size: 0.72rem;
  border-radius: 6px;
  padding: 0 0.3rem;
  border: 1px solid var(--border);
  color: var(--fg-muted);
}
.tl-badge.confirmed {
  color: #7ee787;
  border-color: #2ea04326;
}
.tl-badge.datamined {
  border-style: dashed;
}
.tl-badge.predicted {
  border-style: dotted;
  opacity: 0.85;
}

.now-marker {
  flex: 0 0 auto;
  align-self: center;
  font-size: 0.72rem;
  color: var(--accent);
  border-left: 2px solid var(--accent);
  padding-left: 0.3rem;
  white-space: nowrap;
}

.tl-detail h3 {
  margin: 0 0 0.4rem;
}
.tl-detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0 0 0.6rem;
}
.tl-detail-fields {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.2rem 0.6rem;
  margin: 0 0 0.6rem;
}
.tl-detail-fields dt {
  color: var(--fg-muted);
}
.tl-detail-fields dd {
  margin: 0;
}
.tl-feeds {
  color: var(--accent);
}
.tl-unconfirmed {
  color: var(--fg-muted);
  border-top: 1px dashed var(--border);
  padding-top: 0.4rem;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/features/meta-intel/TimelinePage.test.tsx`
Expected: PASS (all assertions green).

Note on the "now marker" test: jsdom defines `scrollIntoView` as a no-op (or leaves it undefined) — the `?.scrollIntoView?.()` guard means clicking "Jump to now" never throws either way.

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck`
Expected: no errors.

```bash
git add src/features/meta-intel/TimelinePage.tsx src/features/meta-intel/meta-intel.css src/features/meta-intel/TimelinePage.test.tsx
git commit -m "feat(m3): browsable timeline page (lanes, filters, detail)"
```

---

## Task 5: Wire into the app shell (`App.tsx`)

**Files:**
- Modify: `src/app/App.tsx`

- [ ] **Step 1: Edit `App.tsx`**

Make exactly these four edits.

(a) Add the import after the existing `SkillPlannerPage` import (line ~10):

```tsx
import { TimelinePage } from '@/features/meta-intel/TimelinePage';
```

(b) Drop "Meta Intel" from the stub list (line ~13):

```tsx
// Modules 1–2 land in later phases; nav shows them as disabled stubs.
const STUB_MODULES = ['Inheritance', 'SP Optimizer'] as const;
```

(c) Add a `NavLink` after the Parents one, before the `STUB_MODULES.map(...)` (line ~41-43):

```tsx
          <NavLink to="/meta-intel" className={navItemClass}>
            Meta Intel
          </NavLink>
```

(d) Add the route after the `/parents` route (line ~55):

```tsx
          <Route path="/meta-intel" element={<TimelinePage />} />
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Run the full test suite**

Run: `pnpm test`
Expected: PASS — all prior tests plus the new meta-intel tests (335 baseline + the new ones), 0 failures.

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: typecheck + Vite build succeed.

- [ ] **Step 5: Commit**

```bash
git add src/app/App.tsx
git commit -m "feat(m3): wire timeline page into /meta-intel route"
```

---

## Self-Review (run after all tasks)

- **Spec coverage (M3 spec §1.3):** swimlanes (CM/Banners/Patches) ✓ (Task 4); now marker ✓; tier badge on every entry ✓ (`timelineBadge`, Tasks 2–3); current-CM `→ M4` link ✓ (Task 2); controls — lane filters ✓, confirmed-only ✓, jump-to-now ✓ (Task 4). **Deferred (note in handoff):** range selector (quarter/month/year) and the dev-only refresh button — v1 renders all baked entries; range zoom is a polish follow-up. The editable `/news/` source field + "✓ Confirm & stamp" is **intentionally out of scope** (a static app can't write `timeline_overrides.json`) — the detail panel surfaces the hand-edit workflow instead (Task 3).
- **Type consistency:** `LaneKey = TimelineEntry['type']` used everywhere; `timelineBadge` label values (`confirmed`/`datamined`/`predicted`) match the CSS class names and the card/detail/badge tests; `effectiveDate` drives both sort and past/now logic consistently.
- **Placeholder scan:** none — every step ships complete code.
- **Honesty (P3/P4):** every card carries its tier badge; predictions/datamined visually distinguished (dotted/dashed); JP-ahead noted in the page blurb; nothing renders a bare date without its tier.

---

## Execution Handoff

Subagent-driven: dispatch one fresh subagent per task with the full task text, TDD, two-stage review between tasks. After Task 5 merges, the worktree work is done — finish via finishing-a-development-branch (merge to main).

**Follow-ups (not in this plan):** (1) auto-fill upcoming CMs from `cm_tracks.json` + the pace predictor (M3 synthesis); (2) range/zoom controls + proportional time axis; (3) build-time headless official-`/news/` auto-confirm.
