# Handoff: Spark Filter (Uma CM Planner — parent inheritance picker)

## Overview
A filter panel for the Umamusume Champions Meeting build planner that finds an
**inheritance parent** by the *sparks* present across its 3-member lineage
(the parent + its two grandparents). The user sets minimum star thresholds per
factor and a live "N of 60 parents match" count updates. Sparks are grouped
into three colour families: **Blue (stat)**, **Pink (aptitude)**, and
**Green (unique)**. The design is the "Star Tracks" direction — big, glanceable
star meters grouped into category cards.

## About the Design Files
The files in this bundle are **design references authored in HTML** (a Design
Component prototype that renders with React under the hood). They demonstrate the
intended look, layout, and interaction — they are **not production code to copy
verbatim**. The task is to **recreate this design inside the target codebase's
existing environment** (the real `uma-cm-planner` React app) using its
established components, tokens, and patterns. Where this prototype hand-rolls a
piece the real app already has (e.g. `SearchPicker`), use the app's real
component. If implementing somewhere without an environment yet, pick the most
appropriate framework and port the design faithfully.

## Fidelity
**High-fidelity.** Final colours, typography scale, spacing, star mechanics, and
interactions are all specified below and should be reproduced closely. Styling in
the prototype is driven by the design-system tokens (`var(--*)` from
`_ds_bundle.css`); use those same tokens rather than the raw hex fallbacks where a
token exists.

## The core domain model (READ FIRST — the interactions depend on it)
Each candidate parent ("veteran") in the box has, per factor, two numbers:
- **Parent / legacy (own)** — the parent's *own* spark level, **0–3★**.
- **Total / lineage** — the summed spark level across the 3-member lineage,
  **0–9★** for blue/pink, **0–3★ for green (unique)**.

Filter rules enforced by the UI:
1. **At most 3 sparks per colour** (one per lineage member). Once 3 factors in a
   colour are active, the remaining add-buttons in that colour are disabled
   (greyed, `not-allowed`) and the green search is hidden.
2. **Total ≥ Parent** always (raising Parent bumps Total up to match; lowering
   Total cannot go below Parent).
3. Tapping a star sets a **minimum threshold**; tapping the currently-set star
   toggles it down by one.
4. A candidate matches when, for every active filter,
   `candidate.legacy[id] >= filter.parent` **and**
   `candidate.total[id] >= filter.total`.

## Screens / Views
Single panel, max-width **560px**, centered, vertical stack, `gap: 12px`,
padding `16px 16px 56px`. Mobile-first; works responsively at desktop widths too.

### 1. Header
- Small vertical accent bar (`8×20px`, radius 3, `var(--tier-spark, #e0a94a)`) +
  `h1` "Filter by spark" (19px / 800).
- Sub line (muted, small, indented 16px): "Match a parent by the sparks across
  its 3-member lineage."

### 2. Summary bar (sticky, `class="panel"`, `top: 8px`, z-index 5)
- Box shadow `0 4px 14px -8px rgba(20,25,40,.28)`.
- Row: **match count** (32px / 800, tabular-nums, `var(--accent)`) + "parents
  match" (13px / 700) / "of 60 in your box" (muted small). **Reset all** button
  pushed right (pill, `var(--bg-2)` bg, `var(--border)`, muted text, 12px/700) —
  only shown when ≥1 filter active.
- **Active-filter chips** (wrap, `gap: 6px`), each: pill with
  `1px solid color-mix(in srgb, TONE 35%, var(--border))` border,
  `color-mix(in srgb, TONE 8%, #fff)` bg, 12px. Contents: factor **name** in the
  category colour (`color-mix(in srgb, TONE 60%, var(--fg))`, 700), then the
  requirement stars: **gold** `{parent}★` (if parent>0) and, when total>parent,
  the category-colour `{total}★`; a `✕` remove button.
- Chips are **sorted** into canonical order: blue first (Speed, Stamina, Power,
  Guts, Wit), then pink in surface→distance→style order (Turf, Dirt / Sprint,
  Mile, Medium, Long / Front, Pace, Late, End), then green (UNIQUES order).

### 3. Category cards (Blue, Pink, Green) — one each
Card: `1px solid var(--border)`, radius 14, `var(--bg-1, #fff)`, overflow hidden.
- **Header bar** (`padding: 9px 13px`, white text) with a category gradient:
  - Blue: `linear-gradient(90deg,#3b82f6,#2563eb)`, title **"STAT"**
  - Pink: `linear-gradient(90deg,#ec4899,#db2777)`, title **"APTITUDE"**
  - Green: `linear-gradient(90deg,#22c55e,#16a34a)`, title **"UNIQUE"**
  - Title 13px / 800, letter-spacing .04em.
  - Right side: **3 member pips** (`16×8px`, radius 3, `1px solid rgba(255,255,255,.5)`);
    filled = solid white, empty = `rgba(255,255,255,.32)`. Filled count = number
    of active sparks in that colour.
- **Body** (`padding: 11px 13px`, column, `gap: 11px`): active factor rows, then
  add-controls.

#### Active factor row — Blue / Pink layout (two lines)
Container: column card, `padding 10px 11px`, radius 11,
`1px solid color-mix(in srgb, TONE 30%, var(--border))` border,
`color-mix(in srgb, TONE 5%, #fff)` bg. Inner is a **row** (`align-items:flex-start`, `gap:12px`):
- **Name** on the left — fixed `width: 70px`, 15px/700, category colour
  (`color-mix(in srgb, TONE 60%, var(--fg))`), ellipsis, `margin-top:2px`.
- **Right column** (`gap: 8px`), two lines:
  - Line 1 — label **"Parent"** (`width:44px`, 9px/800, `#b8860b`) + **legacy meter**.
  - Line 2 — label **"Total"** (`width:44px`, 9px/800, `#7c8aa0`) + **total meter**.
- **Remove ✕** pushed right (`var(--error)`, 14px).

**Legacy meter** = 3 stars in a row, 20px:
- filled `★` gold `#eab308`; empty `☆` `#c9d1dd`; disabled/out-of-cap `#e6e9ef`.
- Tapping star *n* sets parent = n (toggles to n−1 if already n).

**Total meter** = **3 member-slot boxes × 3 stars** (9 total), 17px stars:
- Boxes have `padding 3px 5px`, radius 7, **transparent background**.
- **First box dashed border**, other two solid; border
  `color-mix(in srgb,#8595ab 55%,var(--border))` when that box has any filled
  star, else `var(--border)`. Out-of-cap boxes drop to `opacity:.45`.
- Star colours: within the legacy portion → gold `#eab308`; filled beyond legacy
  → **category colour** `color-mix(in srgb, TONE 60%, var(--fg))`; empty
  `#c9d1dd`; out-of-cap `#eceef2`.
- Tapping star *n* sets total = n. As a factor consumes members (every 3 total
  stars = 1 member), the other factors' available boxes shrink.

#### Active factor row — Green layout (distinct, compact)
Row is a single centered flex (`align-items:center`, `gap:11px`):
- **Uma icon** on the left, vertically centered across both lines: `38×38px`
  circle, `var(--bg-2)` bg, `1px solid var(--border)`, containing an 18px
  rounded "head" silhouette (`border-radius:50% 50% 45% 45%`,
  `color-mix(in srgb,#16a34a 40%,var(--fg-muted))`). **In the real app, replace
  with the actual uma character portrait / `GameIcon`.**
- **Content column** (`flex:1`, `gap:6px`):
  - Line 1: full skill **name** (14px/700, green colour, may wrap) + `✕` remove.
  - Line 2: **Parent** meter and **Total** meter side by side (`gap:16px`), both
    at 15px stars. **Green Total is capped at 3★** and rendered as a single
    3-star row (no member boxes).

#### Add controls
- Blue / Pink: **add chips** (wrap, `gap:6px`), pill `"+ Name"`, 12.5px/700,
  `1px dashed color-mix(in srgb, TONE 45%, var(--border))`, text
  `color-mix(in srgb, TONE 60%, var(--fg))`, white bg. When the colour's 3
  members are spent, chips become disabled: `not-allowed`, `var(--bg-2)` bg,
  `var(--border)`, `var(--fg-muted)`, `opacity:.5`.
- Green: the design-system **`SearchPicker`** (`UmaCmPlanner.SearchPicker`) —
  `placeholder="Search unique skill…"`, `items=[{id,name}]`, `onPick(id)`.
  Results reveal after typing; filters on `item.name`. Hidden once 3 green sparks
  are active.

## Interactions & Behavior
- Star tap → set/adjust threshold (see model rules). Chip `✕` / row `✕` → remove
  that filter. **Reset all** → clear everything.
- Match count recomputes on every change against the candidate set.
- Add chip disabled + green search hidden when a colour is full (3 sparks).
- No page-level routing; entirely local state.

## State Management
- Single state object: `sparks: { "<cat>:<key>": { legacy: number, total: number } }`
  where cat ∈ {blue, pink, green}. Absence = no filter. Derived per render:
  match count, per-colour member usage, per-factor caps, sorted chips.
- Helpers: `membersFor(total)=ceil(total/3)`, `membersUsed(cat)=Σ over cat`,
  `maxTotal(cat)= min(9, (3−used)*3)` for blue/pink, `3` for green.
- No data fetching in the prototype (uses a synthetic 60-parent roster). In the
  real app, wire the candidate set + factor metadata to game data via
  `GameDataProvider` / `useGameData`.

## Design Tokens
Category tone (the "60% mix" is the dark text/accent colour):
- Blue tone `#2563eb` → text `#1F48A1`; header gradient `#3b82f6→#2563eb`.
- Pink tone `#db2777` → text `#9E2559`; header gradient `#ec4899→#db2777`.
- Green tone `#16a34a` → text `#166535`; header gradient `#22c55e→#16a34a`.
- Star gold `#eab308`; label gold `#b8860b`. Neutral silver labels `#7c8aa0` /
  `#8595ab`. Empty star `#c9d1dd`; disabled star `#e6e9ef` / `#eceef2`.
- Tokens from the DS (`_ds_bundle.css`): `--bg-0/1/2`, `--fg`, `--fg-muted`,
  `--border`, `--accent`, `--error`, `--tier-spark`.
- Radii: cards 14, factor rows 11, meter boxes 7, chips/pills 999.
- Type: title 19/800, header 13/800, match count 32/800, star meters 15–20px,
  micro labels 9/800.

## Assets
- No image assets. The green "uma icon" is a CSS placeholder — swap for the real
  character portrait (`UmaCmPlanner.GameIcon` or the app's portrait asset).
- Uses the DS `SearchPicker` component from `_ds_bundle.js`.

## Screenshots
See `screenshots/`:
- `01-empty.png` — default state, no filters (60/60 match).
- `02-active-filters.png` — Speed (own 2★ / lineage 5★) + Turf active; summary
  chips, member pips, and the blue/pink two-line meter layout.
- `03-green-and-full.png` — Green "Shadow Break" row (uma icon, Total capped at
  3), and a full blue colour showing disabled/greyed add-chips (Guts, Wit).

## Files
- `Spark Filter - Star Tracks.dc.html` — the chosen "Star Tracks" design (this is
  the one to implement). Logic (`class Component`) holds the full spark model;
  template holds the layout.
- `Spark Filter.dc.html` — the earlier 3-way exploration (Aptitude board /
  Sliders / Star tracks). Reference only.
- Design system: `_ds/uma-cm-planner-ui-.../` (`_ds_bundle.css`, `_ds_bundle.js`,
  `styles.css`). Tokens and `SearchPicker` live here.
