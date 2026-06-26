# Uma CM Planner UI — conventions

A light-theme, mobile-first React UI for an Umamusume Champions Meeting build
planner. No CSS-in-JS and no styling props — components take **data props**, and
all visual styling comes from **global CSS classes + CSS custom-property tokens**
(reachable through `styles.css`, which `@import`s `_ds_bundle.css`). Read
`styles.css` and a component's `.prompt.md` + `.d.ts` before composing it.

## Setup / wrapping

Wrap any tree that uses game data in `GameDataProvider`
(`window.UmaCmPlanner.GameDataProvider`). `GameIcon`, `BuildCards`, `SkillPicker`,
and `PlanHeaderPanel` call `useGameData()` and **throw** ("useGameData must be used
inside <GameDataProvider>") without it. `TimelineEntryCard`, `TimelineDetailPanel`,
and `SearchPicker` are pure-props and don't need it — but wrapping is always safe.

```jsx
const { GameDataProvider, TimelineEntryCard } = window.UmaCmPlanner;
<GameDataProvider>
  <main style={{ background: 'var(--bg-0)', color: 'var(--fg)', padding: '0.75rem' }}>
    <TimelineEntryCard entry={entry} selected={false} past={false} current onSelect={() => {}} />
  </main>
</GameDataProvider>
```

## Tokens (use these `var(--*)`, never hard-coded colors)

- **Surfaces / text:** `--bg-0` (page), `--bg-1` (card), `--bg-2` (subtle fill),
  `--fg`, `--fg-muted`, `--border`, `--accent`, `--error`.
- **Tier colors** (timeline + coverage badges): `--tier-chain`, `--tier-scenario`,
  `--tier-date_event`, `--tier-hint_strong`, `--tier-hint_weak`, `--tier-random`,
  `--tier-spark`, `--tier-uncovered`.
- **Skill / effect chrome:** `--effect-bg`, `--effect-border`, `--effect-color`,
  `--skill-text`, `--skill-shadow`.

## Class vocabulary (the styling idiom — real names from the bundled CSS)

| Family | Classes |
|---|---|
| Containers | `panel` (card section), `field` (label + input/select), `race-fields` |
| Text | `muted`, `small`, `mono` |
| Badges | `badge`, `tl-badge <tier-label>` (e.g. `tl-badge confirmed`) |
| Timeline | `tl-card` (+ `selected` / `past` / `current`), `tl-detail` |
| SP results | `sp-cards`, `sp-card`, `sp-rank` |
| Target list | `target-list`, `target-row`, `star-btn prio-1…prio-3` |
| Pickers | `picker`, `picker-results`, `picker-row`, `picker-name` |
| Icons | `game-icon`, `game-icon-ph` (placeholder box) |

Style your own layout glue with the token `var(--*)`s above; reuse these classes
for anything that matches a family rather than inventing new names.

## Notes

- `GameIcon` renders a neutral dashed placeholder when no icon asset is available
  — it always augments a visible text label (pass `alt=""` for decorative use).
- Search pickers (`SearchPicker`, `SkillPicker`) reveal their results list only
  after a query is typed.

# UmaCmPlanner (uma-cm-planner@0.1.0)

This design system is the published uma-cm-planner React library, bundled as a single
browser global. All 7 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.UmaCmPlanner`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.UmaCmPlanner.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { BuildCards } = window.UmaCmPlanner;
ReactDOM.createRoot(document.getElementById('ds-root')).render(<BuildCards />);
```

Wrap the tree in the provider — most components read theme/i18n from context:

```jsx
<GameDataProvider>{children}</GameDataProvider>
```

## Tokens

21 CSS custom properties from uma-cm-planner. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **color** (5): `--bg-0`, `--bg-1`, `--bg-2`, …
- **shadow** (1): `--skill-shadow`
- **other** (15): `--fg`, `--border`, `--accent`, …

## Components

### sp-optimizer
- `BuildCards`

### data
- `GameIcon`

### skill-planner
- `PlanHeaderPanel`
- `SkillPicker`

### parents
- `SearchPicker`

### meta-intel
- `TimelineDetailPanel`
- `TimelineEntryCard`
