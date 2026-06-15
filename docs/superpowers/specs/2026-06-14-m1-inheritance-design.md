# Module 1 — Inheritance Planner: Design Spec

**Status:** APPROVED — M1 design locked (2026-06-14) · **Owner:** Sun · *(implementation plan via writing-plans deferred until M2 brainstormed)*
**Origin:** Brainstorm (superpowers:brainstorming), building on plan §7. **Resolves M4's inheritance needs** — replaces M4's manual `inheritanceStopgap`.

Given the M4 build (runner uma, aptitude targets, wishlist white sparks, stat targets), M1 finds the **parent pair (+ grandparents)** that delivers it: which spark stars are needed, what your Parent A supplies, the **residual** to hunt, and how candidate Parent Bs **compare**. Two parts:
- **Part 1 — Spark goal & residual** (the search-query builder).
- **Part 2 — Candidate compare** (Parent B candidates vs the fixed Parent A).

---

## 1. Decisions (locked)
- **Affinity: COMPUTED (+ manual override)** — algorithm verified in Phase 0 (`docs/mechanics-notes.md` §3, reproduces umamily.moe); **derived clean-room from the `master.mdb` `succession_relation` tables** (plan §3). **Do NOT port uma.moe `affinity.py`/`affinity.rs` — it's AGPL-3.0, incompatible with our GPL-3.0**; uma.moe + Ice's sheet are *validation cross-checks* only.
- **Roster import: UmaExtractor JSON** (sample at `spikes/samples/`). **UmaExtractor reads the live game record → opt-in, ToS/ban-risk, never required**; **manual entry is a first-class alternative** (same caveat M2 carries).
- **Rental data: paste-parser + deep-links** (no API key, works today). **Native uma.moe `/api/v3/search` is DEFERRED** — auth-gated, no self-serve key (operator-grant via email only); ChronoGenesis is email-invite only. (Feasibility verified 2026-06-14; see plan §3.)
- **UI: pedigree** — grandparents (top) → parents (middle) → **runner** (bottom). **Roster/paste parents are display-only; only a `dummy` is editable.**
- **Persistence: spark goals (pink + blue) saved to the `CmPlan`**, loaded on reopen; the pink goal *is* M4's desired aptitude (shared both ways).
- **Inverse mode (plan §7) DROPPED** — replaced by manual candidate-add plus a **ChronoGenesis-style roster search & filter** (§4.1).

## 2. Data model

> **Canonical shared types** (`Parent`, `RosterEntry`, `ParentSparks`, `Stat`, `AptKey`, `sparkGoals`) live in [`2026-06-15-shared-data-model.md`](2026-06-15-shared-data-model.md); shapes below are superseded by that contract (note: tags + full build live on `RosterEntry`, not `Parent`).
### Parent (extends plan §5)
```ts
interface Parent {
  umaId: string;
  source: 'mine' | 'friend_rental' | 'dummy';
  importSource: 'umaextractor' | 'paste' | 'roster' | 'dummy';
  trainerId?: string;                                  // friend_rental: the in-game ID to friend
  sparks: { pink: Spark[]; blue: Spark[]; green: Spark[]; white: Spark[] };   // Spark = { key: string; stars: 1|2|3 }
  grandparents: [GrandParent?, GrandParent?];          // 1-level nesting; same spark shape
  affinity?: { computed: number; override?: number };
  notes?: string;
}
```
- **Editable only when `source === 'dummy'`** (what-if); roster/paste/rental are display-only snapshots.
- **Generation rule (important):** a chosen veteran contributes its **own** sparks **+ its 2 parents'** sparks (those 2 become the **grandparents** in the new tree). The veteran's *own* grandparents are 3 generations back → **out of the new tree, not counted**. So `Parent.grandparents` = the veteran's 2 parents; spark **totals/filters count the uma + its 2 parents only**.
- Spark note: uma.moe encodes a spark int as `factorId×10 + star`; we normalize to `{ key, stars }`.

### CmPlan additions (cross-module SSOT)
```ts
sparkGoals: {
  pink: Record<AptKey, 'A' | 'S' | 'custom'>;   // seeded from M4 desired aptitude; M1-editable; shared with M4
  blue: Record<Stat, number>;                    // target TOTAL spark stars, e.g. { power: 9, stamina: 9 }
};
// white goals live in the existing `wishlist` (M4) + per-skill flags { doubleUp?: boolean, manualAdd?: boolean }
```
Saved/loaded with the plan so goals survive reopen.

## 3. Part 1 — Spark goal & residual (search builder)
Inputs: the M4 `CmPlan` (runner, desired aptitude, wishlist, stat targets) + the fixed **Parent A** (yours). Per spark color, **residual = goal − what Parent A supplies**:
- **Pink** — seeded from M4's desired aptitude; per-aptitude editable: distance **A/S**, surface **≥ A**, **strategy fully custom**. Residual = stars still needed to clear the target grade at career start (via `careerStartAptitude` table) minus Parent A's pink contribution.
- **Blue** — **manual** per-stat star totals (e.g. Power 9 / Stamina 9); residual = goal − Parent A's blue stars.
- **White** — a **side panel**: pull from the M4 wishlist, **add/remove** any skill spark, and **double-up** — deliberately target a white spark **Parent A already has** so it sits on *both* parents (higher inherit chance; factors into the white-coverage / P math).
- **Residual → search:** because no single parent has everything, the user **ticks which residual items to actually search for** → builds the **deep-link query** (Pure-DB / uma.moe / ChronoGenesis) + paste-back.

## 4. Part 2 — Candidate compare
- **Candidate list (Parent B):** paste a **trainer ID / UmaExtractor code** (Enter or **+ Add**), pick an **own veteran** (≠ Parent A), or **⚄ dummy** (editable). Each becomes a `Parent` record.
- **Compare-all:** Parent A fixed; **every candidate is a column**. Rows: start grade · gap-to-A · **P(S)** · blue preview · **white coverage %** (incl. double-up bonus) · affinity · overall fit. **Trade-offs stay in separate rows/columns — never collapsed to one score** (Maruzensky = best P(S); McQueen = covers both M4 sparks; etc.).

## 4.1 Roster search & filter (ChronoGenesis-style)
You add veterans **manually**, but the box is **filterable** — the same filter serves Parent A selection *and* own-veteran Parent B candidates, and the residual-derived criteria pre-fill the rental deep-links. Modeled on ChronoGenesis `/friend_search`:
- **Per-color spark groups** with **AND / OR / Exclude**.
- **Total blue** (per stat ≥ N★) and **total pink** (per aptitude ≥ N★) — counted over **uma + its 2 parents** (the new-tree members; see §2 generation rule).
- **Skill spark on the uma *itself*** (parent-level only) — for **double-up / high-proc placement** (parent-level affinity > grandparent).
- **Total skill spark** — uma + its 2 parents; **excludes the uma's grandparents** (out of the new tree).
- Plus **distance / surface aptitude** filters.

This "help to search" is what replaces inverse mode — manual selection, but the roster is filtered to what matters.

## 5. Core functions (`src/core/inheritance.ts`) — pure, unit-tested (P6)
```ts
careerStartAptitude(base: Grade, totalPinkStars: number): Grade;      // table-driven; VALIDATE vs umamily.moe
starsNeededFor(base: Grade, target: 'A'|'S', current: number): number;
computeAffinity(umaId: string, member: Parent | GrandParent, lineage): number; // per-member aff2/aff3 (verified §7.1); badge = Σ of 6 members
probReachS(parents: Parent[], aptKey: string, affinity: number): number;
whiteInheritChance(skillId: string, onParentA: boolean, onParentB: boolean): number;  // double-up
residualSpec(plan: CmPlan, parentA: Parent): { pink; blue; white };
evaluateParentSet(plan: CmPlan, parentA: Parent, parentB: Parent): {
  startGrade: Grade; gapToA: number; pS: number;
  blueBonus: Record<Stat, number>;
  whiteCoverage: Array<{ skillId: string; pct: number; doubledUp: boolean }>;   // ← M4 tie-in
};
```

## 6. Honest numbers (P3)
- **"Candidates to go friend, not guarantees"** banner (top of UI): a matching *record* ≠ a *borrowable* rental — follow-then-borrow (3/day), DB lag 2–7 days, private/slot-full profiles. **M1 scores fit, not availability.**
- The **pieces** are verified (pink `[1,4,7,10]`, proc table §2, affinity §7.1); the **assembled P(S)** is the estimate → validate vs umamily.moe (**≥5 hand-checked parent sets**, plan §7 acceptance).

## 7. Mechanics basis (verified — `mechanics-notes.md` §1–§6, Phase 0 2026-06-12)
- **Inspiration = 2 events** (Classic + Senior April); `P(career) = 1 − (1 − p_event)²`.
- **Base proc per event** (before affinity), by 1★/2★/3★: Blue 70/80/90 · **Pink 1/3/5** · Green 5/10/15 · White-skill 3/6/9 · White-race(G1) 1/2/3. Each roll is **independent, per lineage member, scaled by that member's own affinity (§7.1), clamped 100%**.
- **Pink (aptitude):** career start = cumulative pink stars across all 6 lineage members per aptitude; thresholds **[1, 4, 7, 10] → +1/+2/+3/+4 grade** (max +4; **cannot exceed A at start**). **A→S only** via an in-run inspiration proc of that pink spark while at A — so **S is affinity-gated**.
- **Blue (stat):** career start = **[5, 12, 21]** stat points per 1/2/3★ per member, additive (game previews it at parent-select).
- **Grandparents:** their lower proc is **emergent from a structurally smaller affinity score** (only a triangle `aff3` term + shared wins — no direct trainee↔grandparent pairwise term, no parent-pair term) — **not** a flat ×0.5 (that's a myth; don't hardcode), per `mechanics-notes` §4.
- **White double-up:** the same white on ≥2 members → independent rolls, each scaled by that member's affinity → higher combined inherit chance (this *is* the "double-up"; falls straight out of the per-member model).

## 7.1 Affinity — the P(S) lever (verified, `mechanics-notes.md` §3)
**What it is.** A **per-lineage-member** compatibility score between the training uma **T** and each member (2 parents P, 4 grandparents G), from shared character-relations + shared race wins. Computable from `succession_relation` + `succession_relation_member`: `aff2(a,b) = Σ relation_point over types containing both`, `aff3(a,b,c) = Σ over types containing all three`. Our impl reproduces all **528 pairs + 5,456 triplets** of Ice's sheet exactly.
**What it does.** It scales spark inheritance: `chance = base × (1 + memberAffinity/100)`, clamped 100% — using **each member's individual score**, *not* the displayed total. So affinity is the lever on every spark's proc, and especially on **P(S)** (the A→S inspiration is a pink proc, affinity-scaled).
- Member score = `aff2(T,Pᵢ) + aff2(P₁,P₂) + sharedG1Wins(P₁,P₂) + Σⱼ[aff3(T,Pᵢ,Gᵢⱼ) + sharedWins(Pᵢ,Gᵢⱼ)]`; grandparent score = `aff3(T,Pᵢ,Gᵢⱼ) + sharedWins(Pᵢ,Gᵢⱼ)`.
- **In-game badge** = sum of all 6 member scores → **△ 0–50 · ◯ 51–150 · ◎ 151+**.
**M1 integration.**
- Compute every member's affinity from the relation tables (verified; static extracts in `spikes/repos/umalator-global/db/extract/relation*.json`; cross-ref uma-moe `affinity.py`/`affinity.rs`). A **dynamic** shared-won-races bonus (win-saddle) adds on top for *trained* umas.
- **Pedigree:** show the combined **◎/◯/△** badge + per-parent contribution.
- **Compare:** the "affinity" row = combined badge/score; it already drives the `P(S)` and `white coverage` rows.
- **Dynamic G1-win bonus:** `sharedWins` = **+3 affinity per G1 race won by *both* members** of a compared pair (post-2nd-anniversary patch — G2/G3 now count 0; older "+1 per graded win" is stale). Lets low-base umas (Haru Urara) still reach ◎. **Gate on `dataVersion`/`server` (P4).**
- **⚠ #1 pitfall:** never feed the **◎/◯/△ rank** or the **displayed total** (the *sum* of all 6 members) into the proc formula — that massively over-estimates. The formula uses each member's **individual** score; rank/total are display-only.
- **Display (mirror umamily.moe / umamusumeaffinitycalculator.com):** per-parent **rank symbol + integer** ("Legacy A: ◎ 168") with a **per-pair breakdown** (T↔P1, T↔P2, P1↔P2, each parent↔grandparent); grandparents visually subordinate; sortable by affinity. Player target = **triple-◎** (≈150+ on T↔P1, T↔P2, P1↔P2); minimum "≥ ◯ on any legacy you pick."
- **Override / new umas (P3/P4):** keep affinity overridable per member — newly-released umas (e.g. Meisho Doto, chara 1058) can be absent from the datamined tables → manual fallback, **never 0/null**. **Rental-parent affinity is an *estimate*** (the win-history bonus depends on each parent's own record). Math reference = uma-moe **`affinity.py`** (the `.rs` is just an HTTP proxy).

## 8. Integration
- Reads the M4 `CmPlan` (runner, **desired aptitude = pink goal**, **wishlist = white goal**, stat targets); writes back `sparkGoals` + resolved parents → **replaces M4's `inheritanceStopgap`**.
- Affinity cross-validated against uma.moe (`affinity.rs`) + Ice's sheet.

## 9. Data gaps / new artifacts
| Need | Status | Action |
|---|---|---|
| `succession_relation` / `succession_factor` tables | available | from clairvoyance dumps / master.mdb (plan §3) — affinity + spark→skill |
| `CmPlan.sparkGoals` field | **new** | persist pink grades + blue star-totals |
| UmaExtractor → `Parent` mapping | sample ready | `spikes/samples/`; importer + manual fallback |
| paste-parser per site | **new** | parse Pure-DB / uma.moe / ChronoGenesis result text + UmaExtractor code |
| affinity validation harness | **new** | reproduce umamily.moe / uma.moe / Ice's sheet (≥5 sets) |
| native uma.moe search | deferred | auth-gated; only if operator grants a key |

## 10. Risks
1. **Assembled P(S)** needs an end-to-end spot-check vs umamily.moe (its inputs — pink `[1,4,7,10]`, proc table, affinity — are verified; the composition isn't yet).
2. **Rental availability is unknowable** (P3) — surfaced, not hidden.
3. **Paste-parser brittleness** — site layout changes; repair via AI workflow when broken.
4. **Double-up bonus** math needs validation.
5. **Native uma.moe search** blocked on an operator-granted key — kept out of the v1 critical path.

## 11. Milestones
1. **Core** (`src/core/inheritance.ts`) + unit tests + affinity validation vs umamily.moe.
2. **Roster import** (UmaExtractor → `Parent`).
3. **Pedigree UI** + Parent A select/paste.
4. **Part 1** — spark goal editing (pink from M4 / blue manual / white side-panel + double-up) + residual + `CmPlan.sparkGoals` persistence.
5. **Part 2** — candidate list (paste/dummy) + compare-all.
6. **Deep-links + paste-parser.** (Native uma.moe search = later, operator-key-gated.)

> Per Sun's "brainstorm each module first," the implementation plan (writing-plans) is deferred until **M2** is also brainstormed, then folded into one engine-first plan.
