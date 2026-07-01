# M1.8 — "Target spark" card (design)

**Date:** 2026-07-01
**Module:** M1 Inheritance workbench
**Route:** `/inheritance`
**Replaces:** `<Placeholder title="Target spark" phase="M1.8" />` in
[`src/features/inheritance/InheritancePage.tsx`](../../../src/features/inheritance/InheritancePage.tsx) (right column).
**Design source of truth:** the high-fidelity handoff prototype
[`docs/modules/design_handoff_support_card_builder/`](../../modules/design_handoff_support_card_builder/)
— §7 "Target spark" (README lines 110–113; `Support Card Builder.dc.html` lines 483–493, 744–746, 799).

## Summary

A right-rail **read-off panel** that consolidates the sparks a player should hunt for on a
parent / rental to complete the current plan. Three sections:

- **BLUE** — the plan's blue (stat) spark goals, verbatim.
- **PINK** — the plan's pink (aptitude) spark goals, verbatim.
- **WHITE (uncovered skills)** — the wishlist skills the current parents + deck can't
  already provide. This depends on the coverage matrix (**M1.7**), which is being built in
  parallel and is **not yet on `main`**, so WHITE ships behind a seam (see §4).

The panel is a pure display of derived data. The same derivation is exposed as a reusable
value so **M1.4b**'s rental "↻ Load from Target spark" button can seed its editable
dummy-parent sparks from it later — this spec does **not** build the rental builder UI, the
editable rows, or the search-link.

## Scope

**In scope**
- A pure builder `buildTargetSpark(...)` returning `{ blue, pink, white, coverage }`.
- A provider-free presentational `TargetSparkCard` rendering that value.
- Wiring in `InheritancePage` (resolve the plan's uma, call the builder, render the card in
  the right column) — replacing the placeholder.
- Unit + component tests.

**Out of scope (explicitly deferred)**
- The M1.7 coverage matrix itself and its `detailFor`/uncovered computation (parallel branch).
- The M1.4b rental dummy-parent builder, editable hunt rows, `umalink` search-link, and the
  "Load from Target spark" button. We only expose the data contract those will consume.
- Any net-of-parents subtraction on BLUE/PINK (the handoff shows plan goals verbatim; see §3).

## Semantics (faithful to the prototype)

From `Support Card Builder.dc.html`:
- `targetBlue` (line 745) = plan blue goals with `star > 0`, mapped to `{ label: "Stamina 6★", color }`.
- `targetPink` (line 744) = plan pink goals with `star > 0`, mapped to `{ label: "Long 5★" }`.
- `targetWhite` (line 746) = the **uncovered** wishlist rows, green badges.
- `hasWhite`/`noWhite` (line 799): non-empty → chips; empty → green
  "✓ All wishlist skills obtainable from your setup."

**BLUE and PINK are the plan goals verbatim** — they are *not* reduced by what the currently
selected Parent 1 / Parent 2 already supply. This matches the mockup and keeps the panel a
simple "here's the full shopping list for a parent/rental" read-off.

## Architecture

Approach **A** (approved): a pure builder function + a provider-free presentational card. No
hook, no in-card computation.

### 1. `src/features/inheritance/targetSpark.ts` (pure)

```ts
export interface WhiteSparkRow { id: string; name: string }

export type TargetSparkCoverage = 'pending' | 'covered' | 'gaps';

export interface TargetSpark {
  blue: BlueSparkRow[];   // reused from planTargets.ts
  pink: PinkSparkRow[];   // reused from planTargets.ts
  white: WhiteSparkRow[];
  coverage: TargetSparkCoverage;
}

export function buildTargetSpark(
  plan: CmPlan,
  uma: UmaRecord | null,
  skillById: Map<string, SkillRecord>,
  uncoveredSkillIds: string[] | undefined,
): TargetSpark;
```

Behavior:
- `blue = blueSparkRows(plan)` — reuse M1.3's helper, no recomputation.
- `pink = pinkSparkRows(plan, uma)` — reuse M1.3's helper (empty when `uma` is `null`).
- WHITE / `coverage`:
  - `uncoveredSkillIds === undefined` → `white: []`, `coverage: 'pending'`.
  - `uncoveredSkillIds.length === 0` → `white: []`, `coverage: 'covered'`.
  - otherwise → `white` = each id resolved to `{ id, name }` via `skillById` (skip ids the
    map doesn't know, mirroring the app's tolerance for unknown skill ids), `coverage: 'gaps'`.

This function is the **reusable seeding contract**. M1.4b's future "Load from Target spark"
calls it and reads `{ blue, pink, white }` to seed its editable rows.

### 2. `src/features/inheritance/TargetSparkCard.tsx` (presentational, provider-free)

Props: `{ spark: TargetSpark }`. Renders the panel — no data fetching, no `useGameData`/
`useUmas` (keeps the M1 test pattern: pages stub providers, cards stay pure). Windows
case-FS note: the component file is `TargetSparkCard.tsx`, the helper is `targetSpark.ts` —
distinct names, no case clash (unlike the `StatInput`/`statInput` gotcha).

Layout (reusing existing grammar):
- `cmp-plan-card` shell + `cmp-plan-card-head` "Target spark" bar + `cmp-plan-card-body`.
- Intro line (muted, small): "Sparks to hunt for on a parent / rental to complete this plan."
- `cmp-mini-label` "Blue" → `.spark-chips` of `.badge.spark-blue` (border/text tinted per
  stat color, matching the prototype).
- `cmp-mini-label` "Pink" → `.spark-chips` of `.badge.spark-pink`.
- `cmp-mini-label` "White (uncovered skills)" → one of three renderings by `coverage`:
  - `'pending'` → muted small note: "Coverage pending — needs the obtainable-vs-wishlist
    matrix (M1.7)."
  - `'covered'` → green small note: "✓ All wishlist skills obtainable from your setup."
  - `'gaps'` → `.spark-chips` of `.badge.spark-green` skill-name chips.
- **Not collapsible** (matches the handoff — only Plan targets / Inheritance / Support cards
  collapse).

### 3. `InheritancePage.tsx` wiring

- Resolve the active plan's uma the same way M1.3 does (via `useUmas` → `umaById`, from the
  `uma1Plan`'s trainee), producing the `uma: UmaRecord | null` argument.
- Build `skillById` from `useGameData` (already available in the page for M1.3/M1.6).
- Call `buildTargetSpark(uma1Plan, uma, skillById, uncoveredSkillIds)` with
  **`uncoveredSkillIds = undefined`** for now (the M1.7 seam).
- Render `<TargetSparkCard spark={...} />` in the right column, replacing the placeholder at
  the current `Placeholder title="Target spark"` site.

## The M1.7 seam (WHITE)

M1.7 (coverage matrix) is on an unmerged parallel branch. When it lands, its uncovered-skill
list (the wishlist skills whose `detailFor` yields no innate/parent/gp/chain/random source)
becomes the `uncoveredSkillIds` argument — a **single-line change** in `InheritancePage`
(swap `undefined` for the computed list). No change to `targetSpark.ts` or `TargetSparkCard`.

The extra `'pending'` state (beyond the handoff's binary has-white/no-white) is deliberate:
before coverage exists we must **not** show the green "✓ all obtainable" checkmark, which
would be a false positive. `'pending'` shows a neutral "needs M1.7" note instead.

## Data flow

```
InheritancePage
  uma1Plan ─┐
  uma       ├─▶ buildTargetSpark(plan, uma, skillById, undefined) ─▶ TargetSpark
  skillById ┘                                                          │
  (M1.7: uncoveredSkillIds instead of undefined)                       ▼
                                                            <TargetSparkCard spark=… />
```

## Error / edge handling

- No uma resolved (`uma === null`): `pink` is `[]`; the Pink section renders an empty chips
  row (no crash). BLUE and WHITE are unaffected.
- Empty plan (no blue goals): BLUE renders empty. Panel still renders its head + intro.
- Unknown skill id in `uncoveredSkillIds`: skipped (not rendered), mirroring the app's
  existing tolerance for engine-unknown / imported ids.
- The card is pure/presentational — it never throws on missing providers because it takes no
  provider-backed hooks.

## Testing

- **`targetSpark.test.ts`** (pure, no mocks):
  - blue passthrough from `blueSparkRows`.
  - pink passthrough from `pinkSparkRows`; empty when `uma` is `null`.
  - `coverage: 'pending'` when `uncoveredSkillIds` is `undefined`.
  - `coverage: 'covered'` when it's `[]`.
  - `coverage: 'gaps'` + resolved `white` rows when non-empty; unknown id skipped.
- **`TargetSparkCard.test.tsx`** (provider-free render):
  - renders blue/pink chips.
  - renders each of the three WHITE states (pending note / covered note / green chips).

## Reuse & principles

- **P6 pure-function core:** all logic in `targetSpark.ts`, unit-tested; UI is a thin layer.
- **Reuse first (P1):** BLUE/PINK reuse M1.3's `blueSparkRows`/`pinkSparkRows`; the card
  reuses the `cmp-plan-card` grammar, `.spark-chips`, and `.badge.spark-blue|pink|green`
  classes already in `inheritance.css` / the design system. Expected new CSS: none, or a
  trivial spacing tweak.
- **M1 pattern:** provider-free presentational card + pure-helper sibling; the page owns
  provider access and passes plain data in.

## Files

| File | Change |
|---|---|
| `src/features/inheritance/targetSpark.ts` | new — pure builder + types |
| `src/features/inheritance/targetSpark.test.ts` | new — unit tests |
| `src/features/inheritance/TargetSparkCard.tsx` | new — presentational card |
| `src/features/inheritance/TargetSparkCard.test.tsx` | new — component tests |
| `src/features/inheritance/InheritancePage.tsx` | replace the Target-spark placeholder; wire the card |
| `src/features/inheritance/inheritance.css` | only if a spacing tweak is needed |

## Open items / future

- **M1.7 integration:** swap `undefined` → the coverage matrix's uncovered list (one line).
- **M1.4b consumption:** the rental "Load from Target spark" reads `buildTargetSpark(...)`'s
  `{ blue, pink, white }` to seed its editable rows; the search-link + editable UI are M1.4b.
