# Design-system foundation (Phase 1) — design

> **Date:** 2026-06-25 · **Status:** design (awaiting implementation plan)
> **Roadmap phase:** [P1 — Design-system foundation](../../roadmap.md#phase-1--design-system-foundation)
> **Spec type:** shared foundation (cross-module), not a single-module feature.

## 1. Context & goal

The four module UIs are functional skeletons far below the [mockups](../../mockups/) (fidelity audit: M4 ~25%, M3 ~25%, M2 ~20%, M1 ~8%). The fastest way to close ~80% of that gap is to build **the one shared visual grammar the four mockups already agree on**, then apply it module by module (P2→P4).

This spec is **Phase 1**: extract that grammar into a hand-built, themeable design system (tokens + component classes + a `/styleguide` reference), and **prove it** by re-expressing M4's existing card chrome through the system with no light-mode regression. It is the foundation the later fidelity phases build on — it is **not** a redesign of any module (that is P2/P4).

### Confirmed decisions (the forks this spec resolves)

The roadmap flagged two decisions as "resolve before building the tokens." Both are now settled (2026-06-25):

1. **Hand-build `design-system.css`** — pure CSS custom-property tokens + component classes, keeping the existing hand-rolled SVG charts. *Not* a component/charting library (React-Bootstrap + ECharts, hakuraku-style). Rationale: the codebase has **zero UI/chart dependencies** today, the mockups **are** plain CSS that translates ~1:1, and the existing charts are tuned to umalator/utools parity (a library rewrite would regress them). Honors P2 (local-first, minimal deps).
2. **Themeable (light + dark)** with **light as the default** — semantic tokens + a `[data-theme]` switch. The mockups define the dark palette (authoritative for dark); a light variant is derived from the current app palette. A Light/Dark/System control lives in the existing settings menu.
3. **Keep the existing semantic token names** — `--bg-0/1/2`, `--fg`, `--fg-muted`, `--border`, `--accent`, `--error`, `--warn*`, `--tier-*` are referenced **271× across 9 CSS files**. Keeping the names means those usages are untouched and gain dark-theme support for free; only their *values* become theme-scoped.

## 2. Token architecture

**Two-tier, semantic-first.** Components reference *semantic* tokens only. Each theme block assigns concrete values to those tokens. Theme is selected by `[data-theme="light"|"dark"]` on `<html>`.

```css
/* src/styles/design-system/tokens.css */
:root,
[data-theme='light'] {
  color-scheme: light;
  /* surfaces / elevation (existing names kept) */
  --bg-0: #f5f7fb;  /* page            */
  --bg-1: #ffffff;  /* raised card     */
  --bg-2: #eef3f9;  /* sunken / input  */
  --bg-3: #e4ebf4;  /* card-header bar (NEW — mockup --panel2) */
  /* text / line / accent (existing names kept) */
  --fg: #172033; --fg-muted: #637083; --border: #d7dee8; --accent: #3478f6;
  /* status (existing) */
  --error: #c2414b;
  --warn: #b26a00; --warn-fg: #7a4f00; --warn-bg: #fde9c8; --warn-border: #e3b778;
  /* domain (NEW — contrast-tuned for light; values are starting points) */
  --live: #1f9d57; --dead: #9aa3b2; --gold: #a9791a; --violet: #7c5cff; --sp: #3b66b0;
  /* stat colours (NEW — lifted from cm-planner.css, tuned for light) */
  --stat-speed: #2f7fe0; --stat-stamina: #d4453d; --stat-power: #d07b1e;
  --stat-guts: #d24b7e; --stat-wit: #1ba588;
  /* effect-chip trios (NEW) — --ef-{spd,acc,rec,heal,dbf}-{fg,border,bg} */
  /* tier-* (existing, kept) */
}

[data-theme='dark'] {
  color-scheme: dark;
  /* bg-2 is the RAISED grey so the 271 existing --bg-2 usages read in dark with no
     per-usage audit; the mockup's deep #0c0e13 is exposed as --bg-3 (see the plan). */
  --bg-0: #0f1115; --bg-1: #171a21; --bg-2: #1d212a; --bg-3: #0c0e13;
  --fg: #e6e8ec; --fg-muted: #8b929e; --border: #2a2f3a; --accent: #6aa3ff;
  --error: #e06c75;
  --warn: #e0a14f; --warn-fg: #f0c994; --warn-bg: #241c10; --warn-border: #5a4730;
  --live: #57c98a; --dead: #545a66; --gold: #e6b85c; --violet: #b08bff; --sp: #9fb4d8;
  --stat-speed: #5aa0ff; --stat-stamina: #e0564f; --stat-power: #e69a3c;
  --stat-guts: #e35d8c; --stat-wit: #37c2a0;
  /* effect-chip dark trios from the mockup:
     spd  #5aa0ff / #33455f / #15202f      acc  #e69a3c / #5a4730 / #241c10
     rec  #37c2a0 / #2f5650 / #0f231f      heal #57c98a / #2c5a40 / #0f2318
     dbf  #e35d8c / #5a3344 / #241018 */
}
```

**Token categories** (the complete semantic set):

| Category | Tokens | Source |
|---|---|---|
| Surfaces | `--bg-0/1/2/3` | existing + `--bg-3` new |
| Text / line | `--fg`, `--fg-muted`, `--border` | existing |
| Accent | `--accent` | existing |
| Status | `--error`, `--warn`, `--warn-fg/-bg/-border` | existing (dark values added) |
| Domain | `--live`, `--dead`, `--gold`, `--violet`, `--sp` | new |
| Stats | `--stat-{speed,stamina,power,guts,wit}` | new (lift from `cm-planner.css`) |
| Effect chips | `--ef-{spd,acc,rec,heal,dbf}-{fg,border,bg}` | new |
| Tiers (M3) | `--tier-*` (8) | existing |
| Track phases | `--track-{straight,corner,activation,finish}`, `--phase-{early,mid,late,spurt}` | name-only here; values reconciled from existing `racetrack.css`/`skill-trace.css` + mockup during impl |
| Swimlane (M3) | `--lane-{bg,line,label}` | new, name-only here |

> Light-theme **domain** values above are starting points; finalize against WCAG AA contrast on `--bg-0/1/2` during implementation. Dark values are taken verbatim from the mockups (authoritative).

The seeded `--cmp-*` tokens in `cm-planner.css` stay as M4 layout knobs; the two accent ones (`--cmp-uma1-accent` = `--stat-speed` blue, `--cmp-uma2-accent` = `--stat-stamina` red) may be re-pointed at the new stat tokens (cosmetic, non-blocking).

## 3. Theming mechanism

- **Attribute:** `[data-theme]` on `document.documentElement`. Absent ⇒ the `:root, [data-theme='light']` block applies ⇒ **light is the default**.
- **Stored preference:** `'light' | 'dark' | 'system'` in `localStorage` (key `cmp.theme`). Default when unset: `'light'`.
- **Resolution:** `'system'` resolves to `prefers-color-scheme` at read time and on the media-query `change` event; `'light'`/`'dark'` are explicit.
- **No-flash boot:** a tiny synchronous snippet in `main.tsx` (before React mounts / before `app.css` paints) reads the stored preference and sets `data-theme` so there is no flash-of-wrong-theme.
- **Control:** `SettingsMenu.tsx` gains a **Light / Dark / System** segmented control (using the design system's own `.ds-seg`), writing the preference and updating the attribute live.
- **Native UI:** `color-scheme` is set per theme block so scrollbars, form controls, and the `<input type=date>`-style widgets match.

A small pure helper module (`src/app/theme.ts`) owns: read/write the stored preference, resolve `'system'`, and apply the attribute. Unit-tested in isolation (no DOM-paint dependency).

## 4. Component vocabulary

Hand-built, token-driven. **Existing global primitives** (`.badge`, `.chip`, `.tier-*`, `.game-icon`) are consolidated in place — same names, now token-driven, no churn. **Net-new structural components take a `ds-` prefix** to avoid collisions with feature CSS (which uses `cmp-*`, `rt-*`, etc.).

| Component | Class(es) | Generalizes / from |
|---|---|---|
| Card | `.ds-card`, `.ds-card-head`, `.ds-card-body`, `.ds-card-collapse` (+ caret) | M4 `cmp-plan-card` family |
| Numbered band | `.ds-band`, `.ds-bnum`, `.ds-band-head`, `.ds-band-body` | mockup §0/§1/§3 sections |
| Badge | `.badge` + variants (`gold`, `unique`, `b-up`, `b-na`, `b-scn`) | consolidate existing |
| Chip | `.chip` (+ active state) | consolidate existing |
| Effect-chip | `.ds-efb` + `.ds-ef-{spd,acc,rec,heal,dbf}` | mockup `.efb` |
| Segmented control | `.ds-seg`, `.ds-miniseg` (+ `.on`) | mockup `.seg`/`.miniseg` |
| Switch | `.ds-switch` + `.ds-knob` | mockup `.switch` |
| Value text | `.ds-l`, `.ds-cost`, `.ds-na`, `.ds-zero` | mockup `.L/.cost/.na/.zero` |
| Data table | `.ds-table` | mockup `table` styling |

Track-phase and swimlane **colors** are shipped as tokens (above) so P2/M3 share one palette, but the **full track/swimlane rendering stays in the feature/vendored layer** — building those components is out of scope for Phase 1 (YAGNI).

Each component is documented and exercised on `/styleguide` (§6) so its visual contract is verifiable independent of any module.

## 5. File layout

```
src/styles/
  app.css                     # keeps page/nav/footer/layout; :root token block REMOVED
  design-system/
    index.css                 # @import 'tokens.css'; @import 'components.css';
    tokens.css                # both theme blocks (the full semantic set)
    components.css            # the .ds-* + consolidated .badge/.chip classes
```

- `src/main.tsx` imports `@/styles/design-system/index.css` **before** `@/styles/app.css`, so tokens are defined first and feature CSS can still override structurally.
- `app.css`'s `:root { … }` token block **moves** into `tokens.css`; everything else in `app.css` stays.
- No feature CSS file needs editing for tokens (they reference the kept names). M4's card chrome is migrated in §7.

## 6. `/styleguide` route

A new `StyleguidePage` registered in `App.tsx` at `/styleguide` (always available; it is harmless and doubles as the visual-regression anchor). It renders:

- **Token swatches** — every surface/text/status/domain/stat/effect/tier token as a labeled chip showing its resolved value.
- **Component gallery** — a live instance of every component in §4, including states (badge variants, chip active, seg selected, switch on/off, value-text variants, a sample `.ds-table`, a `.ds-card` and a `.ds-band`).
- A **local Light/Dark toggle** that sets `data-theme` on the page wrapper, so both themes are eyeballable side-by-side without changing the global preference.

## 7. Migration: prove it on M4 (no light regression)

The exit criterion is that M4's existing card chrome is re-expressed through the system. Concretely:

- The `cmp-plan-card` / `cmp-plan-card-head` / `cmp-plan-card-body` / `cmp-collapse-head` rules (the "[planner-page card grammar](../../../CLAUDE.md)") are reimplemented as `.ds-card` + parts, and M4 markup switches to the `ds-` classes (or `cmp-plan-card` becomes a thin alias of `.ds-card`).
- **Light-mode output must be visually unchanged** — the `.ds-card` values are seeded from the current `cmp-plan-card` values, so the light render is byte-similar. This is the regression guard.
- **Dark mode is then verified** on the M4 page: cards, bands, the sidebar, badges/chips, and value text read correctly against the dark surfaces.

**Global app shell is tokenized too.** The always-visible chrome — `body` background (currently a hardcoded white→grey gradient that would read as broken white in dark), `.app-header`, `nav`, `.app-footer`, `.settings` menu — is foundation, not module fidelity, and frames `/styleguide` and M4. Phase 1 makes these token-driven so the shell is coherent in both themes. (The conditional `.banner` already uses a dark-amber palette that reads acceptably on either theme; it can stay as-is.)

M4 is the only **module** migrated in Phase 1. Other modules keep rendering (in light) unchanged; they pick up the system in their own fidelity phases.

## 8. Scope / non-goals (YAGNI)

**In scope:** tokens (both themes) · core components (§4) · tokenize the **global app shell** (body/header/nav/footer/settings) · `/styleguide` · settings theme toggle + `theme.ts` · re-express M4 cards via `.ds-card`/`.ds-band` with zero light regression · verify the shell + M4 in dark.

**Out of scope (named, deferred to their phases):**
- M4 full mockup fidelity — §0 redesign, effect-chips wired into live data, sourcing table, etc. → **P2**.
- M2 / M3 / M1 layout & skin → **P4**.
- Chart rewrites / a charting library → not happening (decision §1).
- Full track/swimlane **components** → P2 (M4) / M3.
- Tokenizing every module's hardcoded colors → each module's fidelity phase.

## 9. Known limitations (stated, not hidden — P3)

- **Dark theme is guaranteed-correct only for the app shell + design-system primitives + M4 + `/styleguide`.** Other modules' *feature* CSS contains hardcoded colors (e.g. racetrack/skill-trace chart strokes, `sp-optimizer.css`, `meta-intel.css`, `parents.css`) that will not adapt until tokenized in their fidelity phases (P2/P4). The settings toggle flips the theme globally — those surfaces will just look light-baked in dark mode until then. This is an accepted, stated trade-off, not a silent gap.
- Light-theme domain/stat values are first-pass; a contrast pass during implementation may nudge them.

## 10. Testing & exit criteria

**Tests:**
- `theme.ts` unit tests — default is `'light'`; round-trips `light/dark/system`; `'system'` resolves via the injected matcher.
- A DOM test — toggling the settings control sets `document.documentElement[data-theme]` and persists to `localStorage`.
- `StyleguidePage` renders without error (smoke test).
- Existing suite stays green (the kept token names mean no existing test should break).

**Exit:**
- `/styleguide` renders **all** primitives, correct in **both** themes.
- M4's cards are re-expressed via the system with **no light-mode visual regression**, and M4 renders correctly in dark.
- Theme toggle in settings works and persists; light is the out-of-box default.
- `pnpm build` + `pnpm typecheck` + `pnpm test` all green.

## 11. References

- Roadmap: [P1](../../roadmap.md#phase-1--design-system-foundation) · driver/spine (mockups are the spec).
- Mockups (the visual spec, dark): [m4-current.html](../../mockups/m4-current.html), [m2-sp-optimizer.html](../../mockups/m2-sp-optimizer.html), [m3-timeline.html](../../mockups/m3-timeline.html), [m1-inheritance.html](../../mockups/m1-inheritance.html) — grammar confirmed identical across all four.
- Current tokens/styles: [app.css](../../../src/styles/app.css), [cm-planner.css](../../../src/features/cm-planner/cm-planner.css) (seeded `--cmp-*`).
- Settings host: [SettingsMenu.tsx](../../../src/app/SettingsMenu.tsx).
- Stack-tension reference (hakuraku's React-Bootstrap + ECharts approach, *not* adopted): roadmap Phase 1 UX-references.
