# M4 Main-Page Redesign — Design

> **Status:** design (brainstormed 2026-06-24). **Scope:** the `/` planner page (`CmPlannerPage`) only.
> **Sibling spec (next):** the dedicated **full race-sim page** is a *separate* effort — see *Out of scope* §10.
> **Driver:** the current 4-column page is too dense; rework the layout + IA (polish comes along). Decided: *layout & density* over pure visual polish.

## 1. Context & motivation

The built `/` page is a **4-column grid** — `inventory · plan-sidebar · main · race-sim` — that packs four surfaces side-by-side and stacks the main column vertically (track → race-setup → uma chart → skill chart). It is functionally ahead of the [m4-current.html](../../mockups/m4-current.html) mockup (it has the inventory rail, the two-build race overlay, and skill-detail graphs the mockup never showed) but feels cramped, and the mockup is partly stale.

This redesign keeps the **plan editor + race track/setup always visible** and demotes everything else to **on-demand tabs / a collapsible rail / a separate page**, while introducing a **dual-build (uma1/uma2) planning model** and two new **engine-derived checker** panels.

The blue (uma1) / red (uma2) accent system and the card/tab grammar introduced here **seed the Phase-1 design system** (see [roadmap.md](../../roadmap.md)) without committing to building the whole system in this effort.

## 2. Goals / non-goals

**Goals**
- Replace the dense 4-column layout with a **3-column shell** (collapsible inventory · flip-card plan editor · main) where the main column pins the track+setup and tabs everything else.
- Make the plan editor a **flip card** that focuses either **uma1 (blue)** or **uma2 (red)**, with the *whole working context following the flip*.
- Treat **uma1 and uma2 as two co-equal autosaved plans** (a "focused build" model).
- Add **Stamina** and **Accel** checker tabs, both **derived from our sim engine** (no input forms, no GameTora data).
- Relocate the two-build compare into an **on-demand Mini-sim tab** whose overlay still draws on the pinned track.
- Make the **inventory collapsible** (sliver ↔ today's exact look).

**Non-goals (this spec)**
- The **dedicated full race-sim page** (richer umalator-style sampling/distribution) — separate spec.
- Building the complete shared `design-system.css` — we only extract the tokens this page needs.
- New game data — the checkers use the engine + data we already ship.

## 3. Shell layout

Three columns; the main column stacks a pinned track over a tab strip.

```
┌────┬───────────────────┬──────────────────────────────────┐
│ I  │  PLAN EDITOR       │  ┌─ Tokyo 1600m · CM14 ────────┐  │
│ N  │ ┌ UMA1 │ UMA2 ┐    │  │  §0 race track + activation  │  │
│ V  │ │ blue active │    │  │  zones (focused build)       │  │
│    │ └─────────────┘    │  │  race setup ▾ · condition □□ │  │
│ ▤  │  portrait+unique   │  └──────────────────────────────┘  │
│    │  stat chips        │  ┌─ tabs ───────────────────────┐  │
│ s  │  aptitude tgt/base │  │ ①Unique ②Stamina ③Accel      │  │
│ l  │  strategy · mood   │  │ ④Skills  ⊕Mini-sim           │  │
│ i  │  ── wishlist ──    │  ├──────────────────────────────┤  │
│ v  │  skills + Σ L/SP   │  │     active tab content       │  │
│ r  │  [⇄ copy / save]   │  │                              │  │
└────┴───────────────────┴──┴──────────────────────────────┴──┘
```

- **Inventory** collapses to a slim sliver (icon + plan count); expands to today's `PlanInventoryCard` verbatim. Default **expanded**. State persisted in settings.
- **Plan editor** is the fixed middle column; the UMA1/UMA2 toggle flips it (content swap + accent recolor).
- **Main**: **track + race-setup pinned on top** (always visible), **tab strip** below.
- The old always-on **race-sim rail is removed** (→ Mini-sim tab + full-sim page).
- Responsive: below the existing ~1500px breakpoint, inventory auto-collapses to the sliver and the main column takes full width; the plan editor drops above the main column.

## 4. Components

### 4.1 Collapsible inventory
- **Collapsed:** vertical sliver — inventory glyph + saved-plan count, click to expand.
- **Expanded:** the current `PlanInventoryCard` unchanged (the user explicitly likes it).
- Collapse state persists via `setSetting`/`getSetting` (key e.g. `cmPlannerInventoryCollapsed`), default expanded.
- **Selecting a plan loads it into the _focused_ slot** (uma1 or uma2 — see 4.2/5), not always uma1. The existing auto-apply-track behavior is preserved per slot.
- The inventory list **marks which plans are the current uma1 (blue) / uma2 (red) slots**, since both are live builds.

### 4.2 Dual-build flip-card plan editor
- One component (refactor of `PlannerSidebar`) rendering the **focused build**. A **UMA1 (blue) / UMA2 (red)** segmented toggle in the header sets the focused slot; switching animates a flip transition and recolors via `--uma-accent` (blue `#5aa0ff` / red `#e0564f`, matching the existing overlay convention).
- **uma1** and **uma2** are both full `CmPlan`s that **autosave + auto-name** to inventory while active (see §5). **uma2 does _not_ auto-load:** the slot starts **empty on every page load** and is **cleared on refresh**, so a stored uma2 can never silently change your track/setup on load. Fill it explicitly — load a saved plan into it, or **Duplicate uma1 → uma2**.
- **Empty uma2 face:** flipping to an unfilled uma2 shows a prompt (Load from inventory · Duplicate uma1 →) and leaves the track + charts/checkers unchanged until it's filled.
- **Copy buttons:**
  - On the **red (uma2)** face: **"⤓ Duplicate uma1 → uma2"** — overwrite uma2 with a deep copy of uma1's build (new id/name).
  - On the **blue (uma1)** face: **"⤓ Replicate uma2 → uma1"** — overwrite uma1 with a deep copy of uma2's build. **Confirms first** (overwrites the primary active plan).
- Everything in the sidebar (stats, aptitude targets, strategy/mood, wishlist, Σ L/SP, skill picker) operates on the focused build.

### 4.3 Persistent track + race-setup
- `RaceTrackView` + `RaceSetup` + condition chips stay pinned above the tabs (today's `cmp-track-card` + `RaceSetup`).
- The track renders the **focused build's** wishlist + unique activation zones. When **compare is active** (Mini-sim), it additionally draws the two-build overlay (today's behavior).
- **Track auto-apply rules** (governed by the existing `autoApplyInventoryTrack` toggle):
  - **Flipping focus** (uma1↔uma2) with the toggle **ON** → the track adjusts to the **focused** build's race/track.
  - **Loading a plan into uma2** with the toggle **ON** → the track switches to **uma2's** track.
  - Toggle **OFF** → flipping/loading never changes the track (keeps what you're viewing) — same as today's uma1 behavior.
  - **uma2 blank/unselected → never change the track** (flipping to an empty uma2 keeps the current track), regardless of the toggle.
- Race-setup still edits `plan.cmRef` of the focused build (the timeline-driven `CmRefV2` flow is unchanged).

### 4.4 Tabbed working panel
- Tabs, in order: **①Unique · ②Stamina · ③Accel · ④Skills · ⊕Mini-sim**. Default **①Unique**.
- **①Unique** = today's `UmaChartPanel`; **④Skills** = today's `SkillChartPanel` — moved into tabs, operating on the **focused build**. Both honor the existing `collapseSkillSignal`.
- Switching tabs never reloads the track; only Mini-sim toggles the overlay.
- A single tab is mounted at a time (lazy) to keep the engine work scoped; the sim worker/LRU caches already memoize repeat runs.

### 4.5 Stamina checker (new, engine-derived)
- **Input:** the focused build + current race. **No form.**
- **Logic:** obtain the build's **per-frame HP trace** from the engine (the baseline "without-skill" trace already produced by the trace infrastructure — reuse rather than a new `sim:build` export; confirm in planning). Report:
  - **Verdict:** green **Finishes** / red **Runs out** (does HP reach 0 before the line?).
  - **Margin:** estimated stamina headroom / shortfall (バ身 or HP units).
  - **Recovery contribution** from recovery skills in the wishlist.
  - **Bottom-out position** — optionally flag the worst-HP point on the §0 track.
- Honest-numbers (P3): label it an estimate from the sim; it is strictly more grounded than UmaTools' spreadsheet port.

### 4.6 Accel checker (new, engine-derived)
- **Input:** the focused build's speed/accel skills + course geometry. **No form.**
- **Logic:** from `runSkillTrace` / `skillImpact` activation **positions**, tag each accel/speed skill: **"fires in final straight (optimal)" / "fires mid-race" / "too early" / "won't fire here"**, with the activation position and バ身 impact. A table over the build's skills.
- This is the engine-backed equivalent of UmaTools' geometric VAC buckets — richer because it uses real simulated activation, not a static `ls±` window.

### 4.7 Mini race-sim tab
- Holds the **compare controls**: Run/Stop, HP toggle, distance — for **uma1 vs uma2** (always both, regardless of focus).
- The **velocity/HP overlay + skill rungs draw on the pinned §0 track** (today's `RaceOverlay` on `RaceTrackView`). The tab is the control panel; the track is the canvas.
- Reuses `useRaceCompareController`, **refactored so uma2 = the uma2 plan slot** (replacing the one-off `RaceSimCard` saved-plan picker). The old `RaceSimCard` popover picker is retired (its "pick uma2" role is now the flip card + inventory-into-uma2).
- **If uma2 is empty** (the default on every load), the Mini-sim prompts to load/duplicate a uma2 first — there's nothing to compare against until the slot is filled.
- Full distribution/sampling is **not** here — it lives on the dedicated full-sim page (§10).

## 5. State / architecture

- **Dual active-plan model.** Generalize today's single `useActivePlan` (in `ActivePlanContext`) to two co-equal slots plus a focus flag:
  - `uma1Plan: CmPlan`, `uma2Plan: CmPlan | null` (null = empty slot), `focused: 'uma1' | 'uma2'`.
  - **uma1** persists + auto-loads across page loads (today's behavior). **uma2 is session-ephemeral:** the slot is **not** restored on reload (starts `null`, cleared on refresh) — *but while a uma2 build is active it autosaves + auto-names to inventory* like uma1, so the build itself is never lost, only the slot assignment drops on reload.
  - `focusedPlan` / `setFocusedPlan` are the handles the sidebar + tabs use; the non-focused slot updates only via copy buttons, the Mini-sim, or being loaded from inventory while focused.
  - Preferred shape: extend `ActivePlanContext` to expose `{ uma1, uma2, focused, setFocused, setFocusedPlan, … }` rather than instantiating the hook twice, so saved-plan list + import/export stay single-sourced. (Confirm exact refactor in the implementation plan.)
- **Inventory selection** sets the **focused** slot's plan.
- **`useRaceCompareController`** is refactored to take `uma1Plan` + `uma2Plan` directly (today it lifts uma2 from a picker). LRU sig already keys on aptitudes + mood (good); confirm it keys on both full builds.
- **Engine entrypoints** unchanged: `runRaceCompare` (Mini-sim), `runSkillTrace`/`skillImpact` (Accel + Stamina HP trace), all already wrapped in `simulatableBase`. No `pnpm sim:build` rebuild expected; flag immediately if the single-build HP trace needs a new export.

## 6. Visual system (seed only)

- Introduce CSS custom properties for the **uma accent** (`--uma-accent`, blue/red) and reuse the existing `cmp-plan-card` / `cmp-collapse-head` grammar for the new tab strip + checker panels.
- Keep new tokens in `cm-planner.css` but named so they can lift into `design-system.css` later (Phase 1). Do **not** build the full token system here.

## 7. Key files touched

- `src/features/cm-planner/CmPlannerPage.tsx` — new shell grid; mounts inventory, flip editor, pinned track/setup, tab strip.
- `src/app/ActivePlanContext.tsx` — dual-slot + focus refactor.
- `src/features/cm-planner/PlannerSidebar.tsx` — flip-card faces, accent var, copy/save buttons.
- `src/features/cm-planner/PlanInventoryCard.tsx` — collapsible sliver mode; load-into-focused.
- New: `StaminaCheckerTab.tsx`, `AccelCheckerTab.tsx`, a `WorkingTabs` container.
- `src/features/cm-planner/useRaceCompareController.ts` — consume uma1/uma2 slots.
- `RaceSimCard.tsx` — retired/folded into the Mini-sim tab.
- `cm-planner.css` — shell grid, tab strip, flip transition, sliver, accent vars.

## 8. Testing & non-regression

- The no-compare track must stay byte-identical (the `RaceTrackView` viewBox invariant from CLAUDE.md).
- Tests opening `SkillDetailDisclosure` with `traceContext` must keep `vi.mock`-ing `useSkillTrace` (jsdom Worker limitation).
- New unit tests: dual-plan focus + copy semantics (deep copy, confirm-on-overwrite-uma1), inventory-loads-into-focused, stamina verdict from a known HP trace, accel timing classification from known positions.
- Vitest-while-dev flakiness caveat applies — trust `pnpm build` / `pnpm typecheck`.

## 9. Open questions / risks

- **Single-build HP trace source** — reuse the trace baseline vs. a small new engine export. Resolve in planning; avoid a `sim:build` rebuild if possible.
- **Dual-autosave UX** — two builds both autosaving could surprise; confirm the dirty/Save affordance reads clearly per slot.
- **Copy-into-uma1 safety** — confirmation dialog vs. relying on autosave history.
- **Mini-sim ↔ focus** — Mini-sim ignores focus (always both); make sure switching focus mid-compare doesn't thrash the overlay.

## 10. Out of scope → next spec

The **dedicated full race-sim page** (new route; richer umalator-style both-runners view with sample distribution + full controls). The Mini-sim tab here is the lightweight compare; the full page is the heavy tool. It will reuse `runRaceCompare`/`runComparison` and the dual-plan slots from this spec. To be brainstormed + spec'd immediately after this one.

## 11. Suggested implementation phases (for the plan)

1. Dual-plan state refactor (`ActivePlanContext`) + inventory-into-focused — no visual change yet.
2. Shell grid + collapsible inventory sliver.
3. Flip-card editor (focus toggle, accent, copy/save buttons).
4. Tab strip; move Unique + Skills charts into tabs.
5. Mini-sim tab (refactor `useRaceCompareController`, retire `RaceSimCard`).
6. Stamina checker tab.
7. Accel checker tab.
8. Polish + token extraction + tests.
