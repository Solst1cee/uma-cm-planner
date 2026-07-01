# M1.4 — Inheritance card (parents 1 & 2, owned mode) + UmaExtractor importer

**Date:** 2026-06-26
**Module:** M1 Inheritance · card-by-card build (handoff: [docs/modules/design_handoff_support_card_builder/](../../modules/design_handoff_support_card_builder/))
**Status:** design locked
**Branch:** `feat/m1-4-inheritance-card` (worktree, based on the M1 integration branch `feat/m1-inheritance-workbench` @ 456ff50)
**Builds on:** M1.1 shell + M1.2 uma-plan card. Reads plan targets straight off `CmPlan` (does not wait on M1.3's UI).

## 1. Overview & scope

The "Inheritance" panel is the centre of the M1 workbench: the player picks two inheritance
parents (Parent 1 + Parent 2), each contributing pink/blue/white/green sparks and two
grandparents, and uses "Find candidates" to rank their veteran roster against the plan's
spark goals. Per the handoff (README §"Inheritance panel").

This spec covers **owned mode** plus the **UmaExtractor importer** that populates the roster.
It deliberately **defers Parent 2 _rental_ mode** (the dashed dummy-parent builder + generated
search-link) to a follow-up branch **M1.4b** — the roadmap flagged M1.4 as splittable along
exactly this seam, and rental depends on M1.8's Target-spark seeding which is not built.

Two slices, importer first (it is independently testable and is what makes the picker real):

- **Slice A — UmaExtractor importer** (the handoff's "Upload data" button): parse a UmaExtractor
  `data.json` → `Parent[]`, persist locally to the Dexie `parents` store.
- **Slice B — Inheritance card** (owned-parent picker): Parent 1 & 2 cards, Change/SearchPicker,
  Find-candidates, grandparent chips, spark display, selection persisted to `plan.parents`.

## 2. Data source & provenance

The handoff's "trained umas" = the player's **veteran roster**. Canonical source is
**UmaExtractor** (xancia/UmaExtractor v2.1 — Frida memory-scan of the running Global client's
Veteran List → `data.json`; raw master.mdb IDs; schema confirmed in
[docs/provenance.md §5](../../provenance.md) against the maintainer's own 2026-06-12 export).
The user uploads this file; it is **stored locally** in IndexedDB.

In this codebase the roster lands in the existing Dexie **`parents` store** (`Parent` records,
`source:'mine'`). M1.4 is **source-agnostic**: it consumes `Parent` records and does not care
whether they were typed by hand (existing `ParentForm`) or imported. Reference sample for the
build/fixtures: `docs/UmaExtractorSampleData/data.json` (single scrubbed veteran).

**Privacy (provenance §5 ⚠):** real exports carry friend IDs in `owner_viewer_id`,
`succession_history_array[].viewer_id`, `rental_viewer_id`. The parser **drops these**; the
committed test fixture is scrubbed; nothing from `spikes/`/personal exports is committed.

## 3. Slice A — UmaExtractor importer

### 3.1 `src/core/umaExtractor.ts` (pure)

`parseUmaExtractor(json: unknown): { parents: Parent[]; skipped: number }`

- **Envelope:** accept a bare array OR `{ trained_chara_array: [...] }` OR `{ data: [...] }`
  (provenance §5 acceptance rules). Unknown top-level keys ignored.
- **Per veteran → `Parent`:**
  - `id ← String(trained_chara_id)` · `umaId ← String(card_id)` · `source: 'mine'` ·
    `importSource: 'umaextractor'`
  - `stats ← { spd:speed, sta:stamina, pow:power, gut:guts, wit:wiz }` (accept `wiz|wisdom`,
    `pow|power` key dualities)
  - `rating ←` letter via the `single_mode_rank` ladder from `rank` (e.g. 12=B+, 13=A); keep
    `rank_score`
  - sparks ← decode `factor_id_array` (prefer `factor_info_array` for level when present; treat
    a `level` outside 1–9 as absent) → `blueSpark`, `pinkSpark`, `greenSpark`, `whiteSparks[]`
  - `grandparents ←` `succession_chara_array` positions **10** and **20** (each a `ParentRef`
    with its own decoded `whiteSparks` + `wonRaces`); positions 11/12/21/22 are available but the
    model holds only two grandparents per parent, so they are ignored for now
  - `wonRaces ←` `win_saddle_id_array.map(String)` (see §3.3)

### 3.2 Factor-id decode (validated against `uma-parent-viewer/enrich_data.py` + the sample)

The **star level is the last digit** of the factor id (1–3). By id range:

| Range | Kind | Decode |
|---|---|---|
| `100–599` | **Blue (stat)** | `stat = floor(id/100)` → 1 spd, 2 sta, 3 pow, 4 gut, 5 wit; `star = id%10`. (`202` = Stamina ★2) |
| `1100–1299` | **Pink ground** | group 11 turf / 12 dirt; `star = id%10` |
| `2100–2499` | **Pink style** | 21 nige / 22 senko / 23 sashi / 24 oikomi; `star = id%10`. (`2201` = Pace Chaser ★1) |
| `3100–3499` | **Pink distance** | 31 short / 32 mile / 33 medium / 34 long; `star = id%10` |
| `2000000–2999999` | **White skill spark** | skill group `floor(id/100)*10`; pick the white (rarity 1) member; `star = id%10`. (`2003601` → white skill ★1) |
| `10000000–19999999` | **Green/unique spark** | `middle = digits[2:5]`, `variant = digit[5]`; unique `skillId = (variant===2 ? 110001 : 100001) + middle`; `star = id%10`. (`10150102` → unique 100151 ★2) → `greenSpark` |
| `1000000–9999999` (7-digit) | **Race spark** | not in `Parent` model — skipped |
| `3000XXX` | **Scenario spark** | not in `Parent` model — skipped |

The pink decode maps the three aptitude axes onto the planner's `AptKey`/`Stat`/`Strategy`/
`Grade` types. Decode is a pure helper `decodeFactor(id, level?)` returning a tagged union
(`blue | pinkDistance | pinkSurface | pinkStyle | white | green | skip`), unit-tested per row.

**Open reconciliation (resolve in build, do not fabricate):**
- **Green spark id convention.** `Parent.greenSpark.skillId` is documented as the **9xxxxx
  inherited-unique** id the child gains (mechanics-notes §8), but the factor decodes to the
  base/alt unique (`100xxx`/`110xxx`). Reconcile the `100xxx → 9xxxxx` mapping against
  mechanics-notes §8 + `skills.json`; if no clean mapping exists, store the decoded unique id
  and flag it for M1.7, rather than inventing a 9xxxxx id.
- **White skill group → white member.** Picking the rarity-1 member needs a skills lookup; the
  parser takes an injected `skillRarity`/`skillsByGroup` resolver (pure, testable) rather than
  importing game data directly.

### 3.3 `wonRaces` and the 2.0 win-bonus

`win_saddle_id_array` (G1 saddle/title ids the veteran won) → `Parent.wonRaces` /
`ParentRef.wonRaces`. This is the import M1.0 flagged the 2.0 win-bonus as "pending"
([winBonus.ts](../../../src/core/winBonus.ts), `sharedG1`). The id space `winBonus` expects must
be confirmed: if `win_saddle_id` matches `winBonus`'s race-id space directly, map 1:1; if a
`saddle_id → G1 race` table is needed, import raw saddle ids and add the mapping, validated
against the sample. **If the mapping is unclear, populate `wonRaces` from raw saddle ids and note
the limitation in the UI/test — never fabricate a G1 win.**

### 3.4 Persistence + UI

- Dexie: `bulkUpsertParents(parents)` in `parentsApi` — upsert keyed on `Parent.id`
  (`trained_chara_id`), so re-import refreshes rather than duplicating. Plus an
  `umaExtractorImportedAt` setting (ISO string) powering the handoff's "Updated {timestamp}".
- `useParents` gains a way to surface the bulk result + timestamp (or a thin `useRoster`
  wrapper over it — decide in the plan; reuse `useParents` if it fits).
- **Upload data** button on the Inheritance card header → hidden `<input type="file"
  accept="application/json">` → read → `parseUmaExtractor` → `bulkUpsertParents` → transient
  toast ("Imported N veterans, skipped M"). Parse/validation errors surface inline, never throw
  to a blank screen.

## 4. Slice B — Inheritance card (owned-parent picker)

### 4.1 Components (M1 `View`-suffix + pure-helper-sibling convention, Windows case-FS)

- **`InheritanceCard.tsx`** — collapsible `cmp-plan-card` panel; caret header "Inheritance"
  + muted "parents 1 & 2"; right side: "Updated {timestamp}" + **Upload data**. Body: a
  2-col `1fr 1fr` parent grid (→ 1 col < 760px). Wires the `parents` store + active plan; owns
  the per-parent picker/candidate UI state. Replaces the M1.4 `Placeholder` in
  `InheritancePage.tsx`'s centre column.
- **`ParentCardView.tsx`** — presentational single parent card. Empty state: `Parent N`
  mini-label + `Find candidates` / `Change` buttons. Filled: 42px `GameIcon` portrait, rarity
  badge + name, "GP:" + two 22px grandparent portrait chips, a `.spark-chips` row (pink + blue,
  tinted), and a white-skill spark list (skill name + optional `GP` tag + `★` stars colored
  **gold `#eab308` own / gray `#9aa6b6` grandparent**), red `✕` clear. Parent 2 variant adds the
  Owned/Rental `cmp-control-group` toggle beside its label; **Rental → a labelled "coming in
  M1.4b" stub**, no builder.
- **`candidateScore.ts`** (pure, sibling helper) — see §4.3.
- **Reuses:** existing `SearchPicker` (`@/features/parents/SearchPicker`) for "Change"; a
  `picker-results` list for the Find-candidates top-5; `GameIcon`, the `cmp-*`/`spark-*`/`badge`
  DS classes.

### 4.2 Selection & persistence

Picked parents persist on the plan: `CmPlan.parents = { a?: parentId, b?: parentId }` (already
in the model). Pick/clear calls the active-plan updater (`setPlan` / focused-plan setter in
`ActivePlanContext`), so it saves with the plan exactly like M4's chosen-parents. The card reads
`uma1Plan` (the inheritance page's focused slot) for both the selection and the goals.

The candidate/picker **pool** = the `parents` store filtered to `source:'mine'` (owned
veterans; rental-sourced rows excluded — they belong to M1.4b). Empty roster → an honest empty
state pointing at Upload data / the existing Parents entry.

### 4.3 `candidateScore` (the one new piece of core math)

`Find candidates` ranks each owned roster parent against the **plan's** goals and shows the top 5:

```
score(parent, goals) =
    Σ over goals.blue[stat]      min(parentBlueStars(stat), goalStars)
  + Σ over goals.pink[aptKey]    (parent has matching-apt pink spark ? parentPinkStars : 0)
```

- Blue goals read `CmPlan.sparkGoals.blue` (`Partial<Record<Stat, number>>`, number = target
  stars). A parent's blue stars = its `blueSpark` (+ matching grandparent blue, if modelled).
- Pink goals read `CmPlan.sparkGoals.pink` (`{aptKey, target: Grade}`). The plan stores a
  **grade**, not a star, so there is no goal-star to `min` against — score pink by the parent's
  own matching-apt pink-spark stars. Honest to intent; M1.3 may later add pink goal-stars, at
  which point `min` applies symmetrically.
- Pure, deterministic, `min`-clamped, sorted desc with a stable tie-break (score, then
  `rank_score`/rating, then name). Unit-tested.
- **P3 honesty:** surfaced in-UI as a *heuristic pre-rank*, not a verdict (a small caption); it
  ranks spark-goal overlap only, not affinity or sim outcome.

### 4.4 Deliberately out of scope here (YAGNI)

No affinity proc-% in this card — the handoff's parent card shows spark **stars**, not
inheritance %; the % lives in M1.7's matrix / M1.8's target spark. So **no `affinity.json`
loading in M1.4.** Rental builder + search-link, the deck, the coverage matrix, and the
Target-spark rail are their own phases.

## 5. Testing

- **Importer (`umaExtractor.test.ts`)** against a committed scrubbed single-veteran fixture
  (`src/features/inheritance/__fixtures__/umaextractor-sample.json`, derived from
  `docs/UmaExtractorSampleData/data.json`): each factor-decode row, blue/pink/green/white
  assignment, grandparents from positions 10/20, `wonRaces` from `win_saddle_id_array`,
  privacy-field stripping, bare-array vs `{trained_chara_array}` envelopes, `wiz|wisdom`
  duality, malformed/empty input → `{parents:[], skipped}` without throwing.
- **`candidateScore.test.ts`** — scoring, `min` clamp, empty goals, tie-break, top-5 cap.
- **`ParentCardView.test.tsx`** — empty / filled / GP chips / gold-vs-gray stars / Parent 2
  rental-stub render.
- **`InheritanceCard.test.tsx`** — pick persists to `plan.parents`; clear; Find-candidates list;
  Upload data parse→upsert→toast (stubbed Dexie); pool filtered to `source:'mine'`.
- `parentsApi` bulk-upsert + import-timestamp setting round-trip.
- Vitest gotcha: run race-free (`pnpm build`/`pnpm typecheck` trusted; re-run a flaky UI file
  once before treating a failure as real).

## 6. Integration / merge notes

- **`InheritancePage.tsx` is the merge point** with the parallel M1 sessions (M1.5 "Your deck"
  already swaps a different centre-column `Placeholder`). M1.4 only replaces the **M1.4
  Inheritance** placeholder; resolve at merge by keeping every card. The worktree isolates the
  work until then.
- `parentsApi` / `useParents` are shared with M4's chosen-parents — additive changes only
  (`bulkUpsertParents`, a timestamp setting); do not alter existing signatures.
- No Dexie schema-version bump expected (the `parents` store already exists; we add rows + a
  setting key). Confirm in the plan.

## 7. Deferred (follow-ups)

- **M1.4b** — Parent 2 rental mode: dashed dummy-parent builder, "Load from Target spark"
  seeding (needs M1.8), editable spark rows, generated search-link + Copy/Open.
- Grandparent-of-grandparent (positions 11/12/21/22) if the model ever extends past two GPs.
- Green-spark `100xxx → 9xxxxx` convention + saddle-id → G1 mapping, if §3.2/§3.3 land partial.
