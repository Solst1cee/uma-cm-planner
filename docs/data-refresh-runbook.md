# Data + Timeline Refresh Runbook

How to keep the game data and CM timeline from rotting. Run any of the three
procedures below when the trigger applies. All commands run from the repo root.

---

## 1. Pin bump (new umalator-global release)

**Trigger:** a new `jalbarrang/umalator-global` tag appears, or the upstream
skills/cards dataset has updated content you want to pull.

**Step 1 — update the pin.**

In `scripts/fetch-borrowed.ts`, update `UPSTREAM_COMMIT` to the full 40-char
SHA of the new upstream commit. `DATA_VERSION` flows automatically:

```ts
// scripts/fetch-borrowed.ts
export const UPSTREAM_COMMIT = '<new-full-sha>';
// DATA_VERSION = `global-${UPSTREAM_COMMIT.slice(0, 8)}` — auto-derived, do not touch
```

Update `TACHYONS_COMMIT` in the same file if jechto/Tachyons-lab has a newer
commit touching `front/src/app/data/data.json`.

**Step 2 — fetch + build.**

```sh
pnpm data:fetch
pnpm data:build
```

`pnpm data:fetch` downloads the pinned upstream files into `scripts/borrowed/`
(gitignored; skipped for `localOnly` files — see below). `pnpm data:build`
normalises, merges all `data-overrides/` files, and emits `public/data/`.

**Step 3 — reconcile `card_additions.json` on a duplicate-id failure.**

If `pnpm data:build` throws:

```
card_additions record "<id>": already emitted by the generator — the upstream pin caught up; delete this addition.
```

the new upstream commit now includes that card. Open
`data-overrides/card_additions.json` and delete the stale record(s) whose
`cardId` appears in the error, then rebuild:

```sh
pnpm data:build
```

The same logic applies to `skill_additions.json` for upcoming-skill inserts
(error text: `already emitted by the generator — delete this addition`).

**Step 4 — update `scripts/outputs.test.ts` counts.**

The test file hard-codes the expected record counts and the pinned `dataVersion`
string (`global-<first8>`). After a pin bump both will be wrong. Update them:

- `skills.json` → count assertion + `global-<new8>` literal
- `support_cards.json` → count assertion + `global-<new8>` literal
- `umas.json` → count assertion + `global-<new8>` literal
- `cm_presets.json` → count assertion + `global-<new8>` literal (if preset count changed)

Grep for all occurrences of the old `global-<old8>` fragment:

```sh
grep -rn "global-<old8>" src scripts
```

Replace every hit with `global-<new8>` (the first 8 chars of the new
`UPSTREAM_COMMIT`).

**Step 5 — run the full gate.**

```sh
pnpm typecheck && pnpm test && pnpm build
```

CI expects all three green. A clean build also confirms that the data pipeline
emitted valid JSON consumed by the app.

**Notes:**

- **`localOnly` files** (`relation.json`, `relation_member.json`) are not
  published on raw.githubusercontent.com and are never re-fetched by
  `pnpm data:fetch`. They live in the committed `scripts/borrowed/` copy and
  are stable game data (affinity groups). `--from-spikes` recopies them from
  the local mdb clone if you ever need to refresh them.
- **The sim engine is pinned separately.** `src/sim/` is a vendored bundle
  rebuilt with `pnpm sim:build` from `spikes/repos/umalator-global/` only when
  the engine *logic* changes. A data-only pin bump does **not** require
  `pnpm sim:build`.

---

## 2. Add a confirmed CM

**Trigger:** Umamusume Global official news announces a Champions Meeting with
a confirmed date, track, and finals date.

### 2a — resolve the `courseId`

Open `scripts/borrowed/course_data.json` (available after `pnpm data:fetch`).
Find the entry matching racetrack, distance, and surface. Its key is the
`courseId` to use. The `cm_presets.json` entries in `public/data/` (or
`scripts/borrowed/cm-presets.json` pre-build) are also a useful cross-reference
— each preset already carries a `courseId`.

Example for CM10–15 (the first six Global CMs, added 2026-06-19):

| CM | Track + distance + surface | `courseId` |
|---|---|---|
| CM10 Aquarius Cup | Tokyo dirt 1600m (mile) | `10611` |
| CM11 Pisces Cup | Hanshin turf 3200m (long) | `10914` |
| CM12 Aries Cup | Nakayama turf 2000m (medium) | `10504` |
| CM13 Taurus Cup | Tokyo turf 2400m (medium) | `10606` |
| CM14 Gemini Cup | Tokyo turf 1600m (mile) | `10602` |
| CM15 Cancer Cup | Hanshin turf 2200m (medium) | `10906` |

### 2b — append the `TimelineEntry` to `data-overrides/timeline_overrides.json`

Unknown `id` values are **inserted** as full entries; known `id` values are
patched. For a new CM, insert a full entry:

```jsonc
// data-overrides/timeline_overrides.json → entries array
{
  "id": "cm16-leo-cup",          // kebab-case: cm<N>-<name>-cup
  "type": "cm",
  "title": "Leo Cup",
  "dates": {
    "start": "2026-07-12",       // prelim start date from news
    "finals": "2026-07-16",      // finals date (drives currentCm + sorting)
    "end": "2026-07-22"          // end / reward-close date
  },
  "cm": {
    "cmNumber": 16,
    "courseId": "<id from step 2a>",
    "trackSummary": "<human label, e.g. Tokyo turf 2400m (medium)>",
    "conditions": {                // the planner derives the race chooser's
      "ground": "good",            //   ground/weather/season from HERE — the
      "weather": "cloudy",         //   timeline is the SSOT for CM conditions
      "season": "summer"           //   (omit and it falls back to defaults:
    }                              //   good / sunny / season-from-finals-month)
  },
  "tier": "official",
  "status": "confirmed",
  "source": {
    "kind": "official_news",
    "url": "https://umamusume.com/news/<id>/"  // real permalink from the news post
  },
  "server": "global",
  "dataVersion": "global-76214c82"             // current DATA_VERSION
}
```

> **`cm.conditions` values** (from [`src/core/raceConditions.ts`](../src/core/raceConditions.ts)):
> `ground` ∈ `firm | good | soft | heavy`, `weather` ∈ `sunny | cloudy | rainy | snowy`,
> `season` ∈ `spring | summer | fall | winter`. Since 2026-06-20 the M4 race chooser
> is a derived view of `CmPlan.cmRef`, and a `kind:'cm'` ref reads its conditions
> straight from this timeline entry — so curating `conditions` here is what makes a
> saved CM plan show the real ground/weather/season. No `cm_presets.json` / `PRESETS`
> edit is needed; adding the timeline entry auto-populates the chooser.

### 2c — regenerate

```sh
pnpm data:build
```

`timeline.json` in `public/data/` is rebuilt from the overrides file every
run; no separate step is needed.

Alternatively, `pnpm timeline:rebuild` (`tsx scripts/rebuild-timeline.ts`) runs
only the timeline step; use it if you are iterating quickly and don't want to
wait for the full build. (For the `cm_tracks.json` index — used by the timeline
synthesis to seed predicted future CMs — `pnpm timeline:import`
(`tsx scripts/import-official-news.ts && tsx scripts/import-uma-guide.ts`)
re-imports data from the structured feeds into `public/data/cm_tracks.json`.
Run it when sourcing from the official-news or uma.guide importers, not
hand-editing.)

---

## 3. Add an upcoming card or skill (JP-preview content)

**Trigger:** an upcoming support card or skill is announced in JP news and you
want the skill chart's "show upcoming" toggle to surface it for plans whose
CM date falls on or after the predicted Global release.

### Skills — `data-overrides/skill_additions.json`

Append a full `SkillRecord` to the `records` array:

```jsonc
// data-overrides/skill_additions.json → records array
{
  "skillId": "<numeric string id>",
  "nameEn": "<English name>",
  "nameJp": "<Japanese name>",
  "rarity": "white",           // "white" | "gold" | "unique" | "inherited_unique"
  "baseSpCost": 120,
  "conditions": "<conditions string from source>",
  "server": "jp",              // REQUIRED: P4 — upcoming preview
  "releaseDate": "2026-10-15", // confirmed Global release date from official news
  // OR, if only JP date is known:
  // "releaseDate": "<predictGlobalDateDefault(jpISO) result>",
  // "releaseDatePredicted": true,   // flag: this is a pace-derived estimate (P3)
  "dataVersion": "global-76214c82"  // current DATA_VERSION
}
```

If only the JP announcement date is available, predict the Global date with:

```ts
import { predictGlobalDateDefault } from '@/core/timeline';
predictGlobalDateDefault('2026-04-10'); // → approx Global date
```

Then set `releaseDatePredicted: true` on the record so the UI can distinguish
predicted from confirmed release gates.

Rebuild:

```sh
pnpm data:build
```

The new skill appears in `public/data/skills.json` alongside the Global
records, with `server:'jp'`. The skill chart "show upcoming" toggle (Phase B)
gates on `isReleasedBy(skill, cmStartDate)` from `src/core/availability.ts` —
that predicate is already wired and ready.

**Clean-up:** when the upstream pin catches up and the skill appears in
the generated output, `pnpm data:build` will fail with:

```
skill_additions record "<skillId>": already emitted by the generator — delete this addition.
```

Delete that record from `skill_additions.json` and rebuild.

### Support cards — `data-overrides/upcoming_cards.json`

Append a full `SupportCardRecord` to the `records` array — same shape as
`card_additions.json` but `server:'jp'` + a required `releaseDate` (skills are
validated by format only, so an upcoming card may grant upcoming skills you also
add to `skill_additions.json`):

```jsonc
// data-overrides/upcoming_cards.json → records array
{
  "cardId": "<numeric string id>",
  "nameEn": "...", "charName": "...",
  "rarity": "SSR", "type": "speed",
  "perLevel": [ /* exactly 5 entries, limitBreak 0-4 */ ],
  "skills": [ { "skillId": "...", "sourceType": "hint_pool", "hintLevels": 1 } ],
  "hintPoolSize": 1,             // must equal the hint_pool entry count
  "server": "jp",               // REQUIRED: P4 — upcoming preview
  "releaseDate": "2026-10-15",  // announced Global date, else predictGlobalDateDefault(jpDate)
  "releaseDatePredicted": true, // set when releaseDate is a prediction (P3)
  "dataVersion": "global-<pin8>"
}
```

Then `pnpm data:build`. The card lands in `public/data/support_cards.json` with
`server:'jp'`. Delete the entry once it releases on Global (the build fails with
`already emitted as a Global card — move it to card_additions.json or delete`).

**Where it shows + the guard (deferred toggle):** the legacy sourcing panel
(`src/features/skill-acq/SourcingPanel.tsx`) is **guarded to Global-only cards**
(P4), so upcoming cards do NOT appear as sources there. The card-source
**"include upcoming" toggle** — which opts them in, gated by the CM date via
`isReleasedBy` — is **deferred to M4 §3** (the main-planner sourcing table). The
data pipeline + predicate are built and ready; only that toggle UI remains.

---

## Quick reference

| Task | File(s) to edit | Command |
|---|---|---|
| Pin bump | `scripts/fetch-borrowed.ts` | `pnpm data:fetch && pnpm data:build` |
| Update test counts | `scripts/outputs.test.ts` | — |
| Add confirmed CM | `data-overrides/timeline_overrides.json` | `pnpm data:build` |
| Add upcoming skill | `data-overrides/skill_additions.json` | `pnpm data:build` |
| Add upcoming card | `data-overrides/upcoming_cards.json` | `pnpm data:build` |
| Full rebuild from local mdb | — | `pnpm data:build -- --from-spikes` |
