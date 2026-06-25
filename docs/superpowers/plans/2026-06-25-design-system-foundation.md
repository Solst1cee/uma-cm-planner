# Design-system Foundation (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a hand-rolled, themeable (light + dark) design-system foundation — semantic CSS tokens, core `ds-*` component classes, a `/styleguide` reference, and a settings theme toggle — and verify M4 renders in both themes with zero light-mode regression.

**Architecture:** Two-tier, semantic-first CSS custom properties. A `:root, [data-theme='light']` block holds the full token set with light values; a `[data-theme='dark']` block overrides only the tokens that differ. Components reference *semantic* tokens only. The existing token names (`--bg-0/1/2`, `--fg`, `--accent`, …) are **kept** so the 271 existing usages across 9 CSS files gain dark support untouched. A tiny `theme.ts` reads/resolves/applies the preference; `main.tsx` applies it before first paint.

**Tech Stack:** TypeScript + Vite + React 19, pnpm, Vitest (jsdom) + @testing-library/react. Pure CSS (no UI/charting library). Path alias `@/*` → `src/*`.

## Global Constraints

- **No new runtime dependencies.** Hand-build CSS; keep the hand-rolled SVG charts. (Spec §1 decision 1.)
- **Themeable light + dark; light is the default.** Theme via `[data-theme]` on `<html>`; absent ⇒ light. (Spec §1 decision 2, §3.)
- **Keep every existing semantic token name** — `--bg-0/1/2`, `--fg`, `--fg-muted`, `--border`, `--accent`, `--error`, `--warn*`, `--tier-*`. Only their *values* become theme-scoped. No renames. (Spec §1 decision 3.)
- **New component classes use a `ds-` prefix** to avoid collisions with feature CSS (`cmp-*`, `rt-*`). (Spec §4.)
- **Zero light-mode visual regression.** All kept tokens' light values are byte-identical to today; any re-pointed token's light value equals its old value. (Spec §7, §10.)
- **YAGNI:** only M4 + the app shell + `/styleguide` are guaranteed-correct in dark. Other modules are best-effort dark until their fidelity phase. Do **not** redesign M4, touch M2/M3/M1 layouts, or rewrite charts. (Spec §8, §9.)
- **Verification gates:** `pnpm typecheck`, `pnpm test`, `pnpm build` all green at each commit. (Run `pnpm test` in a shell with **no `pnpm dev` server running** — see CLAUDE.md vitest-flake gotcha.)

---

## File Structure

**Created:**
- `src/styles/design-system/index.css` — `@import`s tokens + components. The single global design-system entry.
- `src/styles/design-system/tokens.css` — both theme blocks (the full semantic token set).
- `src/styles/design-system/components.css` — the `ds-*` component classes.
- `src/app/theme.ts` — pure theme-preference helpers (read/write/resolve/apply/init).
- `src/app/theme.test.ts` — unit tests for `theme.ts`.
- `src/app/ThemeToggle.tsx` — self-contained Light/Dark/System control (no app context deps).
- `src/app/ThemeToggle.test.tsx` — DOM test for the toggle.
- `src/features/styleguide/StyleguidePage.tsx` — token swatches + component gallery + local theme toggle.
- `src/features/styleguide/styleguide.css` — styleguide page layout only.
- `src/features/styleguide/StyleguidePage.test.tsx` — smoke render test.

**Modified:**
- `src/main.tsx` — import design-system before `app.css`; call `initTheme()` before render.
- `src/styles/app.css` — remove the `:root{…}` token block (moved to tokens.css); tokenize the `body` background gradient.
- `src/app/App.tsx` — add the `/styleguide` route + a small footer link.
- `src/app/SettingsMenu.tsx` — render `<ThemeToggle />`.
- `src/features/cm-planner/cm-planner.css` — point `--cmp-card-shadow` at the new `--ds-card-shadow` token (the one cross-theme card fix).
- `CLAUDE.md`, `docs/roadmap.md` — record the landing (final task).

---

## Token reference (used verbatim across tasks)

These are the exact values Tasks 1 and 7 write. Light values for kept tokens are copied verbatim from the current `app.css :root`.

**Light — `:root, [data-theme='light']`** (full set):
```
color-scheme: light;
--bg-0:#f5f7fb; --bg-1:#ffffff; --bg-2:#eef3f9; --bg-3:#e9eef5;
--fg:#172033; --fg-muted:#637083; --border:#d7dee8; --accent:#3478f6;
--error:#c2414b;
--warn:#b26a00; --warn-fg:#7a4f00; --warn-bg:#fde9c8; --warn-border:#e3b778;
--tier-chain:#22c55e; --tier-scenario:#14b8a6; --tier-date_event:#06b6d4;
--tier-hint_strong:#a3e635; --tier-hint_weak:#eab308; --tier-random:#f97316;
--tier-spark:#a78bfa; --tier-uncovered:#ef4444;
--live:#1f9d57; --dead:#9aa3b2; --gold:#a9791a; --violet:#7c5cff; --sp:#3b66b0;
--stat-speed:#2f7fe0; --stat-stamina:#d4453d; --stat-power:#d07b1e; --stat-guts:#d24b7e; --stat-wit:#1ba588;
--ds-card-radius:12px; --ds-card-shadow:0 12px 28px rgb(36 54 78 / 0.08);
--ef-spd-fg:#2f6fd0; --ef-spd-border:#bcd0ef; --ef-spd-bg:#eaf2fd;
--ef-acc-fg:#b9701a; --ef-acc-border:#e6cba0; --ef-acc-bg:#fbf1e2;
--ef-rec-fg:#138a72; --ef-rec-border:#a8dcd0; --ef-rec-bg:#e6f6f2;
--ef-heal-fg:#1f9d57; --ef-heal-border:#aadcbf; --ef-heal-bg:#e7f6ee;
--ef-dbf-fg:#c44d77; --ef-dbf-border:#eebfd0; --ef-dbf-bg:#fbeaf1;
--track-straight:#e6ebf3; --track-corner:#efe7f5; --track-activation:rgb(124 92 255 / 0.16); --track-finish:var(--live);
```

**Dark — `[data-theme='dark']`** (overrides only):
```
color-scheme: dark;
--bg-0:#0f1115; --bg-1:#171a21; --bg-2:#1d212a; --bg-3:#0c0e13;
--fg:#e6e8ec; --fg-muted:#8b929e; --border:#2a2f3a; --accent:#6aa3ff;
--error:#e06c75;
--warn:#e0a14f; --warn-fg:#f0c994; --warn-bg:#241c10; --warn-border:#5a4730;
--live:#57c98a; --dead:#545a66; --gold:#e6b85c; --violet:#b08bff; --sp:#9fb4d8;
--stat-speed:#5aa0ff; --stat-stamina:#e0564f; --stat-power:#e69a3c; --stat-guts:#e35d8c; --stat-wit:#37c2a0;
--ds-card-shadow:0 12px 28px rgb(0 0 0 / 0.45);
--ef-spd-fg:#5aa0ff; --ef-spd-border:#33455f; --ef-spd-bg:#15202f;
--ef-acc-fg:#e69a3c; --ef-acc-border:#5a4730; --ef-acc-bg:#241c10;
--ef-rec-fg:#37c2a0; --ef-rec-border:#2f5650; --ef-rec-bg:#0f231f;
--ef-heal-fg:#57c98a; --ef-heal-border:#2c5a40; --ef-heal-bg:#0f2318;
--ef-dbf-fg:#e35d8c; --ef-dbf-border:#5a3344; --ef-dbf-bg:#241018;
--track-straight:#1b2230; --track-corner:#33283f; --track-activation:rgb(176 139 255 / 0.16);
```

> **Dark `--bg-2` = `#1d212a` (a *raised* grey), not the mockup's deep `#0c0e13`.** Rationale: 271 existing usages reference `--bg-2` as a general control/head/input surface; a raised value keeps them all readable in dark with **no per-usage audit**. The mockup's deep-sunken `#0c0e13` is exposed as the new `--bg-3` for components that explicitly want it. `--tier-*` and `--ds-card-radius` are theme-invariant → declared once in the light block, omitted from dark (they apply in dark via `:root`).
>
> **Deferred (YAGNI, not consumed by any Phase-1 component):** `--phase-*` race-leg tokens and `--lane-*` swimlane tokens from spec §2 are **not** added now; they land with their consuming work (M4 P2 / M3) so their values are reconciled against real `racetrack.css`/`skill-trace.css` then, not guessed here.

---

### Task 1: Token foundation (tokens.css, both themes) + wire the import

**Files:**
- Create: `src/styles/design-system/tokens.css`
- Create: `src/styles/design-system/index.css`
- Modify: `src/main.tsx`
- Modify: `src/styles/app.css` (remove the `:root{…}` block, lines 3–29)

**Interfaces:**
- Produces: the global semantic token set (every name in the Token reference above), theme-scoped via `[data-theme]`. Consumed by every later task and the 9 existing token-driven CSS files.

- [ ] **Step 1: Create `tokens.css`** with the two blocks exactly as in the Token reference:

```css
/* Design-system tokens — the single source of truth for colour/elevation.
   Light is the default (no [data-theme] attribute ⇒ this block applies via :root).
   Dark overrides only what differs; theme-invariant tokens live in the light block. */
:root,
[data-theme='light'] {
  color-scheme: light;
  --bg-0: #f5f7fb; --bg-1: #ffffff; --bg-2: #eef3f9; --bg-3: #e9eef5;
  --fg: #172033; --fg-muted: #637083; --border: #d7dee8; --accent: #3478f6;
  --error: #c2414b;
  --warn: #b26a00; --warn-fg: #7a4f00; --warn-bg: #fde9c8; --warn-border: #e3b778;
  --tier-chain: #22c55e; --tier-scenario: #14b8a6; --tier-date_event: #06b6d4;
  --tier-hint_strong: #a3e635; --tier-hint_weak: #eab308; --tier-random: #f97316;
  --tier-spark: #a78bfa; --tier-uncovered: #ef4444;
  --live: #1f9d57; --dead: #9aa3b2; --gold: #a9791a; --violet: #7c5cff; --sp: #3b66b0;
  --stat-speed: #2f7fe0; --stat-stamina: #d4453d; --stat-power: #d07b1e;
  --stat-guts: #d24b7e; --stat-wit: #1ba588;
  --ds-card-radius: 12px; --ds-card-shadow: 0 12px 28px rgb(36 54 78 / 0.08);
  --ef-spd-fg: #2f6fd0; --ef-spd-border: #bcd0ef; --ef-spd-bg: #eaf2fd;
  --ef-acc-fg: #b9701a; --ef-acc-border: #e6cba0; --ef-acc-bg: #fbf1e2;
  --ef-rec-fg: #138a72; --ef-rec-border: #a8dcd0; --ef-rec-bg: #e6f6f2;
  --ef-heal-fg: #1f9d57; --ef-heal-border: #aadcbf; --ef-heal-bg: #e7f6ee;
  --ef-dbf-fg: #c44d77; --ef-dbf-border: #eebfd0; --ef-dbf-bg: #fbeaf1;
  --track-straight: #e6ebf3; --track-corner: #efe7f5;
  --track-activation: rgb(124 92 255 / 0.16); --track-finish: var(--live);
}

[data-theme='dark'] {
  color-scheme: dark;
  --bg-0: #0f1115; --bg-1: #171a21; --bg-2: #1d212a; --bg-3: #0c0e13;
  --fg: #e6e8ec; --fg-muted: #8b929e; --border: #2a2f3a; --accent: #6aa3ff;
  --error: #e06c75;
  --warn: #e0a14f; --warn-fg: #f0c994; --warn-bg: #241c10; --warn-border: #5a4730;
  --live: #57c98a; --dead: #545a66; --gold: #e6b85c; --violet: #b08bff; --sp: #9fb4d8;
  --stat-speed: #5aa0ff; --stat-stamina: #e0564f; --stat-power: #e69a3c;
  --stat-guts: #e35d8c; --stat-wit: #37c2a0;
  --ds-card-shadow: 0 12px 28px rgb(0 0 0 / 0.45);
  --ef-spd-fg: #5aa0ff; --ef-spd-border: #33455f; --ef-spd-bg: #15202f;
  --ef-acc-fg: #e69a3c; --ef-acc-border: #5a4730; --ef-acc-bg: #241c10;
  --ef-rec-fg: #37c2a0; --ef-rec-border: #2f5650; --ef-rec-bg: #0f231f;
  --ef-heal-fg: #57c98a; --ef-heal-border: #2c5a40; --ef-heal-bg: #0f2318;
  --ef-dbf-fg: #e35d8c; --ef-dbf-border: #5a3344; --ef-dbf-bg: #241018;
  --track-straight: #1b2230; --track-corner: #33283f;
  --track-activation: rgb(176 139 255 / 0.16);
}
```

- [ ] **Step 2: Create `index.css`** (imports only; `@import` must precede other rules):

```css
@import './tokens.css';
@import './components.css';
```

> `components.css` is created in Task 2. To keep the build green between tasks, also create an empty `components.css` now: `touch src/styles/design-system/components.css` (or create it with a one-line `/* design-system components — see Task 2 */` comment).

- [ ] **Step 3: Remove the `:root{…}` token block from `app.css`.** Delete lines 3–29 (the `:root { color-scheme: light; --bg-0 … --tier-uncovered … }` block). Leave the `* { box-sizing }`, `body {…}`, and everything else. The tokens now come from `tokens.css`.

- [ ] **Step 4: Wire the import in `main.tsx`** — design-system FIRST so tokens are defined before `app.css` and feature CSS:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import '@/styles/design-system/index.css';
import '@/styles/app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 5: Verify build + no light regression**

Run: `pnpm typecheck && pnpm build`
Expected: PASS. Then `pnpm dev`, open `http://localhost:5177/` — the app looks **identical** to before (light default; every kept token resolves to its prior value). No `data-theme` attribute is set yet, so the `:root` light block applies.

- [ ] **Step 6: Commit**

```bash
git add src/styles/design-system/ src/main.tsx src/styles/app.css
git commit -m "feat(design-system): theme-scoped token foundation (light+dark)"
```

---

### Task 2: Core component classes (components.css)

**Files:**
- Modify: `src/styles/design-system/components.css` (replace the placeholder from Task 1)

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces: `.ds-card` (+ `-head`/`-body`/`-collapse`/`-caret`), `.ds-band` (+ `-num`/`-head`/`-body`), `.ds-efb` (+ `.ds-ef-{spd,acc,rec,heal,dbf}`), `.ds-seg`/`.ds-miniseg` (+ `.on`), `.ds-switch`/`.ds-knob`, `.ds-l`/`.ds-cost`/`.ds-na`/`.ds-zero`, `.ds-table`. Consumed by Tasks 3 (styleguide), 6 (`.ds-seg` in ThemeToggle), 7.

- [ ] **Step 1: Write `components.css`** (token-driven; `.ds-card` chrome mirrors the current `cmp-plan-card` so M4 can share it):

```css
/* Design-system components. New structural classes are ds-* prefixed to avoid
   collisions with feature CSS (cmp-*, rt-*). All colour/elevation via tokens. */

/* ── Card ─────────────────────────────────────────────────────────────── */
.ds-card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--ds-card-radius);
  background: var(--bg-1);
  box-shadow: var(--ds-card-shadow);
}
.ds-card-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg-2);
  padding: 0.6rem 0.75rem;
  font-size: 1rem;
  font-weight: 700;
  line-height: 1.1;
}
.ds-card-body { padding: 0.75rem; }
.ds-card-collapse { cursor: pointer; user-select: none; }
.ds-card-caret {
  margin-left: auto;
  flex: none;
  width: 0.5rem;
  height: 0.5rem;
  border-right: 2px solid var(--fg-muted);
  border-bottom: 2px solid var(--fg-muted);
  transform: rotate(-45deg);
  transition: transform 120ms ease;
}
.ds-card-caret[data-open] { transform: rotate(45deg); }

/* ── Numbered band (mockup §0/§1/§3 sections) ─────────────────────────── */
.ds-band {
  border: 1px solid var(--border);
  border-radius: var(--ds-card-radius);
  overflow: hidden;
  background: var(--bg-1);
}
.ds-band-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.8rem;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
}
.ds-bnum {
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 6px;
  background: var(--accent);
  color: var(--bg-0);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.78rem;
  flex: none;
}
.ds-band-body { padding: 0.8rem; background: var(--bg-0); }

/* ── Effect chips ─────────────────────────────────────────────────────── */
.ds-efb {
  font-size: 0.62rem;
  padding: 0 0.27rem;
  border-radius: 3px;
  border: 1px solid;
  line-height: 1.45;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
}
.ds-ef-spd  { color: var(--ef-spd-fg);  border-color: var(--ef-spd-border);  background: var(--ef-spd-bg); }
.ds-ef-acc  { color: var(--ef-acc-fg);  border-color: var(--ef-acc-border);  background: var(--ef-acc-bg); }
.ds-ef-rec  { color: var(--ef-rec-fg);  border-color: var(--ef-rec-border);  background: var(--ef-rec-bg); }
.ds-ef-heal { color: var(--ef-heal-fg); border-color: var(--ef-heal-border); background: var(--ef-heal-bg); }
.ds-ef-dbf  { color: var(--ef-dbf-fg);  border-color: var(--ef-dbf-border);  background: var(--ef-dbf-bg); }

/* ── Segmented control ────────────────────────────────────────────────── */
.ds-seg {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.ds-seg > * {
  appearance: none;
  background: transparent;
  border: 0;
  border-right: 1px solid var(--border);
  padding: 0.3rem 0.7rem;
  font-size: 0.82rem;
  color: var(--fg-muted);
  cursor: pointer;
}
.ds-seg > *:last-child { border-right: 0; }
.ds-seg > .on { background: var(--accent); color: var(--bg-0); font-weight: 600; }
.ds-miniseg > * { padding: 0.2rem 0.55rem; font-size: 0.76rem; }

/* ── Switch ───────────────────────────────────────────────────────────── */
.ds-switch { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; }
.ds-knob {
  width: 30px;
  height: 16px;
  border-radius: 99px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  position: relative;
  flex: none;
}
.ds-knob::after {
  content: '';
  position: absolute;
  top: 1px;
  left: 1px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--fg-muted);
  transition: transform 120ms ease, background 120ms ease;
}
.ds-switch[data-on] .ds-knob { background: color-mix(in srgb, var(--live) 32%, transparent); border-color: var(--live); }
.ds-switch[data-on] .ds-knob::after { transform: translateX(14px); background: var(--live); }

/* ── Value text ───────────────────────────────────────────────────────── */
.ds-l    { font-variant-numeric: tabular-nums; font-weight: 700; color: var(--live); }
.ds-cost { font-variant-numeric: tabular-nums; color: var(--sp); }
.ds-na   { color: var(--warn); font-weight: 600; }
.ds-zero { color: var(--dead); font-weight: 600; }

/* ── Data table ───────────────────────────────────────────────────────── */
.ds-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.ds-table th {
  text-align: left;
  color: var(--fg-muted);
  font-weight: 500;
  font-size: 0.66rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid var(--border);
}
.ds-table td {
  padding: 0.5rem;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: PASS (CSS compiles; classes unused until Task 3 renders them).

- [ ] **Step 3: Commit**

```bash
git add src/styles/design-system/components.css
git commit -m "feat(design-system): core ds-* component classes"
```

---

### Task 3: `/styleguide` route + page (the living reference + visual anchor)

**Files:**
- Create: `src/features/styleguide/StyleguidePage.tsx`
- Create: `src/features/styleguide/styleguide.css`
- Create: `src/features/styleguide/StyleguidePage.test.tsx`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: tokens (Task 1), components (Task 2).
- Produces: `StyleguidePage` (default-free named export), route `/styleguide`.

- [ ] **Step 1: Write the failing smoke test** `StyleguidePage.test.tsx`:

```tsx
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StyleguidePage } from './StyleguidePage';

afterEach(cleanup);

describe('StyleguidePage', () => {
  it('renders the heading and a token swatch label', () => {
    render(<StyleguidePage />);
    expect(screen.getByRole('heading', { name: /styleguide/i })).toBeInTheDocument();
    expect(screen.getByText('--accent')).toBeInTheDocument();
  });

  it('renders a sample design-system card', () => {
    const { container } = render(<StyleguidePage />);
    expect(container.querySelector('.ds-card')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/features/styleguide/StyleguidePage.test.tsx`
Expected: FAIL — cannot resolve `./StyleguidePage`.

- [ ] **Step 3: Write `styleguide.css`** (page layout only — components come from the design system):

```css
.styleguide { display: flex; flex-direction: column; gap: 1.5rem; }
.styleguide-toolbar { display: flex; align-items: center; gap: 0.75rem; }
.sg-section { display: flex; flex-direction: column; gap: 0.6rem; }
.sg-section > h2 { font-size: 0.95rem; margin: 0; }
.sg-swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr)); gap: 0.5rem; }
.sg-swatch { display: flex; align-items: center; gap: 0.5rem; border: 1px solid var(--border); border-radius: 8px; padding: 0.4rem; background: var(--bg-1); }
.sg-chip { width: 1.5rem; height: 1.5rem; border-radius: 5px; border: 1px solid var(--border); flex: none; }
.sg-swatch code { font-size: 0.72rem; color: var(--fg-muted); }
.sg-gallery { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: flex-start; }
```

- [ ] **Step 4: Write `StyleguidePage.tsx`** (token swatches + component gallery + a LOCAL theme toggle that sets `data-theme` on its own wrapper, so both themes are visible without changing the global preference):

```tsx
/**
 * Living reference for the design system (roadmap P1). Renders every token as a
 * labelled swatch + a gallery of every ds-* component, with a local Light/Dark
 * toggle (sets data-theme on this page's wrapper only — not the global app).
 */
import { useState } from 'react';
import './styleguide.css';

const SURFACE_TOKENS = ['--bg-0', '--bg-1', '--bg-2', '--bg-3', '--border'];
const TEXT_TOKENS = ['--fg', '--fg-muted', '--accent'];
const DOMAIN_TOKENS = ['--live', '--dead', '--gold', '--violet', '--sp', '--error', '--warn'];
const STAT_TOKENS = ['--stat-speed', '--stat-stamina', '--stat-power', '--stat-guts', '--stat-wit'];

function Swatches({ title, tokens }: { title: string; tokens: string[] }) {
  return (
    <section className="sg-section">
      <h2>{title}</h2>
      <div className="sg-swatches">
        {tokens.map((t) => (
          <div className="sg-swatch" key={t}>
            <span className="sg-chip" style={{ background: `var(${t})` }} />
            <code>{t}</code>
          </div>
        ))}
      </div>
    </section>
  );
}

export function StyleguidePage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  return (
    <div className="styleguide" data-theme={theme}>
      <div className="styleguide-toolbar">
        <h1>Design-system styleguide</h1>
        <div className="ds-seg ds-miniseg" role="group" aria-label="Preview theme" style={{ marginLeft: 'auto' }}>
          <button type="button" className={theme === 'light' ? 'on' : undefined} onClick={() => setTheme('light')}>Light</button>
          <button type="button" className={theme === 'dark' ? 'on' : undefined} onClick={() => setTheme('dark')}>Dark</button>
        </div>
      </div>

      <Swatches title="Surfaces & lines" tokens={SURFACE_TOKENS} />
      <Swatches title="Text & accent" tokens={TEXT_TOKENS} />
      <Swatches title="Domain" tokens={DOMAIN_TOKENS} />
      <Swatches title="Stats" tokens={STAT_TOKENS} />

      <section className="sg-section">
        <h2>Components</h2>
        <div className="sg-gallery">
          <div className="ds-card" style={{ width: '16rem' }}>
            <div className="ds-card-head">Card head</div>
            <div className="ds-card-body">Card body with <span className="ds-l">+1.42</span> and <span className="ds-cost">SP 240</span>.</div>
          </div>

          <div className="ds-band" style={{ width: '16rem' }}>
            <div className="ds-band-head"><span className="ds-bnum">0</span> Band head</div>
            <div className="ds-band-body">Band body content.</div>
          </div>

          <div className="sg-section">
            <div>
              <span className="ds-efb ds-ef-spd">SPD</span>{' '}
              <span className="ds-efb ds-ef-acc">ACC</span>{' '}
              <span className="ds-efb ds-ef-rec">REC</span>{' '}
              <span className="ds-efb ds-ef-heal">HEAL</span>{' '}
              <span className="ds-efb ds-ef-dbf">DBF</span>
            </div>
            <div className="ds-seg" role="group" aria-label="Sample segmented">
              <button type="button" className="on">Front</button>
              <button type="button">Pace</button>
              <button type="button">Late</button>
              <button type="button">End</button>
            </div>
            <span className="ds-switch" data-on><span className="ds-knob" /> show every skill</span>
            <div>
              <span className="ds-l">+2.10</span> · <span className="ds-cost">SP 530</span> ·{' '}
              <span className="ds-na">n/a</span> · <span className="ds-zero">0 L</span>
            </div>
          </div>

          <table className="ds-table" style={{ width: '18rem' }}>
            <thead><tr><th>Skill</th><th>L</th><th>SP</th></tr></thead>
            <tbody>
              <tr><td>Escape Artist</td><td><span className="ds-l">+1.42</span></td><td><span className="ds-cost">240</span></td></tr>
              <tr><td>Rushing Gale!</td><td><span className="ds-zero">0 L</span></td><td><span className="ds-cost">160</span></td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Register the route + a footer link in `App.tsx`.** Add the import near the other page imports:

```tsx
import { StyleguidePage } from '@/features/styleguide/StyleguidePage';
```

Add the route inside `<Routes>` (before the catch-all `<Route path="*" …>`):

```tsx
<Route path="/styleguide" element={<StyleguidePage />} />
```

Add a discoverable link in the footer (replace the existing `<footer …>` body):

```tsx
<footer className="app-footer">
  Coverage tiers are reliability estimates from community-verified
  mechanics — not guarantees. See docs/mechanics-notes.md. ·{' '}
  <NavLink to="/styleguide" className="nav-item" style={{ padding: '0 0.4rem' }}>Styleguide</NavLink>
</footer>
```

(`NavLink` is already imported in `App.tsx`.)

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm vitest run src/features/styleguide/StyleguidePage.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 7: Verify build + eyeball both themes**

Run: `pnpm build`
Expected: PASS. Then `pnpm dev` → open `/styleguide`; toggle Light/Dark and confirm every swatch + component renders correctly in both.

- [ ] **Step 8: Commit**

```bash
git add src/features/styleguide/ src/app/App.tsx
git commit -m "feat(design-system): /styleguide reference page + route"
```

---

### Task 4: `theme.ts` preference helpers + tests

**Files:**
- Create: `src/app/theme.ts`
- Create: `src/app/theme.test.ts`

**Interfaces:**
- Produces: `type ThemePref = 'light'|'dark'|'system'`; `type ResolvedTheme = 'light'|'dark'`; `THEME_STORAGE_KEY`; `readThemePref(storage?)`; `writeThemePref(pref, storage?)`; `systemPrefersDark()`; `resolveTheme(pref, prefersDark?)`; `applyTheme(resolved, root?)`; `initTheme(root?)`. Consumed by Tasks 5 (main.tsx) and 6 (ThemeToggle).

- [ ] **Step 1: Write the failing tests** `theme.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  readThemePref,
  resolveTheme,
  writeThemePref,
} from './theme';

function fakeStorage(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
  };
}

describe('theme prefs', () => {
  it('defaults to light when unset', () => {
    expect(readThemePref(fakeStorage())).toBe('light');
  });
  it('reads stored dark / system prefs', () => {
    expect(readThemePref(fakeStorage({ [THEME_STORAGE_KEY]: 'dark' }))).toBe('dark');
    expect(readThemePref(fakeStorage({ [THEME_STORAGE_KEY]: 'system' }))).toBe('system');
  });
  it('falls back to light on a garbage value', () => {
    expect(readThemePref(fakeStorage({ [THEME_STORAGE_KEY]: 'neon' }))).toBe('light');
  });
  it('round-trips via writeThemePref', () => {
    const s = fakeStorage();
    writeThemePref('dark', s);
    expect(readThemePref(s)).toBe('dark');
  });
  it('resolves system via the injected matcher', () => {
    expect(resolveTheme('system', () => true)).toBe('dark');
    expect(resolveTheme('system', () => false)).toBe('light');
    expect(resolveTheme('dark', () => false)).toBe('dark');
    expect(resolveTheme('light', () => true)).toBe('light');
  });
  it('applyTheme sets data-theme on the root', () => {
    const el = document.createElement('html');
    applyTheme('dark', el);
    expect(el.getAttribute('data-theme')).toBe('dark');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/app/theme.test.ts`
Expected: FAIL — cannot resolve `./theme`.

- [ ] **Step 3: Write `theme.ts`**:

```ts
/**
 * Theme preference: a tiny pure module so it is unit-testable without a DOM
 * paint. Default is light (roadmap P1). 'system' resolves via prefers-color-scheme
 * at read time; the matcher is injectable so tests don't depend on jsdom (which
 * has no matchMedia).
 */
export type ThemePref = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'cmp.theme';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

export function readThemePref(storage: ReadableStorage = localStorage): ThemePref {
  const v = storage.getItem(THEME_STORAGE_KEY);
  return v === 'dark' || v === 'system' ? v : 'light';
}

export function writeThemePref(pref: ThemePref, storage: WritableStorage = localStorage): void {
  storage.setItem(THEME_STORAGE_KEY, pref);
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

export function resolveTheme(
  pref: ThemePref,
  prefersDark: () => boolean = systemPrefersDark,
): ResolvedTheme {
  if (pref === 'system') return prefersDark() ? 'dark' : 'light';
  return pref;
}

export function applyTheme(
  resolved: ResolvedTheme,
  root: HTMLElement = document.documentElement,
): void {
  root.setAttribute('data-theme', resolved);
}

export function initTheme(root: HTMLElement = document.documentElement): ResolvedTheme {
  const resolved = resolveTheme(readThemePref());
  applyTheme(resolved, root);
  return resolved;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/app/theme.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/app/theme.ts src/app/theme.test.ts
git commit -m "feat(design-system): theme-preference helpers (default light)"
```

---

### Task 5: Apply theme at boot + tokenize the app-shell body background

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/styles/app.css` (the `body` background, ~lines 35–44)

**Interfaces:**
- Consumes: `initTheme` (Task 4), tokens (Task 1).

- [ ] **Step 1: Call `initTheme()` before render in `main.tsx`:**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { initTheme } from '@/app/theme';
import '@/styles/design-system/index.css';
import '@/styles/app.css';

initTheme(); // apply the stored/default theme before first paint (no flash)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 2: Tokenize the `body` background** in `app.css`. Replace the hardcoded gradient:

```css
/* before */
body {
  margin: 0;
  background:
    linear-gradient(180deg, #ffffff 0, #f5f7fb 11rem),
    var(--bg-0);
  /* … */
}
/* after */
body {
  margin: 0;
  background: linear-gradient(180deg, var(--bg-1) 0, var(--bg-0) 11rem);
  /* … */
}
```

(Light: `var(--bg-1)`=#fff, `var(--bg-0)`=#f5f7fb — identical to before. Dark: #171a21→#0f1115 — coherent.)

- [ ] **Step 3: Verify build + both themes on the shell**

Run: `pnpm build`
Expected: PASS. Then `pnpm dev`: default load is light (unchanged). Manually set `document.documentElement.setAttribute('data-theme','dark')` in the devtools console → the page background, header, nav, and footer read coherently dark (they already use `--bg-1`/`--bg-2`/`--border`). Reset with `removeAttribute`.

- [ ] **Step 4: Commit**

```bash
git add src/main.tsx src/styles/app.css
git commit -m "feat(design-system): apply theme at boot + tokenize shell background"
```

---

### Task 6: Theme toggle in Settings (ThemeToggle component) + DOM test

**Files:**
- Create: `src/app/ThemeToggle.tsx`
- Create: `src/app/ThemeToggle.test.tsx`
- Modify: `src/app/SettingsMenu.tsx`

**Interfaces:**
- Consumes: `theme.ts` (Task 4), `.ds-seg` (Task 2).
- Produces: `<ThemeToggle />`.

- [ ] **Step 1: Write the failing DOM test** `ThemeToggle.test.tsx`:

```tsx
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from './ThemeToggle';
import { THEME_STORAGE_KEY } from './theme';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('ThemeToggle', () => {
  it('applies and persists dark when Dark is clicked', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('reverts to light when Light is clicked', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));
    await userEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/app/ThemeToggle.test.tsx`
Expected: FAIL — cannot resolve `./ThemeToggle`.

- [ ] **Step 3: Write `ThemeToggle.tsx`** (self-contained — no app context, so it tests in isolation):

```tsx
/** Light / Dark / System control for the settings menu. Self-contained: reads
 *  and writes the preference via theme.ts and applies it globally on click. */
import { useEffect, useState } from 'react';
import {
  type ThemePref,
  applyTheme,
  readThemePref,
  resolveTheme,
  writeThemePref,
} from '@/app/theme';

const OPTIONS: { value: ThemePref; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>(() => readThemePref());

  // While 'system' is selected, re-apply live when the OS preference flips.
  useEffect(() => {
    if (pref !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme(resolveTheme('system'));
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);

  const choose = (next: ThemePref) => {
    setPref(next);
    writeThemePref(next);
    applyTheme(resolveTheme(next));
  };

  return (
    <div className="ds-seg ds-miniseg" role="group" aria-label="Theme">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={o.value === pref ? 'on' : undefined}
          aria-pressed={o.value === pref}
          onClick={() => choose(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/app/ThemeToggle.test.tsx`
Expected: PASS (both cases). jsdom has no `matchMedia`, so the `'system'` effect is inert — that's fine; the tested paths are light/dark.

- [ ] **Step 5: Render it in `SettingsMenu.tsx`.** Add the import:

```tsx
import { ThemeToggle } from '@/app/ThemeToggle';
```

Add a labelled row at the top of `.settings-body` (above the Export button):

```tsx
<div className="settings-body">
  <label className="muted small" style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
    Theme
    <ThemeToggle />
  </label>
  <button type="button" onClick={() => void doExport()}>
    Export data (JSON)
  </button>
  {/* …rest unchanged… */}
```

- [ ] **Step 6: Verify the existing SettingsMenu test still passes + build**

Run: `pnpm vitest run src/app && pnpm build`
Expected: PASS. Then `pnpm dev`: open the ⚙ menu, switch Light/Dark/System — the whole app re-themes live and the choice survives a reload.

- [ ] **Step 7: Commit**

```bash
git add src/app/ThemeToggle.tsx src/app/ThemeToggle.test.tsx src/app/SettingsMenu.tsx
git commit -m "feat(design-system): Light/Dark/System theme toggle in settings"
```

---

### Task 7: Unify M4's card chrome with the design system + verify dark

**Files:**
- Modify: `src/features/cm-planner/cm-planner.css` (the `--cmp-card-shadow` token + a comment)

**Interfaces:**
- Consumes: `--ds-card-shadow` (Task 1), `.ds-card` chrome (Task 2).

This is the spec's "prove it on M4" task. M4's `.cmp-plan-card` already consumes `--bg-1`/`--border`/`--bg-2`/`--cmp-card-radius` (all theme-aware now), so it themes for free. The one cross-theme gap is the **shadow** (`--cmp-card-shadow` is a light-blue-tinted shadow, invisible-but-harmless on dark). Point it at the new themed `--ds-card-shadow` so M4 cards and `.ds-card` share one shadow source.

- [ ] **Step 1: Re-point `--cmp-card-shadow` in `cm-planner.css`.** In the `:root { … }` block (around line 25), change:

```css
/* before */
--cmp-card-shadow: 0 12px 28px rgb(36 54 78 / 0.08);
/* after — share the themed design-system card shadow (light value is identical) */
--cmp-card-shadow: var(--ds-card-shadow);
```

(Light `--ds-card-shadow` = `0 12px 28px rgb(36 54 78 / 0.08)` — identical, zero regression. Dark = a black-based shadow that actually reads.)

- [ ] **Step 2: Verify the full suite + build (no regression)**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: PASS — the whole existing suite stays green (kept token names mean nothing breaks).

- [ ] **Step 3: Manual dark verification of M4 (the proof).** `pnpm dev` → open `/` → ⚙ → Dark. Confirm: the track/race-setup/chart **cards** (border, radius, header bar, shadow), the **sidebar** (stat fields, badges, chips, wishlist rows), and value text (`+L`, SP) all read coherently against the dark surfaces; then switch back to Light and confirm it is unchanged from before this branch. Note any feature-CSS hardcoded-colour spots (expected per spec §9 — do **not** fix here; they belong to M4's P2 pass).

- [ ] **Step 4: Commit**

```bash
git add src/features/cm-planner/cm-planner.css
git commit -m "feat(design-system): share themed card shadow with M4 (dark-ready)"
```

---

### Task 8: Record the landing (docs) + final verification

**Files:**
- Modify: `CLAUDE.md` (Current State + Cross-cutting gotchas)
- Modify: `docs/roadmap.md` (status tracker + Phase 1 note)

**Interfaces:** none (documentation + final gate).

- [ ] **Step 1: Run the full gate and capture the test count**

Run: `pnpm typecheck && pnpm test && pnpm build`
Expected: all PASS. Record the new total test count from the vitest summary (≈ +10 over the prior 850).

- [ ] **Step 2: Update `docs/roadmap.md` status tracker.** Change the P1 row:

```md
| P1 Design system | ✅ done | tokens (light+dark) + ds-* components + /styleguide + Light/Dark/System settings toggle; M4 + shell verified both themes, zero light regression. Spec/plan 2026-06-25. |
```

Add a one-line dated note under the "Update" entries near the top:

```md
**Update (2026-06-25) — Phase 1 design-system foundation landed.** Themeable (light default + dark) semantic tokens in `src/styles/design-system/`, `ds-*` component classes, a `/styleguide` route, and a Light/Dark/System toggle in settings. Existing token names kept (271 usages untouched); M4 + app shell verified in both themes with no light regression. Spec [design](superpowers/specs/2026-06-25-design-system-foundation-design.md) · [plan](superpowers/plans/2026-06-25-design-system-foundation.md).
```

- [ ] **Step 3: Update `CLAUDE.md`.** Add to the **Current State** intro a sentence noting the design-system foundation (themeable tokens + `ds-*` + `/styleguide` + theme toggle), and add a **Cross-cutting gotcha** bullet:

```md
- **Design system lives in `src/styles/design-system/` (tokens.css + components.css), imported in `main.tsx` BEFORE `app.css`.** Tokens are theme-scoped via `[data-theme]` on `<html>` (absent ⇒ light default; `theme.ts` + the settings `ThemeToggle` set it). The existing semantic token names (`--bg-0/1/2`, `--fg`, `--accent`, `--border`, `--warn*`, `--tier-*`) were **kept** and made theme-aware — don't rename them. Dark `--bg-2` is a *raised* grey (`#1d212a`) so all 271 legacy `--bg-2` usages read in dark without a per-usage audit; the mockup's deep-sunken `#0c0e13` is the new `--bg-3`. New component classes are `ds-*` prefixed. **Dark is guaranteed-correct only for the design-system primitives + app shell + M4 + `/styleguide`**; other modules' feature CSS still has hardcoded colours (their fidelity phase tokenizes them).
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs/roadmap.md
git commit -m "docs(design-system): record Phase 1 landing in roadmap + CLAUDE.md"
```

---

## Self-Review

**Spec coverage** (spec §→task):
- §1 decisions (hand-build, themeable, light default, keep names) → Global Constraints + Task 1. ✓
- §2 token architecture (two-tier, full set) → Task 1. ✓ (`--phase-*`/`--lane-*` explicitly deferred — YAGNI, nothing consumes them.)
- §3 theming (data-theme, default light, settings toggle, no-flash boot, color-scheme) → Tasks 4 (helpers), 5 (boot), 6 (toggle); `color-scheme` per block in Task 1. ✓
- §4 component vocabulary → Task 2 (+ exercised in Task 3). ✓ (`.badge`/`.chip` already token-driven in app.css → theme for free; not re-declared.)
- §5 file layout → Tasks 1–3. ✓
- §6 /styleguide → Task 3. ✓
- §7 migration / prove on M4 + global shell → Tasks 5 (shell) + 7 (M4). ✓
- §8 scope/non-goals → Global Constraints. ✓
- §9 known limitation → recorded in Task 8 gotcha. ✓
- §10 testing & exit → Tasks 3,4,6 tests + Task 8 gate. ✓

**Placeholder scan:** no TBD/TODO; every CSS block, component, and test is spelled out in full. CSS-only tasks (1,2,5,7) are verified by build + styleguide render + manual theme eyeball (CSS has no meaningful unit test); JS/TS tasks (3,4,6) are TDD with concrete tests. ✓

**Type consistency:** `theme.ts` exports (`ThemePref`, `ResolvedTheme`, `THEME_STORAGE_KEY`, `readThemePref`, `writeThemePref`, `systemPrefersDark`, `resolveTheme`, `applyTheme`, `initTheme`) are used with matching names/signatures in Tasks 4 (tests), 5 (`initTheme()`), 6 (`readThemePref`/`writeThemePref`/`resolveTheme`/`applyTheme`). Class names (`ds-seg`, `ds-miniseg`, `ds-card`, `ds-card-head/-body`, `ds-band/-head/-body`, `ds-bnum`, `ds-efb`, `ds-ef-*`, `ds-switch`/`ds-knob`, `ds-l`/`ds-cost`/`ds-na`/`ds-zero`, `ds-table`) defined in Task 2 match their uses in Tasks 3 and 6. ✓
