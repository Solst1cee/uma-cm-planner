# M2 SP Optimizer — Tab 1 "Optimize basket" to full fidelity: Design Spec

**Status:** Approved (brainstormed 2026-07-11) · **Owner:** Sun
**Origin:** superpowers:brainstorming. Builds on the shipped M2 MVP (`spOptimizer.ts` / `rankBaskets.ts`), the just-merged **memory-capture importer** (`careerCapture.ts`, `source:'memory'`), and the v0.27.0 Rust/WASM engine re-platform. Realizes the **"Option 1a — two-tab workbench, table-led"** design handoff at [`docs/handoff/design_handoff_m2_sp_optimizer/`](../../handoff/design_handoff_m2_sp_optimizer/README.md).

---

## 1. Problem & scope

The optimizer *math* has shipped, but `/sp-optimizer` is ~20% of its design: a bare manual form + 3 plain cards. This spec brings **Tab 1 ("Optimize basket")** to full handoff fidelity — the interactive **buyable-skills table** (lock · ΔL · SP cost · L/SP · hint) feeding a **result banner** and **3 selectable, simulated basket cards** — plus the **shared chrome** (source segmented control, Build & SP card, Load-uma-plan prefill, two-tab shell).

**In scope (this branch):**
- Shared chrome: input-source segmented control, Build & SP card (uma/apt/stat chips + editable SP), Load-uma-plan → lock-prefill, two-tab shell.
- Tab 1 in full: result banner, skills table (lock/ΔL/cost/L-SP/hint, budget line, buy/cut tints), 3 basket cards.
- Surfacing per-candidate analysis from the orchestrator (the ΔL it already computes but discards).
- Wiring the **existing** `src/core/cost.ts` (`purchaseSpCost` / `effectiveSpCost` / `bundledSpCost`) into the interactive Hint control (the cost math already exists — no new core math).

**Out of scope → follow-ups:**
- **Tab 2 "Compare vs veteran" (the simulation lab)** = **F2**. This branch ships the two-tab **shell** with Tab 2 as a clear **"coming in F2" placeholder** so the cards' "Compare vs veteran →" buttons have a destination. F2 gets its own spec (see §9).
- Contested (opponent-field) sim, phase-profile telemetry, career-rank chip data — honesty-gated (§7), not built here.

**Boundary vs M4** is unchanged (spec `2026-06-14-m2-sp-optimizer-design.md` §1): M2 = post-run, SP-limited, reads the real screen.

## 2. Decisions (locked this session)

1. **Table = workbench, cards = recommendations.** The table lists *all* candidates and is where you lock/inspect; the 3 cards are the simmed recommendations. **Selecting a card** highlights that basket's buys as buy/cut rows in the table (with the dashed budget line).
2. **Re-run trigger = explicit "Re-analyze" button** (M4's Run/Stop + "changes detected" pattern). Locking a skill, editing a cost, or changing a hint level updates instantly and **marks the result stale**; the sim only re-runs on Re-analyze.
3. **Hint-Lv control = interactive reprice.** Selecting a hint level (0–5, per the `HintLevel` type; the handoff drew 0–3 illustratively) recomputes that row's SP cost via the existing `cost.ts` `purchaseSpCost` (instant, pure — auto-bundles gold+white) and its L/SP, and marks stale. (Repricing is instant; re-simming the baskets is the Re-analyze button — decisions 2 + 3 compose.)
4. **Card metrics = honest subset.** Cards show **mean +L** and **consistency spread** (vacuum gives these truthfully) + a **best-effort profile tag** derived only from telemetry we actually have. **No fabricated "% win vs field"** — a true win-vs-field needs a contested sim (F2-adjacent). P3 / spec §9.
5. **Per-candidate analysis rides on `RankResult`** (widen the return, don't add a second function) — reuses the ΔL `rankBaskets` already computes; single source of truth, no double-sim.

## 3. Data flow (end-to-end)

```
INPUT (source segmented control)
  ├─ 📷 Import career-capture.json  → careerCapture.ts → CaptureBundle (source:'memory')
  ├─ Manual entry (BuildContextForm) → CaptureBundle (source:'manual')
  └─ Carry from M4 (active plan)     → wishlistToCandidates → candidates seed
        + Load uma plan ▾ → matching wishlist skills prefilled as 🔒 locked (pinned)
                            ↓
WORKBENCH (Tab 1)
  CaptureBundle + pins + per-row hint/cost edits  ──[Re-analyze]──►  rankBaskets(bundle)
                            ↓                                              ↓
  Skills table (all candidates: lock, ΔL, cost, L/SP, hint)      RankResult { mode,
   ▲ buy/cut tint driven by selected card                          baskets[3], candidates[] }
                            ↓                                              ↓
  Result banner (optimal basket, +L, vs-greedy, SP used/left)   3 basket cards (selectable)
                                                                         ↓
                                                        "Compare vs veteran →" → Tab 2 (F2 stub)
```

**The CaptureBundle stays the single source of truth.** Pins, hint edits, and cost edits are held as page-level working state layered over the bundle; on Re-analyze they are merged into `context.pinned` / `context.candidates` and passed to `rankBaskets`. Results are derived, never persisted stale (spec §2 unchanged).

## 4. Core changes (`src/core/`)

### 4.1 Surface per-candidate analysis on `RankResult` (`rankBaskets.ts`)
`rankBaskets` already computes `deltaLById` per candidate, then discards it. Widen the result:

```ts
export interface CandidateRow {
  skillId: string;
  rarity: SkillRarity;
  deltaL: number;            // mean bashin from the single-skill sim (already computed)
  screenSpCost: number;      // effective cost after hint/edits
  baseSpCost?: number;       // skills.json base, for the struck-through display
  lPerSp: number;            // deltaL / screenSpCost * 1000 (0 if cost 0)
  hintLevel?: HintLevel;
  prereqSkillId?: string;
  pinned: boolean;
}
export interface RankResult {
  mode: 'exact' | 'shortlist';
  baskets: RankedBasket[];
  candidates: CandidateRow[];   // NEW — one row per buyable skill
}
```
Pure; reuses the in-function `deltaLById`. `lPerSp` is computed here (testable). No new sims.

### 4.2 Reuse the existing cost math (`src/core/cost.ts` — already built)
`cost.ts` **already implements** the confirmed schedule (mechanics-notes §7), built explicitly "for (future) M2 spOptimizer": `hintDiscountFraction`, `discountedComponent`, `effectiveSpCost(skill, hintLevel, rates, {fastLearner})`, `bundledSpCost` (gold + white prereq, one ceil), and `purchaseSpCost(skill, skillById, hintLevel, rates, {fastLearner})` which auto-bundles gold. Cumulative **10/20/30/35/40%** hint discount, **Fast Learner +10% ADDITIVE**, **ceil after summing**. **No new core math** — the interactive Hint control calls `purchaseSpCost`.

Wiring notes: these take a `SkillRecord` + `SparkRates` (the discount schedule), not raw numbers — the table resolves the skill via `skillById` and reads `rates` from game data (the same source M4 coverage uses). **Fast Learner** is a page-level toggle in the Build & SP card (default off; when a `source:'memory'` capture's `(baseSpCost, hintLevel, screenSpCost)` implies FL, surface a note — full FL-inference is F1). **Validation anchor:** a unit test asserts `effectiveSpCost` reproduces the mechanics-notes datapoints (160→128, 200→160 at Lv1+FL) and, for captured skills, the captured `screenSpCost` at the captured hint level.

## 5. Components (`src/features/sp-optimizer/`)

### 5.1 Shell — `SpOptimizerPage.tsx` (rework)
- Two-tab shell (`activeTab: 'optimize' | 'compare'`), blue-underline text tabs.
- **Build & SP card** (`BuildSpCard.tsx`, new): source segmented control `[📷 Import][Manual][Carry from M4]`; uma chip (+ career-rank badge *if present in bundle, else omit*); aptitude chip; stat chip; editable SP-available field; **Load uma plan ▾** row that prefills matching wishlist skills as locked + match-summary chips ("N matched", "M not yet buyable").
- P3 caveat banner (reuse existing).
- Tab 1 body = §5.2–5.4. Tab 2 body = a `ComparePlaceholder` ("Simulation lab — coming in F2") so the cards' buttons resolve.
- Working state: `pins: Set<skillId>`, `costEdits: Map<skillId, number>`, `hintEdits: Map<skillId, HintLevel>`, `fastLearner: boolean`, `selectedBasket: 0|1|2`, `stale: boolean`, `result: RankResult | null`. Re-analyze merges edits → bundle → `rankBaskets`, clears `stale`.

### 5.2 Result banner — `ResultBanner.tsx` (new)
Green banner: "OPTIMAL BASKET · {EXACT|ESTIMATE}" + "Buy N → +L"; thin progress bar + "vs greedy-by-ratio: +X L better" (a cheap greedy pass added to the orchestrator for the comparison number); boxed "SP USED n / budget · k left". Reflects the **selected** basket.

### 5.3 Skills table — `BuyableSkillsTable.tsx` (new)
Columns `Lock | Skill | Type | Δ L | SP cost | L/SP (×1k) | Hint Lv`. Rows from `result.candidates`, sorted by L/SP desc.
- **Lock cell:** amber lock badge (user-pinned, row tint amber) · green ✓ (in selected basket = optimizer-added, row tint green) · blue outline box (available; below budget line, dimmed). Clicking toggles the pin (instant, marks stale).
- **Skill cell:** `GameIcon` + name (gold in amber) + **category tag chip** + "+ white base" chip for gold. Category/effect chip reuses M4's effect grammar (`describeEffect` / `skillTechFormat.ts`, or `skill_categories.json`) — a small presentational `skillKind(skill)` helper maps to `{label, hue}` (SPD/CRN/ACC/REC/POS…).
- **Δ L:** green bold, tabular.
- **SP cost:** struck base + discounted value + "−N%"/"bundle" note; editable (marks stale).
- **L/SP:** green when strong, amber when weak (threshold from the median, honest not absolute).
- **Hint Lv:** 0–5 segmented control (handoff drew 0–3); change reprices via `cost.ts` `purchaseSpCost` (instant) + marks stale (decision 3).
- **Budget line:** a dashed row after the selected basket's last buy ("— budget line · n / budget SP used —"); cut rows dimmed below.
- Footer note (locked-always-kept / L-per-SP explainer).

### 5.4 Basket cards — `BuildCards.tsx` (rework)
Three **selectable** cards (card #1 selected by default; selection drives the table's buy/cut tint + budget line + banner). Each: title = best-effort **profile tag** (§7) or "Basket #k"; mode badge (EXACT/ESTIMATE); **mean +L**; **consistency spread** ("tight/moderate/wide"); skill list (locked shown, "+N more"); SP used/left; "**Compare vs veteran →**" button → `setActiveTab('compare')`. **No "% win vs field".** Each card *is* a `SimBuild` — the clean seam for F2 (§9).

## 6. Styling
Theme-aware **semantic tokens** + reuse the `cmp-*`/`ds-*` card grammar — **not** the handoff's raw hexes (app is light-default now; handoff §"Design Tokens" maps each hex to `--bg-*`/`--fg*`/`--accent`/tier tokens). New scoped classes in `sp-optimizer.css`. Category-chip hues map to existing effect-tone tokens. Verify light + dark.

## 7. Honest numbers (P3)
- **No fabricated win-vs-field%.** Vacuum sim = solo; a field win-rate needs opponents (F2). Cards show mean L + spread only.
- **Profile tags are best-effort or generic.** Derive only from telemetry we have (where the skill ΔL lands; stamina/HP margin from the trace). If telemetry can't support a distinct label, show "Basket #k" — never invent "final-corner burst" (spec §9 risk). This may land as generic tags initially; richer profiles arrive with F2's telemetry.
- **effectiveSpCost is a model**, validated against captured datapoints; Fast Learner inference is partial (F1). Flag when a capture's cost can't be reproduced.
- Result banner labels **EXACT** (every feasible residual simmed) vs **ESTIMATE** (shortlisted), from `RankResult.mode`.

## 8. Testing (P6)
- **Core:** `rankBaskets` returns `candidates` with correct ΔL/L-SP + `pinned`; greedy-comparison number; pins/prereq bundling reflected. `effectiveSpCost` reproduces the mechanics-notes schedule + captured datapoints; gold bundling. All against committed fixture `CaptureBundle`s, fixed seed (sim injected — no absolute engine numbers asserted, so stable across engine bumps).
- **Components:** `BuyableSkillsTable` renders rows/buy-cut/budget-line/hint-reprice from a fixture `RankResult` (mock `useGameData`); card selection re-highlights; Re-analyze stale→fresh flow; Load-uma-plan lock-prefill; source segmented control. Sim mocked (jsdom Worker gotcha — `vi.mock` the sim deps / `useUniqueSkillL`-style stubs).
- Typecheck + build green; existing M2 tests (`rankBaskets.test.ts`, `rankBaskets.validation.test.ts`, `SpOptimizerPage.test.tsx`) updated, not broken.

## 9. F2 seam (recorded, not built)
Tab 2 "Compare vs veteran" is a **full simulation lab** (handoff Tab 2): per-lane source `[Basket][Veteran][Custom][Draft]`, a planner-style **race trace reusing `RaceTrackView`/`RaceOverlay`**, a **margin-distribution histogram**, and a **min/max/mean/median** detail table. New this session vs the older mockup:
- **Custom-uma lane** — hand-entered opponent, to compare against a **community/friend's** build (not just your roster).
- **Draft lane** — an uma from the current CM borrow/draft pool.
- It is a **"full race sim" tab** and should **reuse M4's existing two-build machinery** (Mini-sim / `RaceOverlay` / two-runner `runRaceCompare`) rather than build fresh.
This branch leaves the seam clean: each basket card is a resolved `SimBuild`; the "Compare vs veteran →" button switches tabs carrying the selected basket. F2 = its own spec + plan.

## 10. Risks
- **Interactive hint reprice** relies on `cost.ts` (already built + confirmed, mechanics-notes §7) — low risk. Fast Learner handled as a toggle; full FL inference from captures deferred (F1). Gold ~2× premium is still the documented `bundledSpCost` TODO (mechanics-notes §10 item 8) — carried as-is, not blocking.
- **Profile-tag honesty** — must not fabricate; generic "Basket #k" is the honest floor.
- **Re-analyze cost** — the sim is the expensive part; instant reprice/pin keeps interaction snappy, sim gated behind the button (M4 pattern).
- **`RankResult` shape change** ripples to `BuildCards` + tests — contained, typed.
```
