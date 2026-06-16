# 2026-06-16 M4 Planner Sidebar Slice

## Shipped

`/` now pairs the vendored umalator race-track + race setup with a real `CmPlan` sidebar.

- `PlannerSidebar` is mounted in `CmPlannerPage` beside the track/track setup.
- Runner selection searches Global umas by uma name, epithet, and native unique skill name; ArrowUp/ArrowDown/Enter keyboard selection is supported.
- Selecting an uma writes `umaId` and native `uniqueSkillId` into the active plan. Native unique is fixed to the uma and intentionally has no SP, fixed, or add-target control.
- Role moved into the runner block; strategy remains in Plan Target as the single selected style.
- Stats are compact editable number inputs with in-game stat icons and no spinner/rank clutter.
- Plan Target stores surface/distance/style goals in `sparkGoals.pink`, with active distance defaulting to A/S, active surface to A, and active style to A. Non-active aptitude goals can still be set explicitly.
- Mood defaults to Great and is an icon-only dropdown in the Plan Target block.
- Wishlist supports adding skills from the shared `SkillPicker`; the picker has ArrowUp/ArrowDown/Enter navigation. Wishlist rows use in-game-like white/gold/unique skill plates, have no priority star, and keep the remove button fixed-height when details expand.
- Skill details are collapsible and load raw umalator technical data on demand: condition lines split on `&`, raw effect chips remain type/modifier/target placeholders, and duration/cooldown are highlighted.
- A light app theme was applied while keeping the in-game skill/stat/mood visual assets.

## Key Files

- `src/features/cm-planner/CmPlannerPage.tsx`
- `src/features/cm-planner/PlannerSidebar.tsx`
- `src/features/cm-planner/SkillDetailDisclosure.tsx`
- `src/features/cm-planner/skillTechnicalDetails.ts`
- `src/features/cm-planner/cm-planner.css`
- `src/core/simBuild.ts`
- `src/features/skill-planner/SkillPicker.tsx`
- `src/features/data/GameIcon.tsx`
- `scripts/build-icons.ts`
- `public/data/icons/ui/`

## Notes For The Next Agent

- This is the left planner/sidebar slice only. The full Skill chart and Uma chart are still not on the rebuilt `/` page; `/legacy` still owns the engine-ranked chart.
- `skillTechnicalDetails.ts` lazy-loads `@/sim/vendor/umalator.bundle.mjs` directly to get raw skill alternatives and unique-skill sources. The bundle is still also pulled by sim modules during production build, so Vite reports the existing chunk warning.
- UI icon assets are generated from the local uma-tools icon dump through `scripts/build-icons.ts`; do not hand-edit `public/data/icons/ui/`.
- The current visual direction is light shell + in-game assets for compact stat/skill/mood elements.

## 2026-06-17 Visual/Data Follow-Up

The sidebar was tightened after browser review:

- The plan target tiles are narrower, right-aligned, and use two equal-width boxes for Style; visible filler text like "style" / "target" was removed.
- Mood is an icon-only compact dropdown aligned with Track / Distance / Style rows.
- The stats block no longer uses the green in-game table frame. It now uses a light-theme table, color-coded stat icons, centered transparent number inputs, and a growth row below each stat.
- Wishlist rows now have a borderless red cross remove action, a header-level Clear button, hidden dropdown glyphs on skill variant selectors, and fixed-height remove controls when skill details expand.
- New `UmaRecord.baseAptitudes` and `UmaRecord.statGrowth` fields are generated from GameTora character card `aptitude` / `stat_bonus` data. The sidebar uses them for selected-uma growth display and pink-spark requirement chips, e.g. `Turf ★2` / `Medium ★1`.
- `makeDefaultPlan()` now leaves the plan name blank; auto-naming remains an explicit button action.
- `scripts/build-icons.ts` has a Windows-safe icon directory swap fallback for EPERM rename failures during `pnpm data:build`.

## Verification

- `pnpm.cmd typecheck`
- `pnpm.cmd build`
- `pnpm.cmd data:build`
- `pnpm.cmd vitest run src/features/cm-planner/PlannerSidebar.test.tsx src/app/ActivePlanContext.test.tsx scripts/build-umas.test.ts scripts/outputs.test.ts scripts/build-icons.test.ts`
- Final visual/data polish spot-checks: `pnpm.cmd vitest run src/features/cm-planner/PlannerSidebar.test.tsx`, `pnpm.cmd typecheck`, and a Playwright computed-style check for colored stat icons + borderless stat inputs.
