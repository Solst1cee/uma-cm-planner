# Module 3 — Meta Intel Workspace: Design Spec

**Status:** APPROVED — M3 design locked (2026-06-14, timeline-first) · **Owner:** Sun · *(implementation plan via writing-plans deferred until M1/M2 brainstormed)*
**Origin:** Brainstorm (superpowers:brainstorming), building on plan §9. **Timeline-first** slice (it's the dependency M4 already needs).
**Scope:** M3 is the **CM intelligence hub** — three faces, built in this order:
1. **Timeline** (CM schedule · banners · patches) — **v1, the focus of this spec**; unblocks M4's §0 + Now/Upcoming/Future + patch-stamping.
2. **Meta three-up** (JP/TW prior vs Global observed vs sim) — **phase 2** (its sim column needs the engine-first vendor work).
3. **Match logger + sim feedback** — **phase 3** (compounds over time).

---

## 1. The Timeline (v1)

### 1.1 Purpose & integration
A **browsable timeline** of upcoming CMs, banners, and patches that doubles as the **confirmation workspace**. It owns the data M4 consumes:
- `cm_schedule.json` — CM → `courseId` + dates + conditions (M4 §0).
- per-character / per-support **Global release dates** (M4 Now / + Upcoming / + Future availability).
- **patch timeline** — patch version + date (M4 stamps the active patch on each plan; meta read per patch).

### 1.2 Data model

> **Shared types** (`CmId`, `CmRef`, the `CmScheduleRow` projection M4 consumes, the `CmPlan.patch` field) are canonical in [`2026-06-15-shared-data-model.md`](2026-06-15-shared-data-model.md) §3/§6 — emit the projection there, with `cmNumber → cmId` ('CM14') and non-optional `courseId`.
`TimelineEntry` (generated rows ⊕ overrides, merged last):
```ts
interface TimelineEntry {
  id: string;
  type: 'cm' | 'banner' | 'patch';
  title: string;
  dates: { start?: string; finals?: string; end?: string };   // ISO; CM uses start(signup)+finals
  cm?:     { cmNumber: number; courseId?: string; trackSummary?: string };
  banner?: { kind: 'char' | 'support'; umaId?: string; cardId?: string };
  patch?:  { version?: string; summary?: string };
  tier:   'official' | 'datamined' | 'prediction';    // source / confidence class
  status: 'confirmed' | 'unconfirmed';                 // has it been verified against official /news/ yet?
  source: { kind: 'official_news'|'game8'|'soulec'|'phoenix'|'umaguide'|'gametora'|'umalator'|'manual'; url: string };
  server: 'global' | 'jp';                              // P4 — datamined/prediction ahead of Global = 'jp' preview
  dataVersion: string;
}
```
**Displayed badge** = `✓ confirmed` when `status === 'confirmed'` (a matching official `/news/` link is stamped), otherwise the `tier` (`◆ datamined` / `~ predicted`). Confirming a predicted/datamined entry sets `status = 'confirmed'` + stamps the permalink; `tier` is kept for provenance. `tier: 'official'` always implies `status: 'confirmed'`.

Relation to plan §9: the **timeline is a sibling dataset** under M3; the §9 `MetaIntel` object (prior/observed/sim, embedded in `CmPlan`) is **phase 2**. Both live in `features/meta-intel/`.

### 1.3 Browsable view (see mockup `m3-timeline.html`)
- **Swimlanes** — CM · Banners · Patches — across a time axis, with a **"now"** marker. The current CM carries a **`→ M4 §0`** link (the CM M4 plans against).
- **Tier badge on every entry** — `✓ confirmed` (official, has `/news/` link) · `◆ datamined` (dashed) · `~ predicted` (dotted, faded). **Nothing renders without its tier** (P3/P4).
- **Controls** — range (quarter/month/year), lane filters, "confirmed only," **refresh** (dev-only; §1.5), jump-to-now.
- **Detail / confirm panel** (selected entry) — track, dates, an editable **`/news/<id>/` source field**, a **tier selector**, and **"✓ Confirm & stamp /news"** (the mandatory-official gate) — edits saved to `timeline_overrides.json` (P5). Shows what it **feeds** (M4 §0).

### 1.4 Source architecture — build-time bake + hand-confirm
Full classified resource list lives in **plan §3 → "Timeline / schedule / banner / patch sources"** (added 2026-06-14). Summary of how each tier is used:
- **AUTHORITY (mandatory confirmation):** `umamusume.com/news/` — every entry is `confirmed` only when matched to a stable `/news/<id>/` permalink (e.g. `/news/790/` Gemini, balance `/news/100040/`). Client-side-rendered → confirmation is **manual/curated in v1** (optionally build-time headless later); a static runtime can't auto-confirm.
- **AUTO-IMPORT forecast (build-time):** Game8 upcoming table + SoulEC/Phoenix sheets (`pub?output=csv`) + uma.guide CM-schedule (track geometry). Every imported entry → `tier = prediction|datamined`, `status = unconfirmed`.
- **CALIBRATION:** GameTora Gacha History (`server=en`, **manual** — ToS) → derive the **~1.3–1.6× JP→Global pace multiplier** for the date predictor (uma.guide gives a fixed-order track list with no dates).
- **DATAMINED:** GameTora "upcoming" overlay via the already-vendored umalator `sync:data` (the ToS-clean route) → `server:'jp'` preview; live Global `master.mdb` = ground truth for *released* content (course geometry, skill params for patch-diffing) but reveals nothing ahead.
- **PATCHES:** confirmed from official balance bulletins (`/news/100040/` pattern); "what Global inherits" from anni changelogs (snep.pw) + umalator data-version diffs. **No predictive feed exists** → heavily human-curated, predicted patches low-confidence.

**Pipeline:** `pnpm data:build` → `scripts/timeline/*.ts` fetch + normalize the forecast feeds → **`timeline.json`** (generated) ⊕ **`timeline_overrides.json`** (P5, hand-maintained: status flips, `/news/` permalinks, corrections) merged last → shipped dataset.

**No-scraping posture:** GameTora is **cite / deep-link only** (ToS, plan §7) — its data comes through the umalator overlay, never a scraper. The importable community feeds (Game8, Google Sheets, uma.guide) run under the owner's **private-use scraping exception** (`scraping-exception-private-use`); curate/swap before any public release.

### 1.5 Re-import (honest, P2)
The app is static/local-first, so it **cannot scrape at runtime**. "Refresh":
- **Deployed/static:** read-only — shows a **"last imported: <date>"** stamp; data is whatever was baked.
- **Local dev:** optional Vite **dev-middleware** runs the importer on click (never ships), or just `pnpm data:build`.
- Run it via: you (`pnpm data:build` / a focused `pnpm timeline:import`), `!pnpm data:build` in Claude Code, or asking Claude Code to run it. **Deterministic code — not an AI workflow.**

### 1.6 Timeline watch (scheduled) — designed now, built with M3
Two layers:
- **Deterministic diff (free):** a cron runs `data:build`, diffs `timeline.json` vs committed, alerts on change.
- **Light AI confirm-check:** one small agent checks official `/news/` for new confirmations + forecast deltas **since the last marker**, returns only what's new.
Cron → **PushNotification** with the deltas (can open a diff/commit). **NOT** the heavy research sweep (~208k tokens) — a lightweight delta-check, ~weekly (banner cadence ≈ 1/week). Honest caveat: fires while Claude Code's scheduler is active.

---

## 2. Phase 2 — Meta three-up (from plan §9; later, needs the engine)
JP/TW **prior** vs Global **observed** vs sim **calculation**, three-up with **disagreement badges**. The **sim re-param loop**: feed the observed Global style distribution into the vendored engine's pacer assumption → re-rank skills → flag disagreements (usually positional effects the sim can't see → test in-room). The §9 `MetaIntel` data model lives here; Moo's CM dashboard = manual import for "observed." Requires the engine-first vendor work to be live.

## 3. Phase 3 — Match logger (from plan §9; later)
10-second per-match log (placement, opponent styles counted from lobby, notable procs) → accrues Global "observed" data → feeds phase-2 observed column + the sim pacer assumption. Uses the existing `matchLogs` Dexie table (plan §11).

---

## 4. Honest numbers & principles
- **Tier on everything** — no date shown without its tier + predicted/unconfirmed badge (P3 honesty + P4 server-versioning; JP-ahead never silently mixed into Global).
- **Official is the only confirmation authority**; predicted/datamined are explicitly second-class until promoted.
- **No-scraping** — GameTora cite-only; community feeds under the private-use exception; curate before public.
- **Pure-core (P6)** — date-prediction (pace multiplier) + merge logic live in `src/core/` (e.g. `timeline.ts`) as tested pure functions; importers in `scripts/`; UI in `features/meta-intel/`.

## 5. Data gaps / new artifacts
| Need | Status | Action |
|---|---|---|
| `timeline.json` | **new** | generated by `data:build` from forecast feeds |
| `timeline_overrides.json` | **new** | P5 hand-confirm (status flips, `/news/` permalinks, corrections) |
| `scripts/timeline/*.ts` importers | **new** | Game8 table, Sheets-CSV (SoulEC/Phoenix), uma.guide; + pace-multiplier calc |
| GameTora "upcoming" overlay | via vendored umalator `sync:data` | datamined preview (`server:'jp'`) |
| `features/meta-intel/` UI | **new** | timeline view (v1); three-up + logger later |
| official-confirm mechanism | manual v1 | headless build-time confirm = future enhancement |

## 6. Risks
1. **Feed brittleness** — HTML/sheet layouts change; Game8 monthly pages mint a new archive ID each month (discover off the wiki index). Repair via an AI workflow when a parser breaks; importers stay deterministic.
2. **Official client-rendering** — can't auto-confirm in a static app; v1 confirmation is manual/curated (headless build-time later).
3. **Patches have no predictor** — low-confidence, human-curated.
4. **Watch execution model** — runs while Claude Code's scheduler is active; not guaranteed if the machine is off.
5. **GameTora ToS** — never scrape; cite / deep-link / umalator-overlay only.

## 7. Milestones (timeline v1; phases 2–3 follow)
1. **Data model + types** (`TimelineEntry`, `src/core/timeline.ts`) + unit tests (P6).
2. **Forecast importer** (`scripts/timeline/*.ts`) → `timeline.json`; pace-multiplier calibration.
3. **Overrides + merge** (`timeline_overrides.json`, P5).
4. **Browsable timeline view** (`features/meta-intel/`).
5. **Wire outputs to M4** — `cm_schedule.json`, release dates, patch stamp.
6. **Timeline watch** — cron + deterministic diff + light AI confirm-check + push.

> Phase 2 (three-up, needs engine) and Phase 3 (match logger) follow. Per Sun's "brainstorm each module first," the implementation plan (writing-plans) is deferred until M1/M2 are also brainstormed, then folded into one engine-first plan.
