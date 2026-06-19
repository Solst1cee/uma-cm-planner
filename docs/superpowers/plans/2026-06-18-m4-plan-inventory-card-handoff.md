# M4 Plan Inventory Card Handoff (2026-06-18)

This handoff covers the saved-plan inventory rail added to the M4 planner, its companion settings card, and the plan-loading behavior shared with Race setup.

## Scope

Primary files:

- `src/features/cm-planner/PlanInventoryCard.tsx`
- `src/features/cm-planner/CmPlannerPage.tsx`
- `src/features/cm-planner/SkillDetailDisclosure.tsx`
- `src/features/cm-planner/PlannerSidebar.tsx`
- `src/features/cm-planner/UmaChartPanel.tsx`
- `src/features/cm-planner/SkillChartPanel.tsx`
- `src/features/cm-planner/cm-planner.css`
- `src/app/ActivePlanContext.tsx`
- `src/core/types.ts`
- `src/db/exportImport.ts`
- `src/features/planner/race-setup/RaceSetup.tsx`
- related tests in `src/features/cm-planner/`, `src/features/planner/race-setup/`, `src/app/`, and `src/db/`

## Card Placement And Width

Desktop M4 is a three-column layout:

1. Plan Inventory rail
2. Current Uma Plan sidebar
3. Main planner content

The inventory and sidebar rails have equal width. The page maximum width was expanded from the old two-column cap so the main content keeps approximately its previous width after adding the new rail.

The inventory rail contains two sibling cards:

- `Plan Inventory`
- `Inventory settings`

The settings card sits below the inventory list and uses the same card header, border, background, shadow, and width.

## Inventory Structure

Saved plans are grouped into collapsible sections:

- Known presets use their CM number, for example `CM15` or `CM16`.
- Custom plans use the resolved course label, for example `Hanshin 2,200m (Inner)`.

Each row contains:

1. Plan name
2. Raw stats in `speed / stamina / power / guts / wit` order, for example `1000 / 600 / 600 / 400 / 400`
3. Target surface / distance / style aptitude, for example `Turf A / Medium S / Pace A`
4. A right-aligned, vertically centered trash icon matching the wishlist clear/delete visual grammar

Clicking the main row loads the saved plan. Clicking trash deletes it without selecting it.

After a successful inventory load, all expanded skill details collapse automatically. This covers the current Uma's unique skill, wishlist skills, unique-skill chart rows, and acquirable-skill chart rows. Only the skill disclosures close; chart results, chart filters, and parent panel open/closed state remain intact.

## JSON Transfer Toolbar

A right-aligned icon toolbar sits inside the `Plan Inventory` card header, ordered:

1. Upload plan JSON
2. Download all plans as ZIP
3. Delete all plans

The actions are icon-only at rest. Hovering or keyboard-focusing an action expands its visible label to `Upload`, `Download all`, or `Delete all` without increasing the shared card-header height.

Upload accepts multiple `.json` files in one selection. Each file may contain one `CmPlan`, an array of plans, or the app's version-2 full backup blob; only validated plans are imported. Import is additive. Free IDs are preserved, while an ID collision receives a new UUID, the next version number, and a collision-safe name instead of replacing local data.

Download all creates `uma-plans.zip` in the browser with one readable, filename-sanitized JSON file per saved plan. `fflate` supplies browser-side ZIP creation. Each inventory row also has a download icon immediately before its trash icon for downloading that plan as plain JSON.

Each collapsible inventory-group header has a separate download action immediately before its collapse caret. It expands to `Download all` on hover/focus and downloads only that group's plans as `<group>-plans.zip`; activating it must not collapse the group.

Delete all does not use a browser modal. Clicking trash changes the toolbar to `Confirm delete all items?` followed by tick and cross buttons. Tick deletes every saved plan and leaves a fresh unsaved Kitasan draft active. Cross or any pointer click outside the toolbar restores the original three icons without deleting.

## Delete Semantics

Deletion goes through `ActivePlanContext.deleteSavedPlan()` and Dexie.

- Deleting a non-active plan only refreshes the saved-plan list.
- Deleting the active plan selects another saved plan when available.
- Deleting the final saved plan leaves `savedPlans` empty and creates an unsaved default active draft.
- The empty inventory shows `No saved plans yet.` and must not retain a stale course group or `1 item` count.

Do not save the fallback draft automatically after deleting the final item; doing so recreates the row the user just removed.

Fresh devices start with the same generated CM15 Kitasan baseline as the New action. On load, an exact untouched legacy starter (blank name/Uma, Pace, old `1000 / 600 / 600 / 400 / 400` stats, no targets or wishlist) is replaced only when it is the device's sole saved plan. Edited and user-created plans are never migrated by this check.

## Inventory Setting

The `Inventory settings` card contains one sliding switch:

`Apply track setup`

Storage key:

```txt
cmPlannerInventoryAutoApplyTrack
```

Accepted behavior:

- Default is on when no saved setting exists.
- The preference is persisted in Dexie settings.
- Toggling on or off is passive and must not immediately change Race setup.
- The preference is evaluated only when the user clicks an inventory item to load it.
- When on, loading applies that plan's saved course, ground, weather, and season.
- When off, loading changes the active Uma plan but preserves the currently displayed Race setup.
- Turning the option back on still does nothing until the user clicks a plan again.

## Per-Plan Race Setup

`CmPlan.cmRef` stores:

```ts
{
  cmId;
  cmNumber;
  courseId;
  surface;
  distance;
  condition; // ground
  weather;
  season;
}
```

Ground, weather, and season must be written whenever Race setup changes. They are independent per saved plan, so two plans may share the same course and differ only by weather without overwriting each other.

`RaceSetup` accepts an external `selection` so a clicked inventory plan can update its visible controls. Weather was added as an optional `CmRef` field for backward compatibility. Existing exports without weather remain importable and use the preset/current fallback until saved again.

## Important Interaction Detail

Apply the track from the saved item passed to the click handler, not from a later generic active-plan effect. A broad effect tied to the active plan causes two unwanted behaviors:

- Toggling the preference can unexpectedly change the track.
- Other active-plan updates can reapply track setup without an explicit inventory load.

The explicit inventory-click boundary is the accepted behavior.

The same boundary drives skill-detail collapse: `CmPlannerPage` increments a collapse signal only after `selectPlan()` succeeds, then passes it through the sidebar and both charts to the shared `SkillDetailDisclosure`. Loading the currently active saved plan again must still collapse open skills.

## Verification

Focused commands used during this session:

```sh
pnpm.cmd vitest run src/features/cm-planner/CmPlannerPage.test.tsx src/features/planner/race-setup/RaceSetup.test.tsx
pnpm.cmd vitest run src/features/cm-planner/CmPlannerPage.test.tsx src/app/ActivePlanContext.test.tsx src/db/exportImport.test.ts src/features/skill-planner/PlanHeaderPanel.test.tsx
pnpm.cmd vitest run src/features/cm-planner/CmPlannerPage.test.tsx src/features/cm-planner/PlannerSidebar.test.tsx src/features/cm-planner/UmaChartPanel.test.tsx src/features/cm-planner/SkillChartPanel.test.tsx
pnpm.cmd vitest run src/features/cm-planner/PlanInventoryCard.test.ts src/features/cm-planner/CmPlannerPage.test.tsx src/app/ActivePlanContext.test.tsx src/db/exportImport.test.ts
pnpm.cmd typecheck
pnpm.cmd build
```

Last results:

- Inventory/Race setup focused suite: 22 tests passed.
- Plan/storage regression suite: 61 tests passed.
- Inventory-load skill-collapse suite: 53 tests passed.
- Inventory JSON transfer/delete-all suite: 56 tests passed.
- Typecheck passed.
- Production build passed.
- Browser verification at `http://127.0.0.1:5177/` confirmed equal-width inventory cards, the settings card below the list, and the slider aligned at the right.
