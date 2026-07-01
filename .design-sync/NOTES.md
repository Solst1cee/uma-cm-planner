# design-sync notes — uma-cm-planner

Repo-specific gotchas for future syncs. Read this before re-syncing.

## Shape & build

- **This is a private Vite app, not a component library** — no `dist/`, no library `exports`. We run the **package shape with a custom synthetic entry** (`.design-sync/entry.ts`, wired via `cfg.entry`) instead of the converter's `export * from <all src>` fallback (which would pull the whole app: router, Dexie, engine).
- The entry re-exports a curated, **engine-free** set of presentational components + `GameDataProvider`. `cfg.componentSrcMap` pins each component's src path (no shipped `.d.ts`, so props are extracted from source — weaker contracts, expected).
- Build: `node .ds-sync/package-build.mjs --config .design-sync/config.json --node-modules ./node_modules --entry .design-sync/entry.ts --out ./ds-bundle` then `node .ds-sync/package-validate.mjs ./ds-bundle`.
- `PKG_DIR` resolves to the repo root (the walk-up from `.design-sync/entry.ts` finds the root `package.json`). componentSrcMap paths are repo-root-relative.

## Provider / data

- Components read game data from a `useGameData()` React context. The real `GameDataProvider` (`src/features/data/gameData.ts`) fetches `public/data/*.json` at runtime BUT its **initial state is already seeded with `FIXTURE_DATASETS`** (`@/core/fixtures`). So wrapping previews in it (`cfg.provider`) gives fixture skills/cards/umas with no server needed; the runtime fetch fails in headless → fixture fallback (same data).
- `import.meta.env.BASE_URL` (top-level in gameData.ts) is covered by the converter's `IIFE_IMPORT_META_DEFINE` (`BASE_URL:"/"`), so the bundle doesn't crash on load.
- **Icons render as placeholders**: `iconManifest` is `null` in fixture mode, so `GameIcon` degrades to its placeholder (no served `.webp` assets). This is honest/deterministic; real icons would require serving `public/data/icons` + a manifest.

## Excluded from this import (engine-coupled — pull the 5.2 MB umalator bundle)

esbuild inlines lazy `import()` under iife, so any component with a transitive engine import bloats the **shared** bundle for every design. Excluded for that reason:
- **RaceSetup** — lazy `import('@/sim/courseCatalog')` → `coursesService` from `umalator.bundle.mjs`.
- **RaceTrackView** — lazy `import('@/sim/courseData')` → `./adapter` (engine). (Also vendored umalator SVG, not the app's own design language.)
- **SkillDetailDisclosure** (effect-chips) — `skillTechnicalDetails.ts` lazy-imports `umalator.bundle.mjs`; the chips also only render after a click + async load (internal `open` state, no prop), so they can't render in a static screenshot anyway.

Follow-up to include any of these: externalize the engine in the bundle step, or extract a presentational `EffectChip`/track that takes data via props.

## Interaction-gated previews

- **SearchPicker** and **SkillPicker** only render their results list once a query is typed (internal `useState` query — no prop to pre-fill). Static previews therefore show the labeled search field (idle state) only; the row rendering (sub-text, badges, "added" marker, icons) is not statically capturable. Graded `good` on the idle state — this is the component's real idle render, not a broken one.
- **GameIcon** renders its placeholder (not a real icon) in fixture mode — `iconManifest` is `null`. Expected, not a warn to chase.

## Known render warns

- `[RENDER_BLANK]` on an *unauthored* GameIcon floor card (tiny PNG) appeared before GameIcon got an authored preview — resolved by authoring. Not a standing warn.

## Re-sync risks

- The curated set + `entry.ts` are hand-maintained. If a component's source moves or its props change, update `componentSrcMap` / `entry.ts`.
- Icons are placeholder-only by design (see above) — not a regression.
- Tokens/styling come from `app.css` + feature CSS bundled via `entry.ts` imports. If a new component needs CSS from a file not imported there, add the import.
