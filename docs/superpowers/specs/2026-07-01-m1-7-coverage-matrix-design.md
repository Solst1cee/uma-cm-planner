# M1.7 — "Obtainable vs. wishlist" coverage matrix (design)

**Date:** 2026-07-01
**Module:** M1 Inheritance workbench · card M1.7 (panel 6 of the design handoff)
**Status:** design approved, pre-plan
**Handoff (source of truth):** [`docs/modules/design_handoff_support_card_builder/`](../../modules/design_handoff_support_card_builder/) — panel 6 "Obtainable vs. wishlist" (README §"Screens / Views" #6), screenshot `07-coverage-and-target-spark.png`, and the `detailFor` / `sparkChance` / bonus logic in `Support Card Builder.dc.html`.
**Reads:** M1.0 affinity core (`spark.ts` / `lineageAffinity.ts` / `winBonus.ts`) · M1.4 parents/roster (`useRoster`, `Parent`) · M1.5 deck (`useDeckState`) · M1.6 support-card pool (`SupportCardRecord.skills`) · M4 sourcing/coverage (`sourcing.ts` / `coverage.ts`).

## 1. Purpose & scope

A live coverage card that crosses every **wishlist** skill against **where it can be obtained** for the current plan: the trained uma's innate kit, the two inheritance parents + their grandparents (with real spark-inherit %), and the 6-slot support-card deck (Hint / Chain / Random events). It also lists **bonus** skills the setup provides that aren't on the wishlist, and offers a **Matrix ⇄ Coverage** view toggle.

**In scope (this slice):**
- Coverage **matrix** view (columns `Innate ‖ Parent | G.parent ‖ Hint | Chain | Random`), sticky skill column, uncovered red stripe, 2-chip "+N" overflow.
- **Coverage** (bars) view + Matrix/Coverage toggle.
- **Bonus** list (obtainable, not on wishlist).
- Real inherit-% via the M1.0 spark math (no placeholder table).
- **Green-spark reconciliation** (native unique `100xxx`/`110xxx` → inherited-unique `9xxxxx`).
- **wonRaces → G1 reconciliation** (filter raw saddle ids to G1-only before the win-bonus).
- **Innate-skill data** for the plan uma (new `UmaRecord.innateSkills` from the GameTora feed).

**Out of scope (later cards):**
- **Target spark** right-rail + generated search link → **M1.8** (panel 7).
- M1.4b rental-parent builder.

## 2. Decisions (locked in brainstorming, 2026-07-01)

| # | Decision |
|---|---|
| D1 | Inherit-% uses **real M1.0 spark math** (`spark.ts`, affinity + member-aware), not the prototype's `{1:18,2:27,3:36}×0.55` placeholder. (P3.) |
| D2 | **Both** carried-over reconciliations (green `9xxxxx`, wonRaces→G1) land in this slice. |
| D3 | Source columns are **extended with a Hint column**: `Innate ‖ Parent | G.parent ‖ Hint | Chain | Random`. `hint_pool`→Hint, `chain`→Chain, `random_event` + `date_event`→Random. (The mockup's 2-column Chain/Random omits `hint_pool`, the primary card source — we don't.) |
| D4 | G1 saddle ids are **user-provided**: the reconciliation reads a hand-patchable `data-overrides/g1_saddle_ids.json`. Empty stub ⇒ win-bonus safely 0 (fixes today's over-count); the user supplies the authoritative ids. |
| D5 | Innate = each uma's **built-in skill kit** (unique + innate white, e.g. Mayano Top Gun original's "No Stopping Me!"), not just its unique. Sourced by extending `build-umas.ts` to emit `innateSkills` from the GameTora `character-cards.json` skill list; user drops `scripts/borrowed/gametora/` sources so `umas.json` regenerates in-worktree. |
| D6 | The matrix iterates the **full** `CmPlan.wishlist` (including inherited-unique `9xxxxx` entries) so the green/innate columns are meaningful; support-card columns naturally show `·` for unique/inherited-unique skills. |
| D7 | Architecture = **Approach A**: new pure M1 cores + provider-free UI card, reusing M4 (`sourcing.ts`/`coverage.ts`) and M1.0 (`spark.ts`/`lineageAffinity.ts`) primitives. (P6.) |

## 3. Architecture & data flow

One-way flow: **page gathers inputs → pure cores compute → card renders.**

```
InheritancePage
  ├─ inputs it already has: wishlist, uma1Plan, deck, cards, skillById, cardById
  ├─ resolves lineage from uma1Plan.parents.{a,b} via useRoster() + lineageAffinity
  ├─ builds (useMemo): cardHintIndex (M4 buildCardHintIndex), greenMap (skills.json), g1Set (lazy g1_saddle_ids.json)
  └─ buildCoverageMatrix({ wishlist, planUma, lineage, deck, cards, skillById, cardHintIndex, greenMap, g1Set })
         → { rows, bars, bonus }  →  <CoverageMatrixCard ... />   (provider-free)
```

### 3.1 New pure cores (`src/core/`)

**`greenSparkReconcile.ts`** — native unique → inherited-unique id map.
- `buildUniqueToInheritedMap(skills): { map: Map<string,string>; unresolved: string[] }`. Derived purely from committed `skills.json`. Primary key = numeric tail (`10xxxx`→`90xxxx`, `11xxxx`→`91xxxx`); validated against name-match (86/87 agree per current data). Mismatch/miss falls back to name-match and, failing that, is reported in `unresolved` (never silently dropped).
- `reconcileGreenSkillId(id, map): string` — returns the `9xxxxx` form, or the input unchanged if unmapped or already `9xxxxx` (idempotent, honest).

**`g1Saddle.ts`** — win-race grade filter.
- `isG1Saddle(saddleId: string, g1Set: Set<string>): boolean`.
- `filterG1(wonRaces: string[] | undefined, g1Set: Set<string>): string[]`.
- `g1Set` built from `data-overrides/g1_saddle_ids.json` (`string[]`). Empty ⇒ everything filtered (win-bonus 0).

**`coverageMatrix.ts`** — the heart (§4). `buildCoverageMatrix(input): CoverageResult`, pure & memoizable.

### 3.2 Edited cores

- `lineageAffinity.ts` — pass each member's `wonRaces` through `filterG1(_, g1Set)` **before** `computeWinBonus`. `g1Set` threaded in as an argument (keeps the core pure; the page supplies it).
- `types.ts` — add `UmaRecord.innateSkills?: string[]` (uma's built-in kit; optional so pre-regen data doesn't break types).

### 3.3 Edited pipeline

- `scripts/lib/upstream-types.ts` — add the skills field to `GtCharacterCard` (shape confirmed against the real `character-cards.json` once dropped in).
- `scripts/build-umas.ts` — emit `innateSkills` from the GameTora character card's skill list (unique + innate white). `scripts/build-umas.test.ts` extended.
- `public/data/umas.json` — regenerated via `pnpm data:build` (requires the borrowed sources).

### 3.4 UI

- `src/features/inheritance/CoverageMatrixCard.tsx` — provider-free; the page injects data + render helpers (same pattern as `SupportCardPoolCard`). Replaces `<Placeholder title="Obtainable vs. wishlist" phase="M1.7" />` in the center column.
- `src/features/inheritance/inheritance.css` — scoped `.inh-cov-*` additions (bars + bonus rows only).
- `InheritancePage.tsx` — resolve lineage, build indexes, wire the card, remove the placeholder.

## 4. The matrix computation (`coverageMatrix.ts`)

Real-data port of the handoff's `detailFor(skillId)`. Iterates the **full wishlist** (D6).

**Per-skill detail** `{ innate, parent[], gp[], hint[], chain[], random[] }`:

| Column | Source | Rule |
|---|---|---|
| **Innate** | plan uma's built-in kit | `planUma.innateSkills` mapped through `reconcileGreenSkillId` includes `skillId`. |
| **Parent** | active parent white **or** green spark | per active parent: `whiteSparks.find(id)` **or** `reconcileGreenSkillId(greenSpark.skillId) === id` → chip + **real inherit-%**. |
| **G.parent** | grandparent white/green spark | same over `grandparents[]`; grey chip + grandparent-path inherit-%. |
| **Hint** | deck cards, `sourceType==='hint_pool'` | via `cardHintIndex`; chip carries `tierForCardSkill` strong/weak tier. No %. |
| **Chain** | deck cards, `sourceType==='chain'` | card chip. No %. |
| **Random** | deck cards, `sourceType∈{'random_event','date_event'}` | card chip. No %. |

**Inherit-%** = real M1.0 math: feed the resolved `Lineage` (affinity + member context) into `spark.ts`; parent vs grandparent handled by which lineage member owns the spark. Never the placeholder table.

**Row** `{ skillId, name, isGold, cells, covered }`. `covered` = any source non-empty; else `uncovered` → inset red stripe on the skill column (`.row-uncovered`). Cells cap at **2 chips + "+N"**.

**Bars** — one per source (Innate/Parent/G.parent/Hint/Chain/Random) + **Uncovered**; each = covered-count + `% of wishlist`, colored by the source's tier token.

**Bonus** — skills the **deck + inheritance** provide that are **not** in the wishlist set. Scan all active parents' sparks (white + reconciled green) + all deck cards' grantable skills, minus wishlist; each row = skill name + source chip(s) + method label. Cap 4 sources/row.

**Determinism/perf** — pure; the page memoizes on inputs; `cardHintIndex` + `greenMap` built once.

## 5. UI (`CoverageMatrixCard.tsx`)

- **Header** `cmp-collapse-head` (collapsible, M1 card grammar) — title "Obtainable vs. wishlist" + **Matrix · Coverage** `.cmp-control-group` toggle + `HeaderHelp` "?" popup (explains sources + inherit-%).
- **Matrix view** — `.matrix` table (classes exist in `app.css`). Sticky `.skill-col` (gold name if gold-rarity); columns `Innate ‖ Parent | G.parent ‖ Hint | Chain | Random` with double-border separators before Parent and before Hint. Cell chips: Innate = `tier-spark` round chip (uma initials); Parent = accent-bordered round chip + "~N%"; G.parent = grey round chip + "~N%"; Hint = square tier chip (strong/weak); Chain/Random = square type-colored card chip. `·` when empty; `.row-uncovered` stripe on uncovered rows; 2-chip "+N" overflow.
- **Coverage view** — horizontal bars per source + Uncovered, count + % of wishlist, tier-colored. New `.inh-cov-bar*` CSS.
- **Bonus** — divider + "BONUS — obtainable, not on wishlist" + rows (name + source chip(s) + method). New `.inh-cov-bonus*` CSS.
- **Empty states** — no wishlist ⇒ "Add skills to your wishlist to see coverage."; no plan uma ⇒ pick-uma prompt. Placeholder initials for chips (no art), consistent with M1.
- **Reuse** — `.matrix`, `.row-uncovered`, `.skill-col`, `.chip-sm.tier-*`, `.cmp-control-group`, tier tokens all exist; new CSS = bars + bonus only.

## 6. Testing (P6 — cores cite sources)

- `greenSparkReconcile.test.ts` — `100011→900011`, `110011→910011`, name fallback, the known unresolved id surfaces, idempotent on `9xxxxx`.
- `g1Saddle.test.ts` — `isG1Saddle`/`filterG1` with a fixture set; empty set ⇒ all filtered; non-G1 shared win no longer scores.
- `coverageMatrix.test.ts` — innate hit; parent white + real %; grandparent %; green spark covers an inherited-unique wishlist entry; hint/chain/random from deck; uncovered row; 2-chip "+N"; bar counts; bonus excludes wishlist. Hand-built fixtures.
- `lineageAffinity.test.ts` (extend) — `wonRaces` passes through `filterG1` before `computeWinBonus` (non-G1 dropped).
- `build-umas.test.ts` (extend) — `innateSkills` emitted from the GameTora feed.
- `CoverageMatrixCard.test.tsx` — toggle, uncovered stripe, chip overflow, bonus, empty states (inject stub data; provider-free).

## 7. File inventory

| Action | File |
|---|---|
| new core | `src/core/coverageMatrix.ts` + `.test.ts` |
| new core | `src/core/greenSparkReconcile.ts` + `.test.ts` |
| new core | `src/core/g1Saddle.ts` + `.test.ts` |
| new UI | `src/features/inheritance/CoverageMatrixCard.tsx` + `.test.tsx` |
| new data | `data-overrides/g1_saddle_ids.json` (user provides ids) |
| edit core | `src/core/lineageAffinity.ts` (G1 filter), `src/core/types.ts` (`UmaRecord.innateSkills`) |
| edit pipeline | `scripts/lib/upstream-types.ts` (`GtCharacterCard` skills), `scripts/build-umas.ts` (emit innate), regenerated `public/data/umas.json` |
| edit page | `src/features/inheritance/InheritancePage.tsx` |
| edit CSS | `src/features/inheritance/inheritance.css` (`.inh-cov-*`) |

## 8. Pending user actions (gate specific steps, not the whole build)

1. **G1 saddle ids** → `data-overrides/g1_saddle_ids.json`. Until supplied it's an empty stub (win-bonus safely 0). *No fabricated ids.*
2. **Drop `scripts/borrowed/gametora/` sources** (esp. `character-cards.json`) → enables `build-umas` innate extraction + `umas.json` regen. Until then the Innate column shows `·`.

The matrix UI, green reconciliation, deck/parent columns, and real spark-% land **independent** of both — the card is useful immediately and gated columns light up as data arrives.

## 9. Risks & mitigations

- **GameTora skills-field shape unknown until the source is dropped in** — implement innate extraction against the real file (D5); degrade to empty `innateSkills` if absent (optional field).
- **Green name/id mismatch (1/87)** — reported via `unresolved`, never silently dropped; falls back to name-match.
- **wonRaces over-count is a live bug** — the importer already populates `wonRaces`, and `sharedG1` currently counts all grades; filtering to G1 (even an empty set) is a net correctness fix, not a regression.
- **`spikes/` absent ⇒ `data:build` can't run in-worktree** until the borrowed sources are dropped — mitigated by D5's user action; all non-innate work is derivable from committed JSON.

## 10. References

- Handoff: `docs/modules/design_handoff_support_card_builder/` (README §6, screenshot `07`, `Support Card Builder.dc.html`).
- Mechanics: `docs/mechanics-notes.md` §8 (green `9xxxxx`; 2.0 win-bonus: shared G1 only, +3 each, G2/G3 + Triple-Crown/Tiara → 0).
- Provenance: `docs/provenance.md` (GameTora `character-cards.json` "full: … skills"; UmaExtractor `skill_array`/`win_saddle_id_array`).
- Cores reused: `src/core/spark.ts`, `src/core/lineageAffinity.ts`, `src/core/winBonus.ts`, `src/core/sourcing.ts`, `src/core/coverage.ts` (`tierForCardSkill`).
