---
name: verify
description: Use when verifying a UI change in the running app — how to launch the dev server and drive the app in headless Chromium (Playwright) to capture screenshots and runtime evidence.
---

# Verifying UI changes in the running app

## Launch

```sh
pnpm dev   # binds 0.0.0.0:5177; tailnet URL http://$TAILNET_HOST:5177/ from .env.local
```

If port 5177 is busy, an older server (possibly from another worktree — wrong
code!) is holding it: find it with `Get-NetTCPConnection -LocalPort 5177 -State
Listen`, check its CommandLine points at YOUR worktree's `node_modules`, kill it
if not. Verify the served code with a request for a file that only exists on
your branch: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5177/src/<branch-only-file>.tsx` → 200.

## Drive (headless Chromium)

`playwright` is a devDependency — no chromium-cli here. From a script anywhere,
resolve it against the worktree:

```js
import { createRequire } from 'node:module';
const require = createRequire('C:/path/to/<worktree>/package.json');
const { chromium } = require('playwright');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
```

Collect `page.on('console')` errors + `page.on('pageerror')` and check them
before declaring success. The wasm engine runs fine in headless Chromium —
an Analyze/Run click completes in a few seconds (allow a 90s timeout).

## Gotchas that bit

- **Auto-save is OFF by default.** `page.goto()` between routes is a full
  reload and resets the in-memory active plan from Dexie — unsaved planner
  edits (e.g. a wishlist add) vanish. Navigate like a user instead:
  `page.getByRole('link', { name: 'SP Optimizer' }).click()`.
- **Seeding a plan with a wishlist skill** (needed for M2 Carry-from-M4 etc.):
  on `/`, fill `input[placeholder="+ Search skills by name..."]`, then click
  `.picker-results .picker-row` — plain `getByText(name)` misses (names carry
  ○/◎ suffixes and appear in chart rows too).
- **PlanInventoryCard row body** is `.cmp-inventory-select`; the card header's
  first buttons are Upload/Download/Delete/Edit icons — a naive
  `button.first()` clicks Upload.
- React controlled inputs: use `fill`/`setInputFiles`, never `el.value = …`.
