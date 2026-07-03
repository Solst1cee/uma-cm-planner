# Availability Gate — JP-ahead Support Cards — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit the ~321 JP-only gametora support cards as `server:'jp'` records with foresight-projected Global release dates, and gate them in the M1 card pool by the plan's CM date + a "show upcoming" toggle.

**Architecture:** A build-time `foresight-build.ts` reuses the merged `calibratePace`/`projectGlobalDate` to date JP records. `build-cards` gains a `buildJpCards` that builds records for gametora cards absent from the master extract (reusing `buildPerLevel`). The pure `poolModel` gains availability gating; `InheritancePage` + `SupportCardPoolCard` surface it.

**Tech Stack:** TypeScript, Vitest, tsx build scripts, React. No new deps.

## Global Constraints

- **Reuse, don't reinvent:** `projectReleaseDate` calls the merged `projectGlobalDate`; JP-card `perLevel` calls the existing `buildPerLevel(gt.effects, rarity)` (build-cards.ts:127 already uses it for all cards). No new date/perLevel math.
- **P4 (no leak):** JP-ahead *skills* stay dropped — a JP card's `skills` = its released-subset only (`releasedSkillIds` filter). The build-time oracle `assertTachyonsParity` must only assert `server:'global'` cards.
- **P3 honesty:** projected dates carry `releaseDatePredicted:true`; an announced Global date (`release_en`) always wins (`predicted:false`). JP cards are `server:'jp'`.
- **Confirmed-CM source:** the Global CM dates for calibration come from `data-overrides/timeline_overrides.json` CM entries filtered to `status:'confirmed'`, matched to `jp-schedule.json` by `cmNumber` (NOT cm_presets).
- **gametora field map:** `rarity` 1/2/3 → R/SR/SSR; `type` string `speed/stamina/power/guts/friend/group` + **`intelligence`→`wit`**; hint pool = `hints.hint_skills`; events = `event_skills`; `nameEn` = `title_en ?? title_ja ?? char_name`; `charName` = `char_name`; JP date = `release`; announced Global = `release_en`.
- **Windows/case-FS:** `noUncheckedIndexedAccess` is on — guard array indexing.

---

### Task 1: Build-time foresight foundation

**Files:**
- Create: `scripts/lib/foresight-build.ts`
- Test: `scripts/lib/foresight-build.test.ts`

**Interfaces:**
- Consumes: `calibratePace`, `projectGlobalDate`, `Calibration`, `SharedCm` from `@/core/foresight`; `JpCmDate` from `@/core/types`.
- Produces: `ConfirmedCm { cmNumber: number; global: string }`; `buildForesightCalibration(jpCms: JpCmDate[], confirmed: ConfirmedCm[]): Calibration | null`; `projectReleaseDate(jpDate: string | undefined, announcedGlobal: string | undefined, cal: Calibration | null): { releaseDate?: string; predicted: boolean }`.

- [ ] **Step 1: Write the failing test** `scripts/lib/foresight-build.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildForesightCalibration, projectReleaseDate, type ConfirmedCm } from './foresight-build';
import type { JpCmDate } from '@/core/types';

const JP: JpCmDate[] = [
  { cmNumber: 10, cupName: 'Aquarius Cup', jpDate: '2022-02-18' },
  { cmNumber: 11, cupName: 'Pisces Cup', jpDate: '2022-03-22' },
  { cmNumber: 12, cupName: 'Aries Cup', jpDate: '2022-04-22' },
  { cmNumber: 13, cupName: 'Taurus Cup', jpDate: '2022-05-24' },
  { cmNumber: 14, cupName: 'Gemini Cup', jpDate: '2022-06-14' },
  { cmNumber: 15, cupName: 'Cancer Cup', jpDate: '2022-07-14' },
];
const CONFIRMED: ConfirmedCm[] = [
  { cmNumber: 10, global: '2026-03-06' }, { cmNumber: 11, global: '2026-03-30' },
  { cmNumber: 12, global: '2026-04-23' }, { cmNumber: 13, global: '2026-05-14' },
  { cmNumber: 14, global: '2026-06-04' }, { cmNumber: 15, global: '2026-06-24' },
];

describe('buildForesightCalibration', () => {
  it('joins jp-schedule to confirmed Global CMs by cmNumber → GameTora pace', () => {
    const cal = buildForesightCalibration(JP, CONFIRMED)!;
    expect(cal.pace).toBeCloseTo(1.327, 2);
    expect(cal.anchorGlobal).toBe('2026-06-24');
  });
  it('returns null when fewer than 2 CMs join', () => {
    expect(buildForesightCalibration(JP, [{ cmNumber: 10, global: '2026-03-06' }])).toBeNull();
  });
});

describe('projectReleaseDate', () => {
  const cal = buildForesightCalibration(JP, CONFIRMED);
  it('announced Global date wins (not predicted)', () => {
    expect(projectReleaseDate('2022-08-13', '2026-05-01', cal)).toEqual({ releaseDate: '2026-05-01', predicted: false });
  });
  it('projects from the JP date when unannounced (predicted)', () => {
    expect(projectReleaseDate('2022-08-13', undefined, cal)).toEqual({ releaseDate: '2026-07-16', predicted: true });
  });
  it('yields no date when uncalibratable or no JP date', () => {
    expect(projectReleaseDate('2022-08-13', undefined, null)).toEqual({ predicted: false });
    expect(projectReleaseDate(undefined, undefined, cal)).toEqual({ predicted: false });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run scripts/lib/foresight-build.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement** `scripts/lib/foresight-build.ts`:

```ts
/**
 * Build-time foresight: assemble the shared-CM window and project Global release
 * dates for JP-ahead records. Reuses @/core/foresight (no new date math). P3.
 */
import { calibratePace, projectGlobalDate, type Calibration, type SharedCm } from '@/core/foresight';
import type { JpCmDate } from '@/core/types';

/** A confirmed Global CM date, keyed by CM number (from timeline_overrides). */
export interface ConfirmedCm {
  cmNumber: number;
  global: string;
}

/** Join jp-schedule CMs to confirmed Global CM dates by cmNumber, then calibrate. */
export function buildForesightCalibration(jpCms: JpCmDate[], confirmed: ConfirmedCm[]): Calibration | null {
  const globalByNum = new Map(confirmed.map((c) => [c.cmNumber, c.global]));
  const shared: SharedCm[] = [];
  for (const jp of jpCms) {
    const global = globalByNum.get(jp.cmNumber);
    if (global !== undefined) shared.push({ cmNumber: jp.cmNumber, jp: jp.jpDate, global });
  }
  return calibratePace(shared);
}

/** Resolve a Global release date for a JP record: announced wins, else project, else none. */
export function projectReleaseDate(
  jpDate: string | undefined,
  announcedGlobal: string | undefined,
  cal: Calibration | null,
): { releaseDate?: string; predicted: boolean } {
  if (announcedGlobal !== undefined) return { releaseDate: announcedGlobal, predicted: false };
  if (jpDate === undefined || cal === null) return { predicted: false };
  return { releaseDate: projectGlobalDate(jpDate, cal), predicted: true };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run scripts/lib/foresight-build.test.ts`
Expected: PASS (7 assertions). If the projected date differs from `2026-07-16`, recompute by hand and correct the test — the math is `anchorGlobal + (jp − anchorJp)/pace`.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add scripts/lib/foresight-build.ts scripts/lib/foresight-build.test.ts
git commit -m "feat(availability): build-time foresight calibration + projectReleaseDate"
```

---

### Task 2: Emit JP-only cards in the build

**Files:**
- Modify: `scripts/lib/upstream-types.ts` (extend `GtCard`, ~line 102-129)
- Modify: `scripts/build-cards.ts` (add `buildJpCards`; ensure `assertTachyonsParity` skips `server:'jp'`)
- Modify: `scripts/build-all.ts` (read `jp-schedule.json`, build `ConfirmedCm[]` from `timeline_overrides`, calibrate, concat JP cards)
- Modify: `scripts/outputs.test.ts` (support-card count)
- Test: `scripts/build-cards.jp.test.ts`

**Interfaces:**
- Consumes: `buildForesightCalibration`, `projectReleaseDate`, `ConfirmedCm` (Task 1); `buildPerLevel` from `./lib/lerp`; `Calibration` from `@/core/foresight`.
- Produces: `buildJpCards(inputs: { gametoraCards: GtCard[]; masterIds: ReadonlySet<number>; eventSources: EventSkillSourcesJson; releasedSkillIds: ReadonlySet<string>; cal: Calibration | null; dataVersion: string }): SupportCardRecord[]`.

- [ ] **Step 1: Extend `GtCard`** in `scripts/lib/upstream-types.ts` — add the fields `buildJpCards` reads (keep existing ones):

```ts
export interface GtCard {
  support_id: number;
  effects?: number[][];
  rarity: number; // 1=R 2=SR 3=SSR
  type: string; // speed|stamina|power|guts|intelligence|friend|group
  char_name: string;
  title_en?: string; // fan/EN card title; absent for JP-only
  title_ja?: string;
  hints?: { hint_skills?: number[]; hint_others?: unknown[] };
  event_skills?: number[];
  release?: string; // JP release date (ISO)
  title_en_gl?: string;
  release_en?: string; // Global release date, absent if unreleased
}
```

- [ ] **Step 2: Write the failing test** `scripts/build-cards.jp.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildJpCards } from './build-cards';
import type { GtCard } from './lib/upstream-types';
import { buildForesightCalibration } from './lib/foresight-build';

const cal = buildForesightCalibration(
  [{ cmNumber: 15, cupName: 'Cancer Cup', jpDate: '2022-07-14' }, { cmNumber: 14, cupName: 'Gemini Cup', jpDate: '2022-06-14' }],
  [{ cmNumber: 15, global: '2026-06-24' }, { cmNumber: 14, global: '2026-06-04' }],
);
// Minimal gametora rows: one JP-only SSR (in master? no), one already-Global (skipped).
const gt: GtCard[] = [
  { support_id: 90001, rarity: 3, type: 'intelligence', char_name: 'Test Uma',
    title_ja: 'JPカード', effects: [[18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]],
    hints: { hint_skills: [200001, 999999] }, event_skills: [200002], release: '2022-08-13' },
  { support_id: 10001, rarity: 3, type: 'speed', char_name: 'Global Uma', effects: [[18, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20]], release: '2020-01-01', release_en: '2025-06-26' },
];

describe('buildJpCards', () => {
  const out = buildJpCards({
    gametoraCards: gt,
    masterIds: new Set([10001]), // 10001 is a Global master card → skipped
    eventSources: {},
    releasedSkillIds: new Set(['200001', '200002']), // 999999 is JP-ahead → dropped
    cal,
    dataVersion: 'test',
  });
  it('emits only gametora cards absent from the master set, as server:jp', () => {
    expect(out).toHaveLength(1);
    expect(out[0]!.cardId).toBe('90001');
    expect(out[0]!.server).toBe('jp');
  });
  it('maps rarity/type (intelligence→wit) and name fallback', () => {
    expect(out[0]!.rarity).toBe('SSR');
    expect(out[0]!.type).toBe('wit');
    expect(out[0]!.nameEn).toBe('JPカード'); // title_en absent → title_ja
  });
  it('drops JP-ahead skills, keeps released ones', () => {
    const ids = out[0]!.skills.map((s) => s.skillId);
    expect(ids).toContain('200001'); // released hint
    expect(ids).toContain('200002'); // released event
    expect(ids).not.toContain('999999'); // JP-ahead hint dropped
  });
  it('projects the Global releaseDate as predicted', () => {
    expect(out[0]!.releaseDate).toBeDefined();
    expect(out[0]!.releaseDatePredicted).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm vitest run scripts/build-cards.jp.test.ts`
Expected: FAIL — `buildJpCards` not exported.

- [ ] **Step 4: Implement `buildJpCards`** in `scripts/build-cards.ts` (add after `buildCards`; import `buildForesightCalibration` is not needed here, but `projectReleaseDate` + `Calibration` are):

```ts
// at top of build-cards.ts, add imports:
import { projectReleaseDate } from './lib/foresight-build';
import type { Calibration } from '@/core/foresight';

const GT_RARITY: Record<number, 'R' | 'SR' | 'SSR'> = { 1: 'R', 2: 'SR', 3: 'SSR' };
const GT_TYPE: Record<string, CardType> = {
  speed: 'speed', stamina: 'stamina', power: 'power', guts: 'guts',
  intelligence: 'wit', friend: 'friend', group: 'group',
};

/** JP-ahead cards: gametora rows absent from the Global master extract (server:'jp'). */
export function buildJpCards(inputs: {
  gametoraCards: GtCard[];
  masterIds: ReadonlySet<number>;
  eventSources: EventSkillSourcesJson;
  releasedSkillIds: ReadonlySet<string>;
  cal: Calibration | null;
  dataVersion: string;
}): SupportCardRecord[] {
  const { gametoraCards, masterIds, eventSources, releasedSkillIds, cal, dataVersion } = inputs;
  const records: SupportCardRecord[] = [];
  let skipped = 0;
  for (const gt of gametoraCards) {
    if (masterIds.has(gt.support_id)) continue; // Global card → handled by buildCards
    const rarity = GT_RARITY[gt.rarity];
    const type = GT_TYPE[gt.type];
    if (rarity === undefined || type === undefined || !gt.effects) { skipped++; continue; }

    const skills: CardSkill[] = [];
    for (const id of [...(gt.hints?.hint_skills ?? [])].sort((a, b) => a - b)) {
      if (releasedSkillIds.has(String(id))) skills.push({ skillId: String(id), sourceType: 'hint_pool', hintLevels: 1 });
    }
    const src = eventSources[String(gt.support_id)];
    const chain = new Set<number>(src?.chain_event_skills ?? []);
    const eventIds = new Set<number>([...chain, ...(src?.random_event_skills ?? []), ...(gt.event_skills ?? [])]);
    for (const id of [...eventIds].sort((a, b) => a - b)) {
      if (!releasedSkillIds.has(String(id))) continue;
      skills.push({ skillId: String(id), sourceType: chain.has(id) ? 'chain' : 'random_event' });
    }

    const { releaseDate, predicted } = projectReleaseDate(gt.release, gt.release_en, cal);
    const rec: SupportCardRecord = {
      cardId: String(gt.support_id),
      nameEn: gt.title_en ?? gt.title_ja ?? gt.char_name,
      charName: gt.char_name,
      rarity, type,
      perLevel: buildPerLevel(gt.effects, rarity),
      skills,
      hintPoolSize: skills.filter((s) => s.sourceType === 'hint_pool').length,
      server: 'jp',
      dataVersion,
    };
    if (releaseDate !== undefined) rec.releaseDate = releaseDate;
    if (predicted) rec.releaseDatePredicted = true;
    records.push(rec);
  }
  if (skipped > 0) console.warn(`build-cards: skipped ${skipped} JP card(s) missing effects/rarity/type`);
  records.sort((a, b) => Number(a.cardId) - Number(b.cardId));
  return records;
}
```

- [ ] **Step 5: Guard `assertTachyonsParity`.** In `scripts/build-cards.ts`, the parity oracle must only assert Global cards. At the top of its per-card loop add: `if (record.server !== 'global') continue;` (find the `for (... of cards)` loop in `assertTachyonsParity`).

- [ ] **Step 6: Run the JP-card test to verify it passes**

Run: `pnpm vitest run scripts/build-cards.jp.test.ts`
Expected: PASS.

- [ ] **Step 7: Wire into `scripts/build-all.ts`.** Where cards are built (~line 70), read the JP schedule, build the confirmed-CM list from the timeline overrides already read at ~line 137 (move that read up if needed, or re-read), calibrate, and concat:

```ts
import { buildForesightCalibration, type ConfirmedCm } from './lib/foresight-build';
import { buildJpCards } from './build-cards';
import type { JpCmDate } from '@/core/types';
// ...
const gametoraCards = readBorrowedJson<GtCard[]>('gametora/support-cards.json');
const master = readBorrowedJson<MasterCardsJson>('support-cards.json');
let cards = buildCards({ master, gametoraCards, eventSources, tachyons, releasedSkillIds, dataVersion: DATA_VERSION });

// JP-ahead cards, dated by build-time foresight.
const jpSchedule = readJson<{ cms?: JpCmDate[] }>(join(OVERRIDES_DIR, 'jp-schedule.json'));
const tlOverrides = readJson<{ entries?: Array<{ cm?: { cmNumber?: number }; dates?: { finals?: string }; status?: string }> }>(join(OVERRIDES_DIR, 'timeline_overrides.json')).entries ?? [];
const confirmed: ConfirmedCm[] = tlOverrides
  .filter((e) => e.status === 'confirmed' && e.cm?.cmNumber !== undefined && e.dates?.finals !== undefined)
  .map((e) => ({ cmNumber: e.cm!.cmNumber!, global: e.dates!.finals! }));
const cal = buildForesightCalibration(jpSchedule.cms ?? [], confirmed);
const masterIds = new Set(Object.values(master).map((c) => c.id));
const jpCards = buildJpCards({ gametoraCards, masterIds, eventSources, releasedSkillIds, cal, dataVersion: DATA_VERSION });
console.log(`build-cards: emitted ${jpCards.length} JP-ahead card(s) (${jpCards.filter((c) => c.releaseDatePredicted).length} date-projected)`);
cards = [...cards, ...jpCards].sort((a, b) => Number(a.cardId) - Number(b.cardId));
```

(`MasterCard.id` is the numeric id — confirm the field name in `upstream-types.ts` `MasterCard`; adjust `masterIds` if it differs.)

- [ ] **Step 8: Rebuild + update the count.**

Run: `pnpm data:build`
Expected: succeeds; a log line reports the JP-card count. Note the new total from `build-cards: emitted N JP-ahead card(s)` and the final `public/data written: … support cards`.

Update `scripts/outputs.test.ts`: change the support-card count assertion from `222` to the new total (222 + emitted). If `card_effects.json`/`card_unique_effects.json` count assertions also shift, update them to the reported values.

- [ ] **Step 9: Full gate + commit**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

```bash
git add scripts/lib/upstream-types.ts scripts/build-cards.ts scripts/build-cards.jp.test.ts scripts/build-all.ts scripts/outputs.test.ts public/data/support_cards.json public/data/card_effects.json public/data/card_unique_effects.json
git commit -m "feat(availability): emit JP-ahead support cards (server:jp, foresight-dated)"
```

---

### Task 3: Availability gating in the pure pool model

**Files:**
- Modify: `src/features/inheritance/poolModel.ts` (`PoolItem` + `buildPoolItem` + `PoolFilters` + `filterPool`)
- Test: `src/features/inheritance/poolModel.test.ts` (extend)

**Interfaces:**
- Consumes: `isReleasedBy` from `@/core/availability`.
- Produces: `PoolItem` gains `server: Server`, `releaseDate?: string`, `releaseDatePredicted?: boolean`; `PoolFilters` gains `showUpcoming: boolean`; `filterPool(items, filters, asOfISO?: string)` gates JP items.

- [ ] **Step 1: Write the failing test** — extend `poolModel.test.ts`:

```ts
import { isReleasedBy } from '@/core/availability';

describe('filterPool — availability gating', () => {
  const base = { /* minimal PoolItem fields the existing tests use */ } as unknown as PoolItem;
  const globalItem: PoolItem = { ...base, cardId: 'g', server: 'global' };
  const jpSoon: PoolItem = { ...base, cardId: 'j1', server: 'jp', releaseDate: '2026-07-01', releaseDatePredicted: true };
  const jpLater: PoolItem = { ...base, cardId: 'j2', server: 'jp', releaseDate: '2027-01-01', releaseDatePredicted: true };
  const filters = { rarity: 'all', type: 'all', skill: null, search: '', showUpcoming: false } as PoolFilters;

  it('hides jp cards when showUpcoming is off', () => {
    const out = filterPool([globalItem, jpSoon], filters, '2026-08-01');
    expect(out.map((i) => i.cardId)).toEqual(['g']);
  });
  it('shows jp cards released by the CM date when showUpcoming is on', () => {
    const out = filterPool([globalItem, jpSoon, jpLater], { ...filters, showUpcoming: true }, '2026-08-01');
    expect(out.map((i) => i.cardId).sort()).toEqual(['g', 'j1']); // j2 not out by 2026-08-01
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/features/inheritance/poolModel.test.ts`
Expected: FAIL — `filterPool` ignores `showUpcoming`/`asOfISO`; `PoolItem`/`PoolFilters` lack the fields.

- [ ] **Step 3: Implement.** In `poolModel.ts`:
  - Add to `PoolItem`: `server: Server; releaseDate?: string; releaseDatePredicted?: boolean;` (import `Server` from `@/core/types`).
  - In `buildPoolItem(card, ...)`, copy them through: `server: card.server, releaseDate: card.releaseDate, releaseDatePredicted: card.releaseDatePredicted`.
  - Add to `PoolFilters`: `showUpcoming: boolean;`.
  - Change `filterPool` signature to `filterPool(items: PoolItem[], filters: PoolFilters, asOfISO?: string): PoolItem[]` and add, before the existing rarity/type/skill/search filtering:

```ts
import { isReleasedBy } from '@/core/availability';
// inside filterPool, first gate:
const now = asOfISO ?? new Date().toISOString().slice(0, 10);
items = items.filter((it) =>
  it.server === 'global' || (filters.showUpcoming && isReleasedBy(it, now)),
);
```

  (`isReleasedBy` reads `{ releaseDate?, server }` — `PoolItem` now satisfies it.)

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/features/inheritance/poolModel.test.ts`
Expected: PASS. Fix any existing `filterPool`/`DEFAULT_FILTERS` callers that now need `showUpcoming` (add `showUpcoming: false`).

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add src/features/inheritance/poolModel.ts src/features/inheritance/poolModel.test.ts
git commit -m "feat(availability): gate the card pool by CM date + showUpcoming (pure)"
```

---

### Task 4: Wire the gate into the page + pool UI

**Files:**
- Modify: `src/features/inheritance/InheritancePage.tsx` (derive `asOfISO`, pass to `filterPool`; provide `showUpcoming` state)
- Modify: `src/features/inheritance/SupportCardPoolCard.tsx` (`show upcoming` checkbox + predicted `~date` badge)
- Test: `src/features/inheritance/SupportCardPoolCard.test.tsx` (extend)

**Interfaces:**
- Consumes: `filterPool(items, filters, asOfISO)` + `PoolFilters.showUpcoming` (Task 3); the `PoolItem.releaseDatePredicted`/`releaseDate` fields.

- [ ] **Step 1: Derive `asOfISO` in `InheritancePage.tsx`.** Add `timeline` to the `useGameData()` destructure (line 122) and, near the plan, replicate the SkillChartPanel pattern:

```ts
const { skillById, cardById, cards, timeline } = useGameData();
// ... where `plan` (uma1Plan) is available:
const cmNumber = plan?.cmRef.kind === 'cm' ? plan.cmRef.cmNumber : undefined;
const cmEntry = (timeline as TimelineEntry[] | undefined)?.find((e) => e.type === 'cm' && e.cm?.cmNumber === cmNumber);
const asOfISO = cmEntry?.dates.start ?? cmEntry?.dates.finals ?? new Date().toISOString().slice(0, 10);
```

Import `TimelineEntry` from `@/core/types`. Pass `asOfISO` down so the pool's `filterPool(items, filters, asOfISO)` uses it — the simplest wiring is to lift `filters` (incl. `showUpcoming`) or the `asOfISO` into the pool via a prop; do whichever matches how `SupportCardPoolCard` currently owns `filters` (it owns them in local state — so pass `asOfISO` as a new prop and thread it into its `filterPool` call).

- [ ] **Step 2: Add the toggle + badge to `SupportCardPoolCard.tsx`.**
  - Add `asOfISO?: string` to `SupportCardPoolCardProps`.
  - Add `showUpcoming` to the local `DEFAULT_FILTERS` (`showUpcoming: false`) and pass `asOfISO` into the existing `filterPool(items, filters)` call → `filterPool(items, filters, asOfISO)`.
  - Add a checkbox in the filter row:

```tsx
<label className="cmp-upcoming-toggle">
  <input type="checkbox" checked={filters.showUpcoming}
    onChange={(e) => setFilters((f) => ({ ...f, showUpcoming: e.target.checked }))} /> show upcoming
</label>
```

  - In `renderIcon`/the icon cell, when `item.releaseDatePredicted`, render a small badge `~{item.releaseDate}` (predicted-date marker, P3). If the icon is rendered by the page's `renderIcon` prop, add the badge in the pool's own icon-cell wrapper instead (wherever `server:'jp'` items are drawn).

- [ ] **Step 3: Write/extend the test** `SupportCardPoolCard.test.tsx` — a JP item is hidden by default and shown when the checkbox is toggled (with an `asOfISO` past its `releaseDate`), and the predicted badge renders:

```tsx
it('hides upcoming cards until the toggle, then shows the predicted badge', async () => {
  const items = [
    { cardId: 'g', server: 'global', /* …min fields… */ },
    { cardId: 'j', server: 'jp', releaseDate: '2026-07-01', releaseDatePredicted: true, /* …min fields… */ },
  ] as unknown as PoolItem[];
  render(<SupportCardPoolCard {...baseProps} items={items} asOfISO="2026-08-01" />);
  expect(screen.queryByTestId('pool-card-j')).toBeNull();
  await userEvent.click(screen.getByLabelText(/show upcoming/i));
  expect(screen.getByTestId('pool-card-j')).toBeInTheDocument();
  expect(screen.getByText(/~2026-07-01/)).toBeInTheDocument();
});
```

(Adapt selectors to the component's actual test-ids/roles — check the existing `SupportCardPoolCard.test.tsx` for the render helper + how icons are queried.)

- [ ] **Step 4: Run the pool tests**

Run: `pnpm vitest run src/features/inheritance/SupportCardPoolCard.test.tsx src/features/inheritance/InheritancePage.pool.test.tsx`
Expected: PASS. If a UI test flakes (React null / HMR race), re-run once.

- [ ] **Step 5: Full gate + commit**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

```bash
git add src/features/inheritance/InheritancePage.tsx src/features/inheritance/SupportCardPoolCard.tsx src/features/inheritance/SupportCardPoolCard.test.tsx
git commit -m "feat(availability): show-upcoming toggle + predicted badge in the card pool"
```

---

## Self-Review

**Spec coverage:**
- ✅ Build-time foresight foundation — Task 1.
- ✅ JP-only card emission (server:'jp', projected dates, perLevel via buildPerLevel, gametora rarity/type/skills, drop JP-ahead skills) — Task 2.
- ✅ Confirmed-CM join from timeline_overrides by cmNumber — Task 2 Step 7.
- ✅ Pool gate + show-upcoming toggle + predicted badge — Tasks 3–4.
- ✅ assertTachyonsParity skips server:'jp' — Task 2 Step 5.
- ✅ outputs.test count — Task 2 Step 8.
- Decisions A (drop JP-ahead skills) + B (reuse buildPerLevel) + C (build from gametora) — Tasks 2.

**Type consistency:** `ConfirmedCm`/`projectReleaseDate`/`buildJpCards` signatures match across Tasks 1–2; `PoolItem`/`PoolFilters`/`filterPool(…, asOfISO)` match across Tasks 3–4; `isReleasedBy` reads `{ releaseDate?, server }` which `PoolItem` now provides.

**Placeholder scan:** concrete code + real gametora field names throughout. Two determinate-but-run-to-read values (the emitted JP count for `outputs.test.ts`; exact `MasterCard.id` field name) are called out with how to obtain them, not left vague.

**Risks flagged inline:** `assertTachyonsParity` server filter (Task 2.5), `card_effects.json` count drift (Task 2.8), `MasterCard.id` field name (Task 2.7), UI selector adaptation (Task 4.3).
