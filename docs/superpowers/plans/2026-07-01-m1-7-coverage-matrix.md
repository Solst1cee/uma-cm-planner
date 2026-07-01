# M1.7 Coverage Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the M1.7 "Obtainable vs. wishlist" coverage-matrix card — crossing each wishlist skill against where it can be obtained (innate · parent · grandparent · deck hint/chain/random) with real inherit-%, plus a Coverage-bars view and a bonus list.

**Architecture:** Approach A — three new pure cores (`greenSparkReconcile`, `g1Saddle`, `coverageMatrix`) that reuse the M1.0 spark math (`spark.ts`/`lineageAffinity.ts`) and M4 sourcing (`coverage.ts` `tierForCardSkill`), rendered by a provider-free `CoverageMatrixCard` that `InheritancePage` wires with data. Two data reconciliations (green `100xxx→9xxxxx`, `wonRaces→G1`) and one pipeline change (per-uma `innateSkills`) round it out.

**Tech Stack:** TypeScript, React 19, Vitest (jsdom) + React Testing Library, Vite. Path alias `@/*` → `src/*`. Package manager pnpm.

**Spec:** [docs/superpowers/specs/2026-07-01-m1-7-coverage-matrix-design.md](../specs/2026-07-01-m1-7-coverage-matrix-design.md).

## Global Constraints

- **Pure-function core (P6):** all mechanics logic lives in `src/core/` as pure TS; cores are 100% unit-tested. UI is a thin layer.
- **Honest numbers (P3):** inherit-% uses real M1.0 spark math (`sparkChance` + `planLineageAffinity`), never the prototype `{1:18,2:27,3:36}` placeholder. Never fabricate a G1 win or an innate skill; unmapped/absent data degrades to empty, not to a guess.
- **Hand-patchable data (P5):** new datasets get a sibling under `data-overrides/`; never edit generated `public/data/` by hand.
- **Provider-free panels:** feature cards take data + render nodes as props (like `SupportCardPoolCard`); the page injects `useGameData`/`useRoster`/`useAffinityIndex`. Tests inject stub data — no provider needed.
- **Windows case-FS gotcha:** a component file and its pure-helper sibling must not differ only by case. Use distinct names (`coverageMatrix.ts` helper vs `CoverageMatrixCard.tsx` component — already distinct).
- **Column model:** `Innate ‖ Parent | G.parent ‖ Hint | Chain | Random`. `sourceType` map: `hint_pool`→Hint, `chain`→Chain, `random_event`+`date_event`→Random.
- **Run tests race-free:** do NOT run vitest while `pnpm dev` is running (HMR race). Trust `pnpm typecheck` + targeted `pnpm vitest run <file>`.
- Commit message trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Reference: existing signatures this plan consumes (verbatim)

```ts
// src/core/types.ts
export type Stat = 'spd' | 'sta' | 'pow' | 'gut' | 'wit';
export type SkillRarity = 'white' | 'gold' | 'unique' | 'inherited_unique';
export type SkillSourceType = 'chain' | 'hint_pool' | 'random_event' | 'date_event';
export interface CardSkill { skillId: string; sourceType: SkillSourceType; hintLevels?: number; }
export interface SupportCardRecord { cardId: string; nameEn: string; charName: string; rarity: 'R'|'SR'|'SSR'; type: CardType; perLevel: CardPerLevel[]; skills: CardSkill[]; hintPoolSize: number; /*…*/ }
export interface SkillRecord { skillId: string; nameEn: string; rarity: SkillRarity; /*…*/ }
export interface WishlistItem { skillId: string; priority: Priority; source: 'targeted'; /*…*/ }
export interface Parent { id: string; umaId: string; blueSpark:{stat:Stat;stars:1|2|3}; pinkSpark:{aptitude:string;stars:1|2|3};
  greenSpark?: { skillId: string; stars: 1|2|3; sourceCardId?: string };
  whiteSparks: Array<{ skillId: string; stars: 1|2|3 }>;
  grandparents?: [ParentRef?, ParentRef?]; affinityHint?: number; wonRaces?: string[]; /*…*/ }
export interface ParentRef { umaId: string; whiteSparks?: Array<{skillId:string;stars:1|2|3}>; greenSpark?: {skillId:string;stars:1|2|3}; wonRaces?: string[]; /*…*/ }
export interface UmaRecord { umaId: string; charaId: string; nameEn: string; epithet?: string; statGrowth?: Record<Stat,number>; baseAptitudes?: {/*…*/}; server: Server; dataVersion: string; }
export interface CmPlan { umaId: string; uniqueSkillId: string; uniqueIsInherited?: boolean; wishlist: WishlistItem[]; parents: { a?: string; b?: string }; /*…*/ }
export interface LineageAffinity { memberScores: { parentA:number; parentB:number; gA1:number; gA2:number; gB1:number; gB2:number }; /*…*/ }

// src/core/coverage.ts
export function tierForCardSkill(card: SupportCardRecord, lb: LimitBreak, sourceType: SkillSourceType): Tier;
// Tier ∈ 'chain'|'date_event'|'random'|'hint_strong'|'hint_weak'|'scenario' (+others)

// src/core/spark.ts
export function sparkChance(args: { parents: Parent[]; skillId: string; rates: SparkRates;
  opts?: { grandparentAffinity?: number;
           memberAffinity?: (ctx:{parentId:string;grandparent:boolean;gpIndex:number}) => number | undefined;
           skillRarity?: ReadonlyMap<string,SkillRarity> | ((id:string)=>SkillRarity|undefined); }
}): { pct: number; approximate: boolean; contributions: SparkContribution[] };

// src/core/lineageAffinity.ts
export function planLineageAffinity(idx: AffinityIndex, traineeUmaId: string, parentA: Parent, parentB: Parent): LineageAffinity;
// src/core/winBonus.ts
export function computeWinBonus(lin: WinBonusLineage): WinBonus;  // uses sharedG1(a,b) internally

// hooks (feature layer)
useGameData(): { cards: SupportCardRecord[]; sparkRates: SparkRates; skillById: Map<string,SkillRecord>; cardById: Map<string,SupportCardRecord>; skills: SkillRecord[]; /*…*/ }
useRoster(): { roster: Parent[]; importedAt: string | null }
useAffinityIndex(): AffinityIndex | null
useDeckState(): [ { slots: Array<string|null>; slotLb: LimitBreak[] }, (n)=>void ]
// src/features/cm-planner/HeaderHelp.tsx
export function HeaderHelp({ label, children }: { label: string; children: ReactNode }): JSX.Element;
```

---

## Task 1: `greenSparkReconcile` core — native-unique → inherited-unique id map

**Files:**
- Create: `src/core/greenSparkReconcile.ts`
- Test: `src/core/greenSparkReconcile.test.ts`

**Interfaces:**
- Consumes: `SkillRecord` from `@/core/types`.
- Produces:
  - `buildUniqueToInheritedMap(skills: SkillRecord[]): { map: Map<string,string>; unresolved: string[] }`
  - `reconcileGreenSkillId(id: string, map: Map<string,string>): string`

**Data facts (verified against `public/data/skills.json`):** native uniques are `10xxxx`/`11xxxx`; inherited-unique (green) are `90xxxx`/`91xxxx`. The numeric relationship is a leading-prefix swap: `100011 ↔ 900011`, `110011 ↔ 910011` (replace leading `10`→`90`, `11`→`91`). Name-match agrees on 86/87. Reconcile prefers the numeric map; validates by name; reports the 1 miss in `unresolved`.

- [ ] **Step 1: Write the failing test**

```ts
// src/core/greenSparkReconcile.test.ts
import { describe, expect, it } from 'vitest';
import { buildUniqueToInheritedMap, reconcileGreenSkillId } from './greenSparkReconcile';
import type { SkillRecord } from './types';

const s = (skillId: string, nameEn: string, rarity: SkillRecord['rarity']): SkillRecord =>
  ({ skillId, nameEn, nameJp: '', baseSpCost: 0, rarity, iconId: '0', server: 'global', dataVersion: 't' });

const SKILLS: SkillRecord[] = [
  s('100011', 'Shooting Star', 'unique'),
  s('900011', 'Shooting Star', 'inherited_unique'),
  s('110011', "Dazzl'n Diver", 'unique'),
  s('910011', "Dazzl'n Diver", 'inherited_unique'),
  s('200012', 'Corner Recovery', 'white'), // unrelated
];

describe('buildUniqueToInheritedMap', () => {
  it('maps native unique → inherited-unique by prefix swap, validated by name', () => {
    const { map, unresolved } = buildUniqueToInheritedMap(SKILLS);
    expect(map.get('100011')).toBe('900011');
    expect(map.get('110011')).toBe('910011');
    expect(unresolved).toEqual([]);
  });

  it('reports a native unique with no matching inherited-unique as unresolved', () => {
    const orphan = [s('100999', 'Orphan Unique', 'unique')];
    const { map, unresolved } = buildUniqueToInheritedMap(orphan);
    expect(map.has('100999')).toBe(false);
    expect(unresolved).toEqual(['100999']);
  });
});

describe('reconcileGreenSkillId', () => {
  it('returns the inherited-unique id for a native unique id', () => {
    const { map } = buildUniqueToInheritedMap(SKILLS);
    expect(reconcileGreenSkillId('100011', map)).toBe('900011');
  });
  it('is idempotent on an already-inherited (9xxxxx) id', () => {
    const { map } = buildUniqueToInheritedMap(SKILLS);
    expect(reconcileGreenSkillId('900011', map)).toBe('900011');
  });
  it('returns the input unchanged when unmapped', () => {
    const { map } = buildUniqueToInheritedMap(SKILLS);
    expect(reconcileGreenSkillId('100999', map)).toBe('100999');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/greenSparkReconcile.test.ts`
Expected: FAIL — "Failed to resolve import './greenSparkReconcile'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/greenSparkReconcile.ts
/**
 * M1.7 — reconcile a parent's stored native-unique green-spark id
 * (100xxx/110xxx, what UmaExtractor decodes) to the canonical inherited-unique
 * (9xxxxx) id used by skills.json / coverage math (mechanics-notes §8).
 *
 * Native uniques are 10xxxx/11xxxx; inherited-unique (green) are 90xxxx/91xxxx.
 * The relationship is a leading-prefix swap (10→90, 11→91), cross-checked by
 * name. Pure; derived entirely from committed skills.json.
 */
import type { SkillRecord } from '@/core/types';

/** 100011 → 900011, 110011 → 910011; undefined if not a 10xxxx/11xxxx id. */
function inheritedIdFromNative(nativeId: string): string | undefined {
  if (/^10\d{4}$/.test(nativeId)) return '90' + nativeId.slice(2);
  if (/^11\d{4}$/.test(nativeId)) return '91' + nativeId.slice(2);
  return undefined;
}

export function buildUniqueToInheritedMap(skills: SkillRecord[]): {
  map: Map<string, string>;
  unresolved: string[];
} {
  const inheritedIds = new Set(
    skills.filter((s) => s.rarity === 'inherited_unique').map((s) => s.skillId),
  );
  const nameByInheritedId = new Map(
    skills.filter((s) => s.rarity === 'inherited_unique').map((s) => [s.skillId, s.nameEn]),
  );
  const map = new Map<string, string>();
  const unresolved: string[] = [];
  for (const s of skills) {
    if (s.rarity !== 'unique') continue;
    const candidate = inheritedIdFromNative(s.skillId);
    if (candidate && inheritedIds.has(candidate)) {
      map.set(s.skillId, candidate);
      continue;
    }
    // Fallback: name-match against an inherited-unique.
    const byName = [...nameByInheritedId.entries()].find(([, n]) => n === s.nameEn);
    if (byName) map.set(s.skillId, byName[0]);
    else unresolved.push(s.skillId);
  }
  return { map, unresolved };
}

export function reconcileGreenSkillId(id: string, map: Map<string, string>): string {
  return map.get(id) ?? id;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/greenSparkReconcile.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Guard against real-data regression (optional smoke)**

Add to the test file, using the real dataset to assert coverage:

```ts
import skillsJson from '../../public/data/skills.json';
it('real skills.json resolves at least 86 of 87 native uniques', () => {
  const skills = (skillsJson as { skills?: SkillRecord[] }).skills ?? (skillsJson as unknown as SkillRecord[]);
  const { map, unresolved } = buildUniqueToInheritedMap(skills);
  expect(map.size).toBeGreaterThanOrEqual(86);
  expect(unresolved.length).toBeLessThanOrEqual(1);
});
```

Run: `pnpm vitest run src/core/greenSparkReconcile.test.ts` → PASS.
(If the JSON import errors under the test tsconfig, drop this step — the unit tests above are sufficient.)

- [ ] **Step 6: Commit**

```bash
git add src/core/greenSparkReconcile.ts src/core/greenSparkReconcile.test.ts
git commit -m "feat(m1.7): greenSparkReconcile core — native-unique → inherited-unique id map

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `g1Saddle` core + empty overrides stub

**Files:**
- Create: `src/core/g1Saddle.ts`
- Create: `data-overrides/g1_saddle_ids.json`
- Test: `src/core/g1Saddle.test.ts`

**Interfaces:**
- Produces:
  - `isG1Saddle(saddleId: string, g1Set: ReadonlySet<string>): boolean`
  - `filterG1(wonRaces: string[] | undefined, g1Set: ReadonlySet<string>): string[]`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/g1Saddle.test.ts
import { describe, expect, it } from 'vitest';
import { filterG1, isG1Saddle } from './g1Saddle';

const G1 = new Set(['10', '14', '18']);

describe('isG1Saddle', () => {
  it('is true only for ids in the G1 set', () => {
    expect(isG1Saddle('10', G1)).toBe(true);
    expect(isG1Saddle('11', G1)).toBe(false);
  });
});

describe('filterG1', () => {
  it('keeps only G1 saddle ids', () => {
    expect(filterG1(['6', '10', '11', '14', '26'], G1)).toEqual(['10', '14']);
  });
  it('returns [] for undefined wonRaces', () => {
    expect(filterG1(undefined, G1)).toEqual([]);
  });
  it('returns [] when the G1 set is empty (safe under-count, no fabrication)', () => {
    expect(filterG1(['10', '14'], new Set())).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/g1Saddle.test.ts`
Expected: FAIL — cannot resolve `./g1Saddle`.

- [ ] **Step 3: Write the implementation + the empty overrides stub**

```ts
// src/core/g1Saddle.ts
/**
 * M1.7 — filter raw UmaExtractor win-saddle ids down to G1-only before they
 * reach the 2.0 win-bonus (mechanics-notes §8: only shared G1 wins score
 * +3 each; G2/G3 + Triple-Crown/Tiara titles give 0). The G1 id set is
 * hand-patchable data (data-overrides/g1_saddle_ids.json, P5). An empty set
 * yields 0 win-bonus — the safe under-count, never a fabricated win.
 */
export function isG1Saddle(saddleId: string, g1Set: ReadonlySet<string>): boolean {
  return g1Set.has(saddleId);
}

export function filterG1(wonRaces: string[] | undefined, g1Set: ReadonlySet<string>): string[] {
  if (!wonRaces) return [];
  return wonRaces.filter((id) => g1Set.has(id));
}
```

```json
// data-overrides/g1_saddle_ids.json
{
  "_comment": "G1 race saddle ids (UmaExtractor win_saddle_id_array space). Empty until the authoritative list is supplied; win-bonus stays 0 (safe). See docs/superpowers/specs/2026-07-01-m1-7-coverage-matrix-design.md §8.",
  "g1SaddleIds": []
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/g1Saddle.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/g1Saddle.ts src/core/g1Saddle.test.ts data-overrides/g1_saddle_ids.json
git commit -m "feat(m1.7): g1Saddle core + empty g1_saddle_ids overrides stub

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Thread the G1 filter through `lineageAffinity`

**Files:**
- Modify: `src/core/lineageAffinity.ts`
- Test: `src/core/lineageAffinity.test.ts` (create if absent)

**Interfaces:**
- Consumes: `filterG1` (Task 2).
- Produces (changed signature):
  `planLineageAffinity(idx: AffinityIndex, traineeUmaId: string, parentA: Parent, parentB: Parent, g1Set?: ReadonlySet<string>): LineageAffinity`
  — `g1Set` optional; omitted ⇒ treat as empty set (no win-bonus), matching today's data-defaulted behavior.

- [ ] **Step 1: Write the failing test**

```ts
// src/core/lineageAffinity.test.ts
import { describe, expect, it } from 'vitest';
import { planLineageAffinity } from './lineageAffinity';
import { buildAffinityIndex } from './affinity';
import type { Parent } from './types';

// Minimal empty index → aff terms are 0, so memberScores isolate the win bonus.
const idx = buildAffinityIndex([]);

const parent = (id: string, umaId: string, wonRaces: string[]): Parent => ({
  id, umaId, blueSpark: { stat: 'spd', stars: 1 }, pinkSpark: { aptitude: 'turf', stars: 1 },
  whiteSparks: [], wonRaces, source: 'mine',
});

describe('planLineageAffinity G1 filter', () => {
  it('counts a shared G1 win (id in the set) as +3 on both member scores', () => {
    const a = parent('a', '100101', ['10', '11']); // 11 not G1
    const b = parent('b', '100201', ['10', '99']);
    const g1 = new Set(['10']);
    const res = planLineageAffinity(idx, '100301', a, b, g1);
    expect(res.memberScores.parentA).toBe(3);
    expect(res.memberScores.parentB).toBe(3);
  });

  it('does NOT count a shared non-G1 win (over-count fix)', () => {
    const a = parent('a', '100101', ['11']); // shared, but 11 ∉ G1
    const b = parent('b', '100201', ['11']);
    const g1 = new Set(['10']);
    const res = planLineageAffinity(idx, '100301', a, b, g1);
    expect(res.memberScores.parentA).toBe(0);
    expect(res.memberScores.parentB).toBe(0);
  });

  it('with no g1Set, contributes no win bonus', () => {
    const a = parent('a', '100101', ['10']);
    const b = parent('b', '100201', ['10']);
    const res = planLineageAffinity(idx, '100301', a, b);
    expect(res.memberScores.parentA).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/lineageAffinity.test.ts`
Expected: FAIL — `planLineageAffinity` takes 4 args / win bonus counts `11` (no filter yet).

- [ ] **Step 3: Modify `lineageAffinity.ts`**

Add the import and thread `g1Set` through `filterG1` before `computeWinBonus`:

```ts
// src/core/lineageAffinity.ts — add to imports
import { filterG1 } from '@/core/g1Saddle';

// change the signature + winBonus block:
export function planLineageAffinity(
  idx: AffinityIndex,
  traineeUmaId: string,
  parentA: Parent,
  parentB: Parent,
  g1Set: ReadonlySet<string> = new Set(),
): LineageAffinity {
  const gpChara = (p: Parent, i: 0 | 1): number | undefined => {
    const gp = p.grandparents?.[i];
    return gp ? charaIdOf(gp.umaId) : undefined;
  };
  const winBonus = computeWinBonus({
    parentA: { wonRaces: filterG1(parentA.wonRaces, g1Set) },
    parentB: { wonRaces: filterG1(parentB.wonRaces, g1Set) },
    gA1: { wonRaces: filterG1(parentA.grandparents?.[0]?.wonRaces, g1Set) },
    gA2: { wonRaces: filterG1(parentA.grandparents?.[1]?.wonRaces, g1Set) },
    gB1: { wonRaces: filterG1(parentB.grandparents?.[0]?.wonRaces, g1Set) },
    gB2: { wonRaces: filterG1(parentB.grandparents?.[1]?.wonRaces, g1Set) },
  });
  // …unchanged computeLineageAffinity(idx, {...}) call…
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/lineageAffinity.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck (callers still compile — g1Set is optional)**

Run: `pnpm typecheck`
Expected: no errors (existing `planLineageAffinity` callers omit `g1Set`).

- [ ] **Step 6: Commit**

```bash
git add src/core/lineageAffinity.ts src/core/lineageAffinity.test.ts
git commit -m "feat(m1.7): filter wonRaces to G1 before the win-bonus in planLineageAffinity

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `coverageMatrix` core — the per-skill/rows/bars/bonus builder

**Files:**
- Create: `src/core/coverageMatrix.ts`
- Test: `src/core/coverageMatrix.test.ts`

**Interfaces:**
- Consumes: `reconcileGreenSkillId` (Task 1); `tierForCardSkill` (`@/core/coverage`); `sparkChance` + types.
- Produces:

```ts
export type CoverageColumn = 'innate' | 'parent' | 'gp' | 'hint' | 'chain' | 'random';
export interface CoverageChip {
  kind: CoverageColumn;
  label: string;        // uma initials / card initials
  title: string;        // full uma/card name (tooltip)
  pct?: number;         // inherit % (parent/gp only), rounded int
  tier?: string;        // Tier string for hint chips (strong/weak)
  cardType?: CardType;  // for hint/chain/random square chip color
}
export interface CoverageRow {
  skillId: string; name: string; isGold: boolean;
  cells: Record<CoverageColumn, CoverageChip[]>;
  covered: boolean;
}
export interface CoverageBar { column: CoverageColumn | 'uncovered'; count: number; pct: number; }
export interface BonusEntry { skillId: string; name: string; chips: CoverageChip[]; }
export interface CoverageResult { rows: CoverageRow[]; bars: CoverageBar[]; bonus: BonusEntry[]; }

export interface CoverageInput {
  wishlistSkillIds: string[];
  planUma: { umaId: string; nameEn: string; innateSkills?: string[] } | null;
  planUniqueSkillId?: string;                 // fallback innate when innateSkills absent
  activeParents: Array<{ parent: Parent; isA: boolean }>; // resolved from plan.parents
  deckCards: SupportCardRecord[];             // resolved from deck.slots
  deckLbByCardId: Map<string, LimitBreak>;
  skillById: Map<string, SkillRecord>;
  cardById: Map<string, SupportCardRecord>;
  greenMap: Map<string, string>;
  // inherit-% inputs:
  sparkRates: SparkRates;
  memberAffinity?: (ctx: { parentId: string; grandparent: boolean; gpIndex: number }) => number | undefined;
}
export function buildCoverageMatrix(input: CoverageInput): CoverageResult;
```

**Logic (real-data port of the handoff `detailFor`):** iterate the **full** `wishlistSkillIds`. For each, build cells:
- **innate:** `planUma.innateSkills` (or `[planUniqueSkillId]` fallback), each mapped via `reconcileGreenSkillId`, includes the (reconciled) skillId.
- **parent / gp:** for each active parent — `whiteSparks.find(id)` OR `reconcileGreenSkillId(greenSpark.skillId) === skillId` (parent cell); each grandparent's `whiteSparks`/`greenSpark` (gp cell). % from `sparkChance` (single-parent list) using `memberAffinity`/`skillRarity`.
- **hint / chain / random:** iterate `deckCards`; for each `card.skills` entry with `skillId === id`, bucket by `sourceType` (`hint_pool`→hint w/ tier from `tierForCardSkill`, `chain`→chain, `random_event`/`date_event`→random).
- A row is `covered` when any cell is non-empty. `bars` count covered-per-column + `uncovered`. `bonus` = deck+inheritance skills NOT in the wishlist set.
- Cell chip **overflow is a UI concern** — the core returns ALL chips; the card caps at 2 + "+N".

- [ ] **Step 1: Write the failing test (cover innate, parent %, green, deck, uncovered, bars, bonus)**

```ts
// src/core/coverageMatrix.test.ts
import { describe, expect, it } from 'vitest';
import { buildCoverageMatrix, type CoverageInput } from './coverageMatrix';
import type { CardSkill, Parent, SkillRecord, SupportCardRecord, SparkRates } from './types';
import { FIXTURE_SPARK_RATES } from './fixtures';

const rates: SparkRates = FIXTURE_SPARK_RATES;

const skill = (skillId: string, nameEn: string, rarity: SkillRecord['rarity']): SkillRecord =>
  ({ skillId, nameEn, nameJp: '', baseSpCost: 0, rarity, iconId: '0', server: 'global', dataVersion: 't' });

const card = (cardId: string, nameEn: string, skills: CardSkill[]): SupportCardRecord =>
  ({ cardId, nameEn, charName: '', rarity: 'SSR', type: 'speed', perLevel: [], skills, hintPoolSize: 0, server: 'global', dataVersion: 't' });

const parent = (id: string, umaId: string, over: Partial<Parent> = {}): Parent =>
  ({ id, umaId, blueSpark: { stat: 'spd', stars: 1 }, pinkSpark: { aptitude: 'turf', stars: 1 },
     whiteSparks: [], source: 'mine', ...over });

const skillById = new Map([
  ['200011', skill('200011', 'Corner Adept', 'white')],
  ['200022', skill('200022', 'Slick Surge', 'gold')],
  ['200033', skill('200033', 'Straightaway', 'white')],
  ['900011', skill('900011', 'Shooting Star', 'inherited_unique')],
  ['100011', skill('100011', 'Shooting Star', 'unique')],
]);
const greenMap = new Map([['100011', '900011']]);

function baseInput(over: Partial<CoverageInput>): CoverageInput {
  return {
    wishlistSkillIds: ['200011', '200022', '200033', '900011'],
    planUma: { umaId: '100301', nameEn: 'Trainee', innateSkills: ['200011'] },
    activeParents: [],
    deckCards: [],
    deckLbByCardId: new Map(),
    skillById,
    cardById: new Map(),
    greenMap,
    sparkRates: rates,
    ...over,
  };
}

describe('buildCoverageMatrix', () => {
  it('marks an innate wishlist skill covered via the innate cell', () => {
    const res = buildCoverageMatrix(baseInput({}));
    const row = res.rows.find((r) => r.skillId === '200011')!;
    expect(row.cells.innate.length).toBe(1);
    expect(row.covered).toBe(true);
  });

  it('covers a white wishlist skill via a parent white spark with an inherit %', () => {
    const p = parent('pa', '100101', { whiteSparks: [{ skillId: '200033', stars: 3 }] });
    const res = buildCoverageMatrix(baseInput({ activeParents: [{ parent: p, isA: true }] }));
    const row = res.rows.find((r) => r.skillId === '200033')!;
    expect(row.cells.parent.length).toBe(1);
    expect(row.cells.parent[0]!.pct).toBeGreaterThan(0);
    expect(row.covered).toBe(true);
  });

  it('covers an inherited-unique wishlist skill via a parent green spark (reconciled id)', () => {
    const p = parent('pa', '100101', { greenSpark: { skillId: '100011', stars: 2 } });
    const res = buildCoverageMatrix(baseInput({ activeParents: [{ parent: p, isA: true }] }));
    const row = res.rows.find((r) => r.skillId === '900011')!;
    expect(row.cells.parent.length).toBe(1);
    expect(row.covered).toBe(true);
  });

  it('buckets deck cards into hint/chain/random by sourceType', () => {
    const c = card('30001', 'Speedy', [
      { skillId: '200022', sourceType: 'chain' },
      { skillId: '200033', sourceType: 'hint_pool' },
    ]);
    const res = buildCoverageMatrix(baseInput({ deckCards: [c], deckLbByCardId: new Map([['30001', 4]]) }));
    expect(res.rows.find((r) => r.skillId === '200022')!.cells.chain.length).toBe(1);
    expect(res.rows.find((r) => r.skillId === '200033')!.cells.hint.length).toBe(1);
  });

  it('flags a fully-unsourced wishlist skill uncovered', () => {
    const res = buildCoverageMatrix(baseInput({}));
    const row = res.rows.find((r) => r.skillId === '200022')!; // gold, no source
    expect(row.covered).toBe(false);
  });

  it('reports the gold rarity on the row', () => {
    const res = buildCoverageMatrix(baseInput({}));
    expect(res.rows.find((r) => r.skillId === '200022')!.isGold).toBe(true);
  });

  it('builds bars with per-column and uncovered counts', () => {
    const p = parent('pa', '100101', { whiteSparks: [{ skillId: '200033', stars: 3 }] });
    const res = buildCoverageMatrix(baseInput({ activeParents: [{ parent: p, isA: true }] }));
    const innate = res.bars.find((b) => b.column === 'innate')!;
    const uncovered = res.bars.find((b) => b.column === 'uncovered')!;
    expect(innate.count).toBe(1);       // 200011
    expect(uncovered.count).toBe(1);    // 200022 gold, unsourced
  });

  it('lists deck/inheritance skills not on the wishlist as bonus', () => {
    const c = card('30001', 'Speedy', [{ skillId: '200099', sourceType: 'chain' }]);
    const bonusSkillById = new Map(skillById);
    bonusSkillById.set('200099', skill('200099', 'Bonus Skill', 'white'));
    const res = buildCoverageMatrix(baseInput({ deckCards: [c], skillById: bonusSkillById }));
    expect(res.bonus.some((b) => b.skillId === '200099')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/core/coverageMatrix.test.ts`
Expected: FAIL — cannot resolve `./coverageMatrix`.

- [ ] **Step 3: Implement `coverageMatrix.ts`**

```ts
// src/core/coverageMatrix.ts
/**
 * M1.7 — "Obtainable vs. wishlist" coverage. Pure: crosses each wishlist skill
 * against innate / parent / grandparent / deck (hint·chain·random) sources with
 * real inherit-% (spark.ts). Real-data port of the design handoff's detailFor.
 */
import type {
  CardType, LimitBreak, Parent, SkillRarity, SkillRecord, SparkRates, SupportCardRecord,
} from '@/core/types';
import { tierForCardSkill } from '@/core/coverage';
import { sparkChance } from '@/core/spark';
import { reconcileGreenSkillId } from '@/core/greenSparkReconcile';

export type CoverageColumn = 'innate' | 'parent' | 'gp' | 'hint' | 'chain' | 'random';
export const COVERAGE_COLUMNS: CoverageColumn[] = ['innate', 'parent', 'gp', 'hint', 'chain', 'random'];

export interface CoverageChip {
  kind: CoverageColumn; label: string; title: string;
  pct?: number; tier?: string; cardType?: CardType;
}
export interface CoverageRow {
  skillId: string; name: string; isGold: boolean;
  cells: Record<CoverageColumn, CoverageChip[]>; covered: boolean;
}
export interface CoverageBar { column: CoverageColumn | 'uncovered'; count: number; pct: number; }
export interface BonusEntry { skillId: string; name: string; chips: CoverageChip[]; }
export interface CoverageResult { rows: CoverageRow[]; bars: CoverageBar[]; bonus: BonusEntry[]; }

export interface CoverageInput {
  wishlistSkillIds: string[];
  planUma: { umaId: string; nameEn: string; innateSkills?: string[] } | null;
  planUniqueSkillId?: string;
  activeParents: Array<{ parent: Parent; isA: boolean }>;
  deckCards: SupportCardRecord[];
  deckLbByCardId: Map<string, LimitBreak>;
  skillById: Map<string, SkillRecord>;
  cardById: Map<string, SupportCardRecord>;
  greenMap: Map<string, string>;
  sparkRates: SparkRates;
  memberAffinity?: (ctx: { parentId: string; grandparent: boolean; gpIndex: number }) => number | undefined;
}

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

/** A parent's own spark that grants `skillId` (white match, or green reconciled). */
function parentGrantsSkill(p: Parent, skillId: string, greenMap: Map<string, string>): boolean {
  if (p.whiteSparks.some((w) => w.skillId === skillId)) return true;
  if (p.greenSpark && reconcileGreenSkillId(p.greenSpark.skillId, greenMap) === skillId) return true;
  return false;
}
function refGrantsSkill(ref: NonNullable<Parent['grandparents']>[number], skillId: string, greenMap: Map<string, string>): boolean {
  if (!ref) return false;
  if (ref.whiteSparks?.some((w) => w.skillId === skillId)) return true;
  if (ref.greenSpark && reconcileGreenSkillId(ref.greenSpark.skillId, greenMap) === skillId) return true;
  return false;
}

export function buildCoverageMatrix(input: CoverageInput): CoverageResult {
  const {
    wishlistSkillIds, planUma, planUniqueSkillId, activeParents, deckCards, deckLbByCardId,
    skillById, greenMap, sparkRates, memberAffinity,
  } = input;
  const rarityLookup = (id: string): SkillRarity | undefined => skillById.get(id)?.rarity;

  const innateSet = new Set(
    (planUma?.innateSkills ?? (planUniqueSkillId ? [planUniqueSkillId] : []))
      .map((id) => reconcileGreenSkillId(id, greenMap)),
  );

  const rows: CoverageRow[] = wishlistSkillIds.map((skillId) => {
    const rec = skillById.get(skillId);
    const cells: Record<CoverageColumn, CoverageChip[]> = {
      innate: [], parent: [], gp: [], hint: [], chain: [], random: [],
    };

    // Innate
    if (innateSet.has(reconcileGreenSkillId(skillId, greenMap)) || innateSet.has(skillId)) {
      cells.innate.push({ kind: 'innate', label: initials(planUma?.nameEn ?? '?'), title: planUma?.nameEn ?? 'Innate' });
    }

    // Parent + grandparent
    for (const { parent } of activeParents) {
      if (parentGrantsSkill(parent, skillId, greenMap)) {
        const pct = sparkChance({
          parents: [parent], skillId, rates: sparkRates,
          opts: { memberAffinity, skillRarity: rarityLookup },
        }).pct;
        cells.parent.push({ kind: 'parent', label: initials(String(parent.umaId)), title: `Parent ${parent.umaId}`, pct: Math.round(pct) });
      }
      (parent.grandparents ?? []).forEach((ref, gpIndex) => {
        if (refGrantsSkill(ref, skillId, greenMap)) {
          const pct = sparkChance({
            parents: [parent], skillId, rates: sparkRates,
            opts: { memberAffinity, skillRarity: rarityLookup },
          }).pct;
          cells.gp.push({ kind: 'gp', label: initials(String(ref!.umaId)), title: `Grandparent ${ref!.umaId}`, pct: Math.round(pct) });
        }
      });
    }

    // Deck: hint / chain / random
    for (const c of deckCards) {
      const lb = deckLbByCardId.get(c.cardId) ?? 4;
      for (const cs of c.skills) {
        if (cs.skillId !== skillId) continue;
        if (cs.sourceType === 'hint_pool') {
          cells.hint.push({ kind: 'hint', label: initials(c.nameEn), title: c.nameEn, tier: tierForCardSkill(c, lb, 'hint_pool'), cardType: c.type });
        } else if (cs.sourceType === 'chain') {
          cells.chain.push({ kind: 'chain', label: initials(c.nameEn), title: c.nameEn, cardType: c.type });
        } else {
          cells.random.push({ kind: 'random', label: initials(c.nameEn), title: c.nameEn, cardType: c.type });
        }
      }
    }

    const covered = COVERAGE_COLUMNS.some((col) => cells[col].length > 0);
    return { skillId, name: rec?.nameEn ?? skillId, isGold: rec?.rarity === 'gold', cells, covered };
  });

  // Bars
  const total = rows.length;
  const bars: CoverageBar[] = COVERAGE_COLUMNS.map((col) => {
    const count = rows.filter((r) => r.cells[col].length > 0).length;
    return { column: col, count, pct: total ? Math.round((count / total) * 100) : 0 };
  });
  const uncoveredCount = rows.filter((r) => !r.covered).length;
  bars.push({ column: 'uncovered', count: uncoveredCount, pct: total ? Math.round((uncoveredCount / total) * 100) : 0 });

  // Bonus: deck + inheritance skills not on the wishlist
  const wishSet = new Set(wishlistSkillIds);
  const bonusMap = new Map<string, CoverageChip[]>();
  const addBonus = (id: string, chip: CoverageChip) => {
    if (wishSet.has(id)) return;
    const arr = bonusMap.get(id) ?? [];
    arr.push(chip);
    bonusMap.set(id, arr);
  };
  for (const { parent } of activeParents) {
    for (const w of parent.whiteSparks) addBonus(w.skillId, { kind: 'parent', label: initials(String(parent.umaId)), title: `Parent ${parent.umaId}` });
    if (parent.greenSpark) addBonus(reconcileGreenSkillId(parent.greenSpark.skillId, greenMap), { kind: 'parent', label: initials(String(parent.umaId)), title: `Parent ${parent.umaId}` });
  }
  for (const c of deckCards) {
    for (const cs of c.skills) {
      const kind: CoverageColumn = cs.sourceType === 'hint_pool' ? 'hint' : cs.sourceType === 'chain' ? 'chain' : 'random';
      addBonus(cs.skillId, { kind, label: initials(c.nameEn), title: c.nameEn, cardType: c.type });
    }
  }
  const bonus: BonusEntry[] = [...bonusMap.entries()].map(([skillId, chips]) => ({
    skillId, name: skillById.get(skillId)?.nameEn ?? skillId, chips: chips.slice(0, 4),
  }));

  return { rows, bars, bonus };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/core/coverageMatrix.test.ts`
Expected: PASS (8 tests). If a `sparkChance` fixture edge makes a `pct` 0 for the parent-white case, confirm `FIXTURE_SPARK_RATES.baseProcPctByStars.whiteSkill[2]` is > 0 (3★) — it is; the assertion `toBeGreaterThan(0)` holds.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/coverageMatrix.ts src/core/coverageMatrix.test.ts
git commit -m "feat(m1.7): coverageMatrix core — per-skill sources, bars, bonus

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `UmaRecord.innateSkills` type field

**Files:**
- Modify: `src/core/types.ts` (UmaRecord)

**Interfaces:**
- Produces: `UmaRecord.innateSkills?: string[]` (optional so pre-regen `umas.json` still type-checks and old fixtures don't break).

- [ ] **Step 1: Add the field**

In `src/core/types.ts`, inside `interface UmaRecord` (after `epithet?`):

```ts
  /** The uma's built-in skill kit (unique + innate white skills, e.g. Mayano
   *  Top Gun's "No Stopping Me!"). From GameTora character-cards.json via
   *  build-umas. Absent until umas.json is regenerated (M1.7). */
  innateSkills?: string[];
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors (optional field, no callers required).

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(m1.7): add UmaRecord.innateSkills field

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `CoverageMatrixCard` UI + CSS

**Files:**
- Create: `src/features/inheritance/CoverageMatrixCard.tsx`
- Create: `src/features/inheritance/CoverageMatrixCard.test.tsx`
- Modify: `src/features/inheritance/inheritance.css` (append `.inh-cov-*`)

**Interfaces:**
- Consumes: `CoverageResult`, `CoverageRow`, `CoverageChip`, `CoverageColumn` (Task 4); `HeaderHelp`.
- Produces:
  `export function CoverageMatrixCard(props: { result: CoverageResult; hasWishlist: boolean; hasPlanUma: boolean }): JSX.Element`
  — provider-free; the page computes `result` and passes it in.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/inheritance/CoverageMatrixCard.test.tsx
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CoverageMatrixCard } from './CoverageMatrixCard';
import type { CoverageResult } from '@/core/coverageMatrix';

afterEach(cleanup);

const result: CoverageResult = {
  rows: [
    { skillId: '200011', name: 'Corner Adept', isGold: false,
      cells: { innate: [{ kind: 'innate', label: 'TR', title: 'Trainee' }], parent: [], gp: [], hint: [], chain: [], random: [] }, covered: true },
    { skillId: '200022', name: 'Slick Surge', isGold: true,
      cells: { innate: [], parent: [], gp: [], hint: [], chain: [], random: [] }, covered: false },
  ],
  bars: [
    { column: 'innate', count: 1, pct: 50 },
    { column: 'uncovered', count: 1, pct: 50 },
  ],
  bonus: [{ skillId: '200099', name: 'Bonus Skill', chips: [{ kind: 'chain', label: 'SP', title: 'Speedy', cardType: 'speed' }] }],
};

describe('CoverageMatrixCard', () => {
  it('renders wishlist skill names in the matrix', () => {
    render(<CoverageMatrixCard result={result} hasWishlist hasPlanUma />);
    expect(screen.getByText('Corner Adept')).toBeTruthy();
    expect(screen.getByText('Slick Surge')).toBeTruthy();
  });

  it('marks the uncovered row with the row-uncovered class', () => {
    const { container } = render(<CoverageMatrixCard result={result} hasWishlist hasPlanUma />);
    expect(container.querySelector('.row-uncovered')).toBeTruthy();
  });

  it('toggles to the Coverage (bars) view', () => {
    render(<CoverageMatrixCard result={result} hasWishlist hasPlanUma />);
    fireEvent.click(screen.getByRole('button', { name: /coverage/i }));
    expect(screen.getByText(/uncovered/i)).toBeTruthy();
  });

  it('renders the bonus list', () => {
    render(<CoverageMatrixCard result={result} hasWishlist hasPlanUma />);
    expect(screen.getByText('Bonus Skill')).toBeTruthy();
  });

  it('shows an empty state when there is no wishlist', () => {
    render(<CoverageMatrixCard result={{ rows: [], bars: [], bonus: [] }} hasWishlist={false} hasPlanUma />);
    expect(screen.getByText(/add skills to your wishlist/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/CoverageMatrixCard.test.tsx`
Expected: FAIL — cannot resolve `./CoverageMatrixCard`.

- [ ] **Step 3: Implement the card**

```tsx
// src/features/inheritance/CoverageMatrixCard.tsx
/** M1.7 — "Obtainable vs. wishlist" coverage card (design handoff panel 6).
 *  Provider-free: the page computes the CoverageResult and passes it in. */
import { useState } from 'react';
import type { CoverageChip, CoverageColumn, CoverageResult, CoverageRow } from '@/core/coverageMatrix';
import { HeaderHelp } from '@/features/cm-planner/HeaderHelp';

const COLS: Array<{ key: CoverageColumn; label: string; sep?: boolean }> = [
  { key: 'innate', label: 'Innate' },
  { key: 'parent', label: 'Parent', sep: true },
  { key: 'gp', label: 'G.parent' },
  { key: 'hint', label: 'Hint', sep: true },
  { key: 'chain', label: 'Chain' },
  { key: 'random', label: 'Random' },
];
const BAR_LABEL: Record<CoverageColumn | 'uncovered', string> = {
  innate: 'Innate', parent: 'Parent', gp: 'G.parent', hint: 'Hint', chain: 'Chain', random: 'Random', uncovered: 'Uncovered',
};

function Chip({ chip }: { chip: CoverageChip }) {
  const round = chip.kind === 'innate' || chip.kind === 'parent' || chip.kind === 'gp';
  const cls =
    chip.kind === 'innate' ? 'inh-cov-chip tier-spark' :
    chip.kind === 'parent' ? 'inh-cov-chip inh-cov-chip-parent' :
    chip.kind === 'gp' ? 'inh-cov-chip inh-cov-chip-gp' :
    `inh-cov-chip inh-cov-chip-card type-${chip.cardType ?? 'speed'}`;
  return (
    <span className="inh-cov-chip-wrap" title={chip.title}>
      <span className={cls} data-round={round ? '1' : undefined}>{chip.label}</span>
      {chip.pct !== undefined && <span className="inh-cov-pct">~{chip.pct}%</span>}
    </span>
  );
}

function Cell({ chips }: { chips: CoverageChip[] }) {
  if (chips.length === 0) return <td className="inh-cov-cell muted">·</td>;
  const shown = chips.slice(0, 2);
  const extra = chips.length - shown.length;
  return (
    <td className="inh-cov-cell">
      {shown.map((c, i) => <Chip key={i} chip={c} />)}
      {extra > 0 && <span className="inh-cov-more">+{extra}</span>}
    </td>
  );
}

function MatrixTable({ rows }: { rows: CoverageRow[] }) {
  return (
    <table className="matrix inh-cov-matrix">
      <thead>
        <tr>
          <th className="skill-col">Wishlist skill</th>
          {COLS.map((c) => <th key={c.key} className={c.sep ? 'inh-cov-sep' : undefined}>{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.skillId} className={r.covered ? undefined : 'row-uncovered'}>
            <th className="skill-col" style={r.isGold ? { color: '#c27a00' } : undefined}>{r.name}</th>
            {COLS.map((c) => <Cell key={c.key} chips={r.cells[c.key]} />)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Bars({ result }: { result: CoverageResult }) {
  return (
    <div className="inh-cov-bars">
      {result.bars.map((b) => (
        <div key={b.column} className="inh-cov-bar-row">
          <span className="inh-cov-bar-label">{BAR_LABEL[b.column]}</span>
          <span className="inh-cov-bar-track"><span className={`inh-cov-bar-fill col-${b.column}`} style={{ width: `${b.pct}%` }} /></span>
          <span className="inh-cov-bar-num">{b.count} · {b.pct}%</span>
        </div>
      ))}
    </div>
  );
}

export function CoverageMatrixCard({ result, hasWishlist, hasPlanUma }: {
  result: CoverageResult; hasWishlist: boolean; hasPlanUma: boolean;
}) {
  const [view, setView] = useState<'matrix' | 'bars'>('matrix');
  return (
    <div className="cmp-plan-card inh-cov-card">
      <div className="cmp-plan-card-head inh-cov-head">
        <span className="inh-cov-title">Obtainable vs. wishlist</span>
        <span className="cmp-control-group inh-cov-toggle">
          <button type="button" className={view === 'matrix' ? 'is-active' : ''} onClick={() => setView('matrix')}>Matrix</button>
          <button type="button" className={view === 'bars' ? 'is-active' : ''} onClick={() => setView('bars')}>Coverage</button>
        </span>
        <HeaderHelp label="Coverage help">
          Crosses each wishlist skill against where you can get it: your uma's
          innate kit, parent/grandparent sparks (with real inherit-%), and your
          deck's hint / chain-event / random-event skills. Red-striped rows are
          uncovered.
        </HeaderHelp>
      </div>
      <div className="cmp-plan-card-body inh-cov-body">
        {!hasPlanUma ? (
          <p className="muted">Pick a plan uma to see coverage.</p>
        ) : !hasWishlist ? (
          <p className="muted">Add skills to your wishlist to see coverage.</p>
        ) : (
          <>
            {view === 'matrix' ? <MatrixTable rows={result.rows} /> : <Bars result={result} />}
            {result.bonus.length > 0 && (
              <div className="inh-cov-bonus">
                <div className="inh-cov-bonus-head">BONUS — obtainable, not on wishlist</div>
                {result.bonus.map((b) => (
                  <div key={b.skillId} className="inh-cov-bonus-row">
                    <span className="inh-cov-bonus-name">{b.name}</span>
                    <span className="inh-cov-bonus-chips">{b.chips.map((c, i) => <Chip key={i} chip={c} />)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Append the CSS**

Append to `src/features/inheritance/inheritance.css`:

```css
/* M1.7 coverage matrix */
.inh-cov-head { display: flex; align-items: center; gap: 0.5rem; }
.inh-cov-title { font-weight: 700; }
.inh-cov-toggle { margin-left: auto; }
.inh-cov-matrix td.inh-cov-cell { white-space: nowrap; }
.inh-cov-matrix .inh-cov-sep { border-left: 2px solid var(--border); }
.inh-cov-chip-wrap { display: inline-flex; align-items: center; gap: 2px; margin-right: 4px; }
.inh-cov-chip { display: inline-flex; align-items: center; justify-content: center; height: 18px; min-width: 18px; padding: 0 4px; font-size: 0.56rem; font-weight: 800; color: #fff; border-radius: 4px; }
.inh-cov-chip[data-round="1"] { border-radius: 999px; }
.inh-cov-chip.tier-spark { background: var(--tier-spark); }
.inh-cov-chip-parent { background: transparent; color: var(--accent); border: 1px solid var(--accent); }
.inh-cov-chip-gp { background: transparent; color: #64748b; border: 1px solid #9aa6b6; }
.inh-cov-chip-card.type-speed { background: #3b82f6; } .inh-cov-chip-card.type-stamina { background: #ef4444; }
.inh-cov-chip-card.type-power { background: #ec4899; } .inh-cov-chip-card.type-guts { background: #f59e0b; }
.inh-cov-chip-card.type-wit { background: #10b981; } .inh-cov-chip-card.type-friend, .inh-cov-chip-card.type-group { background: #64748b; }
.inh-cov-pct { font-size: 0.6rem; font-weight: 700; color: var(--fg-muted); }
.inh-cov-more { font-size: 0.6rem; color: var(--fg-muted); }
.inh-cov-bars { display: flex; flex-direction: column; gap: 0.35rem; }
.inh-cov-bar-row { display: grid; grid-template-columns: 5rem 1fr auto; align-items: center; gap: 0.5rem; font-size: 0.72rem; }
.inh-cov-bar-track { height: 10px; background: var(--bg-2); border-radius: 999px; overflow: hidden; }
.inh-cov-bar-fill { display: block; height: 100%; }
.inh-cov-bar-fill.col-innate { background: var(--tier-spark); } .inh-cov-bar-fill.col-parent { background: #3478f6; }
.inh-cov-bar-fill.col-gp { background: #0ea5e9; } .inh-cov-bar-fill.col-hint { background: var(--tier-hint_strong); }
.inh-cov-bar-fill.col-chain { background: var(--tier-chain); } .inh-cov-bar-fill.col-random { background: var(--tier-random); }
.inh-cov-bar-fill.col-uncovered { background: var(--tier-uncovered); }
.inh-cov-bonus { margin-top: 0.6rem; border-top: 1px solid var(--border); padding-top: 0.5rem; }
.inh-cov-bonus-head { font-size: 0.62rem; font-weight: 800; color: var(--tier-spark); text-transform: uppercase; margin-bottom: 0.3rem; }
.inh-cov-bonus-row { display: flex; justify-content: space-between; gap: 0.5rem; align-items: center; padding: 0.15rem 0; }
.inh-cov-bonus-name { font-weight: 600; font-size: 0.78rem; }
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm vitest run src/features/inheritance/CoverageMatrixCard.test.tsx`
Expected: PASS (5 tests).
Run: `pnpm typecheck` → no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/inheritance/CoverageMatrixCard.tsx src/features/inheritance/CoverageMatrixCard.test.tsx src/features/inheritance/inheritance.css
git commit -m "feat(m1.7): CoverageMatrixCard UI (matrix/coverage toggle + bonus) + CSS

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire `InheritancePage` — resolve lineage, compute matrix, replace placeholder

**Files:**
- Modify: `src/features/inheritance/InheritancePage.tsx`
- Modify: `src/features/inheritance/InheritancePage.test.tsx` (extend) OR `src/app/App.inheritance.test.tsx`

**Interfaces:**
- Consumes: `buildCoverageMatrix` + `buildUniqueToInheritedMap` (Tasks 1,4), `CoverageMatrixCard` (Task 6), `planLineageAffinity` (Task 3), `useRoster`, `useAffinityIndex`, `useDeckState`, `useGameData`.

**Lazy G1 set loader** — add a small hook file alongside (mirrors `useAffinityIndex`):

- [ ] **Step 1: Create the G1-set hook**

```ts
// src/features/inheritance/useG1SaddleSet.ts
/** Lazy-load data-overrides/g1_saddle_ids.json → Set<string>. Empty on failure
 *  (win-bonus stays 0). Overrides files ship in public/data-overrides? No —
 *  this file is bundled: import it directly (build-time), no fetch needed. */
import g1 from '../../../data-overrides/g1_saddle_ids.json';

export function useG1SaddleSet(): ReadonlySet<string> {
  return new Set((g1 as { g1SaddleIds?: string[] }).g1SaddleIds ?? []);
}
```

> Note: if importing from `data-overrides/` outside `src/` trips the Vite/tsconfig `rootDir`, instead copy the JSON to `src/features/inheritance/g1_saddle_ids.json` and import from there; keep `data-overrides/g1_saddle_ids.json` as the P5 hand-patch source and sync on data:build. Pick whichever compiles; document the choice in a code comment.

- [ ] **Step 2: Write/extend the page test (smoke: matrix renders for a wishlist)**

Add to `src/features/inheritance/InheritancePage.test.tsx` (follow its existing `useGameData`/`useUmas` stub pattern — the file already mocks these; extend the mock so `skillById` has the wishlist skills and the plan has a `wishlist`). Assert the coverage card renders a wishlist skill name and is no longer a placeholder:

```tsx
it('renders the M1.7 coverage matrix (no placeholder) for a plan with a wishlist', async () => {
  // (reuse the file's existing render helper + stubbed active plan;
  //  ensure the stub plan.wishlist = [{ skillId: '200011', priority: 1, source: 'targeted' }]
  //  and skillById has 200011 → { nameEn: 'Corner Adept', rarity: 'white' })
  renderInheritancePage();
  expect(await screen.findByText('Obtainable vs. wishlist')).toBeTruthy();
  expect(screen.queryByText('M1.7')).toBeNull(); // placeholder gone
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/InheritancePage.test.tsx`
Expected: FAIL — placeholder still present / card not found.

- [ ] **Step 4: Wire the page**

In `InheritancePage.tsx`:

Add imports:
```ts
import { useRoster } from './useRoster';
import { useAffinityIndex } from './useAffinityIndex';
import { useG1SaddleSet } from './useG1SaddleSet';
import { buildUniqueToInheritedMap } from '@/core/greenSparkReconcile';
import { buildCoverageMatrix } from '@/core/coverageMatrix';
import { planLineageAffinity } from '@/core/lineageAffinity';
import { CoverageMatrixCard } from './CoverageMatrixCard';
import type { LimitBreak } from '@/core/types';
```

Inside the component (near the other hooks; `skills`, `sparkRates`, `skillById`, `cardById` already come from `useGameData()`, `deck` from `useDeckState()`, `uma1Plan` from `useActivePlan()`):
```ts
const { roster } = useRoster();
const affinityIdx = useAffinityIndex();
const g1Set = useG1SaddleSet();
const { skills, sparkRates } = useGameData(); // if not already destructured

const coverageResult = useMemo(() => {
  const wishlistSkillIds = (uma1Plan?.wishlist ?? []).map((w) => w.skillId);
  const greenMap = buildUniqueToInheritedMap(skills).map;
  const rosterById = new Map(roster.map((p) => [p.id, p]));
  const pA = uma1Plan?.parents.a ? rosterById.get(uma1Plan.parents.a) : undefined;
  const pB = uma1Plan?.parents.b ? rosterById.get(uma1Plan.parents.b) : undefined;
  const activeParents = [
    ...(pA ? [{ parent: pA, isA: true }] : []),
    ...(pB ? [{ parent: pB, isA: false }] : []),
  ];

  // memberAffinity resolver from planLineageAffinity.memberScores (both parents present).
  let memberAffinity: ((ctx: { parentId: string; grandparent: boolean; gpIndex: number }) => number | undefined) | undefined;
  if (affinityIdx && uma1Plan && pA && pB) {
    const la = planLineageAffinity(affinityIdx, uma1Plan.umaId, pA, pB, g1Set);
    memberAffinity = ({ parentId, grandparent, gpIndex }) => {
      if (!grandparent) return parentId === pA.id ? la.memberScores.parentA : parentId === pB.id ? la.memberScores.parentB : undefined;
      if (parentId === pA.id) return gpIndex === 0 ? la.memberScores.gA1 : la.memberScores.gA2;
      if (parentId === pB.id) return gpIndex === 0 ? la.memberScores.gB1 : la.memberScores.gB2;
      return undefined;
    };
  }

  const deckCards = deck.slots.filter((id): id is string => !!id).map((id) => cardById.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
  const deckLbByCardId = new Map<string, LimitBreak>();
  deck.slots.forEach((id, i) => { if (id) deckLbByCardId.set(id, deck.slotLb[i] ?? 4); });

  const planUmaRec = uma1Plan ? umaById.get(uma1Plan.umaId) ?? null : null;

  return buildCoverageMatrix({
    wishlistSkillIds,
    planUma: planUmaRec ? { umaId: planUmaRec.umaId, nameEn: planUmaRec.nameEn, innateSkills: planUmaRec.innateSkills } : null,
    planUniqueSkillId: uma1Plan?.uniqueSkillId,
    activeParents,
    deckCards,
    deckLbByCardId,
    skillById,
    cardById,
    greenMap,
    sparkRates,
    memberAffinity,
  });
}, [uma1Plan, roster, affinityIdx, g1Set, skills, deck, cardById, skillById, sparkRates, umaById]);
```

Replace the placeholder JSX:
```tsx
// before:
<Placeholder title="Obtainable vs. wishlist" phase="M1.7" />
// after:
<CoverageMatrixCard
  result={coverageResult}
  hasWishlist={(uma1Plan?.wishlist?.length ?? 0) > 0}
  hasPlanUma={!!uma1Plan}
/>
```

- [ ] **Step 5: Run test + typecheck + build**

Run: `pnpm vitest run src/features/inheritance/InheritancePage.test.tsx src/app/App.inheritance.test.tsx`
Expected: PASS.
Run: `pnpm typecheck` → no errors.
Run: `pnpm build` → green (race-free confirmation).

- [ ] **Step 6: Commit**

```bash
git add src/features/inheritance/InheritancePage.tsx src/features/inheritance/InheritancePage.test.tsx src/features/inheritance/useG1SaddleSet.ts
git commit -m "feat(m1.7): wire coverage matrix into InheritancePage (lineage, deck, green map)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8 (DATA-GATED — needs `scripts/borrowed/gametora/` sources): per-uma `innateSkills` in the pipeline

> **Blocked until the user drops `scripts/borrowed/gametora/character-cards.json` (+ the borrowed set) into the worktree.** Until then, `UmaRecord.innateSkills` stays absent and the Innate column renders `·` — the rest of M1.7 is fully functional. When the sources arrive, do this task, then regenerate `umas.json`.

**Files:**
- Modify: `scripts/lib/upstream-types.ts` (`GtCharacterCard`)
- Modify: `scripts/build-umas.ts` (emit `innateSkills`)
- Modify: `scripts/build-umas.test.ts` (assert emission)
- Regenerate: `public/data/umas.json`

- [ ] **Step 1: Inspect the real source to confirm the skills field shape**

```bash
node -e "const c=require('./scripts/borrowed/gametora/character-cards.json'); const s=c.find(x=>String(x.card_id).startsWith('1024')); console.log(JSON.stringify(s, null, 2).slice(0, 1200));"
```
Identify the field holding the character's innate/default skills (e.g. `skills`, `talent_skills`, or an array of `{ id, … }`). Note the exact key + element shape.

- [ ] **Step 2: Extend the `GtCharacterCard` type** (use the real key from Step 1)

```ts
// scripts/lib/upstream-types.ts — add to GtCharacterCard
  /** Innate skill kit for this outfit (unique + innate white). Shape confirmed
   *  against gametora/character-cards.json. */
  skills?: Array<{ id: number | string } | number | string>;
```

- [ ] **Step 3: Write the failing build-umas test**

```ts
// scripts/build-umas.test.ts — add
it('emits innateSkills from the GameTora character card skill list', () => {
  const umasIn = { '1001': { name: ['ジ','Trainee'], outfits: { '100101': '[Ep]' } } } as unknown as UmalatorUmasJson;
  const gt: GtCharacterCard[] = [{
    card_id: 100101, char_id: 1001, aptitude: ['A','G','G','A','A','G','G','A','A','G'],
    stat_bonus: [10,0,0,0,0], title_en_gl: '[Ep]', skills: [{ id: 100011 }, { id: 200033 }],
  } as unknown as GtCharacterCard];
  const [rec] = buildUmas({ umas: umasIn, gametoraChars: gt, dataVersion: 't' });
  expect(rec.innateSkills).toEqual(['100011', '200033']);
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest run scripts/build-umas.test.ts`
Expected: FAIL — `innateSkills` undefined.

- [ ] **Step 5: Emit `innateSkills` in `buildUmas`** (adapt the extractor to the real shape from Step 1)

```ts
// scripts/build-umas.ts — helper
function innateSkillsFromGt(gt: GtCharacterCard | undefined): string[] | undefined {
  const raw = gt?.skills;
  if (!raw || raw.length === 0) return undefined;
  const ids = raw.map((s) => (typeof s === 'object' ? String((s as { id: number|string }).id) : String(s)));
  return ids.length ? ids : undefined;
}
// in the record assembly, after statGrowth/baseAptitudes:
const innate = innateSkillsFromGt(gt);
if (innate) record.innateSkills = innate;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm vitest run scripts/build-umas.test.ts`
Expected: PASS.

- [ ] **Step 7: Regenerate umas.json + verify**

Run: `pnpm data:build`
Then sanity-check a known uma:
```bash
node -e "const u=require('./public/data/umas.json'); const m=(u.umas||u).find(x=>/Mayano Top Gun/.test(x.nameEn)); console.log(m.nameEn, m.innateSkills);"
```
Expected: `innateSkills` is a non-empty array of skill ids.

- [ ] **Step 8: Full test + build**

Run: `pnpm test` (or `pnpm build`) → green.

- [ ] **Step 9: Commit**

```bash
git add scripts/lib/upstream-types.ts scripts/build-umas.ts scripts/build-umas.test.ts public/data/umas.json
git commit -m "feat(m1.7): emit per-uma innateSkills in build-umas + regenerate umas.json

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9 (DATA-GATED — needs the user's G1 ids): populate `g1_saddle_ids.json`

> **Blocked until the user supplies the authoritative G1 saddle-id list.** Until then the empty stub keeps win-bonus at 0 (safe). No fabricated ids.

**Files:**
- Modify: `data-overrides/g1_saddle_ids.json` (+ the synced `src/features/inheritance/g1_saddle_ids.json` if Task 7 Step 1's fallback path was taken)

- [ ] **Step 1: Paste the ids** into `g1SaddleIds` (strings, matching UmaExtractor's `win_saddle_id_array` space):

```json
{ "_comment": "…", "g1SaddleIds": ["<id>", "<id>", "…"] }
```

- [ ] **Step 2: Add a lineageAffinity fixture test with real ids** (guards the wiring end-to-end): pick two parents sharing one supplied G1 id, assert `memberScores.parentA === 3`.

Run: `pnpm vitest run src/core/lineageAffinity.test.ts` → PASS.

- [ ] **Step 3: Typecheck + build**

Run: `pnpm build` → green.

- [ ] **Step 4: Commit**

```bash
git add data-overrides/g1_saddle_ids.json src/features/inheritance/g1_saddle_ids.json src/core/lineageAffinity.test.ts
git commit -m "data(m1.7): populate G1 saddle ids for the win-bonus filter

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Docs wrap-up

**Files:**
- Modify: `docs/modules/module-1-inheritance.md`, `docs/roadmap.md` (tick M1.7), `CLAUDE.md` (status line + test count)

- [ ] **Step 1: Update the module doc** — add an "M1.7 coverage matrix" section (cores `greenSparkReconcile`/`g1Saddle`/`coverageMatrix`, `CoverageMatrixCard`, the two data gates + their status, the `innateSkills` pipeline addition). Note the gotchas: green map derived from skills.json (86/87), g1 filter default-empty is safe, `useG1SaddleSet` import path decision.

- [ ] **Step 2: Tick roadmap** — mark M1.7 done (or "core done, 2 data gates pending") in `docs/roadmap.md`.

- [ ] **Step 3: Update CLAUDE.md** — bump the M1 status line + the test count (run `pnpm test` and read the total).

- [ ] **Step 4: Commit**

```bash
git add docs/modules/module-1-inheritance.md docs/roadmap.md CLAUDE.md
git commit -m "docs(m1.7): coverage-matrix wrap-up — module/roadmap/CLAUDE status

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- §1 matrix (Innate|Parent|G.parent|Hint|Chain|Random) → Tasks 4 (core) + 6 (UI). ✓
- §1 Coverage bars + Matrix/Coverage toggle → Tasks 4 (bars) + 6 (toggle). ✓
- §1 Bonus list → Tasks 4 + 6. ✓
- §1/D1 real inherit-% via spark math → Task 4 (`sparkChance`) + Task 7 (`memberAffinity` from `planLineageAffinity`). ✓
- §1/D2 green `9xxxxx` reconciliation → Task 1, consumed in Tasks 4 & 7. ✓
- §1/D2 wonRaces→G1 → Tasks 2 (core) + 3 (wiring) + 9 (data). ✓
- §1/D5 per-uma innate skills → Task 5 (type) + Task 8 (pipeline). ✓
- §3.4 replace placeholder, provider-free card → Tasks 6 + 7. ✓
- §6 tests → each core/UI task is TDD; §7 file inventory all covered. ✓
- §8 two pending user actions → Tasks 8 & 9, clearly gated + non-blocking. ✓

**Placeholder scan:** no "TBD"/"add error handling" left; the two DATA-GATED tasks are genuine external dependencies, not vague steps, and each has concrete steps. Task 8 Step 1 adapts to the real field shape (documented as a deliberate inspect-then-implement step). ✓

**Type consistency:** `buildUniqueToInheritedMap`→`{map,unresolved}`; `reconcileGreenSkillId(id, map)`; `buildCoverageMatrix(CoverageInput)→CoverageResult`; `planLineageAffinity(idx, umaId, pA, pB, g1Set?)`; `CoverageMatrixCard({result, hasWishlist, hasPlanUma})`; `memberAffinity` ctx `{parentId, grandparent, gpIndex}` matches `spark.ts` verbatim. Consistent across tasks. ✓

**Ordering:** Tasks 1–7 (non-gated) deliver a working card that degrades gracefully; Tasks 8–9 light up gated columns when data arrives; Task 10 documents. ✓
