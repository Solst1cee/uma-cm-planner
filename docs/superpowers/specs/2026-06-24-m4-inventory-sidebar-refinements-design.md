# M4 Inventory + Sidebar UX Refinements — Design

> **Created 2026-06-24.** Follow-up to the [main-page redesign](2026-06-24-m4-main-page-redesign-design.md) (3-column dual-build flip-card planner, merged to `main` locally). This spec is a batch of 13 inventory + sidebar refinements + bug fixes surfaced during live verification of that redesign.

**Goal:** Make the dual-build inventory + sidebar feel finished — explicit per-slot plan picking with collision safety, an edit-mode gate over destructive buttons, a backpack-icon inventory, a track-change confirmation flow, full red theming for uma2, and fixes for three concrete bugs (stat-field "0", delete-touches-loaded-plan, stale "saved" indicator).

**Architecture:** All changes live in the four existing M4 planner surfaces — `PlanInventoryCard.tsx`, `PlannerSidebar.tsx`, `CmPlannerPage.tsx` (orchestration), `ActivePlanContext.tsx` (dual-plan state) — plus `cm-planner.css`. Pure, branchy logic is extracted into small unit-tested helpers (`statInput.ts`, `trackChange.ts`, a `shouldDuplicateForSlot` collision predicate); a new `StatInput` subcomponent owns the stat-field buffer. No engine (`sim:build`) work, no Dexie schema change, no change to uma2's session-scratch persistence model.

**Tech Stack:** TypeScript + React 19, Vitest (jsdom) + Testing Library, existing helpers `copyPlanInto`, `useDismissOnOutside`, `generatePlanName`, inline-SVG `IconSvg` convention.

---

## Decisions (resolved during brainstorming)

1. **Drag-and-drop into the sidebar is DEFERRED** to a separate follow-up — out of scope here.
2. **Backpack icon = inline themed SVG** (matching the `IconSvg` convention), not bundled game art.
3. **Track-change Cancel = "load/flip anyway, keep my current track."** Cancel never aborts the load or the focus switch; it only declines to move the track.
4. **Focused-uma2 action row = `[Replicate uma1] [New]`** with **Save / Save As disabled** (uma2 is session-scratch and autosaves, so explicit Save/Save As have no job there). `New` clears the uma2 scratch slot.
5. **Collision auto-duplicate is silent** and **uniform**: the duplicate goes into the *target* slot and follows that slot's normal persistence (uma2 → scratch autosave/autoname; uma1 → loaded-but-unsaved until the user Saves).

---

## A. Inventory — backpack icon + edit mode

### A1. Backpack icon
- A new inline-SVG `BackpackIcon` (line-art, `viewBox="0 0 20 20"`, theme-tinted via `currentColor`) heads the inventory card, following the existing `IconSvg`/`CheckIcon`/`TrashIcon` pattern in `PlanInventoryCard.tsx`.
- **Collapsed sliver:** render only the backpack at **2× size**, centered, with **no plan-count number** (today the sliver shows a count — remove it).
- **Expanded:** backpack icon + the existing "Saved plans" heading/label.

### A2. Edit mode
- A **pencil toggle button** (`EditIcon`, new inline SVG) sits in the inventory card header, **only when expanded**.
- `editMode` is local boolean state in `PlanInventoryCard`.
- **Default (editMode = false):** the **per-group** "download all" / "delete all" buttons AND the **per-item** download / delete buttons are **hidden**.
- **editMode = true:** those per-group and per-item buttons are **shown**.
- The **card-header** "download all" / "upload" / "delete all" buttons are **always visible** — edit mode never hides or shows them.
- **Toggle behavior:**
  - Clicking the pencil flips `editMode` (enter ↔ exit).
  - **Click outside the action buttons** exits edit mode — implemented with `useDismissOnOutside(editScopeRef, editMode, () => setEditMode(false))`. The dismiss ref wraps the inventory list so clicks on the per-group/per-item action buttons (inside the ref) do NOT dismiss, but clicks elsewhere on the page do.
  - **Clicking any per-group / per-item action button performs its task and stays in edit mode** (the existing handlers run; edit mode is not exited). Because those buttons live inside the dismiss ref, their `pointerdown` is not treated as "outside."
- While `editMode` is true, the per-item slot-pick badges (B1) are **hidden**.

**Acceptance:** With ≥1 saved plan: per-item download/delete and per-group download-all/delete-all are absent until the pencil is clicked; clicking the pencil reveals them; clicking a per-item delete deletes that plan and keeps edit mode on; clicking empty page area exits edit mode; the card-header trio is visible in both states; collapsing the inventory shows a 2× backpack and no number.

---

## B. Inventory — per-item slot picking + glow

### B1. Slot-pick badges
- Each inventory row renders two badges, visible **on row hover only** and **hidden when `editMode` is true**:
  - **"1"** badge — blue (`--cmp-uma1-accent`), loads that plan into **uma1**.
  - **"2"** badge — red (`--cmp-uma2-accent`), loads that plan into **uma2**.
- Badge clicks call a new page handler `loadPlanIntoSlot(planId, 'uma1' | 'uma2')` and `stopPropagation` (so the row-body click in B2 does not also fire).

### B2. Row-body click → focused slot
- Clicking the **row body** (anywhere outside the two badges) loads that plan into the **currently focused slot** (`focused`).
- This fixes the current bug where, with the uma2 sidebar open, the inventory could only load into uma1. Now: focused uma2 + row-body click → loads into uma2.

### B3. Loaded-row glow
- The row whose plan id equals `uma1Plan?.id` gets a **blue glow + tint** (`.is-uma1`); the row equal to `uma2Plan?.id` gets a **red glow + tint** (`.is-uma2`). Both may be present on different rows simultaneously. (The current single `.is-active` blue style is replaced by these two slot-aware classes.)

**Acceptance:** Hovering a row reveals "1"/"2" badges (not in edit mode); clicking "1" loads uma1, "2" loads uma2 regardless of current focus; clicking the row body loads the focused slot; the uma1-loaded row glows blue and the uma2-loaded row glows red at the same time.

---

## C. Collision → auto-duplicate

- When `loadPlanIntoSlot(id, slot)` is called and `id` already equals the **other** slot's plan id, the plan is **duplicated** (`copyPlanInto` → fresh `crypto.randomUUID()` id, `planNumber` reset, blank name) and the **copy** is loaded into the target slot. The original stays in the other slot. The two slots therefore never share an id.
- Pure predicate `shouldDuplicateForSlot(id, slot, uma1Id, uma2Id): boolean` — returns true iff loading `id` into `slot` would collide with the opposite slot's current plan id.
- Persistence of the duplicate follows the **target slot's** normal rules:
  - target **uma2** → `setUma2Plan(copy)` (session-scratch; autosaves + autonames as it already does).
  - target **uma1** → loaded as the active uma1 plan with the fresh id; it is **unsaved** (not yet in the saved set) until the user Saves. `activePlanId` is set to the fresh id.
- Picking a plan into the slot it is **already** in is a no-op (no duplicate, no reload side effects).

**Acceptance:** With plan X loaded in uma1, clicking "2" on X's row creates a distinct-id copy in uma2 (X unchanged in uma1); editing the uma2 copy does not change uma1. With plan Y in uma2, clicking "1" on Y's row creates a distinct-id copy in uma1. Clicking "1" on the row already in uma1 does nothing.

---

## D. Sidebar — copy buttons + blank face

### D1. Blank uma2 face
- The empty-uma2 face button label becomes **"⇋ Duplicate Uma 1"** (currently "⤓ Duplicate uma1 →"). Same `onDuplicateUma1ToUma2` action.

### D2. Action row with relocated Replicate
- The standalone `.cmp-copy-row` is **removed**. Replicate moves into the action row alongside Save / Save As / New.
- **Focused uma1:** `[Replicate uma2] [Save] [Save As] [New]`.
  - `Replicate uma2` = copy uma2 → uma1 (the existing `onReplicateUma2ToUma1`, confirm-gated, preserves uma1 id/planNumber). Disabled when uma2 is empty.
  - Save / Save As / New behave exactly as today (uma1).
- **Focused uma2:** `[Replicate uma1] [New]`, with **Save / Save As disabled**.
  - `Replicate uma1` = copy uma1 → uma2 (`onDuplicateUma1ToUma2`).
  - `New` clears the uma2 scratch slot (`setUma2Plan(null)`), returning to the blank-uma2 face.
- The label text for the replicate button is computed from `focused` (the opposite slot number).

**Acceptance:** Focused uma1 shows the four-button row with "Replicate uma2"; focused uma2 shows "Replicate uma1" + "New" with Save/Save As visibly disabled; the old separate copy-row no longer renders.

---

## E. Sidebar — track confirm + indicators

### E1. Track-change confirm flow
- **Trigger:** an explicit **inventory load into the focused slot** (B2/B1) or **flip between uma1/uma2** (the UMA1/UMA2 toggle) that would change the displayed **course**, while **auto-apply-track is ON** and a prior track already exists (not the very first load). The **Replicate / Duplicate** copy buttons (D2) are deliberate copy actions that carry their own intent (and Replicate has its own confirm) — they are **not** track-confirm triggers and apply their resulting track directly.
- **State:** add `trackOverrideRef: CmRefV2 | null` to the page. The displayed track is:
  - `displayedTrackRef = trackOverrideRef ?? autoFollowRef`, where
  - `autoFollowRef = (autoApplyInventoryTrack && !(focused === 'uma2' && uma2Plan === null)) ? focusedPlan.cmRef : uma1Plan.cmRef` (the current `trackCmRef` formula).
- **Pure decision helper** `trackChangeNeedsConfirm({ autoApply, hadPriorTrack, prevCourseId, nextCourseId }): boolean` = `autoApply && hadPriorTrack && prevCourseId !== nextCourseId`. Course comparison uses `cmRef.courseId` (no narrowing needed per the `CmRefV2` contract). A `tracksDiffer(a, b)` convenience wraps the id compare.
- **On a triggering transition:** pin the track to the *old* ref immediately (`trackOverrideRef = oldDisplayedRef`) so it does not visibly jump, and open the confirm popup. The focus/load change itself proceeds regardless.
  - **Confirm (right button):** `trackOverrideRef = null` (resume auto-follow → track moves to the new course) **and** flash the "Track changed!" transient (E2).
  - **Cancel (left button):** leave `trackOverrideRef` pinned to the old ref (track stays).
- The confirm popup reuses the existing inline-confirm visual pattern (like the replicate confirmation), with **Cancel on the left, Confirm on the right**.
- When auto-apply is OFF, or the course is unchanged, or it is the first load: no popup; `trackOverrideRef` stays null and the track auto-follows as today.

### E2. "Track changed!" transient
- When a track change is **confirmed** (E1) or otherwise applied through the auto-apply path due to a course change, show **"Track changed!"** in **orange** within the track header (`.cmp-track-head`), auto-fading after **3 s**. Implemented with a timestamped state + a CSS fade; the timer is cleared/reset on unmount and on a new change.

### E3. Track-mismatch indicator
- A small chip on the row **above the plan name** in the sidebar shows when uma1's and uma2's **courses differ** (`tracksDiffer(uma1Plan.cmRef, uma2Plan.cmRef)`), e.g. `⚠ Different track from uma{opposite}`.
- Hidden when the courses match **or** when uma2 is empty (`uma2Plan === null`).

**Acceptance:** With auto-apply ON and a Tokyo track loaded, loading a Kyoto plan into the focused slot opens the confirm (Cancel left / Confirm right); Cancel keeps Tokyo and still loads the plan; Confirm switches to Kyoto and flashes orange "Track changed!" that fades in ~3 s. Flipping uma1↔uma2 across differing courses triggers the same confirm. With uma1 on Tokyo and uma2 on Kyoto, the sidebar shows the mismatch chip above the name; setting both to Tokyo hides it.

---

## F. Sidebar — stat input fix + full red accent

### F1. Stat "0" clearing bug
- **Current bug:** stat fields are `<input type="number" value={stats[key]}>` committing `Number(e.target.value)`; clearing the field yields `Number("") = 0` so a "0" sticks, and typing into a "0" produces e.g. `01200`.
- **Fix:** a new `StatInput` subcomponent backs each field with **local string draft state**:
  - `draft` initializes from the stat value; kept in sync when the underlying value changes externally (plan load) via an effect comparing the committed numeric value.
  - **onChange:** `setDraft(raw)`; commit `statValueFromDraft(raw)` to the plan **live** (so charts/checkers react while typing).
  - **onBlur:** if the draft is empty/invalid, set draft to `'0'` and commit `0`; otherwise set draft to the sanitized form.
- **Pure helpers** in `statInput.ts`:
  - `sanitizeStatDraft(raw: string): string` — keep digits only, strip leading zeros (but allow a single `'0'` and allow `''` during editing).
  - `statValueFromDraft(raw: string): number` — `Number(sanitizeStatDraft(raw) || '0')`.
- Empty mid-edit is allowed (field can be blank); the value only normalizes to `0` on blur.

**Acceptance:** Selecting all + deleting clears the field to empty (not "0"); typing `1200` into a just-cleared field yields `1200` (not `01200`); blurring an empty field shows `0` and stores `0`; a leading-zero paste like `0850` normalizes to `850`.

### F2. Full red accent for uma2
- `--uma-accent` (blue `#5aa0ff` for uma1, red `#e0564f` for uma2) is currently set inline only on `.cmp-flip-card` and applied to the flip-tab background + card inset ring. Extend it so the accent is also set on the **sidebar root scope** (e.g. a `data-uma` attribute on the sidebar container) and applied to **input zones**:
  - name field, stat fields, aptitude controls, and other sidebar inputs get a **subtle accent-tinted background** (`color-mix(in srgb, var(--uma-accent) ~8%, var(--bg-1))`) and an **accent focus ring/border**.
- uma1 stays blue, uma2 turns the whole input surface red-tinted (not just the border).

**Acceptance:** Flipping to uma2 tints the name + stat + aptitude input backgrounds red and gives them a red focus ring; flipping back to uma1 restores blue/neutral.

---

## G. Delete behavior fix

- **Current bug:** deleting an inventory item replaces uma1's loaded plan ("auto-load uma2/last-saved into uma1"), and the sidebar "saved" indicator can go stale after a delete.
- **Fix `deleteSavedPlan(id)`** in `ActivePlanContext`:
  - Remove the plan from Dexie **and** from the in-memory `savedPlans` state (so derived `isSaved` recomputes).
  - **Never** modify `uma1Plan`, `uma2Plan`, `activePlanId`, or `focused`. Whatever is loaded in either sidebar slot stays loaded.
  - If the deleted record was the **source** of a loaded slot, that slot's plan is now absent from the saved set, so `isSaved` derives to **false** ("unsaved") — this is the saved-indicator fix.
- Symmetric for uma1-source and uma2-source deletions; deleting an unrelated record changes neither loaded plan nor the indicator.

**Acceptance:** Deleting the inventory record currently loaded in uma1 keeps uma1 in the sidebar and flips the indicator to "unsaved"; deleting uma2's source keeps uma2 loaded and updates the indicator; deleting an unrelated record leaves both loaded plans and the indicator untouched.

---

## File structure

**New files:**
- `src/features/cm-planner/statInput.ts` — `sanitizeStatDraft`, `statValueFromDraft` (pure) + `statInput.test.ts`.
- `src/features/cm-planner/StatInput.tsx` — stat field with local draft buffer.
- `src/features/cm-planner/trackChange.ts` — `tracksDiffer`, `trackChangeNeedsConfirm` (pure) + `trackChange.test.ts`.
- `src/features/cm-planner/slotLoad.ts` — `shouldDuplicateForSlot` (pure) + `slotLoad.test.ts`. *(Small; may be folded into the context if it proves trivial, but keep the predicate unit-tested.)*

**Modified:**
- `PlanInventoryCard.tsx` — backpack icon, collapsed sliver (no count), edit-mode state/toggle/dismiss, hide/show group+item buttons, "1"/"2" badges, row-body→focused load, blue/red glow classes.
- `ActivePlanContext.tsx` — `loadPlanIntoSlot(id, slot)` with collision duplicate; fix `deleteSavedPlan` (no loaded-plan mutation + savedPlans refresh).
- `CmPlannerPage.tsx` — wire `loadPlanIntoSlot` to the inventory; `trackOverrideRef` state + confirm flow + "Track changed!" transient; pass `focused`/slot handlers + `uma1Plan.id`/`uma2Plan.id` to the inventory.
- `PlannerSidebar.tsx` — blank-face label, relocated/relabeled action row, `StatInput` swap, track-mismatch chip, `data-uma` accent scope hooks.
- `cm-planner.css` — backpack sizing + 2× sliver, edit-mode visibility, "1"/"2" badge styling, row glow (blue/red), accent-tinted input backgrounds + focus rings, "Track changed!" transient, mismatch chip, confirm-popup layout.

**Reused:** `copyPlanInto` (cmPlanCopy.ts), `useDismissOnOutside`, `generatePlanName`, the inline-SVG icon convention, the existing inline-confirm pattern.

---

## Testing strategy

- **Pure helpers (unit):** `sanitizeStatDraft` / `statValueFromDraft` (blank→0, leading-zero strip, non-digits, empty-during-edit); `tracksDiffer` + `trackChangeNeedsConfirm` (truth table over autoApply × hadPriorTrack × course-equality); `shouldDuplicateForSlot` (collision matrix).
- **Component (Testing Library):** edit-mode show/hide + dismiss-on-outside + stay-on-action-click; "1"/"2" badge load routing + row-body→focused load; blue/red glow on the right rows; `StatInput` clear/blur/leading-zero behavior; action-row composition per focus; mismatch chip visibility; delete-keeps-loaded + indicator-updates.
- **CSS-only bits** (accent tint, glow color, transient fade) are visual and not unit-tested; verified live.
- **Regression:** `CmPlannerPage.test.tsx` must stay green on every page-touching task (lesson from the redesign — its key-aware settings mock and inventory-collapsed default matter). Trust `pnpm build` + `pnpm typecheck`; re-run a failing UI test file once before treating a failure as real (dev-server HMR flake).

---

## Out of scope

- **Drag-and-drop** into the sidebar (deferred follow-up).
- Any change to **uma2's session-scratch persistence** (still cleared on refresh, never writes `activePlanId`).
- Engine / `sim:build` work, Dexie schema changes, the dedicated full race-sim page.

## Open questions

None — all forks resolved (see Decisions).
