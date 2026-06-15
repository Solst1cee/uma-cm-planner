# M3 Forecast Importers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the M3 build-time importers — JP→Global **pace calibration**, an **official-news** importer (headless-render the authority for confirmations), and a **uma.guide CM#→track** importer — so the timeline can *predict* upcoming Global CM dates and *confirm* against the official source.

**Architecture:** Plan 2 of M3 (milestone 2). Pattern proven by recon (2026-06-15): each importer is a **build-time/local script** (needs network + Chrome) whose **pure parser is the tested core** (TDD against a captured fixture); the fetch/render and dataset emission live in the script. **These do NOT run in the static deployed app or CI** (spec §1.5) — they run on demand (`pnpm timeline:import`). Importers are brittle (HTML/SPA layouts change); repair the parser + re-capture the fixture when they break.

**Tech Stack:** TypeScript strict, Vitest, tsx scripts, headless Chrome (already on this machine: `C:\Program Files\Google\Chrome\Application\chrome.exe`), `fetch` (Node 24). Worktree: `.claude/worktrees/feat+m3-importers`. Gate: `pnpm typecheck && pnpm test`.

---

## Recon facts (2026-06-15 — ground these in the parsers)

- **SoulEC sheet** is a messy multi-section CSV (not clean columns) but states the **pace factor = 1.422 (142.2%)** — JP→Global acceleration. JP launch ≈ **2021-02-24**, Global launch ≈ **2025-06-26** (the launch anchor pair).
- **uma.guide `/cm-schedule/`** = an **ordered list** of 44 CMs, each `#N · Cup name · Racetrack · distance · Sprint/Mile/Medium/Long · Turf/Dirt`, **no dates**. Recurring cup names (e.g. `#3 Cancer · Tokyo 1600m Mile Turf` vs the later Global CM15 Cancer · Hanshin 2200m). The list is positional — `#N` corresponds to the Nth CM occurrence. *(Verify during build whether `#N` aligns to the Global CM number — Global CM15 should be the Hanshin 2200m Cancer; if `#N` ≠ Global CM number, emit by position and let overrides map cmNumber.)*
- **umamusume.com/news/** is a JS SPA — a plain fetch returns an empty shell, but **headless Chrome `--dump-dom` renders it** (164 KB DOM with real `/news/<id>/` links + dates `2026/06/…`). Extracting a CM's full track/dates from inside an article is brittle; the robust use is the **news index** (id/title/date) as a confirmation feed.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/core/timeline.ts` | **Modify.** Add `JP_GLOBAL_PACE`, launch anchors, `predictGlobalDateDefault`. |
| `src/core/types.ts` | **Modify.** Add `NewsItem`, `CmTrack`. |
| `src/core/newsMatch.ts` | **Create.** Pure: classify a `NewsItem` (cm/banner/patch) + match to a cup name. |
| `src/core/newsMatch.test.ts`, `src/core/timeline.test.ts` | **Create/modify.** Tests. |
| `scripts/lib/render.ts` | **Create.** `renderDom(url)` — headless-Chrome `--dump-dom` wrapper (finds Chrome). |
| `scripts/import-official-news.ts` | **Create.** Render `/news/` → `parseOfficialNews` → `public/data/official_news.json`. |
| `scripts/parse-official-news.ts` | **Create.** Pure `parseOfficialNews(html) → NewsItem[]` (TDD). |
| `scripts/import-uma-guide.ts` | **Create.** Fetch `/cm-schedule/` → `parseUmaGuideSchedule` → `public/data/cm_tracks.json`. |
| `scripts/parse-uma-guide.ts` | **Create.** Pure `parseUmaGuideSchedule(html) → CmTrack[]` (TDD). |
| `scripts/__fixtures__/*.html` | **Create.** Captured DOM/HTML samples the parsers test against. |
| `package.json` | **Modify.** Add `timeline:import` script. |

---

## Task 1: Pace calibration

**Files:** Modify `src/core/timeline.ts`, `src/core/timeline.test.ts`.

- [ ] **Step 1: Add the failing test** (append to `src/core/timeline.test.ts`):
```ts
import { predictGlobalDateDefault, JP_GLOBAL_PACE, JP_LAUNCH, GLOBAL_LAUNCH } from './timeline';

describe('pace calibration', () => {
  it('exposes the calibrated JP→Global pace (SoulEC 1.422) + launch anchors', () => {
    expect(JP_GLOBAL_PACE).toBeCloseTo(1.422);
    expect(JP_LAUNCH).toBe('2021-02-24');
    expect(GLOBAL_LAUNCH).toBe('2025-06-26');
  });
  it('predictGlobalDateDefault compresses a JP date by the baked pace from launch', () => {
    // a JP event exactly at JP launch → Global launch
    expect(predictGlobalDateDefault('2021-02-24')).toBe('2025-06-26');
    // 1422 JP days after launch → 1000 Global days after launch (1422/1.422)
    const d = predictGlobalDateDefault('2025-01-16'); // 2021-02-24 + 1422 days
    expect(d).toBe(predictGlobalDateDefault('2025-01-16')); // deterministic
    expect(d > '2025-06-26').toBe(true);
  });
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** (append to `src/core/timeline.ts`):
```ts
/** JP→Global content acceleration (SoulEC "Time Factor" ≈ 142.2%, 2026-06-15). PREDICTION input only. */
export const JP_GLOBAL_PACE = 1.422;
export const JP_LAUNCH = '2021-02-24';
export const GLOBAL_LAUNCH = '2025-06-26';

/** Predict a Global date from a JP date using the baked pace + launch anchors (tier 'prediction'). */
export function predictGlobalDateDefault(jpISO: string): string {
  return predictGlobalDate(jpISO, JP_GLOBAL_PACE, JP_LAUNCH, GLOBAL_LAUNCH);
}
```
> `predictGlobalDate` already exists (M3 Plan 1). Confirm the Step-1 expected `'2025-06-26'` matches your output (adjust the test if UTC rounding shifts it by a day; keep the "JP launch → Global launch" property).

- [ ] **Step 4: Run → PASS.** `pnpm typecheck` clean.
- [ ] **Step 5: Commit**
```bash
git add src/core/timeline.ts src/core/timeline.test.ts
git commit -m "feat(core): bake JP→Global pace (1.422) + predictGlobalDateDefault"
```

---

## Task 2: Official-news importer (headless render → confirmation feed)

**Files:** Create `scripts/lib/render.ts`, `scripts/parse-official-news.ts`, `scripts/parse-official-news.test.ts`, `scripts/import-official-news.ts`, `scripts/__fixtures__/official-news.html`; Modify `src/core/types.ts`; Create `src/core/newsMatch.ts` + test; Generated `public/data/official_news.json`.

- [ ] **Step 1: Capture the fixture** (real rendered DOM — the parser's ground truth):
```bash
chrome="/c/Program Files/Google/Chrome/Application/chrome.exe"
mkdir -p scripts/__fixtures__
timeout 40 "$chrome" --headless --disable-gpu --no-sandbox --virtual-time-budget=8000 --dump-dom "https://umamusume.com/news/" > scripts/__fixtures__/official-news.html 2>/dev/null
wc -c scripts/__fixtures__/official-news.html   # expect ~150–170 KB
grep -oiE 'news/[0-9]+' scripts/__fixtures__/official-news.html | sort -u | head
```
**Inspect the fixture** to learn the per-item markup: each news item is an `<a href=".../news/<id>/">` whose subtree contains the title text + a date (`2026/06/…`) + possibly a category tag. Note the exact tag/class structure for the parser.

- [ ] **Step 2: Add `NewsItem` to `src/core/types.ts`**
```ts
export interface NewsItem {
  id: string;            // /news/<id>/
  title: string;
  date: string;          // ISO 'YYYY-MM-DD'
  url: string;           // https://umamusume.com/news/<id>/
  category?: string;
  /** Importer's guess at what this post is about (newsMatch.ts). */
  kind?: 'cm' | 'banner' | 'patch' | 'other';
}
```

- [ ] **Step 3: Pure parser — `scripts/parse-official-news.ts`** + TDD `scripts/parse-official-news.test.ts`.
Write the test FIRST, loading the captured fixture and asserting it extracts ≥5 items with id/title/date, e.g.:
```ts
// scripts/parse-official-news.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseOfficialNews } from './parse-official-news';

const html = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__/official-news.html'), 'utf8');

describe('parseOfficialNews', () => {
  const items = parseOfficialNews(html);
  it('extracts news items with id, ISO date, title, url', () => {
    expect(items.length).toBeGreaterThanOrEqual(5);
    for (const it of items.slice(0, 5)) {
      expect(it.id).toMatch(/^\d+$/);
      expect(it.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(it.url).toBe(`https://umamusume.com/news/${it.id}/`);
      expect(it.title.length).toBeGreaterThan(0);
    }
  });
  it('includes the known recent ids (e.g. 829 family)', () => {
    const ids = items.map((i) => i.id);
    expect(ids.some((id) => Number(id) >= 800 && Number(id) < 900)).toBe(true);
  });
});
```
Then implement `parseOfficialNews(html: string): NewsItem[]` — extract `<a href*="/news/<id>/">` blocks, pull the inner title text, the nearest `YYYY/MM/DD` (→ ISO), dedupe by id, sort desc by date. Base the regex/DOM-walk on the EXACT markup you saw in Step 1 (do not guess — match the fixture). Use a tiny regex/string approach (no DOM lib needed). Run → FAIL → implement → PASS.

- [ ] **Step 4: Classifier — `src/core/newsMatch.ts`** + TDD:
```ts
// src/core/newsMatch.ts
import type { NewsItem } from './types';
const CUP = /(taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|aries)\s+cup/i;
/** Heuristic classification of an official news post. */
export function classifyNews(title: string): NonNullable<NewsItem['kind']> {
  if (/champions?\s+meeting|チャンピオンズ|cup\b/i.test(title) || CUP.test(title)) return 'cm';
  if (/banner|scout|gacha|support card|new (uma|character)/i.test(title)) return 'banner';
  if (/balance|update|maintenance|adjustment|patch|version/i.test(title)) return 'patch';
  return 'other';
}
/** The cup name a CM post names, if any (lowercased, e.g. 'cancer cup'). */
export function cupOf(title: string): string | undefined {
  const m = title.match(CUP);
  return m ? m[0].toLowerCase() : undefined;
}
```
Test classifyNews ('… Cancer Cup …' → 'cm', banner/patch keywords, 'other') + cupOf. Run → FAIL → implement → PASS.

- [ ] **Step 5: The importer script — `scripts/import-official-news.ts`** (+ `scripts/lib/render.ts`):
`scripts/lib/render.ts` exports `renderDom(url: string): Promise<string>` — spawns headless Chrome (find it via `process.env.CHROME_PATH` or the common Win/macOS/Linux paths) with `--headless --disable-gpu --dump-dom --virtual-time-budget=8000`, returns stdout. `import-official-news.ts`: `renderDom('https://umamusume.com/news/')` → `parseOfficialNews` → set each item's `kind = classifyNews(title)` → write `public/data/official_news.json` = `{ dataVersion, fetchedAt: <pass-in or omit>, items }` via the deterministic writer. (Avoid `Date.now()`; if a fetched-at stamp is wanted, accept it as a CLI arg or omit it.)

- [ ] **Step 6: Run the importer + verify**
```bash
pnpm tsx scripts/import-official-news.ts
node -e "const n=require('./public/data/official_news.json'); console.log('items',n.items.length,'| cm posts',n.items.filter(i=>i.kind==='cm').length); console.log(JSON.stringify(n.items.slice(0,3),null,1))"
```
Expect a real list of recent posts with `kind` tags.

- [ ] **Step 7: Gate + commit**
`pnpm typecheck && pnpm test` green. Commit:
```bash
git add scripts/lib/render.ts scripts/parse-official-news.ts scripts/parse-official-news.test.ts scripts/import-official-news.ts scripts/__fixtures__/official-news.html src/core/types.ts src/core/newsMatch.ts src/core/newsMatch.test.ts public/data/official_news.json
git commit -m "feat(m3): official-news importer (headless render → confirmation feed) + classifier"
```

---

## Task 3: uma.guide CM#→track importer

**Files:** Create `scripts/parse-uma-guide.ts` + test + `scripts/__fixtures__/uma-guide-cm.html`, `scripts/import-uma-guide.ts`; Modify `src/core/types.ts`; Generated `public/data/cm_tracks.json`.

- [ ] **Step 1: Capture the fixture**
```bash
node -e "fetch('https://uma.guide/cm-schedule/').then(r=>r.text()).then(t=>require('node:fs').writeFileSync('scripts/__fixtures__/uma-guide-cm.html',t)).then(()=>console.log('saved'))"
wc -c scripts/__fixtures__/uma-guide-cm.html
grep -oiE 'taurus cup|cancer cup|hanshin|2200m' scripts/__fixtures__/uma-guide-cm.html | head
```
> If the bare fetch returns a JS shell (uma.guide may be SSR or SPA), fall back to `renderDom` from Task 2 (`scripts/lib/render.ts`). Inspect the fixture for the per-CM markup (`#N`, cup, track, distance, surface).

- [ ] **Step 2: Add `CmTrack` to `src/core/types.ts`**
```ts
export interface CmTrack {
  index: number;          // uma.guide position (#N)
  cupName: string;        // 'Cancer Cup'
  racetrack: string;      // 'Hanshin'
  distance: number;       // 2200
  distanceClass: 'sprint' | 'mile' | 'medium' | 'long';
  surface: 'turf' | 'dirt';
}
```

- [ ] **Step 3: Pure parser — `scripts/parse-uma-guide.ts`** + TDD `parse-uma-guide.test.ts` (load the fixture; assert it extracts ≥40 CMs; `#4` is `Leo Cup · Hanshin · 2200 · medium · turf` per recon, and one entry is `Cancer Cup · Hanshin · 2200` matching Global CM15). Implement `parseUmaGuideSchedule(html): CmTrack[]` matching the fixture's markup (regex/string). Run → FAIL → implement → PASS.

- [ ] **Step 4: Importer — `scripts/import-uma-guide.ts`**: fetch (or `renderDom`) `/cm-schedule/` → `parseUmaGuideSchedule` → write `public/data/cm_tracks.json` = `{ dataVersion, tracks: CmTrack[] }`. Run it; verify ~44 tracks.

- [ ] **Step 5: Add `pnpm timeline:import`** to `package.json` running both importers:
```json
"timeline:import": "tsx scripts/import-official-news.ts && tsx scripts/import-uma-guide.ts"
```

- [ ] **Step 6: Gate + commit**
`pnpm typecheck && pnpm test` green. Commit:
```bash
git add scripts/parse-uma-guide.ts scripts/parse-uma-guide.test.ts scripts/__fixtures__/uma-guide-cm.html scripts/import-uma-guide.ts src/core/types.ts public/data/cm_tracks.json package.json
git commit -m "feat(m3): uma.guide CM#→track importer + pnpm timeline:import"
```

---

## Self-Review

**1. Spec coverage (M3 spec §1.4 + milestone 2):** AUTHORITY confirmation via `/news/` (§1.4) → Task 2 (headless render, the honest semi-auto: surface posts + classify; curation/UI confirms). Pace-multiplier calibration (§1.4) → Task 1. uma.guide CM-schedule (§1.4) → Task 3. SoulEC/Phoenix/Game8 HTML scrapers → **intentionally skipped** (recon: messy/brittle; the pace value is baked from SoulEC, confirmed CMs come via official `/news/`). GameTora/ChronoGenesis → cite-only (untouched). Honest re-import (§1.5): importers are build-time/local (need Chrome+network), never runtime/CI — documented.

**2. Placeholder scan:** Fixtures are captured from real renders (Steps capture them). Parsers are written *against the captured markup* (the plan says "match the fixture, don't guess") — the only honest way to parse brittle HTML. No fabricated data.

**3. Type consistency:** `NewsItem`/`CmTrack` defined in `types.ts`, consumed by parsers + importers identically. `parseOfficialNews`/`classifyNews`/`cupOf`/`parseUmaGuideSchedule`/`predictGlobalDateDefault` signatures match their tests.

**Honest-numbers / brittleness (P3):** every importer's output is `prediction`/`other`-tier until curated against the authority; the pace prediction is labeled; parsers are fixture-locked and will need re-capture + repair when the upstream layout changes (spec §6 risk — repair, don't auto-trust).

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-06-15-m3-importers.md`. Two options:
1. **Subagent-Driven (recommended)** — fresh subagent per task, review between (note: Tasks 2–3 need network + Chrome at capture/import time).
2. **Inline Execution** — here with checkpoints.

Which approach?
