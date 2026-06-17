# M4 Sidebar Polish Handoff (2026-06-18)

This note captures the user-accepted edits made in the long M4 sidebar polish session so future work can resume without rereading the chat.

## Scope

Touched areas:

- `src/features/cm-planner/PlannerSidebar.tsx`
- `src/features/cm-planner/cm-planner.css`
- `src/features/cm-planner/PlannerSidebar.test.tsx`
- `src/core/aptitudeInheritance.ts`
- `src/core/aptitudeInheritance.test.ts`
- `scripts/build-icons.ts`
- `scripts/build-icons.test.ts`
- `src/core/icons.ts`
- `public/data/icons/`
- `docs/provenance.md`

## Pink Spark Mechanics

Career-start pink aptitude inheritance is now modeled as rank steps with cumulative star thresholds:

| Rank increase | Required same pink stars |
|---:|---:|
| +1 | 1 |
| +2 | 4 |
| +3 | 7 |
| +4 | 10 |

Inheritance can raise at most `+4` ranks at career start. Any remaining gap to the desired target must be shown as mid-run pink spark procs.

Examples:

- `C -> A`: needs `+2`, so show only `End Closer star 4`; no mid-run row.
- `C -> S`: needs `+3`, so show only `End Closer star 7`; no mid-run row.
- `G -> A`: career-start can only reach `C` with `+4`, so show `End Closer star 10` and a separate `Mid-run spark` row with `End Closer x 2`.

Important UI wording accepted by the user:

- The main pink spark row should be only `End Closer star 10`.
- Do not append explanatory text like `-> C +2 run` inside that chip.
- Use a separate row labeled `Mid-run spark`.
- If the target is reachable within the `+4` inheritance range, do not display the mid-run row.

Implementation:

- `pinkAptitudeRequirement(base, target)` lives in `src/core/aptitudeInheritance.ts`.
- The sidebar computes pink chips from selected Uma base aptitudes and current race target aptitudes.
- The mid-run row renders only when `steps === 4` and `inRunStepsNeeded > 0`.

## Runner Search UI

The selected Uma epithet is visually rendered inside the same search control as the Uma name, not as a separate line.

Accepted behavior:

- The real `<input>` value remains the Uma name only, for example `Mejiro Dober`.
- When not editing, an overlay renders `Mejiro Dober` plus the epithet on the same line.
- The Uma name keeps its previous font size.
- The epithet keeps the smaller size, is italic, and baseline-aligns with the Uma name so the bottoms of the text sit together.
- The dropdown result list is absolutely positioned over lower sidebar content and must not push other components down.
- After selecting from the dropdown, clicking the search field again must reopen/edit it without requiring an outside click first.

Implementation details:

- `.cmp-runner-picker` owns the absolutely positioned `.cmp-uma-results`.
- `.cmp-uma-input-overlay` is `pointer-events: none`.
- The input click handler reopens the picker and selects the text.

## Plan Name, Notes, And Save Controls

The top of the Current Uma Plan card now uses three compact rows:

1. Plan name with an `Auto` sliding switch on the right.
2. A note field that starts at one line and grows vertically as needed.
3. Save state on the left, with Auto-save and Save / Save as / New grouped on the right.

Accepted behavior:

- Plan names remain freely editable while `Auto` is off.
- Turning `Auto` on continuously regenerates the name from the current race, Uma, role, strategy, and optional remark, and makes the name field read-only.
- Turning `Auto` off preserves the generated text and unlocks the field.
- Save generates a name only when the field is blank; a nonblank custom name is never replaced.
- Auto-generated names no longer include `Plan N`. Example: `CM15 / Kitasan Black / Ace / Front`.
- Save as treats generated and custom names the same. Name collisions use the first free suffix: `ABC`, `ABC (1)`, `ABC (2)`, filling a missing suffix when possible.
- Notes use the placeholder `note`, are stored in `CmPlan.notes`, and round-trip through JSON export/import.
- Auto-save is a persisted sliding switch and defaults off when no preference exists.
- The saved/unsaved indicator is green/orange at the left with an `8px` inset. Auto-save and the segmented Save / Save as / New actions remain aligned to the right.
- The visible gap from plan-name border to note border and from note border to action-group border is `8px` on both sides.
- Saved identity follows the requested build criteria: same Uma, track/distance, stats, target aptitudes, and wishlist skill IDs. Display name and note text do not define a separate build version.
- Save overwrites the active plan. Save as creates a new plan id and resolves any duplicate name with the suffix rule above.
- New creates a generated Kitasan Black draft for the current race: stats `1200 / 900 / 1000 / 600 / 1100`, Turf A, current distance S, Front Runner A, Great mood, and no wishlist skills.

Implementation:

- Name generation and collision handling live in `src/core/planName.ts`.
- Saved-build identity lives in `src/core/planIdentity.ts`.
- Auto-save state, Save, Save as, New draft selection, and inventory refresh live in `src/app/ActivePlanContext.tsx` and `src/features/cm-planner/CmPlannerPage.tsx`.
- The note field and controls live in `PlannerSidebar.tsx`; their compact layout is in `cm-planner.css`.

## Stat Box Icon Colors

The stat icon assets are white glyphs with their game-like color supplied by CSS. The accepted palette is:

- Speed: blue
- Stamina: red-orange
- Power: amber
- Guts: pink
- Wit: green

Stamina and Guts had been assigned each other's colors; the final CSS restores Stamina to `#ef5a48` and Guts to `#f05f9f`.

## Sidebar Card Scrolling And Cropping

The sidebar itself is a sticky shell; only the inner `cmp-plan-card-body` scrolls when content exceeds viewport height.

Reason:

- Scrolling the whole `aside.cmp-sidebar` caused the rounded card frame to appear cropped or visually cut off at the top/bottom.
- Keeping the card frame sticky and scrolling only the body preserves the rounded border.

Implementation:

- `aside.cmp-sidebar` has sticky positioning, max height, rounded clipping behavior, and no body-level scroll.
- `.cmp-sidebar > .cmp-plan-card` is a flex column with inherited max height.
- `.cmp-sidebar > .cmp-plan-card > .cmp-plan-card-body` has `overflow-y: auto`.

## Wishlist Clear Button

The wishlist clear action was changed from a text button to a transparent bordered icon button.

Accepted details:

- Uses a trash/bin icon.
- Transparent container with border.
- Icon centered vertically in the section title row.
- Accessible label/title is `Clear wishlist`.

## Uma Portrait Size

The selected runner portrait in the sidebar was increased to `70px`, with additional space from the left border.

Implementation:

- `GameIcon kind="uma"` in the runner card uses `size={70}`.
- `.cmp-portrait-ph` matches `70px`.
- `.cmp-runner-card` provides left inset/spacing.

## Alternate Uma Icon Fix

The alternate portraits existed in `spikes/repos/uma-tools/icons/chara`, but the builder was probing filenames using the app `umaId`.

Actual issue:

- Several Global alt outfits use a different trained icon asset id in the filename.
- Example: T.M. Opera O `[New Year, Same Radiance!]` is app `umaId=101502`, but the source icon is `chara/trained_chr_icon_1015_101510_02.png`.
- Example: Mihono Bourbon `[CODE: ICING]` is app `umaId=102602`, but the source icon is `chara/trained_chr_icon_1026_102613_02.png`.

Fix:

- `scripts/build-icons.ts` now has `UMA_TRAINED_ICON_ID_OVERRIDES`, mirrored from the vendored umalator icon map.
- `umaSourceFile()` resolves `chara/trained_chr_icon_<charaId>_<iconAssetId>_02.png`.
- Regenerated affected `public/data/icons/uma/*.webp`.
- `public/data/icons/icon-manifest.json` now has `_fallbackUmas: []`.
- `docs/provenance.md` now documents these as asset-id overrides, not missing icons.

The 17 override Uma IDs are:

`100402`, `100502`, `101402`, `101502`, `101702`, `101802`, `102002`, `102202`, `102402`, `102602`, `103702`, `103802`, `104502`, `105202`, `105602`, `106002`, `106102`.

## Verification

Last known green commands:

```sh
pnpm.cmd vitest run src/features/cm-planner/PlannerSidebar.test.tsx scripts/build-icons.test.ts src/core/aptitudeInheritance.test.ts
pnpm.cmd vitest run src/core/planName.test.ts src/core/planIdentity.test.ts src/app/ActivePlanContext.test.tsx src/features/cm-planner/CmPlannerPage.test.tsx
pnpm.cmd typecheck
```

The local dev server was responding at:

```txt
http://127.0.0.1:5177/
```

Final wrap-up verification on 2026-06-18:

- Full Vitest suite: 75 files, 545 tests passed.
- `pnpm.cmd build`: typecheck and production Vite build passed.
