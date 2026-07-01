# M1.6 Support Card Pool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mockup §5 "Support cards" pool — a browse/filter/scoreable support-card panel that drag-sources and "+ Add"s cards into the M1.5 deck (Icon · Art · Plot views), with euophrys' vendored training-power score (editable weights) shown alongside wishlist-skill coverage.

**Architecture:** Vendor euophrys' MIT scorer + data under `src/vendor/uma-tiers/`. Pure scoring/matching/filtering helpers in `src/core/`. Browser-local weights state via a guarded-localStorage hook (mirrors M1.5's `useDeckState`). Provider-free presentational components (`ScoreWeightsPanel`, `SupportCardPoolCard`); `InheritancePage` owns `useGameData`/scores/weights/wishlist/deck and passes resolved view-models + handlers in. Effect is captioned honestly; Matches is the primary plan-relevant axis.

**Tech Stack:** TypeScript + Vite + React 19, Vitest (jsdom) + @testing-library/react, pnpm. Path alias `@/*` → `src/*`. The vendored scorer is plain JS (`@ts-nocheck` + a `.d.ts` shim).

**Spec:** `docs/superpowers/specs/2026-06-26-m1-6-support-card-pool-design.md`.

## Global Constraints

- **P1 reuse + attribution:** euophrys files vendored verbatim, MIT preserved, recorded in `docs/provenance.md` (URL + pinned commit + retrieval date).
- **P2 local-first:** weights persist to `localStorage`; no backend.
- **P3 honest numbers:** Effect captioned "training power · URA scenario · via euophrys"; cards with no euophrys row show `—` (Icon/Art) / are omitted (Plot). Matches is exact.
- **P6 pure core:** scoring/matching/filtering logic is pure `src/core/` functions, unit-tested.
- **M1 conventions:** component files named apart from pure-helper siblings (Windows case-FS); presentational cards are **provider-free** (no `useGameData`/`GameIcon` inside — the page injects resolved data + nodes); reuse the `inh-deck`/`cmp-plan-card` card grammar; **scope input CSS overrides** (the global `input[type=…]` rule out-specifies a lone class).
- **Vendor source:** branch **`main`** of `Euophrys/umamusume-tierlist`. Raw base: `https://raw.githubusercontent.com/Euophrys/umamusume-tierlist/main/`.
- **Test runner caveat:** trust `pnpm typecheck` + `pnpm build`; re-run a failing UI test file once before believing it (vitest flakes beside a dev server).
- **PR split:** Tasks 1–6 = **PR-A** (scoring foundation). Tasks 7–13 = **PR-B** (pool panel + page wiring).
- **Deck/limit-break types** (from `src/features/inheritance/deckOps.ts`): `DeckState = { slots: (string|null)[]; slotLb: LimitBreak[] }`, `DECK_SLOTS = 6`, `LimitBreak = 0|1|2|3|4`. Type colors/labels: `TYPE_COLORS`/`TYPE_LABEL` keyed by `CardType` (`'speed'|'stamina'|'power'|'guts'|'wit'|'friend'|'group'`).

---

# PR-A — Scoring foundation (Tasks 1–6)

### Task 1: Vendor euophrys files + provenance

**Files:**
- Create: `src/vendor/uma-tiers/tierlist-calc.js` (verbatim from `src/components/tierlist-calc.js`)
- Create: `src/vendor/uma-tiers/gl.js` (verbatim from `src/cards/gl.js`)
- Create: `src/vendor/uma-tiers/card-events.js` (verbatim from `src/card-events.js`)
- Create: `src/vendor/uma-tiers/scenarios.js` (verbatim from `src/scenarios.js`)
- Create: `src/vendor/uma-tiers/index.d.ts` (type shim — declares the surface our code calls)
- Create: `src/vendor/uma-tiers/LICENSE` (euophrys MIT license text)
- Modify: `docs/provenance.md` (add the vendor entry)
- Test: `src/vendor/uma-tiers/smoke.test.ts`

**Interfaces:**
- Produces: `import { processCards } from '@/vendor/uma-tiers/tierlist-calc'` → `(cards: CardObj[], weights: FlatWeights, selectedCards: CardObj[]) => ScoredRow[]` where `ScoredRow = { id: number; lb: number; score: number; info: object; char_name: string }`.
- Produces: `import cards from '@/vendor/uma-tiers/gl'` → `CardObj[]` (1130 rows; `default` export).
- Produces: `import { getDefaultScenario, getScenario } from '@/vendor/uma-tiers/scenarios'` → `getDefaultScenario('gl') => Scenario` (MANT + `bondPerDay:10`).

- [ ] **Step 1: Download the four source files verbatim**

```bash
cd src/vendor/uma-tiers
BASE=https://raw.githubusercontent.com/Euophrys/umamusume-tierlist/main
curl -fsSL $BASE/src/components/tierlist-calc.js -o tierlist-calc.js
curl -fsSL $BASE/src/cards/gl.js              -o gl.js
curl -fsSL $BASE/src/card-events.js           -o card-events.js
curl -fsSL $BASE/src/scenarios.js             -o scenarios.js
curl -fsSL $BASE/LICENSE                       -o LICENSE
```

Verify imports resolve: `gl.js` ends `export default cards`; `tierlist-calc.js` has `export function processCards`; `scenarios.js` exports `getDefaultScenario`/`getScenario`. If any file's relative imports point elsewhere (e.g. `tierlist-calc.js` imports `../card-events`), rewrite that import to the sibling path `./card-events` (and any `./cards/gl` → `./gl`). Record the commit hash you pinned: `git ls-remote https://github.com/Euophrys/umamusume-tierlist main`.

- [ ] **Step 2: Add `@ts-nocheck` + the type shim**

Prepend `// @ts-nocheck — vendored verbatim from Euophrys/umamusume-tierlist (MIT)` as the first line of all four `.js` files (verbatim third-party; our strict TS would reject it).

Create `src/vendor/uma-tiers/index.d.ts`:

```ts
// Type surface for the vendored uma-tiers scorer (Euophrys/umamusume-tierlist, MIT).
declare module '@/vendor/uma-tiers/gl' {
  const cards: UmaTiersCard[];
  export default cards;
}
declare module '@/vendor/uma-tiers/tierlist-calc' {
  export function processCards(
    cards: UmaTiersCard[],
    weights: UmaTiersWeights,
    selectedCards: UmaTiersCard[],
  ): UmaTiersScoredRow[];
}
declare module '@/vendor/uma-tiers/scenarios' {
  export function getScenario(server: string, key: string): UmaTiersScenario;
  export function getDefaultScenario(server: string): UmaTiersScenario;
}
export interface UmaTiersCard {
  id: number; type: number; group: boolean; rarity: number; limit_break: number;
  char_name: string; starting_stats: number[]; stat_bonus: number[]; race_bonus: number;
  specialty_rate: number; tb: number; mb: number; fs_bonus: number; fs_stats: number[];
  hint_rate: number; sb: number; [k: string]: unknown;
}
export interface UmaTiersScoredRow { id: number; lb: number; score: number; info: unknown; char_name: string }
export interface UmaTiersStatType { type: number; stats: number[]; cap: number; minimum: number; prioritize?: boolean; onlySummer?: boolean }
export interface UmaTiersGeneral {
  bondPerDay: number; races: number[]; umaBonus: number[]; multi: number; bonusSpec: number;
  motivation: number; scenarioBonus: number; fanBonus: number; scenarioLink: number[];
  unbondedTrainingGain: number[][]; bondedTrainingGain: number[][]; summerTrainingGain: number[][];
}
export interface UmaTiersScenario extends Record<string, unknown> {
  version: number; currentState: string; show: boolean; general: UmaTiersGeneral;
  speed: UmaTiersStatType; stamina: UmaTiersStatType; power: UmaTiersStatType;
  guts: UmaTiersStatType; wisdom: UmaTiersStatType; friend: UmaTiersStatType;
}
export type UmaTiersWeights = UmaTiersStatType & UmaTiersGeneral;
```

- [ ] **Step 3: Write the smoke test**

```ts
// src/vendor/uma-tiers/smoke.test.ts
import { describe, expect, it } from 'vitest';
import cards from '@/vendor/uma-tiers/gl';
import { processCards } from '@/vendor/uma-tiers/tierlist-calc';
import { getDefaultScenario } from '@/vendor/uma-tiers/scenarios';

describe('vendored uma-tiers', () => {
  it('loads 1130 card rows (226 ids × 5 LBs)', () => {
    expect(cards).toHaveLength(1130);
    expect(new Set(cards.map((c) => c.id)).size).toBe(226);
  });

  it('default GL scenario is MANT with bondPerDay 10', () => {
    const s = getDefaultScenario('gl');
    expect(s.general.bondPerDay).toBe(10);
    expect(s.speed.stats).toHaveLength(7);
  });

  it('processCards scores a Speed deck and returns rows sorted desc', () => {
    const scenario = getDefaultScenario('gl');
    const weights = { ...scenario.speed, ...scenario.general };
    const speedRows = cards.filter((c) => c.type === 0);
    const out = processCards(speedRows, weights, []);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].score).toBeGreaterThanOrEqual(out[out.length - 1].score);
    expect(out[0]).toHaveProperty('id');
    expect(out[0]).toHaveProperty('lb');
  });
});
```

- [ ] **Step 4: Run the smoke test**

Run: `pnpm vitest run src/vendor/uma-tiers/smoke.test.ts`
Expected: PASS (all 3). If a relative-import error appears, fix the import path per Step 1 and re-run.

- [ ] **Step 5: Add the provenance entry**

In `docs/provenance.md`, add under the vendored-sources section:

```markdown
### uma-tiers support-card scorer (M1.6)
- Source: https://github.com/Euophrys/umamusume-tierlist (branch `main`), **MIT** (LICENSE vendored).
- Pinned commit: `<HASH from Step 1>`; retrieved 2026-06-26.
- Vendored verbatim: `src/components/tierlist-calc.js`, `src/cards/gl.js`, `src/card-events.js`, `src/scenarios.js` → `src/vendor/uma-tiers/`.
- Use: the M1.6 support-card pool's "Effect" score (URA-scenario training power). **Off-axis caveat:** scores career-training power, not inheritance/CM wishlist value — surfaced as an estimate alongside the primary "Matches" axis. Re-pull on euophrys' Global updates.
```

- [ ] **Step 6: Commit**

```bash
git add src/vendor/uma-tiers docs/provenance.md
git commit -m "feat(m1.6): vendor euophrys uma-tiers scorer + data (MIT)"
```

---

### Task 2: `cardScore.ts` — per-type scoring wrapper

**Files:**
- Create: `src/core/cardScore.ts`
- Test: `src/core/cardScore.test.ts`

**Interfaces:**
- Consumes: `processCards`, `getDefaultScenario`, `cards` (Task 1); `DeckState`/`LimitBreak` from `deckOps`/`types`.
- Produces:
  - `DEFAULT_SCENARIO: UmaTiersScenario` (= `getDefaultScenario('gl')`).
  - `type ScoredCard = { score: number; lb: LimitBreak }`.
  - `cardRowsByKey(): Map<string, UmaTiersCard>` — keyed `"${id}:${lb}"`, from vendored `gl.js`.
  - `resolveDeckObjects(deck: DeckState, byKey: Map<string,UmaTiersCard>): UmaTiersCard[]` — filled slots → gl.js row at slot LB (drops unknown/empty).
  - `scoreCards(scenario: UmaTiersScenario, deckObjs: UmaTiersCard[], rows: UmaTiersCard[]): Map<string, ScoredCard>` — keyed by `String(card.id)`; groups `rows` by training type, calls `processCards` per type with `{...scenario[typeKey], ...scenario.general}`.

- [ ] **Step 1: Write the failing test**

```ts
// src/core/cardScore.test.ts
import { describe, expect, it } from 'vitest';
import cards from '@/vendor/uma-tiers/gl';
import { DEFAULT_SCENARIO, cardRowsByKey, resolveDeckObjects, scoreCards } from './cardScore';
import { emptyDeck } from '@/features/inheritance/deckOps';

describe('cardScore', () => {
  it('scores every requested row, keyed by card id', () => {
    const lb4 = cards.filter((c) => c.limit_break === 4);
    const scores = scoreCards(DEFAULT_SCENARIO, [], lb4);
    expect(scores.size).toBe(226);
    for (const c of lb4) expect(scores.get(String(c.id))).toBeDefined();
  });

  it('ranks Kitasan Black SSR (30028) near the top of speed cards', () => {
    const speedLb4 = cards.filter((c) => c.type === 0 && c.limit_break === 4);
    const scores = scoreCards(DEFAULT_SCENARIO, [], speedLb4);
    const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score).map(([id]) => id);
    expect(ranked.indexOf('30028')).toBeLessThan(5); // top 5 of speed SSRs
  });

  it('resolveDeckObjects maps filled slots to gl rows at slot LB', () => {
    const byKey = cardRowsByKey();
    const deck = { ...emptyDeck(), slots: ['30028', null, null, null, null, null], slotLb: [2, 4, 4, 4, 4, 4] as const };
    const objs = resolveDeckObjects(deck as never, byKey);
    expect(objs).toHaveLength(1);
    expect(objs[0].id).toBe(30028);
    expect(objs[0].limit_break).toBe(2);
  });

  it('omits ids absent from the vendored set', () => {
    const scores = scoreCards(DEFAULT_SCENARIO, [], []);
    expect(scores.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/cardScore.test.ts`
Expected: FAIL ("does not provide an export named 'scoreCards'").

- [ ] **Step 3: Write the implementation**

```ts
// src/core/cardScore.ts
/** M1.6 — wraps the vendored euophrys scorer (src/vendor/uma-tiers, MIT).
 *  Scores each card under ITS OWN training type's weights, as the marginal
 *  addition to the current deck. P3: this is training-power, not inheritance
 *  value — see docs/superpowers/specs/2026-06-26-m1-6-support-card-pool-design.md. */
import type { LimitBreak } from '@/core/types';
import type { DeckState } from '@/features/inheritance/deckOps';
import type { UmaTiersCard, UmaTiersScenario } from '@/vendor/uma-tiers/index';
import glCards from '@/vendor/uma-tiers/gl';
import { processCards } from '@/vendor/uma-tiers/tierlist-calc';
import { getDefaultScenario } from '@/vendor/uma-tiers/scenarios';

export const DEFAULT_SCENARIO: UmaTiersScenario = getDefaultScenario('gl');

export interface ScoredCard {
  score: number;
  lb: LimitBreak;
}

/** Map of every vendored row keyed "id:lb" (e.g. "30028:4"). */
export function cardRowsByKey(): Map<string, UmaTiersCard> {
  const m = new Map<string, UmaTiersCard>();
  for (const c of glCards) m.set(`${c.id}:${c.limit_break}`, c);
  return m;
}

/** euophrys training type (0-4, 6) → the scenario stat-subobject key. */
const TYPE_KEY: Record<number, keyof UmaTiersScenario> = {
  0: 'speed', 1: 'stamina', 2: 'power', 3: 'guts', 4: 'wisdom', 6: 'friend',
};

export function resolveDeckObjects(deck: DeckState, byKey: Map<string, UmaTiersCard>): UmaTiersCard[] {
  const out: UmaTiersCard[] = [];
  deck.slots.forEach((cardId, i) => {
    if (!cardId) return;
    const row = byKey.get(`${cardId}:${deck.slotLb[i] ?? 4}`);
    if (row) out.push(row);
  });
  return out;
}

export function scoreCards(
  scenario: UmaTiersScenario,
  deckObjs: UmaTiersCard[],
  rows: UmaTiersCard[],
): Map<string, ScoredCard> {
  const byType = new Map<number, UmaTiersCard[]>();
  for (const c of rows) {
    const t = c.type;
    if (!(t in TYPE_KEY)) continue;
    (byType.get(t) ?? byType.set(t, []).get(t)!).push(c);
  }
  const out = new Map<string, ScoredCard>();
  for (const [type, typeRows] of byType) {
    const stat = scenario[TYPE_KEY[type]] as Record<string, unknown>;
    const weights = { ...stat, ...scenario.general } as never;
    for (const scored of processCards(typeRows, weights, deckObjs)) {
      out.set(String(scored.id), { score: scored.score, lb: scored.lb as LimitBreak });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/cardScore.test.ts`
Expected: PASS (all 4). If the Kitasan rank assertion fails, log the top-5 ids to confirm the join/weights, then adjust only if the data genuinely ranks differently (do not loosen below top-10).

- [ ] **Step 5: Commit**

```bash
git add src/core/cardScore.ts src/core/cardScore.test.ts
git commit -m "feat(m1.6): per-type card-score wrapper over vendored scorer"
```

---

### Task 3: `cardMatches.ts` — wishlist matching

**Files:**
- Create: `src/core/cardMatches.ts`
- Test: `src/core/cardMatches.test.ts`

**Interfaces:**
- Consumes: `SupportCardRecord` (`@/core/types`).
- Produces:
  - `matchedSkillIds(card: SupportCardRecord, wishlist: ReadonlySet<string>): string[]` — wishlist skill ids the card provides (any sourceType), de-duped, in card order.
  - `matchCount(card, wishlist): number` — `matchedSkillIds(...).length`.

- [ ] **Step 1: Write the failing test**

```ts
// src/core/cardMatches.test.ts
import { describe, expect, it } from 'vitest';
import { matchCount, matchedSkillIds } from './cardMatches';
import type { SupportCardRecord } from '@/core/types';

const card = {
  cardId: '30028', skills: [
    { skillId: '200001', sourceType: 'hint_pool' },
    { skillId: '200002', sourceType: 'chain' },
    { skillId: '200001', sourceType: 'random_event' },
  ],
} as unknown as SupportCardRecord;

describe('cardMatches', () => {
  it('returns wishlist skills the card provides, de-duped', () => {
    expect(matchedSkillIds(card, new Set(['200001', '999']))).toEqual(['200001']);
  });
  it('counts matches', () => {
    expect(matchCount(card, new Set(['200001', '200002']))).toBe(2);
    expect(matchCount(card, new Set())).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — Run: `pnpm vitest run src/core/cardMatches.test.ts`; Expected: FAIL (no export).

- [ ] **Step 3: Write the implementation**

```ts
// src/core/cardMatches.ts
/** M1.6 — cross a support card's provided skills against the plan wishlist. Exact (P3). */
import type { SupportCardRecord } from '@/core/types';

export function matchedSkillIds(card: SupportCardRecord, wishlist: ReadonlySet<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of card.skills) {
    if (wishlist.has(s.skillId) && !seen.has(s.skillId)) {
      seen.add(s.skillId);
      out.push(s.skillId);
    }
  }
  return out;
}

export function matchCount(card: SupportCardRecord, wishlist: ReadonlySet<string>): number {
  return matchedSkillIds(card, wishlist).length;
}
```

- [ ] **Step 4: Run test to verify it passes** — Expected: PASS (both).

- [ ] **Step 5: Commit**

```bash
git add src/core/cardMatches.ts src/core/cardMatches.test.ts
git commit -m "feat(m1.6): wishlist match-count helpers"
```

---

### Task 4: `useScoreWeights` hook

**Files:**
- Create: `src/features/inheritance/useScoreWeights.ts`
- Test: `src/features/inheritance/useScoreWeights.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_SCENARIO` (Task 2), `UmaTiersScenario`.
- Produces: `useScoreWeights(): { scenario: UmaTiersScenario; setScenario: (s: UmaTiersScenario) => void; reset: () => void }`. Persists to `localStorage['scb_score_weights']`, guarded like `useDeckState`; on version mismatch (`parsed.version !== DEFAULT_SCENARIO.version`) falls back to defaults.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/inheritance/useScoreWeights.test.ts
import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useScoreWeights } from './useScoreWeights';
import { DEFAULT_SCENARIO } from '@/core/cardScore';

afterEach(() => localStorage.clear());

describe('useScoreWeights', () => {
  it('defaults to the GL scenario', () => {
    const { result } = renderHook(() => useScoreWeights());
    expect(result.current.scenario.general.bondPerDay).toBe(DEFAULT_SCENARIO.general.bondPerDay);
  });
  it('persists changes and reset restores defaults', () => {
    const { result } = renderHook(() => useScoreWeights());
    act(() => result.current.setScenario({ ...result.current.scenario, general: { ...result.current.scenario.general, bondPerDay: 25 } }));
    expect(JSON.parse(localStorage.getItem('scb_score_weights')!).general.bondPerDay).toBe(25);
    act(() => result.current.reset());
    expect(result.current.scenario.general.bondPerDay).toBe(DEFAULT_SCENARIO.general.bondPerDay);
  });
  it('ignores a version-mismatched stored value', () => {
    localStorage.setItem('scb_score_weights', JSON.stringify({ version: -1 }));
    const { result } = renderHook(() => useScoreWeights());
    expect(result.current.scenario.version).toBe(DEFAULT_SCENARIO.version);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — Expected: FAIL (no export).

- [ ] **Step 3: Write the implementation**

```ts
// src/features/inheritance/useScoreWeights.ts
/** M1.6 — browser-local euophrys scoring scenario (guarded localStorage, like useDeckState). */
import { useState } from 'react';
import type { UmaTiersScenario } from '@/vendor/uma-tiers/index';
import { DEFAULT_SCENARIO } from '@/core/cardScore';

const KEY = 'scb_score_weights';

function read(): UmaTiersScenario {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw == null) return DEFAULT_SCENARIO;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === DEFAULT_SCENARIO.version) return parsed as UmaTiersScenario;
    return DEFAULT_SCENARIO;
  } catch {
    return DEFAULT_SCENARIO;
  }
}

export function useScoreWeights() {
  const [scenario, setState] = useState<UmaTiersScenario>(() => read());
  const persist = (s: UmaTiersScenario) => {
    setState(s);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
  };
  return { scenario, setScenario: persist, reset: () => persist(DEFAULT_SCENARIO) };
}
```

- [ ] **Step 4: Run test to verify it passes** — Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/useScoreWeights.ts src/features/inheritance/useScoreWeights.test.ts
git commit -m "feat(m1.6): browser-local scoring-weights hook"
```

---

### Task 5: `weightsPanelModel.ts` — pure setter helpers for the Weights panel

**Files:**
- Create: `src/features/inheritance/weightsPanelModel.ts`
- Test: `src/features/inheritance/weightsPanelModel.test.ts`

**Interfaces:**
- Produces:
  - `TYPE_TABS: { key: 'speed'|'stamina'|'power'|'guts'|'wisdom'|'friend'; label: string }[]` (render order).
  - `setStatWeight(s, typeKey, idx, val): UmaTiersScenario` — immutable; `s[typeKey].stats[idx] = val`.
  - `setGeneral(s, key, val)` / `setGeneralArray(s, key, idx, val)` — immutable updates of `s.general`.
  - `setStatField(s, typeKey, key: 'cap'|'minimum'|'prioritize'|'onlySummer', val)`.
  - `setUmaBonus(s, idx, val)` — `s.general.umaBonus[idx] = val`.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/inheritance/weightsPanelModel.test.ts
import { describe, expect, it } from 'vitest';
import { setGeneral, setGeneralArray, setStatWeight, setUmaBonus } from './weightsPanelModel';
import { DEFAULT_SCENARIO } from '@/core/cardScore';

describe('weightsPanelModel', () => {
  it('sets a stat weight immutably', () => {
    const next = setStatWeight(DEFAULT_SCENARIO, 'speed', 0, 2.7);
    expect(next.speed.stats[0]).toBe(2.7);
    expect(DEFAULT_SCENARIO.speed.stats[0]).not.toBe(2.7); // original untouched
  });
  it('sets a general scalar and an array slot', () => {
    expect(setGeneral(DEFAULT_SCENARIO, 'bondPerDay', 12).general.bondPerDay).toBe(12);
    expect(setGeneralArray(DEFAULT_SCENARIO, 'races', 0, 9).general.races[0]).toBe(9);
  });
  it('sets an uma bonus', () => {
    expect(setUmaBonus(DEFAULT_SCENARIO, 1, 1.1).general.umaBonus[1]).toBe(1.1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — Expected: FAIL (no export).

- [ ] **Step 3: Write the implementation**

```ts
// src/features/inheritance/weightsPanelModel.ts
/** M1.6 — pure immutable setters for ScoreWeightsPanel (mirrors euophrys Weights.jsx state). */
import type { UmaTiersScenario } from '@/vendor/uma-tiers/index';

export type TypeKey = 'speed' | 'stamina' | 'power' | 'guts' | 'wisdom' | 'friend';
export const TYPE_TABS: { key: TypeKey; label: string }[] = [
  { key: 'speed', label: 'Speed' }, { key: 'stamina', label: 'Stamina' },
  { key: 'power', label: 'Power' }, { key: 'guts', label: 'Guts' },
  { key: 'wisdom', label: 'Wisdom' }, { key: 'friend', label: 'Friend' },
];

const clone = (s: UmaTiersScenario): UmaTiersScenario => JSON.parse(JSON.stringify(s));

export function setStatWeight(s: UmaTiersScenario, typeKey: TypeKey, idx: number, val: number) {
  const n = clone(s); (n[typeKey] as { stats: number[] }).stats[idx] = val; return n;
}
export function setStatField(s: UmaTiersScenario, typeKey: TypeKey, key: 'cap' | 'minimum' | 'prioritize' | 'onlySummer', val: number | boolean) {
  const n = clone(s); (n[typeKey] as Record<string, unknown>)[key] = val; return n;
}
export function setGeneral(s: UmaTiersScenario, key: keyof UmaTiersScenario['general'], val: number) {
  const n = clone(s); (n.general as Record<string, unknown>)[key] = val; return n;
}
export function setGeneralArray(s: UmaTiersScenario, key: 'races', idx: number, val: number) {
  const n = clone(s); (n.general[key] as number[])[idx] = val; return n;
}
export function setUmaBonus(s: UmaTiersScenario, idx: number, val: number) {
  const n = clone(s); n.general.umaBonus[idx] = val; return n;
}
```

- [ ] **Step 4: Run test to verify it passes** — Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/weightsPanelModel.ts src/features/inheritance/weightsPanelModel.test.ts
git commit -m "feat(m1.6): pure setters for the scoring-weights panel"
```

---

### Task 6: `ScoreWeightsPanel.tsx` — provider-free Weights panel

**Files:**
- Create: `src/features/inheritance/ScoreWeightsPanel.tsx`
- Modify: `src/features/inheritance/inheritance.css` (add `.inh-weights*` rules)
- Test: `src/features/inheritance/ScoreWeightsPanel.test.tsx`

**Interfaces:**
- Consumes: `weightsPanelModel` setters + `TYPE_TABS` (Task 5), `UmaTiersScenario`.
- Produces: `<ScoreWeightsPanel scenario onChange={(s)=>void} onReset={()=>void} />`. No providers used (pure props). Collapsible; renders the type tabs, the gated "Customize settings" controls, and the always-on Uma's Bonuses — matching `Weights.jsx` ranges from the spec.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/inheritance/ScoreWeightsPanel.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ScoreWeightsPanel } from './ScoreWeightsPanel';
import { DEFAULT_SCENARIO } from '@/core/cardScore';

afterEach(cleanup);

describe('ScoreWeightsPanel', () => {
  it('shows the active-type speed weight and emits a change', () => {
    const onChange = vi.fn();
    render(<ScoreWeightsPanel scenario={DEFAULT_SCENARIO} onChange={onChange} onReset={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /customize settings/i }));
    const spd = screen.getByLabelText(/^speed weight$/i);
    fireEvent.change(spd, { target: { value: '2.7' } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.lastCall![0].speed.stats[0]).toBe(2.7);
  });
  it('switches the active type tab', () => {
    render(<ScoreWeightsPanel scenario={DEFAULT_SCENARIO} onChange={vi.fn()} onReset={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^stamina$/i }));
    fireEvent.click(screen.getByRole('button', { name: /customize settings/i }));
    expect(screen.getByLabelText(/^speed weight$/i)).toHaveValue(DEFAULT_SCENARIO.stamina.stats[0]);
  });
  it('reset button calls onReset', () => {
    const onReset = vi.fn();
    render(<ScoreWeightsPanel scenario={DEFAULT_SCENARIO} onChange={vi.fn()} onReset={onReset} />);
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(onReset).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — Expected: FAIL (no component).

- [ ] **Step 3: Implement the component**

Build `ScoreWeightsPanel` with local `useState` for `currentState` (active type tab) and `show` (customize toggle). Each input is controlled from `scenario` and on change calls the matching `weightsPanelModel` setter then `onChange(next)`. Use `inh-deck` card grammar (head "Scoring weights" + a caret collapse), then:
- A row of 6 type-tab `<button>`s (`TYPE_TABS`), the active one highlighted.
- A "Customize settings" toggle button (`aria-expanded={show}`); when `show`:
  - Bond Rate `<input type="number" aria-label="Bond rate" min={1} max={40} step={0.5}>` → `setGeneral('bondPerDay')`.
  - Optional Races: 3 numbers (G1/G2-3/OP) `min=0 max=30 step=1` → `setGeneralArray('races', i)`.
  - Multiplier (`min1 max2.2 step0.05` → `setGeneral('multi')`) + Spec Bonus (`min-1 max95 step5` → `setGeneral('bonusSpec')`).
  - 7 Stat Weights `min0 max3 step0.1` → `setStatWeight(currentState, i)`; **`aria-label` = `"<Speed|Stamina|Power|Guts|Wit|Skill Pts|Energy> weight"`** (the test queries `/^speed weight$/i`).
  - Motivation slider `min-0.2 max0.2 step0.05` → `setGeneral('motivation')` (show `%`).
  - Stat Cap slider `min300 max1000 step20` → `setStatField(currentState,'cap')`.
  - Min Train Score slider `min0 max50 step1` → `setStatField(currentState,'minimum')`.
  - When `currentState !== 'friend'`: Prioritize + Only-Summer checkboxes → `setStatField`.
- Uma's Bonuses (always shown, **outside** the `show` gate): 5 numbers spd/sta/pow/guts/wis `min0.7 max1.3 step0.01` → `setUmaBonus(i)`.
- A "Reset to defaults" button → `onReset()`.
- A muted caption: *"Training power · URA scenario · via euophrys — affects the Effect score only."* with a link to `https://euophrys.github.io/uma-tiers/#/global`.

Keep all `<input>`s with an associated `<label>`/`aria-label`. Scope any input CSS under `.inh-weights …` so the global `input[type=number]` rule doesn't win.

- [ ] **Step 4: Run test to verify it passes** — Run: `pnpm vitest run src/features/inheritance/ScoreWeightsPanel.test.tsx`; Expected: PASS (all 3). Re-run once if it flakes.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add src/features/inheritance/ScoreWeightsPanel.tsx src/features/inheritance/ScoreWeightsPanel.test.tsx src/features/inheritance/inheritance.css
git commit -m "feat(m1.6): provider-free scoring-weights panel (mirrors euophrys)"
```

**PR-A boundary:** open a PR into `feat/m1-inheritance-workbench` ("M1.6a — support-card scoring foundation"). Run `pnpm build` first.

---

# PR-B — Pool panel + page wiring (Tasks 7–13)

### Task 7: `poolModel.ts` — view-model, filtering, sorting (pure)

**Files:**
- Create: `src/features/inheritance/poolModel.ts`
- Test: `src/features/inheritance/poolModel.test.ts`

**Interfaces:**
- Consumes: `SupportCardRecord`, `ScoredCard` (Task 2), `matchedSkillIds` (Task 3), `TYPE_COLORS`/`TYPE_LABEL` (`deckOps`).
- Produces:
  - `PoolFilters = { rarity: 'all'|'R'|'SR'|'SSR'; type: 'all'|CardType; skill: string|null; search: string }`.
  - `PoolSort = 'matches' | 'effect'`.
  - `buildPoolItem(card, opts): PoolItem` where `opts = { score?: number; wishlist: ReadonlySet<string>; lb: LimitBreak }` and `PoolItem = { cardId; name; charName; rarity; type; typeColor; typeLabel; score: number|null; matchCount; matchedIds: string[]; chain: string[]; random: string[]; hint: string[] }` (chain/random/hint = skill ids by sourceType).
  - `filterPool(items, filters, cardSkillIndex): PoolItem[]` (skill filter uses `card.skills`; search matches name/charName case-insensitively).
  - `sortPool(items, sort): PoolItem[]` — `matches`: matchCount desc then score desc then name; `effect`: score desc (nulls last) then name.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/inheritance/poolModel.test.ts
import { describe, expect, it } from 'vitest';
import { buildPoolItem, filterPool, sortPool } from './poolModel';
import type { SupportCardRecord } from '@/core/types';

const mk = (id: string, type: SupportCardRecord['type'], rarity: SupportCardRecord['rarity'], name: string, skills: { skillId: string; sourceType: string }[] = []) =>
  ({ cardId: id, nameEn: name, charName: name, rarity, type, skills } as unknown as SupportCardRecord);

describe('poolModel', () => {
  const wishlist = new Set(['s1']);
  const a = buildPoolItem(mk('1', 'speed', 'SSR', 'Alpha', [{ skillId: 's1', sourceType: 'chain' }]), { score: 10, wishlist, lb: 4 });
  const b = buildPoolItem(mk('2', 'stamina', 'SR', 'Beta'), { score: 20, wishlist, lb: 4 });
  const c = buildPoolItem(mk('3', 'speed', 'SSR', 'Gamma'), { wishlist, lb: 4 }); // no score → null

  it('builds an item with match + chain classification', () => {
    expect(a.matchCount).toBe(1);
    expect(a.chain).toEqual(['s1']);
    expect(c.score).toBeNull();
  });
  it('filters by rarity/type/search', () => {
    const all = [a, b, c];
    expect(filterPool(all, { rarity: 'SSR', type: 'all', skill: null, search: '' }).map((i) => i.cardId)).toEqual(['1', '3']);
    expect(filterPool(all, { rarity: 'all', type: 'speed', skill: null, search: 'gam' }).map((i) => i.cardId)).toEqual(['3']);
  });
  it('sorts by matches then effect', () => {
    expect(sortPool([b, a, c], 'matches').map((i) => i.cardId)).toEqual(['1', '2', '3']); // a matches → first
    expect(sortPool([a, b, c], 'effect').map((i) => i.cardId)).toEqual(['2', '1', '3']); // 20,10,null
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — Expected: FAIL (no export).

- [ ] **Step 3: Implement** `poolModel.ts` per the Interfaces block: `buildPoolItem` reads `card.skills` into `chain`/`random`/`hint` id arrays (by `sourceType`: `'chain'` → chain; `'random_event'` → random; `'hint_pool'` → hint), computes `matchedIds`/`matchCount` via `matchedSkillIds`, resolves `typeColor`/`typeLabel` from `deckOps`, and sets `score = opts.score ?? null`. `filterPool` applies rarity (`'all'` passes), type, skill (`item.matchedIds`/card-skill membership), and a lowercased `search` over `name`+`charName`. `sortPool` per the two orders (nulls last for effect). Keep it pure.

- [ ] **Step 4: Run test to verify it passes** — Expected: PASS (all 3).

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/poolModel.ts src/features/inheritance/poolModel.test.ts
git commit -m "feat(m1.6): pool view-model + filter/sort helpers"
```

---

### Task 8: `SupportCardPoolCard.tsx` — shell, header, filters, Icon view

**Files:**
- Create: `src/features/inheritance/SupportCardPoolCard.tsx`
- Modify: `src/features/inheritance/inheritance.css` (`.inh-pool*` rules)
- Test: `src/features/inheritance/SupportCardPoolCard.test.tsx`

**Interfaces:**
- Consumes: `PoolItem`/`PoolFilters`/`PoolSort` (Task 7), `LimitBreak`.
- Produces:
```ts
interface SupportCardPoolCardProps {
  items: PoolItem[];                 // already scored+matched (page builds these)
  wishlistSkillNames: { id: string; name: string }[]; // for the Skill filter chips
  statsShown: string[];              // which stat-line fields to render
  cardLb: Record<string, LimitBreak>;
  onCardLb: (cardId: string, lb: LimitBreak) => void;
  deckCardIds: ReadonlySet<string>;  // to show "Added"/disable Add
  onAdd: (cardId: string) => void;
  renderIcon: (item: PoolItem) => React.ReactNode; // placeholder art (provider-free)
}
```
View state (`view: 'icon'|'art'|'plot'`, sort, filters, statsShown) is local. This task ships **Icon view** + header + filters + counts; Art/Plot are Tasks 9–10 (the view toggle shows all three but Art/Plot render "coming below" placeholders until then — OR gate the toggle to Icon only and widen in Task 9; pick gating to keep tests green).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/inheritance/SupportCardPoolCard.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SupportCardPoolCard } from './SupportCardPoolCard';
import { buildPoolItem } from './poolModel';
import type { SupportCardRecord } from '@/core/types';

const mk = (id: string, type: SupportCardRecord['type'], rarity: SupportCardRecord['rarity'], name: string) =>
  ({ cardId: id, nameEn: name, charName: name, rarity, type, skills: [] } as unknown as SupportCardRecord);
const items = [
  buildPoolItem(mk('1', 'speed', 'SSR', 'Alpha'), { score: 10, wishlist: new Set(), lb: 4 }),
  buildPoolItem(mk('2', 'stamina', 'SR', 'Beta'), { score: 20, wishlist: new Set(), lb: 4 }),
];
const base = {
  items, wishlistSkillNames: [], statsShown: [], cardLb: {}, onCardLb: vi.fn(),
  deckCardIds: new Set<string>(), onAdd: vi.fn(), renderIcon: () => <i />,
};
afterEach(cleanup);

describe('SupportCardPoolCard', () => {
  it('shows the count and both cards', () => {
    render(<SupportCardPoolCard {...base} />);
    expect(screen.getByText(/2 shown/i)).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });
  it('filters by rarity SSR', () => {
    render(<SupportCardPoolCard {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /^SSR$/ }));
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });
  it('Add calls onAdd; deck members show Added', () => {
    const onAdd = vi.fn();
    render(<SupportCardPoolCard {...base} onAdd={onAdd} deckCardIds={new Set(['2'])} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^add$/i })[0]);
    expect(onAdd).toHaveBeenCalledWith('1');
    expect(screen.getByText(/added/i)).toBeInTheDocument();
  });
  it('sort toggle reorders to effect (Beta first)', () => {
    render(<SupportCardPoolCard {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /effect/i }));
    const names = screen.getAllByTestId('pool-card-name').map((e) => e.textContent);
    expect(names[0]).toBe('Beta');
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — Expected: FAIL (no component).

- [ ] **Step 3: Implement** the shell (`inh-deck` grammar, head "Support cards" + "{filtered.length} shown"), the header-right view toggle (Icon·Art·Plot) + sort toggle (Matches·Effect), the filter rows (Rarity all/SSR/SR/R; Type all/SPD/STA/POW/GUT/WIT/FRD/GRP using `TYPE_COLORS`; Skill `Any`+`wishlistSkillNames`; Stats multi-toggle; search input). Compute `filtered = sortPool(filterPool(items, filters), sort)`. Icon view = a scrollable grid of tiles; each tile renders `renderIcon(item)`, name (`data-testid="pool-card-name"`), char, rarity badge, `E {score ?? '—'}` + `{matchCount} wishlist`, hint chips, LB diamonds (reuse the deck diamond markup; click → `onCardLb`), `draggable` setting `e.dataTransfer.setData('text/card-id', cardId)`, and an Add button → `onAdd(cardId)` shown as "Added"/disabled when `deckCardIds.has(cardId)`. Scope input CSS under `.inh-pool`.

- [ ] **Step 4: Run test to verify it passes** — Expected: PASS (all 4). Re-run once if flaky.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add src/features/inheritance/SupportCardPoolCard.tsx src/features/inheritance/SupportCardPoolCard.test.tsx src/features/inheritance/inheritance.css
git commit -m "feat(m1.6): support-card pool — shell, filters, Icon view"
```

---

### Task 9: Art view

**Files:**
- Modify: `src/features/inheritance/SupportCardPoolCard.tsx`
- Modify: `src/features/inheritance/inheritance.css`
- Test: `src/features/inheritance/SupportCardPoolCard.art.test.tsx`

**Interfaces:** Consumes the same props; switches on `view==='art'`. Renders Chain (green `--tier-chain`) + Random (orange `--tier-random`) event-skill chip rows from `item.chain`/`item.random` (mapped id→name via a `skillName(id)` prop — **add `skillName: (id:string)=>string` to props**), the stat line, LB + Add. Draggable.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/inheritance/SupportCardPoolCard.art.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SupportCardPoolCard } from './SupportCardPoolCard';
import { buildPoolItem } from './poolModel';
import type { SupportCardRecord } from '@/core/types';

const card = { cardId: '1', nameEn: 'Alpha', charName: 'Alpha', rarity: 'SSR', type: 'speed',
  skills: [{ skillId: 's1', sourceType: 'chain' }, { skillId: 's2', sourceType: 'random_event' }] } as unknown as SupportCardRecord;
const item = buildPoolItem(card, { score: 10, wishlist: new Set(), lb: 4 });
const props = { items: [item], wishlistSkillNames: [], statsShown: [], cardLb: {}, onCardLb: vi.fn(),
  deckCardIds: new Set<string>(), onAdd: vi.fn(), renderIcon: () => <i />, skillName: (id: string) => `name-${id}` };
afterEach(cleanup);

it('art view shows chain + random event skills', () => {
  render(<SupportCardPoolCard {...props} />);
  fireEvent.click(screen.getByRole('button', { name: /^art$/i }));
  expect(screen.getByText('name-s1')).toBeInTheDocument();
  expect(screen.getByText('name-s2')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails** — Expected: FAIL (Art view not implemented / `skillName` missing).
- [ ] **Step 3: Implement** the Art branch + add the `skillName` prop (default `(id)=>id` so Task 8's tests stay green).
- [ ] **Step 4: Run to verify it passes** — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(m1.6): support-card pool — Art view"`.

---

### Task 10: Plot view

**Files:**
- Modify: `src/features/inheritance/SupportCardPoolCard.tsx`
- Modify: `src/features/inheritance/inheritance.css`
- Test: `src/features/inheritance/SupportCardPoolCard.plot.test.tsx`

**Interfaces:** `view==='plot'` renders a hand-rolled SVG scatter — X = `matchCount`, Y = `score`; nodes type-colored, `onClick` → `onAdd`. Cards with `score===null` are omitted; a footnote reads "{k} cards have no score". Sort toggle hidden in Plot.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/inheritance/SupportCardPoolCard.plot.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { SupportCardPoolCard } from './SupportCardPoolCard';
import { buildPoolItem } from './poolModel';
import type { SupportCardRecord } from '@/core/types';
const mk = (id: string, name: string, score?: number) =>
  buildPoolItem({ cardId: id, nameEn: name, charName: name, rarity: 'SSR', type: 'speed', skills: [] } as unknown as SupportCardRecord, { score, wishlist: new Set(), lb: 4 });
const props = { items: [mk('1', 'Alpha', 10), mk('2', 'Beta')], wishlistSkillNames: [], statsShown: [],
  cardLb: {}, onCardLb: vi.fn(), deckCardIds: new Set<string>(), onAdd: vi.fn(), renderIcon: () => <i />, skillName: (id: string) => id };
afterEach(cleanup);
it('plot omits unscored cards and notes them; clicking a node adds', () => {
  const onAdd = vi.fn();
  render(<SupportCardPoolCard {...props} onAdd={onAdd} />);
  fireEvent.click(screen.getByRole('button', { name: /^plot$/i }));
  expect(screen.getByText(/1 cards have no score/i)).toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/add Alpha/i));
  expect(onAdd).toHaveBeenCalledWith('1');
});
```

- [ ] **Step 2: Run to verify it fails** — Expected: FAIL.
- [ ] **Step 3: Implement** the Plot SVG branch (scale matchCount→x, score→y over the scored subset; `<circle>`/`<g>` per node with `role="button"` + `aria-label={`add ${name}`}`; footnote for unscored count).
- [ ] **Step 4: Run to verify it passes** — Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "feat(m1.6): support-card pool — Plot view"`.

---

### Task 11: Wire pool + weights into `InheritancePage`

**Files:**
- Modify: `src/features/inheritance/InheritancePage.tsx`
- Test: `src/features/inheritance/InheritancePage.pool.test.tsx`

**Interfaces:**
- Consumes: `useGameData().cards`/`cardById`/`skillById`, `useScoreWeights`, `cardRowsByKey`/`resolveDeckObjects`/`scoreCards`, `buildPoolItem`, `useDeckState` (existing `deck`/`setDeck`), `addCardToDeck` (existing seam — **remove the `void addCardToDeck;` line**).
- Produces: the center column renders `<ScoreWeightsPanel>` + `<SupportCardPoolCard>` in place of `<Placeholder title="Support cards" phase="M1.6" />`.

- [ ] **Step 1: Write the failing test** (page renders the pool with cards from a mocked `useGameData`)

```tsx
// src/features/inheritance/InheritancePage.pool.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('@/app/ActivePlanContext', () => ({ useActivePlan: () => ({ uma1Plan: { umaId: 'u1', wishlist: [], sparkGoals: { blue: [], pink: [] } }, plan: null, setPlan: vi.fn() }) }));
vi.mock('@/features/parents/useUmas', () => ({ useUmas: () => ({ umas: [], umaById: new Map() }), umaName: (_: unknown, id: string) => id }));
vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({
    cardById: new Map(),
    skillById: new Map(),
    cards: [{ cardId: '30028', nameEn: 'Kitasan', charName: 'Kitasan', rarity: 'SSR', type: 'speed', skills: [] }],
  }),
}));
import { InheritancePage } from './InheritancePage';
afterEach(cleanup);

it('renders the support-card pool with a card', async () => {
  render(<InheritancePage deps={{ loadCatalog: () => Promise.resolve([]) }} />);
  await waitFor(() => expect(screen.getByText('Support cards')).toBeInTheDocument());
  expect(screen.getByText('Kitasan')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails** — Expected: FAIL (placeholder still rendered / pool absent).

- [ ] **Step 3: Implement the wiring** in `InheritancePage.tsx`:
  - `const { scenario, setScenario, reset } = useScoreWeights();`
  - `const { cards, skillById } = useGameData();`
  - `const wishlist = useMemo(() => new Set((uma1Plan?.wishlist ?? []).map((w) => w.skillId)), [uma1Plan]);`
  - `const byKey = useMemo(cardRowsByKey, []);`
  - `const deckObjs = useMemo(() => resolveDeckObjects(deck, byKey), [deck, byKey]);`
  - `const rows = useMemo(() => cards.map((c) => byKey.get(`${c.cardId}:${cardLb[c.cardId] ?? 4}`)).filter(Boolean), [cards, cardLb, byKey]);`
  - `const scores = useMemo(() => scoreCards(scenario, deckObjs, rows as never), [scenario, deckObjs, rows]);`
  - `const items = useMemo(() => cards.map((c) => buildPoolItem(c, { score: scores.get(c.cardId)?.score, wishlist, lb: cardLb[c.cardId] ?? 4 })), [cards, scores, wishlist, cardLb]);`
  - `cardLb` state: `const [cardLb, setCardLb] = useState<Record<string, LimitBreak>>({});`
  - Render `<ScoreWeightsPanel scenario={scenario} onChange={setScenario} onReset={reset} />` and `<SupportCardPoolCard items={items} wishlistSkillNames={wishlist...→names via skillById} statsShown=... cardLb={cardLb} onCardLb={(id,lb)=>setCardLb({...cardLb,[id]:lb})} deckCardIds={new Set(deck.slots.filter(Boolean) as string[])} onAdd={addCardToDeck} renderIcon={(it)=> <span className="cmp-portrait-ph">{it.typeLabel}</span>} skillName={(id)=>skillById.get(id)?.nameEn ?? id} />` replacing the `M1.6` placeholder. Remove `void addCardToDeck;`.

- [ ] **Step 4: Run to verify it passes** — Expected: PASS. Then run the existing route smoke test and **update its `useGameData` mock** to include `cards: []`, `skillById: new Map()`:

Run: `pnpm vitest run src/app/App.inheritance.test.tsx src/features/inheritance/InheritancePage.pool.test.tsx`
Expected: PASS (fix the smoke-test mock if it errors on `cards`/`skillById`).

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm typecheck
git add src/features/inheritance/InheritancePage.tsx src/features/inheritance/InheritancePage.pool.test.tsx src/app/App.inheritance.test.tsx
git commit -m "feat(m1.6): wire support-card pool + scoring weights into the workbench"
```

---

### Task 12: Full build + manual smoke

**Files:** none (verification).

- [ ] **Step 1: Build + full test run**

Run: `pnpm build` then `pnpm test`
Expected: typecheck + vite build green; all tests pass (re-run any single flaky UI file once).

- [ ] **Step 2: Manual smoke (optional but recommended)**

Run `pnpm dev` (surface the tailnet URL from `.env.local`), open `/inheritance`: confirm the pool lists cards, filters/sort/view-toggle work, `E` shows a number (or `—`), dragging a tile onto a deck slot and the `+ Add` button both fill the deck at the tile's LB, and editing a weight reorders the Effect sort.

- [ ] **Step 3: Commit** (only if a fix was needed) — `git commit -am "fix(m1.6): <whatever build/smoke surfaced>"`.

---

### Task 13: Docs

**Files:**
- Modify: `docs/modules/module-1-inheritance.md` (add an "M1.6 Support cards" section + gotchas)
- Modify: `CLAUDE.md` (M1 status line → M1.6 done; add a gotcha about per-type scoring + the vendored uma-tiers)
- Modify: `docs/roadmap.md` (mark M1.6 built)

- [ ] **Step 1:** Add the M1.6 section to `module-1-inheritance.md`: the pool panel (Icon/Art/Plot), euophrys vendored scorer (`src/vendor/uma-tiers/`, MIT, per-type scoring, off-axis caveat), the files (`cardScore.ts`/`cardMatches.ts`/`poolModel.ts`/`useScoreWeights.ts`/`ScoreWeightsPanel.tsx`/`SupportCardPoolCard.tsx`), browser-local `scb_score_weights`, and the gotchas (weights is a flat merge; `selectedCards` are objects; scoring is per-type; re-pull vendored files on euophrys updates).

- [ ] **Step 2:** Update the M1 row/status in `CLAUDE.md` and the roadmap line. Keep edits to one line each where possible.

- [ ] **Step 3: Commit**

```bash
git add docs/modules/module-1-inheritance.md CLAUDE.md docs/roadmap.md
git commit -m "docs(m1.6): record support-card pool landing"
```

**PR-B boundary:** open a PR into `feat/m1-inheritance-workbench` ("M1.6b — support-card pool UI"). Run `pnpm build` first.

---

## Self-Review

**Spec coverage:**
- Vendoring (4 files + provenance + MIT) → Task 1. ✓
- Per-type `scoreCards` + `DEFAULT_SCENARIO` + deck-context → Task 2. ✓
- Matches → Task 3. ✓
- Browser-local weights → Task 4; pure setters → Task 5; Weights panel 1:1 (type tabs, gated customize, uma bonuses, ranges) → Task 6. ✓
- Pool view-model + filters/sort → Task 7; shell+filters+Icon → Task 8; Art → Task 9; Plot → Task 10. ✓
- Page wiring (replace placeholder, `onAdd`→`addCardToDeck`, drag target reuse, `cardLb`, route-mock update) → Task 11. ✓
- Honesty (`—`/omit, captions, deep-link) → Tasks 6 (caption) + 8/10 (`—`/omit). ✓
- Docs/provenance → Tasks 1 + 13. ✓
- Out-of-scope (M1.7 coverage matrix, real art, non-surfaced scenario internals) → not tasked. ✓

**Placeholder scan:** UI tasks (6, 8–10) describe component structure with exact prop interfaces, exact `aria-label`/`data-testid` strings the tests query, exact euophrys ranges, and full test code — no "TBD"/"add error handling". Logic tasks carry complete code.

**Type consistency:** `UmaTiersScenario`/`UmaTiersCard`/`UmaTiersWeights` (Task 1 shim) used consistently in Tasks 2/4/5/6. `ScoredCard` (Task 2) consumed in 7/11. `PoolItem`/`PoolFilters`/`PoolSort` (Task 7) consumed in 8–11. `scoreCards`/`cardRowsByKey`/`resolveDeckObjects` names stable across 2/11. `matchedSkillIds`/`matchCount` stable across 3/7. `skillName` prop added in Task 9 with a default so Task 8 tests stay green. ✓
