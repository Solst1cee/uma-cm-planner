# 2026-06-19 — Data & timeline currency + the availability model

## Context

Everything baked into `public/data/` is pinned to a single snapshot —
`global-c1fa2107` (umalator-global **v0.14.2**, data tag **2026-06-05**) ⊕ Tachyons-lab
**2026-06-09**. Today is **2026-06-19**, so the dataset is a ~2-week-old freeze and Global has
moved on. Two stale surfaces share that one stale pin:

- **Game data** (`skills` / `support_cards` / `umas` / courses / `cm_presets` / `affinity`).
  The pin shipped 217 support cards; Global hit 220 on 2026-06-11 (bridged via
  [`data-overrides/card_additions.json`](../../../data-overrides/card_additions.json)).
  Anything released after that is absent. **Upstream has kept current** — release tags now run
  to **v0.16.1 (2026-06-19)** (v0.15.0/0.15.1 on 06-14, v0.16.0 on 06-15). So for game data the
  "resource already doing this" (P1) is the same upstream we already vendor; we are just behind.
- **Timeline** ([`public/data/timeline.json`](../../../public/data/timeline.json)). Confirmed
  **Global** CMs run only through **LONG · 2026-01-22**, then jump to the hand-seeded **CM15
  Cancer Cup · 2026-06-30**. The CMs that actually ran Feb→May 2026 (**CM10 Aquarius, CM11
  Pisces, CM12 Aries, CM13 Taurus, CM14 Gemini**) are missing, and
  [`cm_tracks.json`](../../../public/data/cm_tracks.json) skips index 14. **Even v0.16.1's
  `cm-presets.json` still stops at 2026-01-22** — upstream does not track recent Global CM
  history, so the timeline is not borrowable wholesale; it is assembled from authoritative
  sources (`umamusume.com/news/` permalinks for dates + uma.guide for track geometry + Game8
  cross-check) and curated in overrides (P5).

**Driving use cases (owner, 2026-06-19) — the planner must reason about what will be available
by the time the CM runs, not just what is out today:**
1. The skill chart can show **upcoming skills** that are not yet available because their
   granting card has not arrived — but will (a CM-banner card typically drops ~2 days before
   the CM starts).
2. The support-card source has an **"include upcoming" toggle** so planning can pull in
   future cards.

This adds an **availability dimension** (Now / Upcoming) that joins *card release dates* (a
game-data fact) with the *CM date* (a timeline fact) — binding the two surfaces into one
coherent piece of work rather than two unrelated chores.

**Owner asks folded in:** make the timeline a **source of truth** read app-wide (the live/next
CM everywhere, the planner's default race, the M3 page itself — **not** M1/M2 cross-module);
keep **umas released-only** for now; let each consuming module choose its own "upcoming"
horizon (e.g. `today + 2 weeks`, or the CM date) rather than baking one horizon into the data.

## Goals / non-goals

- **Goal:** bring `skills` / `support_cards` / `umas` / courses current via an engine-safe pin
  bump, and make the CM timeline accurate and authoritative.
- **Goal:** an **availability model** — a per-record release date plus a pure, date-parameterized
  predicate — so the planner can include cards/skills that release on/before the CM date, gated
  behind explicit toggles (P4: preview content is opt-in, never silently mixed).
- **Goal:** one app-wide "current CM" reader, consumed by a nav badge, the planner's default
  race, and the M3 page.
- **Goal:** a repeatable currency runbook so this does not re-rot.
- **Non-goal:** re-vendoring the engine (`src/sim/` stays at v0.14.2); M1/M2 cross-module CM
  context; banner/patch timeline lanes (no data); M3 grid-layout fidelity; **upcoming umas**
  (released-only for now).

## Approach — one spec, two file-disjoint tracks, two phases

Single `data-timeline-currency` branch. Neither track touches `src/sim/`, so the bulk runs
parallel to active M4 work. The only overlap is the two UI toggles, which land in live M4 files
— so the work splits into:

- **Phase A — fully parallel-safe** (no M4-file overlap): Track 1 (pin bump + availability
  model in `scripts/` / `public/data/` / `types.ts` / `data-overrides/`) and Track 2 (a)–(c)
  + nav badge + M3 (in `core/`, `gameData.ts`, `App.tsx`).
- **Phase B — coordinate with M4**: the skill-chart "upcoming" button + card-source "include
  upcoming" toggle + the planner's default-race seed, all of which touch active M4 files
  (`SkillChartPanel.tsx` is currently uncommitted M4 work). Done as small additive changes once
  M4's in-flight edits settle, or rebased onto them.

## Track 1 — Data freshness (pin bump)

**Core move:** in [`scripts/fetch-borrowed.ts`](../../../scripts/fetch-borrowed.ts) bump
`UPSTREAM_COMMIT` from `c1fa2107…` to the **v0.16.1** commit
`76214c821a2573a532657c90cb406f3f5fe65f3e` (fallback v0.16.0 =
`d2f0b056d6894971c9d43eed6e37beb0431d4ed6`; record the new SHA in `docs/provenance.md` §1 as
`c1fa2107` was), and bump `TACHYONS_COMMIT` to its latest commit touching
`front/src/app/data/data.json`. Then
`pnpm data:fetch` → `pnpm data:build`. The vendored engine stays at v0.14.2 — verified safe:
the v0.15→0.16 data changes are format-compatible and the v0.16.1 parser tweak ("support
negative integers in skill conditions") is additive.

**Four consequences to handle:**
1. **`DATA_VERSION` ripple.** [`build-all.ts`](../../../scripts/build-all.ts) derives
   `DATA_VERSION` from the SHA, so every emitted record flips `global-c1fa2107` →
   `global-<new8>`. Update the hardcoded literals: tests/fixtures
   ([`scripts/outputs.test.ts`](../../../scripts/outputs.test.ts),
   [`src/db/exportImport.test.ts`](../../../src/db/exportImport.test.ts), the M2 fixtures) and
   the M2 default param [`BuildContextForm.tsx:23`](../../../src/features/sp-optimizer/BuildContextForm.tsx#L23).
   `build-spark-rates` is deliberately versioned `global-2026-06` and is **untouched**.
2. **`card_additions.json` reconciliation.** The 3 bridged cards (30102/30103/30104) are almost
   certainly in v0.16.1; the build's duplicate-id guard will **fail on purpose** — diff the
   fresh record vs the stale addition and delete the addition (the documented mechanism,
   provenance §3.2).
3. **Oracle re-run.** `assertTachyonsParity` must pass against the new pins; any drift it flags
   is real new event-skill data to absorb.
4. **Live `master.mdb` extraction = fallback only.** Use the `extract-card-additions.ts` bridge
   only for anything released in the last day or two that v0.16.1 does not yet carry.

**Fallback if a v0.16.1 skill condition breaks the v0.14.2 parser:** pin data to **v0.16.0**
(2026-06-15, pre-parser-change data) — still current, still engine-safe.

## Availability model — the bridge between the two tracks

**Schema (additive, `src/core/types.ts`):** add `releaseDate?: string` (ISO) +
`releaseDatePredicted?: boolean` to **both** `SupportCardRecord` and `SkillRecord`.
`server: 'global' | 'jp'` already exists on every record (P4). Giving the *skill* its own
optional `releaseDate` (set on the upcoming-skill override alongside its upcoming card) keeps
the skill chart — which ranks skills, not cards — able to gate without a card→skill join.

**Data-sourcing reality (verified 2026-06-19, fact-gathering workflow).** `build-cards.ts`
emits cards **only** from the umalator `master` support-cards extract (every emitted card is
hard-coded `server: 'global'`); the GameTora catalog is a per-card *effects-matrix lookup*
(`GtCard = { support_id, effects }`) with **no release-date field and no JP-ahead card
records** (name/rarity/type/skills). There is therefore **no borrowed feed to "stop filtering"
into existence** — and JP-ahead *skills* are likewise dropped (`skills.json` = Global cutover).
So upcoming content is **curated, not auto-emitted**:

- **Mechanism (always on):** add `releaseDate?: string` + `releaseDatePredicted?: boolean` to
  `SupportCardRecord` (and `SkillRecord`); the predicate below + the UI toggles work whether or
  not any upcoming records exist.
- **Upcoming cards (P5 curation):** a new `data-overrides/upcoming_cards.json` holding full
  `SupportCardRecord`s for *announced/anticipated* Global banner cards (same schema +
  validation as `card_additions.json`), tagged `server: 'jp'` with `releaseDate` (announced
  date from official news, else **predicted** via `predictGlobalDateDefault`, pace 1.422, with
  `releaseDatePredicted: true`). Their skills, if not yet in the Global cutover, ride along via
  a `skills` override entry.
- **Already-Global cards** keep `releaseDate` undefined → the predicate treats them as released
  (`server === 'global'`). Populating exact Global release dates for the back-catalog is **out
  of scope** (no borrowed source); only the upcoming layer needs dates.
- Initially the upcoming layer may be **empty/sparse** (curated when a banner is announced) —
  honest per P3; the toggle simply surfaces nothing extra until entries are added via the
  runbook.

**Predicate (`src/core/availability.ts`, pure — generic over `{ releaseDate?, server }`):**
```
isReleasedBy(record, asOfISO): boolean
  // if record.releaseDate is set → releaseDate <= asOfISO
  // else                        → record.server === 'global'   (on Global now, undated)
```
So an undated Global record is always available; a dated record (announced or predicted future)
is available only once `asOfISO` reaches its date; an undated JP-ahead record is never available
until it gains a date. The same one predicate serves both the card-source and skill-chart
toggles.
The **reference date is supplied by the consumer**, not baked in:
- the planner passes the active plan's **CM start date** (`cmRef` → timeline `dates.start`,
  fall back to `finals`) → "what can I have for this CM";
- a generic "upcoming" view can pass `today + 2 weeks` (or any horizon it chooses).

## Track 2 — Timeline as source of truth

**(a) Fill the CM gap (data, P5; P3 — only real sourced entries, never fabricated).** Add
**CM10–14** as confirmed Global entries in
[`timeline_overrides.json`](../../../data-overrides/timeline_overrides.json), two-source
verified (2026-06-19): **CM10** Aquarius · Tokyo 1600m dirt · courseId `10611` · finals
`2026-03-06`; **CM11** Pisces · Hanshin 3200m turf · `10914` · `2026-03-30`; **CM12** Aries ·
Nakayama 2000m turf · `10504` · `2026-04-23`; **CM13** Taurus · Tokyo 2400m turf · `10606` ·
`2026-05-14`; **CM14** Gemini · Tokyo 1600m turf · `10602` · `2026-06-04`. Add the missing
**CM14 Gemini** row to `cm_tracks.json` (it skips index 14). **Fix the existing CM15 bug:** the
committed `cm15-cancer-cup` entry has `finals: 2026-06-30`, but Round 1/finals begins
**`2026-06-24`** (06-30 is the event *end*) — correct `dates.finals` to `2026-06-24` and keep
`dates.end: 2026-06-30`. Keep CM16–18 as predictions. Each entry carries the official
`/news/<id>/` permalink as `source.url` (candidate IDs 612/642/700/771/790; the implementer
opens each to confirm it announces that CM — the dates/tracks themselves are already
two-source confirmed).

**(b) Promote the selector to core.** Move `currentCm(entries, todayISO)` from
[`timelineView.ts:56`](../../../src/features/meta-intel/timelineView.ts#L56) → `src/core/timeline.ts`
(pure, beside `projectCmSchedule`); re-point `timelineView` at the core export. Behavior
unchanged: first CM on/after now, else the most recent past one.

**(c) Surface it on the context.** [`gameData.ts`](../../../src/features/data/gameData.ts)
already loads `timeline.json` and serves `timeline` / `cmSchedule`. Add a resolved
`currentCm: TimelineEntry | null` to the `GameData` value (computed via the core selector +
today). One app-wide reader: `useGameData().currentCm`.

**(d) Consumers** (the three picked):
- **Nav badge** — [`App.tsx`](../../../src/app/App.tsx) header chip: "Now: Cancer Cup · Jun 30",
  additive (no route/merge collision). *(Phase A.)*
- **M3 page** — switch to the core/context `currentCm` (dedup); now accurate post-gap-fill.
  *(Phase A.)*
- **Planner default race** — [`CmPlannerPage.tsx:172`](../../../src/features/cm-planner/CmPlannerPage.tsx#L172),
  where it composes from `makeDefaultPlan()`: seed a new plan's `cmRef` from `currentCm`.
  *(Phase B — M4 file.)*
- **The two toggles** (the driving use cases) — skill-chart "show upcoming" button + card-source
  "include upcoming" toggle flip the predicate's reference date from "now" to the active plan's
  CM date. *(Phase B — M4 files: `SkillChartPanel.tsx` etc.)*

## Ongoing currency runbook

A short `docs/` doc (e.g. `docs/data-refresh-runbook.md`) covering: (1) bump the upstream +
Tachyons pins and rebuild, reconciling `card_additions.json`; (2) add a confirmed CM (override
entry + `/news/` permalink, `cm_tracks` row); (3) refresh release-date predictions. Makes
currency repeatable, not a one-off.

## Testing & verification

- **Unit:** `currentCm` (in core), `isReleasedBy` / `skillAvailableBy` (edge cases: no
  `releaseDate`, `server` global vs jp, asOf exactly on release date, derived skill availability).
- **Build oracle:** `assertTachyonsParity` stays green against the new pins.
- **Ripple:** update the `dataVersion`-literal tests/fixtures to the new version.
- **Gates:** `pnpm typecheck` + `pnpm build` + `pnpm test` + the engine fidelity smoke
  (meanBashin ≈ 0.2202) all green before merge. Re-run any flaky UI test file (the
  dev-server/Vitest HMR race — trust `build`/`typecheck`).

## Out of scope

Engine re-vendor; M1/M2 cross-module CM context; banner/patch timeline lanes; M3 grid-layout
fidelity; upcoming umas; live OCR.

## Sources (P1 / provenance)

- Upstream tags & release notes: `github.com/jalbarrang/umalator-global` (v0.16.1, 2026-06-19;
  v0.15–0.16 changes data-format-compatible). v0.16.1 `cm-presets.json` confirmed to stop at
  2026-01-22.
- CM identity/geometry: uma.guide `/cm-schedule/` (CM10 Aquarius … CM14 Gemini … CM15 Cancer).
- CM dates: `umamusume.com/news/` permalinks (authoritative) + Game8 per-CM pages (e.g. CM14
  Gemini, CM15 Cancer `news/829/`) cross-check.
- Release dates: GameTora `release_en` (already-borrowed catalog) + JP→Global prediction
  (`predictGlobalDateDefault`, pace 1.422). Per-record `server`/`dataVersion` already in schema
  (P4); predicted dates flagged (P3).
