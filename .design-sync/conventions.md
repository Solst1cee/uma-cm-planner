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
