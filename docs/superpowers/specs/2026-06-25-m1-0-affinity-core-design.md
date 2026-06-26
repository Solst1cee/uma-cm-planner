# M1.0 — Affinity core (2.0 win-bonus + per-member spark wiring) — design

> **Date:** 2026-06-25 · **Status:** design (awaiting plan) · **Phase:** M1.0 (first phase of the M1 Inheritance workbench)
> **Roadmap:** [M1 — Inheritance workbench](../../roadmap.md#m1--inheritance-workbench--active-build-from-the-2026-06-25-design-handoff)
> **Mechanics of record:** [mechanics-notes.md §2–§3](../../mechanics-notes.md) (incl. the 2.0 compatibility overhaul).

## 1. Context

M1.0 is the pure-core math foundation the M1 workbench reads from (P6: core before UI). Exploration showed the core is **further along than the harvest doc implied**:

- `src/core/spark.ts` — spark inheritance proc chance (`sparkChance` / `combinedSparkChance`), `min(1, base/100·(1+affinity/100))` scaling, validated; consumed by `coverage.ts`.
- `src/core/affinity.ts` — static `aff2`/`aff3` + per-member assembly (`computeLineageAffinity → memberScores {parentA,parentB,gA1,gA2,gB1,gB2}`), validated vs Ice's sheet.

Two real gaps remain — exactly where the **2.0 compatibility overhaul** (Global 2026-07-01, retroactive; live JP/KR/TW) lands:

1. **`affinity.ts` *injects* `winBonus` but nothing computes it** (`Lineage.winBonus` is an optional input). The win/race bonus is unimplemented — so the 2.0 rule (G1-only, +3, no G2/G3, no titles) is **built here**, not edited.
2. **`spark.ts` scales by the user's *total* `affinityHint`** as a per-member score — its own docblock flags this `approximate`, waiting for "M1's computed per-member affinity." Wiring `computeLineageAffinity().memberScores` in **de-approximates every downstream number**.

**Decisions (Sun, 2026-06-25):**
- **Build the 2.0 model now, verify later** — it matches the established JP/KR/TW servers.
- **Owned/veteran umas:** won-race data comes from **UmaExtractor** import (so the win-bonus has real data; no baking blocker).
- **Rental Parent 2:** do **not** compute its affinity (unknowable lineage). Instead a **target-tier mode** — pick ○ or ◎ and show *how much affinity the rental must supply* to reach it.

## 2. The 2.0 win/race bonus (the rule to implement)

Per [mechanics-notes §3](../../mechanics-notes.md): only shared **G1-grade** wins grant a bonus, at **+3 each**; G2/G3 races and Triple Crown/Tiara titles give **0**. Computed per family-tree connection. Let `g1(X)` = the set of G1 race ids uma X won, and

```
sg(X, Y) = 3 × |g1(X) ∩ g1(Y)|        // shared-G1 win bonus (2.0)
```

The `winBonus` object `computeLineageAffinity` already consumes (each field = that member's total win-bonus contribution, matching the §3 member decomposition):

```
w.gA1 = sg(P1, GA1)              w.gA2 = sg(P1, GA2)
w.gB1 = sg(P2, GB1)             w.gB2 = sg(P2, GB2)
w.parentA = sg(P1, P2) + sg(P1, GA1) + sg(P1, GA2)
w.parentB = sg(P2, P1) + sg(P2, GB1) + sg(P2, GB2)
```

(The same `sg(Pᵢ,Gᵢⱼ)` legitimately appears in both `parentᵢ` and `gᵢⱼ` — the §3 model; the displayed total sums all six members.)

## 3. Scope — what M1.0 builds

All pure `src/core/` functions + focused tests. **No UI.**

**3.1 `Parent.wonRaces` model field** (`src/core/types.ts`)
- Add `wonRaces?: string[]` (won G1 race ids) to `Parent` and `ParentRef` (grandparents). Optional — absent ⇒ the win-bonus contributes 0 (honest floor; the win-bonus stays inert until populated). The **UmaExtractor importer wiring that populates it is a follow-on data step** (§6), not part of M1.0.

**3.2 `src/core/winBonus.ts`** — the pure 2.0 win-bonus computation
- `sharedG1(a: string[]|undefined, b: string[]|undefined): number` → `3 × |a ∩ b|`.
- `computeWinBonus(lin: WinBonusLineage): NonNullable<Lineage['winBonus']>` building the object in §2 from each member's `wonRaces`. `WinBonusLineage = { parentA, parentB, gA1?, gA2?, gB1?, gB2? }` where each member is `{ wonRaces?: string[] }`.
- Pure; no master-data needed (the G1-grade filter happens upstream — `wonRaces` already holds *G1* ids per the extractor; documented).

**3.3 Wire per-member affinity into `spark.ts`** — de-approximate
- `spark.ts` gains an optional `opts.memberAffinity?: { parentId → score, gp → score }` (or a per-contribution affinity resolver) so a contribution scales by its member's **computed** score instead of `Parent.affinityHint`.
- When a computed per-member score is supplied, the contribution is **no longer `approximate`** (it's the real model). The existing `affinityHint`/`grandparentAffinity` path stays as the manual/rental fallback (still `approximate`).
- A thin adapter `lineageMemberAffinity(plan/parents) → computeLineageAffinity(...)` maps the planner's parents to the `Lineage` shape and surfaces `memberScores`, so the workbench feeds spark.ts the real scores.

**3.4 Rental target-tier helper** (`affinity.ts` or `winBonus.ts`)
- `tierThreshold(tier: '○'|'◎'): number` → `51 | 151` (from `affinityTier`).
- `affinityNeededForTier(computablePartScore: number, tier): number` → `max(0, threshold − computablePartScore)` — the affinity a rental Parent 2 must supply to reach the chosen tier (powers M1.4 rental mode + M1.8 target spark). Pure.

## 4. Non-goals (deferred)

- The **UmaExtractor importer** change that fills `wonRaces` (data step, §6) — M1.0 only adds the field + consumes it.
- The **2.0 base-relation-point boost** — a `master.mdb` data refresh (sidelist **S1**); picked up automatically when `affinity.json` is regenerated. No code.
- `rankParents` / find-candidates optimizer → **M1.4**.
- `detailFor` coverage join → already in `coverage.ts`; any reconciliation → M1.7.
- All workbench **UI** (M1.1–M1.8).

## 5. Validation & honesty (P3)

- **`winBonus.ts` tests** — synthetic fixtures: disjoint G1 sets → 0; `k` shared G1 ids → `3k`; the full 6-member assembly (P1↔P2 + each parent↔its gps) → the exact §2 object. *Logic*-validated (the pre-2.0 `54+18=72` fixture is superseded; a real post-patch worked-example is queued — [mechanics-notes §10 item 7](../../mechanics-notes.md), user verifies after 2026-07-01).
- **`spark.ts` wiring tests** — same parents: `affinityHint`-path result is `approximate:true`; computed-`memberAffinity`-path is `approximate:false` and uses the per-member score (numerically different where the total ≠ a member score).
- **Rental-tier tests** — `affinityNeededForTier(40,'○')=11`, `(60,'○')=0`, `(100,'◎')=51`.
- **Honesty:** rental affinity is a *target*, never a computed number; the win-bonus is 0 (honest floor) until `wonRaces` is populated; computed per-member chances drop the `approximate` flag only when real scores are supplied.

## 6. Follow-on (tracked, not M1.0)

- **UmaExtractor → `wonRaces`:** extend the importer to read veteran umas' won-G1 races into `Parent.wonRaces` (+ each grandparent's). Needed before the win-bonus is *live*; the user confirmed UmaExtractor exposes this.
- **G1-grade source:** confirm the extractor already filters to G1 (else add a G1 race-id allowlist from master.mdb `race`/grade).
- **S1 data refresh** for the boosted base relation points (post-2026-07-01).

## 7. Exit

`winBonus.ts` + the `spark.ts` per-member wiring + the rental-tier helper land as pure, unit-tested core; `Parent.wonRaces` exists; `pnpm typecheck` + `pnpm test` + `pnpm build` green. The affinity *logic* of the 2.0 overhaul is in place, ready for the importer to feed it real won-race data.
