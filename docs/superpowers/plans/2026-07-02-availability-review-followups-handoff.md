# Handoff — availability review follow-ups (PRs #25–#28 senior review, 2026-07-02)

A verified multi-agent review of the foresight + availability-gate PRs (#25–#28)
produced 9 findings. **#1–#3 (the confirmed user-visible ones) were fixed in PR #29**
(P4 gates: JP out of M2 candidates + same-server variant families; one calibration
clock via `calibrateFromConfirmed`). The `confirm-timeline` project skill
(`.claude/skills/confirm-timeline/`) also landed there. Everything below is
**verified but deliberately not fixed** — resume here.

## Confirmed, unfixed

1. **Tachyons parity narrowed** — `scripts/build-cards.ts` `assertTachyonsParity`
   has `if (record.server !== 'global') continue;`. A genuinely-Global card missing
   from the stale master pin is emitted `server:'jp'` by `buildJpCards` and now
   *skips* validation instead of failing the build (the old "in Tachyons-lab but
   missing from emitted data" arm can't fire because a jp record exists). Repro: any
   master-pin lag where gametora+tachyons know a card master doesn't. Fix shape: for
   a tachyons-known card resolved to a jp record, either fail or validate it anyway.

2. **Hidden JP skills are simulated** — `SkillChartPanel.tsx` + `AccelChartPanel.tsx`
   build their candidate `reps`/`ids` with **no `showUpcoming` gate** (only the
   render filters `server === 'jp'` rows). Every Run Monte-Carlo-sims all
   released-by-CM-date JP skills and counts them in done/total while invisible.
   Impact grows with far-future CM dates. Fix shape: filter the candidate list by
   the toggle (and decide whether toggling should invalidate run results).

3. **Card dedup gap** — `buildJpCards` dedups only against `masterIds`, not
   `card_additions.json`/`upcoming_cards.json` (build-all.ts ~L110). A future
   hand-added card also in gametora gets emitted twice; **no duplicate-cardId test
   exists** (skills got exactly this fix in `ba59f42`; cards didn't). Fix shape:
   pass the full existing-id set like the skills path + add the outputs test.

## Plausible / latent (guard when convenient)

4. **`release_en` mistag** — `projectReleaseDate` returns `predicted:false` for an
   announced Global date, so a gametora card/uma with `release_en` but absent from
   master is emitted `server:'jp'` **without** `releaseDatePredicted` — which today
   *breaks the build* via `outputs.test.ts` (`every releaseDatePredicted === true`)
   rather than shipping. Decide the designed behavior before it fires on a data
   refresh. Umas share the mechanism; skills don't.
5. **Roster white resolver** — `useRoster.ts` `makeWhiteResolver` scans an unfiltered
   Global+JP skill map (`+1..+9` first-match). No collision today (JP white ids
   202192+ sit above Global's max 201552) but 105 Global windows have an open `+1`
   slot. One `server === 'global'` filter closes it.
6. **Non-monotonic predicted CM dates** — pace-projected vs `addMonths`-fallback CMs
   use different anchors; a gap in `jp-schedule.json` could date CM(n+1) before
   CM(n). Can't fire on the contiguous seed; cheap insurance = monotonicity clamp in
   `cmSynthesis`.

## Architecture (the recommended next slice)

**Data-layer gating**: `useGameData` exposes mixed-server arrays AND ungated
`skillById`/`cardById`/`umaById` maps — every consumer must remember
`server === 'global'`, and three audit passes still left leaks (the M2 leak fixed in
PR #29 came through the map). Before availability slice 3, invert the default:
provider exposes `globalSkills/globalUmas/globalCards` (+ Global-only maps) and an
explicit upcoming selector. Kills the whole bug class.

Cleanup batch (multi-angle-confirmed, mechanical): extract `useCmAsOfDate(plan)`
(the asOfISO derivation is copy-pasted in 5 components), one
`isVisibleUpcoming(record, {server, asOfISO, showUpcoming})` helper (4–6 predicate
variants exist, some subtly different), one `UpcomingBadge` component (6 hand-rolled
copies, 3 class names, duplicate CSS block in `uma-chart.css` + `cm-planner.css`),
`useMemo` the `SupportCardPoolCard` filter+sort (539 items per keystroke), and
pre-filter JP cards out of `InheritancePage`'s `buildPoolItem` map when the toggle
is off.

## Docs debt (conventions findings)

- `docs/provenance.md` was never updated for PRs #25–#28: no entry for the
  Moomoolator-seeded `jp-schedule.json` (no source URL/retrieval date) nor for the
  gametora-derived JP card/uma/skill datasets; it still claims JP preview comes from
  umalator sync. `foresight.test.ts` cites GameTora reference numbers without a
  dated link (P6 rule).
- Policy tension flagged for Sun's call: 962/317/170 GameTora-derived records now
  ship in git-tracked `public/data`, vs the "GameTora = cite-and-deep-link only"
  rule. Currently covered by the private-use exception; the public-release swap list
  should include it.

## Known quirks recorded in the skill (not bugs to fix now)

- `outputs.test.ts` pins `releaseDatePredicted === true` for ALL JP records — the
  **first real release-date confirmation must update that assertion** (exempt
  confirmed ids). The `confirm-timeline` skill documents the exact edit.
- `build-all.ts` builds the JP-skill date maps (`cardDates`/`umaDates`) **before**
  the override loop, so a `card/uma_release_overrides.json` confirmation does not
  re-derive dates for JP-only skills granted by that record. Harmless until a
  confirmed card grants `server:'jp'` skills; then either fix the ordering or
  confirm the skills via a `"_target": "skills"` override too.
