---
name: confirm-timeline
description: Use when given an official Umamusume Global announcement (screenshot, image, or transcribed text) of a Champions Meeting date, a character/support banner, or a game-patch date that should be reflected in the app — confirming a predicted CM, recording a banner release, or flipping a predicted date to confirmed.
---

# Confirm Timeline Event

## Overview

Turn an official announcement into `data-overrides/` edits + a rebuild. The timeline
is the SSOT for CM data; overrides are the only hand-editable layer (P5 — **never
edit `public/data/` directly**, it is generated). The full `TimelineEntry` template
and `courseId` resolution live in **`docs/data-refresh-runbook.md` §2** — read it
first; this skill is the decision layer on top (what to extract, patch-vs-insert,
which rebuild command, what a confirmation re-anchors).

## Step 1 — Extract from the announcement

| Field | From the announcement | Rule |
|---|---|---|
| `dates.start` | **Preliminary rounds** start | NOT the entry/registration period open |
| `dates.finals` | Finals day | drives sorting, `currentCm`, availability gating |
| `dates.end` | Reward-close/end date | only if explicitly announced — **never fabricate** (P3) |
| `cm.conditions` | Season / Weather / Ground | map to enums: ground `firm\|good\|soft\|heavy`, weather `sunny\|cloudy\|rainy\|snowy`, season `spring\|summer\|fall\|winter` (`src/core/raceConditions.ts`) |
| `source.url` | The news permalink | `kind: "official_news"` |

**Years:** announcements usually omit the year. Infer it from the announcement's
publication date, not blindly from today: an event dated earlier in the calendar
than its announcement month rolls into the next year (December post announcing a
January event). If the image is unreadable or a required date is ambiguous, **stop
and ask — never guess a date into the data**.

## Step 2 — Patch or insert

Search `data-overrides/timeline_overrides.json` for the event (by `cmNumber` or id):

- **Already present as a prediction** (`tier: "prediction"` / `status: "unconfirmed"`)
  → **patch that entry in place**: real dates, `tier: "official"`, `status: "confirmed"`,
  `source: { kind: "official_news", url: <news link> }`. Keep the id.
- **Not present** → insert a full `TimelineEntry` per runbook §2b (resolve `courseId`
  per §2a).
- **Banner** → insert `type: "banner"` with `banner: { kind: "char" | "support", umaId?/cardId? }`,
  `dates.start` = banner open (+ `end` if announced), then also do Step 3.
- **Game patch date** → insert `type: "patch"` with `patch: { version?, summary? }`.
  Skill **rebalance data changes are out of scope** here — that's a separate
  handpicked system (see `docs/engine-update-todo.md`); this skill only records the
  patch *date* on the timeline.

## Step 3 — Banners: confirm the record's release date

JP-ahead cards/umas in the data carry a foresight-*projected* `releaseDate` +
`releaseDatePredicted: true`. A banner announcement is the real date — patch the
record so the availability gate flips from predicted to confirmed:

- Generated records (the usual case): add the id to
  `data-overrides/card_release_overrides.json` (`"_target": "support_cards"`) or
  `uma_release_overrides.json` (`"_target": "umas"`) — create the file if absent:

  ```jsonc
  { "_target": "support_cards",
    "records": { "<cardId>": { "releaseDate": "2026-08-14", "releaseDatePredicted": false } } }
  ```

  Only `*_overrides.json` files are picked up (`scripts/merge-overrides.ts`); a
  standard `_target` + `records` shape needs no code change. The build fails loudly
  if the id doesn't exist — that means the record isn't generated; check
  `upcoming_cards.json` / `skill_additions.json` and edit the hand-added record there instead.
- **Test invariant flip:** `scripts/outputs.test.ts` pins
  `jpCards.every(c => c.releaseDatePredicted === true)` (and the same for umas). The
  first confirmation breaks it — update that assertion to exempt the confirmed ids
  (keep the invariant "predicted unless confirmed via a release override").
- **Skill dates do NOT re-derive from overridden card/uma dates**: `build-all.ts`
  builds the skill date maps from the generated records *before* the override loop.
  If the confirmed card/uma grants `server:'jp'` skills, also confirm those skills'
  dates via a `"_target": "skills"` override; skills already `server:'global'` need
  nothing.

## Step 4 — Rebuild: the command choice matters

| What changed | Command |
|---|---|
| CM `status` flipped to confirmed, or a confirmed CM's dates changed | **`pnpm data:build`** (full) |
| Banner/patch timeline entry only, no record patches | `pnpm timeline:rebuild` |
| Any record `releaseDate` patch (Step 3) | **`pnpm data:build`** |

Why full build on a CM confirmation: **confirmed CMs are the foresight calibration
window** (`calibrateFromConfirmed`, one clock for the whole app). Flipping a CM to
confirmed re-anchors the pace, which re-projects *every* JP-ahead card/uma/skill
`releaseDate` and slides the predicted-CM window. `pnpm timeline:rebuild` alone
leaves those record dates on the stale clock. Corollary: hand-authored prediction
entries are harmless (they're excluded from the clock) **as long as their `status`
stays `"unconfirmed"`** — only real announcements flip status.

## Step 5 — Verify

1. `git status --porcelain` — dirty files must be only `data-overrides/*` + `public/data/*`
   (+ `scripts/outputs.test.ts` when a first-confirmation flips its invariant, above).
2. Read the flipped entry back from `public/data/timeline.json` (status/tier/dates/source).
3. After a CM confirmation: predicted CMs re-anchored (window slides to the next
   `horizon` beyond the new confirmed CM; predictions carry no `courseId`), and JP
   record `releaseDate`s shifted with the new pace — spot-check one.
4. `pnpm typecheck && pnpm test` green. (Gotcha: never run vitest with `pnpm dev`
   running — mass false `useState` failures.)
5. No further step is needed for "include it once the date passes": the UI gates at
   runtime via `isReleasedBy(record, cmDate)` string comparison.

## Step 6 — Commit

Branch first (`data/<event>-confirmed`), commit the override edit(s) **and** the
regenerated `public/data/` together, message style
`data(timeline): confirm CM16 Leo Cup — … (<news url>)`. Do not push/PR unless asked.

## Common mistakes

| Mistake | Reality |
|---|---|
| Editing `public/data/*.json` by hand | Generated (P5). Edit `data-overrides/`, rebuild. |
| `dates.start` = entry-period open | `start` = prelim start; it anchors availability (`asOfISO`). |
| Inventing `dates.end` / a year | P3: only announced dates enter the data. Ask if ambiguous. |
| `timeline:rebuild` after a status flip | Record dates stay on the old clock — full `pnpm data:build`. |
| Confirming by editing `jp-schedule.json` | That file is JP history (calibration input), never Global confirmations. |
| Prediction entry left `status: "confirmed"` | Only real announcements are confirmed — status drives the calibration clock. |
