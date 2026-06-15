# M2 · F1 — Capture Import + M4-wishlist seed: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the M2 SP optimizer two new ways to fill its form besides manual entry — **import a `CaptureBundle` JSON** (from the future native companion or any source) and **1-click copy the active M4 wishlist** — both feeding the same editable, confirm-on-entry candidate form.

**Architecture:** Two pure, CI-tested core functions (`parseCaptureBundle` validator, `wishlistToCandidates` mapper) in `src/core/spOptimizer.ts`; an upgraded `BuildContextForm` with editable named candidate rows + `initial*` pre-fill props; and a `SpOptimizerPage` import-file control + "Copy from M4 wishlist" button that share one remount-key seed. No OCR/canvas/WASM in the web app — that lives in a separate native companion (spec §5).

**Tech Stack:** TypeScript, React 19, Vite, Vitest (jsdom) + Testing Library. Path alias `@/* → src/*`. Spec: [docs/superpowers/specs/2026-06-15-m2-f1-ocr-assist-design.md](../specs/2026-06-15-m2-f1-ocr-assist-design.md).

---

## Conventions (read once)
- `import type { ... }` for types, alphabetized; `@/*` alias.
- Core tests: `import { describe, expect, it } from 'vitest';` + `@/core/fixtures` (`FIXTURE_SKILLS`).
- Component tests: `import '@testing-library/jest-dom/vitest';`, `afterEach(cleanup)`, `userEvent.setup()`; mock `@/features/data/gameData` (spread `importOriginal` to keep `GameIcon`), mock `@/app/ActivePlanContext` where the page uses `useActivePlan`.
- Run one file: `pnpm vitest run <path>`. Typecheck: `pnpm typecheck`.
- Baseline: `pnpm test` → 393 passing.

## File structure
| File | Responsibility | Task |
|---|---|---|
| `src/core/spOptimizer.ts` | `BuyableSkill.matchTier` + `parseCaptureBundle` | 1 |
| `src/core/spOptimizer.ts` | `wishlistToCandidates` | 2 |
| `src/core/spOptimizer.test.ts` | tests for both | 1, 2 |
| `src/features/sp-optimizer/BuildContextForm.tsx` | editable named rows + `initial*` props + remove + badge + `source` | 3 |
| `src/features/sp-optimizer/BuildContextForm.test.tsx` | extended tests | 3 |
| `src/features/sp-optimizer/SpOptimizerPage.tsx` | import-file control + wishlist button + shared seed | 4 |
| `src/features/sp-optimizer/SpOptimizerPage.test.tsx` | extended tests (mock `useActivePlan`) | 4 |
| `src/features/sp-optimizer/sp-optimizer.css` | row/badge/import classes | 4 |
| `docs/capture-bundle-contract.md` | the companion's output contract | 5 |

---

## Task 1: `BuyableSkill.matchTier` + `parseCaptureBundle`

**Files:** Modify `src/core/spOptimizer.ts`; Test `src/core/spOptimizer.test.ts` (append).

- [ ] **Step 1: Add `matchTier` to `BuyableSkill`.** In the `BuyableSkill` interface, after `prereqSkillId?:`, add:
```ts
  /** OCR/import-row provenance for the UI badge; absent/'manual' on manual entry. */
  matchTier?: 'exact' | 'fuzzy' | 'manual';
```
Run `pnpm typecheck` → clean (optional field, backward-compatible).

- [ ] **Step 2: Write the failing test** (append to `src/core/spOptimizer.test.ts`)

```ts
import { parseCaptureBundle } from '@/core/spOptimizer';

describe('parseCaptureBundle', () => {
  const valid = {
    schemaVersion: 1, source: 'ocr', capturedAt: '2026-06-15T00:00:00.000Z',
    server: 'global', dataVersion: 'v', seed: 12345,
    context: {
      umaId: '', stats: { spd: 1000, sta: 800, pow: 800, gut: 400, wit: 600 },
      aptitudes: { distance: 'A', surface: 'A', strategy: 'A' }, strategy: 'pace',
      courseId: '10101', spBudget: 2285, ownedSkills: [], pinned: [],
      candidates: [{ skillId: '200332', rarity: 'white', screenSpCost: 110, matchTier: 'exact' }],
    },
  };

  it('accepts a valid bundle through a JSON round-trip', () => {
    const b = parseCaptureBundle(JSON.parse(JSON.stringify(valid)));
    expect(b.source).toBe('ocr');
    expect(b.context.spBudget).toBe(2285);
    expect(b.context.candidates[0]!.skillId).toBe('200332');
    expect(b.context.candidates[0]!.matchTier).toBe('exact');
  });

  it('rejects a wrong schemaVersion', () => {
    expect(() => parseCaptureBundle({ ...valid, schemaVersion: 2 })).toThrow(/schemaVersion/);
  });

  it('rejects a non-object / missing context', () => {
    expect(() => parseCaptureBundle({ ...valid, context: undefined })).toThrow(/context/);
    expect(() => parseCaptureBundle(null)).toThrow(/bundle/);
  });

  it('rejects a non-string candidate skillId', () => {
    const bad = JSON.parse(JSON.stringify(valid));
    bad.context.candidates[0].skillId = 123;
    expect(() => parseCaptureBundle(bad)).toThrow(/skillId/);
  });

  it('rejects an invalid rarity', () => {
    const bad = JSON.parse(JSON.stringify(valid));
    bad.context.candidates[0].rarity = 'legendary';
    expect(() => parseCaptureBundle(bad)).toThrow(/rarity/);
  });
});
```

- [ ] **Step 3: Run → fails.** `pnpm vitest run src/core/spOptimizer.test.ts`

- [ ] **Step 4: Implement `parseCaptureBundle`** (append to `src/core/spOptimizer.ts`; the imports `Stat`, `SkillRarity`, `Server`, `Grade`, `Strategy` already exist in this file)

```ts
// --- CaptureBundle import validation (F1) ---

function fail(msg: string): never { throw new Error(`Invalid CaptureBundle: ${msg}`); }
function asObject(v: unknown, name: string): Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) fail(`${name} must be an object`);
  return v as Record<string, unknown>;
}
function asString(v: unknown, name: string): string {
  if (typeof v !== 'string') fail(`${name} must be a string`);
  return v;
}
function asNumber(v: unknown, name: string): number {
  if (typeof v !== 'number' || Number.isNaN(v)) fail(`${name} must be a number`);
  return v;
}
function asArray(v: unknown, name: string): unknown[] {
  if (!Array.isArray(v)) fail(`${name} must be an array`);
  return v;
}

const SOURCES = ['manual', 'ocr', 'video'];
const STAT_KEYS: Stat[] = ['spd', 'sta', 'pow', 'gut', 'wit'];
const RARITIES = ['white', 'gold', 'unique', 'inherited_unique'];

/** Validate + normalize an imported value into a CaptureBundle. Throws a descriptive Error otherwise. */
export function parseCaptureBundle(data: unknown): CaptureBundle {
  const root = asObject(data, 'bundle');
  if (root['schemaVersion'] !== 1) fail('schemaVersion must be 1');
  const source = asString(root['source'], 'source');
  if (!SOURCES.includes(source)) fail(`source must be one of ${SOURCES.join('|')}`);

  const ctx = asObject(root['context'], 'context');
  const statsObj = asObject(ctx['stats'], 'context.stats');
  const stats = {} as Record<Stat, number>;
  for (const k of STAT_KEYS) stats[k] = asNumber(statsObj[k], `context.stats.${k}`);

  const apt = asObject(ctx['aptitudes'], 'context.aptitudes');
  const aptitudes = {
    distance: asString(apt['distance'], 'context.aptitudes.distance') as Grade,
    surface: asString(apt['surface'], 'context.aptitudes.surface') as Grade,
    strategy: asString(apt['strategy'], 'context.aptitudes.strategy') as Grade,
  };

  const candidates: BuyableSkill[] = asArray(ctx['candidates'], 'context.candidates').map((c, i) => {
    const o = asObject(c, `context.candidates[${i}]`);
    const rarity = asString(o['rarity'], `context.candidates[${i}].rarity`);
    if (!RARITIES.includes(rarity)) fail(`context.candidates[${i}].rarity must be a skill rarity`);
    const bs: BuyableSkill = {
      skillId: asString(o['skillId'], `context.candidates[${i}].skillId`),
      rarity: rarity as SkillRarity,
      screenSpCost: asNumber(o['screenSpCost'], `context.candidates[${i}].screenSpCost`),
    };
    if (o['prereqSkillId'] !== undefined) bs.prereqSkillId = asString(o['prereqSkillId'], `context.candidates[${i}].prereqSkillId`);
    if (o['matchTier'] !== undefined) bs.matchTier = asString(o['matchTier'], `context.candidates[${i}].matchTier`) as BuyableSkill['matchTier'];
    return bs;
  });

  const context: BuildContext = {
    umaId: asString(ctx['umaId'], 'context.umaId'),
    stats,
    aptitudes,
    strategy: asString(ctx['strategy'], 'context.strategy') as Strategy,
    courseId: asString(ctx['courseId'], 'context.courseId'),
    spBudget: asNumber(ctx['spBudget'], 'context.spBudget'),
    ownedSkills: asArray(ctx['ownedSkills'], 'context.ownedSkills').map((s, i) => asString(s, `context.ownedSkills[${i}]`)),
    pinned: asArray(ctx['pinned'], 'context.pinned').map((s, i) => asString(s, `context.pinned[${i}]`)),
    candidates,
  };

  const bundle: CaptureBundle = {
    schemaVersion: 1,
    source: source as CaptureBundle['source'],
    capturedAt: asString(root['capturedAt'], 'capturedAt'),
    server: asString(root['server'], 'server') as Server,
    dataVersion: asString(root['dataVersion'], 'dataVersion'),
    context,
  };
  if (root['seed'] !== undefined) bundle.seed = asNumber(root['seed'], 'seed');
  return bundle;
}
```

- [ ] **Step 5: Run → passes.**
- [ ] **Step 6: Commit.** `pnpm typecheck && git add src/core/spOptimizer.ts src/core/spOptimizer.test.ts && git commit -m "feat(m2-f1): BuyableSkill.matchTier + parseCaptureBundle validator"`

---

## Task 2: `wishlistToCandidates`

**Files:** Modify `src/core/spOptimizer.ts`; Test `src/core/spOptimizer.test.ts` (append).

- [ ] **Step 1: Write the failing test** (append)

```ts
import { wishlistToCandidates } from '@/core/spOptimizer';
import { FIXTURE_SKILLS } from '@/core/fixtures';
import type { WishlistItem } from '@/core/types';

const SKILL_BY_ID = new Map(FIXTURE_SKILLS.map((s) => [s.skillId, s]));
const wl = (skillId: string): WishlistItem => ({ skillId, priority: 1, source: 'targeted' });

describe('wishlistToCandidates', () => {
  it('maps wishlist skills to BuyableSkills with dataset rarity/base cost/prereq', () => {
    expect(wishlistToCandidates([wl('200332'), wl('200331')], SKILL_BY_ID)).toEqual([
      { skillId: '200332', rarity: 'white', screenSpCost: 110, matchTier: 'manual' },
      { skillId: '200331', rarity: 'gold', screenSpCost: 160, prereqSkillId: '200332', matchTier: 'manual' },
    ]);
  });

  it('dedupes and skips ids absent from the dataset', () => {
    const out = wishlistToCandidates([wl('200332'), wl('200332'), wl('999999')], SKILL_BY_ID);
    expect(out.map((c) => c.skillId)).toEqual(['200332']);
  });
});
```

- [ ] **Step 2: Run → fails.**

- [ ] **Step 3: Implement** (append to `src/core/spOptimizer.ts`; add `SkillRecord, WishlistItem` to the existing `import type { ... } from '@/core/types';` line)

```ts
// --- M4-wishlist seed (F1) ---

/**
 * Map an M4 `CmPlan.wishlist` to editable buyable candidates (1-click seed).
 * Cost is the dataset base (an estimate to confirm against the screen). Dedupes
 * by skillId; skips ids absent from the dataset (e.g. P4-filtered). Pure.
 */
export function wishlistToCandidates(
  wishlist: WishlistItem[],
  skillById: ReadonlyMap<string, SkillRecord>,
): BuyableSkill[] {
  const out: BuyableSkill[] = [];
  const seen = new Set<string>();
  for (const item of wishlist) {
    if (seen.has(item.skillId)) continue;
    const skill = skillById.get(item.skillId);
    if (!skill) continue;
    seen.add(item.skillId);
    const bs: BuyableSkill = {
      skillId: skill.skillId,
      rarity: skill.rarity,
      screenSpCost: skill.baseSpCost,
      matchTier: 'manual',
    };
    if (skill.prereqSkillId !== undefined) bs.prereqSkillId = skill.prereqSkillId;
    out.push(bs);
  }
  return out;
}
```

- [ ] **Step 4: Run → passes.**
- [ ] **Step 5: Commit.** `pnpm typecheck && git add src/core/spOptimizer.ts src/core/spOptimizer.test.ts && git commit -m "feat(m2-f1): wishlistToCandidates (M4 wishlist → editable candidates)"`

---

## Task 3: `BuildContextForm` — editable named rows + pre-fill props

**Files:** Modify `src/features/sp-optimizer/BuildContextForm.tsx` (+ test).

- [ ] **Step 1: Replace the test** (`BuildContextForm.test.tsx`) — the form will now call `useGameData()`, so add the mock; keep the existing manual case; add pre-fill + edit + remove cases.

```tsx
// src/features/sp-optimizer/BuildContextForm.test.tsx
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { BuyableSkill } from '@/core/spOptimizer';
import { BuildContextForm } from '@/features/sp-optimizer/BuildContextForm';

vi.mock('@/features/data/gameData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/data/gameData')>();
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { ...actual, useGameData: () => fixtureGameData() };
});

afterEach(cleanup);

describe('BuildContextForm', () => {
  it('emits a manual CaptureBundle with the entered SP and one candidate', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    render(<BuildContextForm onAnalyze={onAnalyze} />);

    await user.clear(screen.getByLabelText('Available SP'));
    await user.type(screen.getByLabelText('Available SP'), '500');
    await user.type(screen.getByLabelText('Skill id'), '200332');
    await user.type(screen.getByLabelText('On-screen SP cost'), '120');
    await user.click(screen.getByRole('button', { name: 'Add skill' }));
    await user.click(screen.getByRole('button', { name: 'Analyze' }));

    const bundle = onAnalyze.mock.calls[0]![0];
    expect(bundle.source).toBe('manual');
    expect(bundle.context.spBudget).toBe(500);
    expect(bundle.context.candidates[0].skillId).toBe('200332');
    expect(bundle.context.candidates[0].screenSpCost).toBe(120);
  });

  it('pre-fills from initialCandidates/initialSpBudget and emits source:ocr', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    const seed: BuyableSkill[] = [{ skillId: '200332', rarity: 'white', screenSpCost: 110, matchTier: 'exact' }];
    render(<BuildContextForm onAnalyze={onAnalyze} initialCandidates={seed} initialSpBudget={2285} initialCourseId="10105" />);

    expect(screen.getByLabelText('Available SP')).toHaveValue(2285);
    expect(screen.getByLabelText('Course id')).toHaveValue('10105');
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    const bundle = onAnalyze.mock.calls[0]![0];
    expect(bundle.source).toBe('ocr');
    expect(bundle.context.candidates[0].skillId).toBe('200332');
  });

  it('lets you correct a candidate cost and remove a row', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    const seed: BuyableSkill[] = [
      { skillId: '200332', rarity: 'white', screenSpCost: 110, matchTier: 'exact' },
      { skillId: '200331', rarity: 'gold', screenSpCost: 160, matchTier: 'fuzzy', prereqSkillId: '200332' },
    ];
    render(<BuildContextForm onAnalyze={onAnalyze} initialCandidates={seed} initialSpBudget={2285} />);

    const costInputs = screen.getAllByLabelText(/^Cost for /);
    await user.clear(costInputs[0]!);
    await user.type(costInputs[0]!, '128');
    const removeButtons = screen.getAllByRole('button', { name: /^Remove/ });
    await user.click(removeButtons[1]!);

    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    const bundle = onAnalyze.mock.calls[0]![0];
    expect(bundle.context.candidates).toHaveLength(1);
    expect(bundle.context.candidates[0].skillId).toBe('200332');
    expect(bundle.context.candidates[0].screenSpCost).toBe(128);
  });
});
```

- [ ] **Step 2: Run → fails** (no `initialCandidates` prop / no editable rows yet).

- [ ] **Step 3: Replace `BuildContextForm.tsx`**

```tsx
// src/features/sp-optimizer/BuildContextForm.tsx
import { useState } from 'react';

import type { BuyableSkill, CaptureBundle } from '@/core/spOptimizer';
import type { Stat } from '@/core/types';
import type { Grade } from '@/sim/types';
import { GameIcon } from '@/features/data/GameIcon';
import { useGameData } from '@/features/data/gameData';

const DEFAULT_STATS: Record<Stat, number> = { spd: 1000, sta: 800, pow: 800, gut: 400, wit: 600 };

export interface BuildContextFormProps {
  onAnalyze: (bundle: CaptureBundle) => void;
  initialCandidates?: BuyableSkill[];
  initialSpBudget?: number;
  initialCourseId?: string;
  dataVersion?: string;
  /** Clock injected so the component stays testable/deterministic. */
  now?: () => string;
}

export function BuildContextForm({
  onAnalyze, initialCandidates, initialSpBudget, initialCourseId, dataVersion = 'global-c1fa2107', now,
}: BuildContextFormProps) {
  const { skillById } = useGameData();
  const [spBudget, setSpBudget] = useState(initialSpBudget ?? 1000);
  const [courseId, setCourseId] = useState(initialCourseId ?? '10101');
  const [candidates, setCandidates] = useState<BuyableSkill[]>(initialCandidates ?? []);
  const [draftId, setDraftId] = useState('');
  const [draftCost, setDraftCost] = useState('');
  const [source] = useState<'manual' | 'ocr'>(
    initialCandidates && initialCandidates.length > 0 ? 'ocr' : 'manual',
  );

  function addCandidate() {
    const id = draftId.trim();
    if (!id || candidates.some((c) => c.skillId === id)) return;
    setCandidates((prev) => [...prev, { skillId: id, rarity: 'white', screenSpCost: Number(draftCost) || 0, matchTier: 'manual' }]);
    setDraftId('');
    setDraftCost('');
  }

  function setCost(skillId: string, cost: number) {
    setCandidates((prev) => prev.map((c) => (c.skillId === skillId ? { ...c, screenSpCost: cost } : c)));
  }

  function removeCandidate(skillId: string) {
    setCandidates((prev) => prev.filter((c) => c.skillId !== skillId));
  }

  function analyze() {
    const bundle: CaptureBundle = {
      schemaVersion: 1,
      source,
      capturedAt: now ? now() : new Date().toISOString(),
      server: 'global',
      dataVersion,
      seed: 12345,
      context: {
        umaId: '',
        stats: { ...DEFAULT_STATS },
        aptitudes: { distance: 'A' as Grade, surface: 'A' as Grade, strategy: 'A' as Grade },
        strategy: 'pace',
        courseId,
        spBudget,
        ownedSkills: [],
        pinned: [],
        candidates,
      },
    };
    onAnalyze(bundle);
  }

  return (
    <div className="sp-form">
      <label>
        Available SP
        <input type="number" value={spBudget} onChange={(e) => setSpBudget(Number(e.target.value))} />
      </label>
      <label>
        Course id
        <input value={courseId} onChange={(e) => setCourseId(e.target.value)} />
      </label>

      <fieldset>
        <legend>Buyable skill</legend>
        <label>
          Skill id
          <input value={draftId} onChange={(e) => setDraftId(e.target.value)} />
        </label>
        <label>
          On-screen SP cost
          <input type="number" value={draftCost} onChange={(e) => setDraftCost(e.target.value)} />
        </label>
        <button type="button" onClick={addCandidate}>Add skill</button>
      </fieldset>

      <ul className="sp-candidates">
        {candidates.map((c) => {
          const skill = skillById.get(c.skillId);
          const name = skill?.nameEn ?? `Skill ${c.skillId}`;
          return (
            <li key={c.skillId} className="sp-candidate-row">
              {skill && <GameIcon kind="skill" id={skill.iconId} size={20} alt="" />}
              <span className="sp-candidate-name">{name}</span>
              {c.matchTier && c.matchTier !== 'manual' && (
                <span className="sp-tier-badge" data-tier={c.matchTier}>{c.matchTier}</span>
              )}
              <input
                type="number"
                className="sp-candidate-cost"
                aria-label={`Cost for ${name}`}
                value={c.screenSpCost}
                onChange={(e) => setCost(c.skillId, Number(e.target.value))}
              />
              <button type="button" className="sp-candidate-remove" aria-label={`Remove ${name}`} onClick={() => removeCandidate(c.skillId)}>✕</button>
            </li>
          );
        })}
      </ul>

      <button type="button" className="sp-analyze" onClick={analyze} disabled={candidates.length === 0}>
        Analyze
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run → passes.** `pnpm vitest run src/features/sp-optimizer/BuildContextForm.test.tsx`
- [ ] **Step 5: Commit.** `pnpm typecheck && git add src/features/sp-optimizer/BuildContextForm.tsx src/features/sp-optimizer/BuildContextForm.test.tsx && git commit -m "feat(m2-f1): editable named candidate rows + initial-pre-fill props"`

---

## Task 4: `SpOptimizerPage` import control + "Copy from M4 wishlist" + CSS

**Files:** Modify `src/features/sp-optimizer/SpOptimizerPage.tsx` (+ test), `sp-optimizer.css`.

- [ ] **Step 1: Replace `SpOptimizerPage.test.tsx`** — add the `useActivePlan` mock + a wishlist-button test (keep the existing analyze→save test).

```tsx
// src/features/sp-optimizer/SpOptimizerPage.test.tsx
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SpOptimizerPage } from '@/features/sp-optimizer/SpOptimizerPage';

vi.mock('@/features/data/gameData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/data/gameData')>();
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { ...actual, useGameData: () => ({ ...fixtureGameData(), status: 'ready' as const }) };
});

vi.mock('@/db', () => ({
  listCaptures: vi.fn(async () => []),
  saveCapture: vi.fn(async (d: { label: string; bundle: unknown }) => ({ id: 'id1', ...d })),
  deleteCapture: vi.fn(async () => undefined),
}));

vi.mock('@/features/sp-optimizer/rankBaskets', () => ({
  rankBaskets: vi.fn(() => ({ mode: 'exact', baskets: [{ skills: ['200332'], score: 1, spUsed: 110, spLeft: 0, descriptor: 'd' }] })),
}));

// active plan with a 1-item wishlist (200332 is in FIXTURE_SKILLS)
vi.mock('@/app/ActivePlanContext', () => ({
  useActivePlan: () => ({
    plan: { wishlist: [{ skillId: '200332', priority: 1, source: 'targeted' }] },
    setPlan: vi.fn(), flushPendingSave: vi.fn(), loadError: null,
  }),
}));

afterEach(cleanup);

describe('SpOptimizerPage', () => {
  it('seeds the form from the M4 wishlist and can Analyze', async () => {
    const user = userEvent.setup();
    render(<SpOptimizerPage />);

    await user.click(screen.getByRole('button', { name: /Copy from M4 wishlist/i }));
    // the seeded candidate row renders + Analyze is enabled
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    expect(screen.getByText('Suggested baskets')).toBeInTheDocument();
  });
});
```

> Note: `wishlistToCandidates` skips skillIds absent from `skillById`, so the wishlist test's `skillId` (`200332`) must resolve in `fixtureGameData`. Confirm it does (read `src/features/testing/fixtureGameData.ts`); if not, use a skillId that `fixtureGameData` provides (or extend the fixture). The Task-3 form pre-fill test already exercises `200332` with the same mock.

- [ ] **Step 2: Run → fails** (no wishlist button yet).

- [ ] **Step 3: Replace `SpOptimizerPage.tsx`**

```tsx
// src/features/sp-optimizer/SpOptimizerPage.tsx
import { useState } from 'react';

import { useActivePlan } from '@/app/ActivePlanContext';
import { type BuyableSkill, type CaptureBundle, parseCaptureBundle, wishlistToCandidates } from '@/core/spOptimizer';
import { useGameData } from '@/features/data/gameData';
import { BuildCards } from '@/features/sp-optimizer/BuildCards';
import { BuildContextForm } from '@/features/sp-optimizer/BuildContextForm';
import { type RankResult, rankBaskets } from '@/features/sp-optimizer/rankBaskets';
import { useCaptures } from '@/features/sp-optimizer/useCaptures';
import './sp-optimizer.css';

interface Seed { candidates: BuyableSkill[]; sp?: number; courseId?: string; }

export function SpOptimizerPage() {
  const { status, skillById } = useGameData();
  const { plan } = useActivePlan();
  const captures = useCaptures();
  const [result, setResult] = useState<RankResult | null>(null);
  const [bundle, setBundle] = useState<CaptureBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [seed, setSeed] = useState<Seed | null>(null);
  const [seedKey, setSeedKey] = useState(0);

  function applySeed(next: Seed) {
    setSeed(next);
    setSeedKey((k) => k + 1);
    setImportError(null);
  }

  async function importFile(file: File) {
    try {
      const parsed = parseCaptureBundle(JSON.parse(await file.text()));
      applySeed({ candidates: parsed.context.candidates, sp: parsed.context.spBudget, courseId: parsed.context.courseId });
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }

  function copyWishlist() {
    if (!plan) return;
    applySeed({ candidates: wishlistToCandidates(plan.wishlist, skillById) });
  }

  function analyze(b: CaptureBundle) {
    setBundle(b);
    try {
      setResult(rankBaskets(b));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setResult(null);
    }
  }

  function saveCurrent() {
    if (!bundle) return;
    captures.save(label.trim() || 'Untitled capture', bundle);
    setLabel('');
  }

  if (status === 'loading') {
    return <p className="muted">Loading…</p>;
  }

  const wishlistEmpty = !plan || plan.wishlist.length === 0;

  return (
    <div className="page">
      <section className="panel" aria-labelledby="sp-h">
        <h2 id="sp-h">SP Purchase Optimizer</h2>
        <p className="muted small">
          Post-run, SP-limited. Enter the skills on your purchase screen (or import / copy from your
          M4 wishlist), their on-screen costs, and your available SP. Costs are read from the screen — never calculated.
        </p>
        <p className="sp-caveat small" role="note">
          Estimates, not verdicts — the sim can’t see positional chaos (P3).
        </p>
        {status === 'fixture' && (
          <p className="error" role="alert">Running on placeholder data — results are illustrative.</p>
        )}

        <div className="sp-imports">
          <label className="sp-import">
            Import capture (.json)
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); }}
            />
          </label>
          <button type="button" onClick={copyWishlist} disabled={wishlistEmpty}>
            Copy from M4 wishlist
          </button>
        </div>
        {importError && <p className="error" role="alert">Import failed: {importError}</p>}

        <BuildContextForm
          key={seedKey}
          onAnalyze={analyze}
          initialCandidates={seed?.candidates}
          initialSpBudget={seed?.sp}
          initialCourseId={seed?.courseId}
        />
        {error && <p className="error" role="alert">Could not analyze: {error}</p>}
      </section>

      {result && (
        <section className="panel" aria-labelledby="sp-results-h">
          <h2 id="sp-results-h">Suggested baskets</h2>
          <BuildCards result={result} />
          <div className="sp-save">
            <label>
              Save as
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. CM14 ace" />
            </label>
            <button type="button" onClick={saveCurrent}>Save capture</button>
          </div>
        </section>
      )}

      <section className="panel" aria-labelledby="sp-saved-h">
        <h2 id="sp-saved-h">Saved captures</h2>
        {captures.error !== null && <p className="error" role="alert">Captures error: {captures.error}</p>}
        {captures.items === null ? (
          <p className="muted">Loading…</p>
        ) : captures.items.length === 0 ? (
          <p className="muted small">No saved captures yet.</p>
        ) : (
          <ul className="sp-saved">
            {captures.items.map((c) => (
              <li key={c.id}>
                <button type="button" className="sp-load" onClick={() => analyze(c.bundle)}>{c.label}</button>
                <button type="button" aria-label={`Delete ${c.label}`} onClick={() => captures.remove(c.id)}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Append CSS** to `src/features/sp-optimizer/sp-optimizer.css`:
```css
.sp-imports { display: flex; gap: 0.5rem; align-items: end; flex-wrap: wrap; margin-bottom: 0.5rem; }
.sp-import { display: inline-grid; gap: 0.2rem; }
.sp-candidate-row { display: flex; align-items: center; gap: 0.4rem; }
.sp-candidate-name { flex: 1; }
.sp-candidate-cost { width: 5rem; }
.sp-candidate-remove { background: none; border: none; cursor: pointer; font-size: 0.9rem; }
.sp-tier-badge { font-size: 0.7rem; padding: 0 0.3rem; border-radius: 0.25rem; background: var(--chip, #eee); }
.sp-tier-badge[data-tier='fuzzy'] { background: var(--warn-bg, #fde9c8); }
```

- [ ] **Step 5: Run the page test → passes.** `pnpm vitest run src/features/sp-optimizer/SpOptimizerPage.test.tsx`
  - Note: the `App.tsx` renders the page inside `<ActivePlanProvider>` already, so production has a real `useActivePlan`; only the test needs the mock above.
- [ ] **Step 6: Full suite + commit.** `pnpm typecheck && pnpm test` (all green). Then:
```bash
git add src/features/sp-optimizer/SpOptimizerPage.tsx src/features/sp-optimizer/SpOptimizerPage.test.tsx src/features/sp-optimizer/sp-optimizer.css
git commit -m "feat(m2-f1): import-capture control + Copy-from-M4-wishlist button"
```

---

## Task 5: Document the CaptureBundle contract

**Files:** Create `docs/capture-bundle-contract.md`.

- [ ] **Step 1: Write the contract doc** (so the separate native companion can target it)

```markdown
# CaptureBundle JSON — import contract (M2)

`CaptureBundle` is the JSON the M2 SP optimizer imports (spec
`docs/superpowers/specs/2026-06-15-m2-f1-ocr-assist-design.md` §4). Any producer
(the native capture companion, a hand-authored file, this app's own export) that
emits a valid bundle can feed M2. `parseCaptureBundle` (`src/core/spOptimizer.ts`)
is the **authoritative validator** — it rejects malformed input with a descriptive error.

## Shape
\`\`\`jsonc
{
  "schemaVersion": 1,
  "source": "ocr",            // "manual" | "ocr" | "video"
  "capturedAt": "<ISO 8601>",
  "server": "global",
  "dataVersion": "<dataset version matched against>",
  "seed": 12345,              // optional; fixed seed → reproducible sims
  "context": {
    "umaId": "",
    "stats":  { "spd": 0, "sta": 0, "pow": 0, "gut": 0, "wit": 0 },
    "aptitudes": { "distance": "A", "surface": "A", "strategy": "A" },
    "strategy": "pace",       // "front" | "pace" | "late" | "end"
    "courseId": "10101",
    "spBudget": 2285,         // available SP (the number a companion really reads)
    "ownedSkills": [],
    "pinned": [],
    "candidates": [
      { "skillId": "200332", "rarity": "white", "screenSpCost": 110, "matchTier": "exact" },
      { "skillId": "200331", "rarity": "gold",  "screenSpCost": 160, "prereqSkillId": "200332", "matchTier": "fuzzy" }
    ]
  }
}
\`\`\`

## Producer notes (native companion)
- A skill-screen capturer can populate `candidates` (name→`skillId` match + on-screen cost) and `spBudget`. It cannot read `stats`/`aptitudes`/`strategy`/`courseId` off that screen — leave them at defaults; the user confirms in the form (or M2·F3 supplies them).
- `matchTier` ('exact' | 'fuzzy' | 'manual') drives the UI confidence badge.
- The validated OCR reference design lives in the spec §6 (ported from the gitignored `spikes/ocr/`).
```

- [ ] **Step 2: Commit.** `git add docs/capture-bundle-contract.md && git commit -m "docs(m2-f1): CaptureBundle import contract for the native companion"`

---

## Self-review (author)
- **Spec coverage:** §3.1 `parseCaptureBundle`→T1, `wishlistToCandidates`→T2; §3.2 form→T3, import control + wishlist button→T4; §4 contract→T5; §8 testing→T1-4; §2 cost=base (`screenSpCost: baseSpCost`)→T2, confirm-on-entry editable rows→T3. `matchTier`→T1.
- **No placeholders;** every code step is complete. No OCR/canvas/WASM anywhere (moved to the companion per spec §5).
- **Type consistency:** `matchTier` union 'exact'|'fuzzy'|'manual' added in T1, set by `wishlistToCandidates`/manual-add (T2/T3), validated by `parseCaptureBundle` (T1), badged in the form (T3). `parseCaptureBundle`/`wishlistToCandidates` return/consume `BuyableSkill`/`CaptureBundle` from the same module; `BuildContextForm` `initial*` props (T3) consumed by `SpOptimizerPage` (T4). The page's `useActivePlan` (T4) is mocked in its test.
- **Honest scope:** imported `context.stats/aptitudes/strategy` are not surfaced by the MVP form (it uses defaults) — recorded as F3 territory in the spec; the import seeds candidates + SP + course only.

> F1 ships the import + wishlist paths + the contract. F2 (compare-vs-veteran), F3 (full pre-fill incl. stats), and the native companion remain separate efforts.
