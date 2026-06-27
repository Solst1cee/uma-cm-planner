# M1.4 Inheritance Card + UmaExtractor Importer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the M1 "Inheritance" card (owned Parent 1 & 2 picker + Find-candidates + spark display, persisted to `plan.parents`) and the UmaExtractor importer (Upload data → parse `data.json` → local `parents` roster).

**Architecture:** A pure factor-id decoder feeds a pure UmaExtractor parser that maps veterans → `Parent[]`; a Dexie bulk-upsert + a small hook persist the roster locally; the presentational `ParentCardView` and the `InheritanceCard` container consume the roster and the active `CmPlan` (goals from `sparkGoals`, selection to `parents.{a,b}`). Rental mode is deferred to M1.4b.

**Tech Stack:** TypeScript, React 19, Vitest (jsdom) + Testing Library, Dexie. Path alias `@/*` → `src/*`. Run tests with `pnpm vitest run <path>`.

**Spec:** [docs/superpowers/specs/2026-06-26-m1-4-inheritance-card-design.md](../specs/2026-06-26-m1-4-inheritance-card-design.md)

## Global Constraints

- **Pure core (P6):** decode + parse + scoring are pure functions, no Dexie/DOM imports; mechanics-style logic is unit-tested.
- **P3 honest numbers:** Find-candidates is a *heuristic pre-rank*, captioned as such; never present it as a verdict. Never fabricate a value where a mapping is unresolved (green/unique spark and `wonRaces` saddle→G1 mapping have documented fallbacks).
- **Privacy (provenance §5):** the parser drops `owner_viewer_id`, every `*viewer_id`, `rental_viewer_id`. The committed fixture is scrubbed. Never commit anything from `spikes/` or a personal export.
- **Windows case-FS convention:** React component files use a `View`/`Card` suffix; pure helpers are lower-camel siblings (e.g. `ParentCardView.tsx` + `candidateScore.ts`). Never name a component file the same (case-insensitively) as a helper.
- **`Parent.pinkSpark.aptitude` string convention:** `'turf'|'dirt'|'sprint'|'mile'|'medium'|'long'|'front'|'pace'|'late'|'end'` (distance uses `'sprint'`, NOT `'short'`).
- **Selection persistence:** picked parents → `CmPlan.parents = { a?: parentId, b?: parentId }`, saved via `useActivePlan().setPlan(next)`.
- **Roster pool:** owned veterans = `parents` store rows with `source: 'mine'`.
- **Test races:** trust `pnpm typecheck` / `pnpm build`; re-run a flaky UI test file once before treating a failure as real (do not run with `pnpm dev` active).
- **Commit footer:** end every commit message with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## File Structure

- `src/features/inheritance/factorDecode.ts` — pure `decodeFactor(id)` → tagged union (Task 1)
- `src/features/inheritance/umaExtractor.ts` — pure `parseUmaExtractor(json, deps)` → `{ parents, skipped }` (Task 2)
- `src/features/inheritance/__fixtures__/umaextractor-sample.json` — scrubbed single-veteran fixture (Task 2)
- `src/db/parentsApi.ts` — add `bulkUpsertParents` (Task 3)
- `src/features/inheritance/useRoster.ts` — load roster + import-from-file + timestamp (Task 4)
- `src/features/inheritance/UploadDataButton.tsx` — file input → parse → upsert → toast (Task 4)
- `src/features/inheritance/candidateScore.ts` — pure `candidateScore` + `topCandidates` (Task 5)
- `src/features/inheritance/ParentCardView.tsx` — presentational parent card (Task 6)
- `src/features/inheritance/InheritanceCard.tsx` — container wiring roster + plan + candidates (Task 7)
- `src/features/inheritance/InheritancePage.tsx` — swap the M1.4 placeholder (Task 8)
- `src/features/inheritance/inheritance.css` — card styles (Task 8)

---

### Task 1: Factor-id decoder (`factorDecode.ts`)

**Files:**
- Create: `src/features/inheritance/factorDecode.ts`
- Test: `src/features/inheritance/factorDecode.test.ts`

**Interfaces:**
- Consumes: `Stat`, `Strategy` from `@/core/types`.
- Produces:
  - `type DecodedFactor = { kind:'blue'; stat:Stat; star:1|2|3 } | { kind:'pink'; aptitude:string; star:1|2|3 } | { kind:'white'; groupBase:number; star:1|2|3 } | { kind:'green'; uniqueSkillId:string; star:1|2|3 } | { kind:'skip' }`
  - `decodeFactor(id:number): DecodedFactor`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/inheritance/factorDecode.test.ts
import { describe, expect, it } from 'vitest';
import { decodeFactor } from './factorDecode';

describe('decodeFactor', () => {
  it('decodes blue stat factors (stat = floor(id/100), star = id%10)', () => {
    expect(decodeFactor(202)).toEqual({ kind: 'blue', stat: 'sta', star: 2 });
    expect(decodeFactor(101)).toEqual({ kind: 'blue', stat: 'spd', star: 1 });
    expect(decodeFactor(103)).toEqual({ kind: 'blue', stat: 'spd', star: 3 });
    expect(decodeFactor(503)).toEqual({ kind: 'blue', stat: 'wit', star: 3 });
  });

  it('decodes pink aptitude factors (surface / style / distance)', () => {
    expect(decodeFactor(1101)).toEqual({ kind: 'pink', aptitude: 'turf', star: 1 });
    expect(decodeFactor(1202)).toEqual({ kind: 'pink', aptitude: 'dirt', star: 2 });
    expect(decodeFactor(2201)).toEqual({ kind: 'pink', aptitude: 'pace', star: 1 });
    expect(decodeFactor(2301)).toEqual({ kind: 'pink', aptitude: 'late', star: 1 });
    expect(decodeFactor(3101)).toEqual({ kind: 'pink', aptitude: 'sprint', star: 1 });
    expect(decodeFactor(3402)).toEqual({ kind: 'pink', aptitude: 'long', star: 2 });
  });

  it('decodes white skill sparks to a group base + star', () => {
    expect(decodeFactor(2003601)).toEqual({ kind: 'white', groupBase: 200360, star: 1 });
  });

  it('decodes green/unique sparks (base + alt outfit variants)', () => {
    // 10[150][1][02] → middle 150, variant 1 (base) → 100001+150 = 100151, star 2
    expect(decodeFactor(10150102)).toEqual({ kind: 'green', uniqueSkillId: '100151', star: 2 });
    // variant 2 (alt outfit) → 110001 + middle
    expect(decodeFactor(10150202)).toEqual({ kind: 'green', uniqueSkillId: '110151', star: 2 });
  });

  it('skips race + scenario sparks and invalid stars', () => {
    expect(decodeFactor(1001202)).toEqual({ kind: 'skip' }); // race spark
    expect(decodeFactor(3000101)).toEqual({ kind: 'skip' }); // scenario spark
    expect(decodeFactor(200)).toEqual({ kind: 'skip' }); // star 0 → invalid
    expect(decodeFactor(0)).toEqual({ kind: 'skip' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/factorDecode.test.ts`
Expected: FAIL — `decodeFactor` not exported / file missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/inheritance/factorDecode.ts
/**
 * Pure UmaExtractor factor-id decoder. The star level is the LAST digit (1–3);
 * the leading digits identify the factor. Ranges validated against
 * spikes/repos/uma-parent-viewer/enrich_data.py + the sample veteran.
 *
 *   100–599        blue stat   (stat = floor(id/100): 1 spd 2 sta 3 pow 4 gut 5 wit)
 *   1100–1299      pink ground (11 turf, 12 dirt)
 *   2100–2499      pink style  (21 front, 22 pace, 23 late, 24 end)
 *   3100–3499      pink dist   (31 sprint, 32 mile, 33 medium, 34 long)
 *   2_000_000..    white skill (group base = floor(id/100)*10)
 *   10_000_000..   green/unique (10[middle][variant][star])
 *   1e6..1e7 else  race / scenario sparks → skip (not in the Parent model)
 */
import type { Stat, Strategy } from '@/core/types';

export type DecodedFactor =
  | { kind: 'blue'; stat: Stat; star: 1 | 2 | 3 }
  | { kind: 'pink'; aptitude: string; star: 1 | 2 | 3 }
  | { kind: 'white'; groupBase: number; star: 1 | 2 | 3 }
  | { kind: 'green'; uniqueSkillId: string; star: 1 | 2 | 3 }
  | { kind: 'skip' };

const SKIP: DecodedFactor = { kind: 'skip' };
const BLUE_STAT: Record<number, Stat> = { 1: 'spd', 2: 'sta', 3: 'pow', 4: 'gut', 5: 'wit' };
const PINK_SURFACE: Record<number, string> = { 11: 'turf', 12: 'dirt' };
const PINK_STYLE: Record<number, Strategy> = { 21: 'front', 22: 'pace', 23: 'late', 24: 'end' };
const PINK_DISTANCE: Record<number, string> = { 31: 'sprint', 32: 'mile', 33: 'medium', 34: 'long' };

function star(id: number): 1 | 2 | 3 | null {
  const s = id % 10;
  return s === 1 || s === 2 || s === 3 ? s : null;
}

export function decodeFactor(id: number): DecodedFactor {
  if (!Number.isInteger(id) || id <= 0) return SKIP;
  const s = star(id);

  // green/unique: 8-digit 10[middle:3][variant:1][star:2]
  if (id >= 10_000_000 && id < 20_000_000) {
    const str = String(id);
    if (str.length !== 8 || s === null) return SKIP;
    const middle = Number(str.slice(2, 5));
    const variant = Number(str[5]);
    const base = variant === 2 ? 110001 : 100001;
    return { kind: 'green', uniqueSkillId: String(base + middle), star: s };
  }
  // white skill spark
  if (id >= 2_000_000 && id < 3_000_000) {
    if (s === null) return SKIP;
    return { kind: 'white', groupBase: Math.floor(id / 100) * 10, star: s };
  }
  // race + scenario sparks → skip
  if (id >= 1_000_000 && id < 10_000_000) return SKIP;

  // blue stat (3-digit)
  if (id >= 100 && id <= 599) {
    const stat = BLUE_STAT[Math.floor(id / 100)];
    return stat && s !== null ? { kind: 'blue', stat, star: s } : SKIP;
  }
  // pink (4-digit)
  if (id >= 1100 && id <= 3499) {
    const group = Math.floor(id / 100);
    const aptitude = PINK_SURFACE[group] ?? PINK_STYLE[group] ?? PINK_DISTANCE[group];
    return aptitude && s !== null ? { kind: 'pink', aptitude, star: s } : SKIP;
  }
  return SKIP;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/factorDecode.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/factorDecode.ts src/features/inheritance/factorDecode.test.ts
git commit -m "feat(m1): UmaExtractor factor-id decoder (M1.4)"
```

---

### Task 2: UmaExtractor parser (`umaExtractor.ts`) + fixture

**Files:**
- Create: `src/features/inheritance/umaExtractor.ts`
- Create: `src/features/inheritance/__fixtures__/umaextractor-sample.json`
- Test: `src/features/inheritance/umaExtractor.test.ts`

**Interfaces:**
- Consumes: `decodeFactor` (Task 1); `Parent`, `ParentRef`, `Stat` from `@/core/types`.
- Produces:
  - `interface ParseDeps { resolveWhiteSkill: (groupBase:number) => string | undefined }`
  - `interface ParseResult { parents: Parent[]; skipped: number }`
  - `parseUmaExtractor(json: unknown, deps: ParseDeps): ParseResult`
  - `ratingFromRank(rank: number): string`

**Context — fixture creation.** Build the scrubbed fixture from the sample at the original repo path (the worktree base does not contain it). Run this once before writing the test:

```bash
node -e '
const fs=require("fs");
const SRC="C:/Users/User/Project/uma-cm-planner/docs/UmaExtractorSampleData/data.json";
const d=JSON.parse(fs.readFileSync(SRC,"utf8"));
const v=Array.isArray(d)?d[0]:(d.trained_chara_array||d.data)[0];
// keep only fields the parser reads; force-scrub any viewer ids
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>k in o).map(k=>[k,o[k]]));
const gp=g=>({...pick(g,["position_id","card_id","rank","rarity","factor_id_array","factor_info_array","win_saddle_id_array"]),owner_viewer_id:0});
const out=[{...pick(v,["trained_chara_id","card_id","speed","stamina","power","wiz","guts","rank","rank_score","rarity",
  "proper_ground_turf","proper_ground_dirt","proper_running_style_nige","proper_running_style_senko","proper_running_style_sashi","proper_running_style_oikomi",
  "proper_distance_short","proper_distance_mile","proper_distance_middle","proper_distance_long",
  "factor_id_array","factor_info_array","win_saddle_id_array"]),
  succession_chara_array:(v.succession_chara_array||[]).map(gp)}];
fs.mkdirSync("src/features/inheritance/__fixtures__",{recursive:true});
fs.writeFileSync("src/features/inheritance/__fixtures__/umaextractor-sample.json",JSON.stringify(out,null,2));
console.log("wrote fixture; card_id",out[0].card_id,"factors",out[0].factor_id_array,"gp positions",out[0].succession_chara_array.map(g=>g.position_id));
'
```

Expected output: `wrote fixture; card_id 101501 factors [202,2201,1001202,1001701,2003601,3000101,10150102] gp positions [10,20,11,12,21,22]` (or similar — positions include 10 and 20). Confirm the written file has `owner_viewer_id:0` on each succession node and **no** other `*viewer_id` keys.

- [ ] **Step 1: Write the failing test**

```ts
// src/features/inheritance/umaExtractor.test.ts
import { describe, expect, it } from 'vitest';
import sample from './__fixtures__/umaextractor-sample.json';
import { parseUmaExtractor, ratingFromRank, type ParseDeps } from './umaExtractor';

// Stub resolver: white group base → a deterministic white skill id (groupBase+1).
const deps: ParseDeps = { resolveWhiteSkill: (g) => String(g + 1) };

describe('parseUmaExtractor', () => {
  it('maps a veteran to a Parent with blue + pink main sparks', () => {
    const { parents } = parseUmaExtractor(sample, deps);
    expect(parents).toHaveLength(1);
    const p = parents[0]!;
    expect(p.id).toBe('47'); // trained_chara_id
    expect(p.umaId).toBe('101501'); // card_id
    expect(p.source).toBe('mine');
    expect(p.importSource).toBe('umaextractor');
    expect(p.blueSpark).toEqual({ stat: 'sta', stars: 2 }); // factor 202
    expect(p.pinkSpark).toEqual({ aptitude: 'pace', stars: 1 }); // factor 2201
    expect(p.stats).toEqual({ spd: 991, sta: 677, pow: 632, gut: 398, wit: 450 });
  });

  it('decodes white sparks via the injected resolver and skips race/scenario/green', () => {
    const p = parseUmaExtractor(sample, deps).parents[0]!;
    // factor 2003601 → groupBase 200360 → resolver → '200361'
    expect(p.whiteSparks).toContainEqual({ skillId: '200361', stars: 1 });
    // race (1001202/1001701), scenario (3000101), green (10150102) are NOT white sparks
    expect(p.whiteSparks.every((w) => w.skillId === '200361')).toBe(true);
    // green/unique deferred to M1.7 — greenSpark not populated
    expect(p.greenSpark).toBeUndefined();
  });

  it('reads grandparents from succession positions 10 and 20', () => {
    const p = parseUmaExtractor(sample, deps).parents[0]!;
    expect(p.grandparents).toHaveLength(2);
    const [g1, g2] = p.grandparents!;
    expect(g1!.umaId).toBe('100701'); // position 10 card_id
    expect(g2!.umaId).toBe('100601'); // position 20 card_id
    expect(g1!.blueSpark).toEqual({ stat: 'sta', stars: 1 }); // factor 201
  });

  it('maps win_saddle_id_array to wonRaces', () => {
    const p = parseUmaExtractor(sample, deps).parents[0]!;
    expect(p.wonRaces).toEqual(['6', '10', '11', '13', '14', '18', '26']);
  });

  it('accepts the {trained_chara_array} envelope and wiz/wisdom dualities', () => {
    const wrapped = { trained_chara_array: sample };
    expect(parseUmaExtractor(wrapped, deps).parents).toHaveLength(1);
  });

  it('returns empty without throwing on malformed input', () => {
    expect(parseUmaExtractor(null, deps)).toEqual({ parents: [], skipped: 0 });
    expect(parseUmaExtractor({ nope: 1 }, deps)).toEqual({ parents: [], skipped: 0 });
    expect(parseUmaExtractor([{ trained_chara_id: 1 }], deps).skipped).toBe(1); // no card_id
  });

  it('ratingFromRank maps known ranks', () => {
    expect(ratingFromRank(12)).toBe('B+');
    expect(ratingFromRank(13)).toBe('A');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/umaExtractor.test.ts`
Expected: FAIL — `parseUmaExtractor` not exported / fixture missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/inheritance/umaExtractor.ts
/**
 * Pure UmaExtractor data.json → Parent[] parser (spec §3, provenance §5).
 * Source-agnostic: the caller persists. Privacy: drops every *viewer_id.
 * Green/unique sparks are decoded but NOT stored — the 100xxx→9xxxxx
 * inherited-id convention (mechanics-notes §8) is reconciled in M1.7; we
 * omit rather than store a wrong id. wonRaces are raw saddle ids (saddle→G1
 * filtering reconciled with winBonus.ts later; never fabricate a G1 win).
 */
import type { Parent, ParentRef, Stat } from '@/core/types';
import { decodeFactor } from './factorDecode';

export interface ParseDeps {
  /** group base (floor(factorId/100)*10) → the white skill id, or undefined. */
  resolveWhiteSkill: (groupBase: number) => string | undefined;
}
export interface ParseResult {
  parents: Parent[];
  skipped: number;
}

type Json = Record<string, unknown>;
const isObj = (x: unknown): x is Json => typeof x === 'object' && x !== null;
const num = (x: unknown): number | undefined => (typeof x === 'number' ? x : undefined);

/** Best-effort single_mode_rank int → letter (display + tie-break only). */
const RANK_LETTERS: Record<number, string> = {
  1: 'G', 2: 'F', 3: 'F+', 4: 'E', 5: 'E+', 6: 'D', 7: 'D+', 8: 'C', 9: 'C+',
  10: 'B', 11: 'B', 12: 'B+', 13: 'A', 14: 'A+', 15: 'S', 16: 'S+', 17: 'SS',
};
export function ratingFromRank(rank: number): string {
  return RANK_LETTERS[rank] ?? String(rank);
}

function statsOf(v: Json): Record<Stat, number> | undefined {
  const spd = num(v.speed), sta = num(v.stamina), pow = num(v.power);
  const gut = num(v.guts), wit = num(v.wiz) ?? num(v.wisdom);
  if ([spd, sta, pow, gut, wit].some((n) => n === undefined)) return undefined;
  return { spd: spd!, sta: sta!, pow: pow!, gut: gut!, wit: wit! };
}

function asStar(level: unknown, fallback: 1 | 2 | 3): 1 | 2 | 3 {
  const l = num(level);
  return l === 1 || l === 2 || l === 3 ? l : fallback;
}

/** Decode a factor_id_array into the parent/ref spark fields. */
function decodeSparks(factorIds: number[], deps: ParseDeps) {
  let blueSpark: { stat: Stat; stars: 1 | 2 | 3 } | undefined;
  let pinkSpark: { aptitude: string; stars: 1 | 2 | 3 } | undefined;
  const whiteSparks: Array<{ skillId: string; stars: 1 | 2 | 3 }> = [];
  for (const id of factorIds) {
    const d = decodeFactor(id);
    if (d.kind === 'blue') blueSpark ??= { stat: d.stat, stars: d.star };
    else if (d.kind === 'pink') pinkSpark ??= { aptitude: d.aptitude, stars: d.star };
    else if (d.kind === 'white') {
      const skillId = deps.resolveWhiteSkill(d.groupBase);
      if (skillId) whiteSparks.push({ skillId, stars: d.star });
    }
    // green/unique + skip → omitted (see module docblock)
  }
  return { blueSpark, pinkSpark, whiteSparks };
}

function intArray(x: unknown): number[] {
  return Array.isArray(x) ? x.filter((n): n is number => typeof n === 'number') : [];
}
function wonRacesOf(v: Json): string[] | undefined {
  const arr = intArray(v.win_saddle_id_array);
  return arr.length ? arr.map(String) : undefined;
}

function toGrandparent(node: unknown, deps: ParseDeps): ParentRef | undefined {
  if (!isObj(node)) return undefined;
  const cardId = num(node.card_id);
  if (cardId === undefined) return undefined;
  const { blueSpark, pinkSpark, whiteSparks } = decodeSparks(intArray(node.factor_id_array), deps);
  const ref: ParentRef = { umaId: String(cardId) };
  if (blueSpark) ref.blueSpark = blueSpark;
  if (pinkSpark) ref.pinkSpark = pinkSpark;
  if (whiteSparks.length) ref.whiteSparks = whiteSparks;
  const won = wonRacesOf(node);
  if (won) ref.wonRaces = won;
  return ref;
}

function toParent(v: Json, deps: ParseDeps): Parent | undefined {
  const charaId = num(v.trained_chara_id);
  const cardId = num(v.card_id);
  const stats = statsOf(v);
  if (charaId === undefined || cardId === undefined || !stats) return undefined;
  const { blueSpark, pinkSpark, whiteSparks } = decodeSparks(intArray(v.factor_id_array), deps);
  if (!blueSpark || !pinkSpark) return undefined; // every trained uma has both main sparks

  // grandparents = succession positions 10 (parent-1 side) and 20 (parent-2 side)
  const succ = Array.isArray(v.succession_chara_array) ? v.succession_chara_array : [];
  const at = (pos: number) => succ.find((n) => isObj(n) && num((n as Json).position_id) === pos);
  const g10 = toGrandparent(at(10), deps);
  const g20 = toGrandparent(at(20), deps);

  const parent: Parent = {
    id: String(charaId),
    umaId: String(cardId),
    blueSpark,
    pinkSpark,
    whiteSparks,
    source: 'mine',
    importSource: 'umaextractor',
    stats,
  };
  if (g10 || g20) parent.grandparents = [g10, g20];
  const rank = num(v.rank);
  if (rank !== undefined) parent.rating = ratingFromRank(rank);
  const won = wonRacesOf(v);
  if (won) parent.wonRaces = won;
  return parent;
}

export function parseUmaExtractor(json: unknown, deps: ParseDeps): ParseResult {
  const list: unknown[] = Array.isArray(json)
    ? json
    : isObj(json) && Array.isArray(json.trained_chara_array)
      ? json.trained_chara_array
      : isObj(json) && Array.isArray(json.data)
        ? json.data
        : [];
  const parents: Parent[] = [];
  let skipped = 0;
  for (const v of list) {
    const p = isObj(v) ? toParent(v, deps) : undefined;
    if (p) parents.push(p);
    else skipped += 1;
  }
  return { parents, skipped };
}
```

> Note `asStar` is provided for completeness if level-based stars are ever needed; the sample's `factor_info_array.level` is uniformly 0, so stars derive from the id (decodeFactor). Remove `asStar` if your linter flags it as unused.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/umaExtractor.test.ts`
Expected: PASS (7 tests). If `asStar` trips `noUnusedLocals`, delete it.

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/umaExtractor.ts src/features/inheritance/umaExtractor.test.ts src/features/inheritance/__fixtures__/umaextractor-sample.json
git commit -m "feat(m1): UmaExtractor data.json parser + scrubbed fixture (M1.4)"
```

---

### Task 3: Dexie bulk upsert (`bulkUpsertParents`)

**Files:**
- Modify: `src/db/parentsApi.ts`
- Modify: `src/db/index.ts` (re-export)
- Test: `src/db/parentsApi.test.ts` (append)

**Interfaces:**
- Consumes: `Parent` from `@/core/types`; `db` singleton.
- Produces: `bulkUpsertParents(parents: Parent[]): Promise<number>` (returns count written).

- [ ] **Step 1: Write the failing test** (append to `src/db/parentsApi.test.ts`)

```ts
import { bulkUpsertParents, listParents } from './parentsApi';

describe('bulkUpsertParents', () => {
  it('inserts new parents and overwrites by id, returning the count', async () => {
    const base = {
      umaId: '101501', blueSpark: { stat: 'sta', stars: 2 }, pinkSpark: { aptitude: 'pace', stars: 1 },
      whiteSparks: [], source: 'mine', importSource: 'umaextractor', stats: { spd: 991, sta: 677, pow: 632, gut: 398, wit: 450 },
    } as const;
    const n = await bulkUpsertParents([
      { ...base, id: 'v1' },
      { ...base, id: 'v2', umaId: '100601' },
    ]);
    expect(n).toBe(2);
    // re-import v1 with a changed stat → overwrite, not duplicate
    await bulkUpsertParents([{ ...base, id: 'v1', umaId: '999999' }]);
    const all = await listParents();
    expect(all.filter((p) => p.id === 'v1')).toHaveLength(1);
    expect(all.find((p) => p.id === 'v1')!.umaId).toBe('999999');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/db/parentsApi.test.ts`
Expected: FAIL — `bulkUpsertParents` not exported.

- [ ] **Step 3: Write minimal implementation** (append to `src/db/parentsApi.ts`)

```ts
/** Upsert many parents by id in one transaction (UmaExtractor import). Returns the count written. */
export async function bulkUpsertParents(parents: Parent[]): Promise<number> {
  if (parents.length === 0) return 0;
  await db.parents.bulkPut(parents);
  return parents.length;
}
```

Add to `src/db/index.ts` line 18's re-export:

```ts
export { listParents, getParent, saveParent, deleteParent, bulkUpsertParents } from './parentsApi';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/db/parentsApi.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/parentsApi.ts src/db/index.ts src/db/parentsApi.test.ts
git commit -m "feat(m1): bulkUpsertParents for roster import (M1.4)"
```

---

### Task 4: Roster hook + Upload data button

**Files:**
- Create: `src/features/inheritance/useRoster.ts`
- Create: `src/features/inheritance/UploadDataButton.tsx`
- Test: `src/features/inheritance/UploadDataButton.test.tsx`

**Interfaces:**
- Consumes: `parseUmaExtractor`, `ParseDeps` (Task 2); `bulkUpsertParents`, `listParents` (Task 3); `getSetting`, `setSetting` from `@/db`; `useGameData` from `@/features/data/gameData`.
- Produces:
  - `useRoster(): { roster: Parent[]; importedAt: string | null; importFromFile: (file: File) => Promise<{ added: number; skipped: number }> }`
  - `UploadDataButton({ onImported }: { onImported?: () => void })`
  - const `ROSTER_IMPORTED_AT_KEY = 'umaExtractorImportedAt'`

**Context — white-skill resolver from game data.** Build `resolveWhiteSkill` from the loaded skills: for a group base `g`, return the first skill id in `g+1..g+9` whose `rarity === 'white'`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/inheritance/UploadDataButton.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UploadDataButton } from './UploadDataButton';

const sample = [{
  trained_chara_id: 47, card_id: 101501, speed: 991, stamina: 677, power: 632, wiz: 450, guts: 398,
  rank: 12, factor_id_array: [202, 2201], succession_chara_array: [],
}];

vi.mock('@/features/data/gameData', () => ({
  useGameData: () => ({ skills: [] }),
}));
const bulk = vi.fn(async (p: unknown[]) => p.length);
vi.mock('@/db', () => ({
  bulkUpsertParents: (p: unknown[]) => bulk(p),
  listParents: async () => [],
  getSetting: async () => null,
  setSetting: async () => undefined,
}));

afterEach(cleanup);

describe('UploadDataButton', () => {
  it('parses an uploaded file and upserts the roster', async () => {
    const onImported = vi.fn();
    render(<UploadDataButton onImported={onImported} />);
    const file = new File([JSON.stringify(sample)], 'data.json', { type: 'application/json' });
    const input = screen.getByLabelText(/upload data/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(bulk).toHaveBeenCalled());
    expect(bulk.mock.calls[0]![0]).toHaveLength(1);
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(screen.getByText(/imported 1/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/UploadDataButton.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/inheritance/useRoster.ts
import { useCallback, useEffect, useState } from 'react';
import type { Parent, SkillRecord } from '@/core/types';
import { bulkUpsertParents, getSetting, listParents, setSetting } from '@/db';
import { useGameData } from '@/features/data/gameData';
import { parseUmaExtractor, type ParseDeps } from './umaExtractor';

export const ROSTER_IMPORTED_AT_KEY = 'umaExtractorImportedAt';

/** group base g → first white (rarity 'white') skill id in g+1..g+9. */
export function makeWhiteResolver(skills: SkillRecord[]): ParseDeps['resolveWhiteSkill'] {
  const byId = new Map(skills.map((s) => [s.skillId, s]));
  return (groupBase) => {
    for (let d = 1; d <= 9; d++) {
      const cand = String(groupBase + d);
      if (byId.get(cand)?.rarity === 'white') return cand;
    }
    return undefined;
  };
}

export function useRoster() {
  const { skills } = useGameData();
  const [roster, setRoster] = useState<Parent[]>([]);
  const [importedAt, setImportedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [rows, ts] = await Promise.all([
        listParents(),
        getSetting<string>(ROSTER_IMPORTED_AT_KEY),
      ]);
      if (cancelled) return;
      setRoster(rows);
      setImportedAt(ts ?? null);
    })();
    return () => { cancelled = true; };
  }, []);

  const importFromFile = useCallback(
    async (file: File): Promise<{ added: number; skipped: number }> => {
      const json: unknown = JSON.parse(await file.text());
      const { parents, skipped } = parseUmaExtractor(json, { resolveWhiteSkill: makeWhiteResolver(skills) });
      const added = await bulkUpsertParents(parents);
      const ts = new Date().toISOString();
      await setSetting(ROSTER_IMPORTED_AT_KEY, ts);
      setRoster(await listParents());
      setImportedAt(ts);
      return { added, skipped };
    },
    [skills],
  );

  return { roster, importedAt, importFromFile };
}
```

```tsx
// src/features/inheritance/UploadDataButton.tsx
import { useId, useRef, useState } from 'react';
import { useRoster } from './useRoster';

/** "Upload data" — reads a UmaExtractor data.json into the local roster. */
export function UploadDataButton({ onImported }: { onImported?: () => void }) {
  const { importFromFile } = useRoster();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-importing the same filename
    if (!file) return;
    setStatus('Importing…');
    try {
      const { added, skipped } = await importFromFile(file);
      setStatus(`Imported ${added}${skipped ? `, skipped ${skipped}` : ''}`);
      onImported?.();
    } catch {
      setStatus('Import failed — not a valid UmaExtractor file');
    }
  };

  return (
    <span className="inh-upload">
      <label htmlFor={inputId} className="cmp-small-btn">Upload data</label>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="inh-upload-input"
        aria-label="Upload data"
        onChange={onChange}
      />
      {status && <span className="inh-upload-status muted small">{status}</span>}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/UploadDataButton.test.tsx`
Expected: PASS. (The `.inh-upload-input` visually-hidden style lands in Task 8; the `<label>` is clickable regardless.)

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/useRoster.ts src/features/inheritance/UploadDataButton.tsx src/features/inheritance/UploadDataButton.test.tsx
git commit -m "feat(m1): roster import hook + Upload data button (M1.4)"
```

---

### Task 5: Candidate scoring (`candidateScore.ts`)

**Files:**
- Create: `src/features/inheritance/candidateScore.ts`
- Test: `src/features/inheritance/candidateScore.test.ts`

**Interfaces:**
- Consumes: `Parent`, `CmPlan`, `AptKey`, `Stat` from `@/core/types`.
- Produces:
  - `candidateScore(parent: Parent, goals: CmPlan['sparkGoals']): number`
  - `topCandidates(parents: Parent[], goals: CmPlan['sparkGoals'], n?: number): Array<{ parent: Parent; score: number }>`
  - `aptKeyToPinkKey(aptKey: AptKey): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/inheritance/candidateScore.test.ts
import { describe, expect, it } from 'vitest';
import type { CmPlan, Parent } from '@/core/types';
import { aptKeyToPinkKey, candidateScore, topCandidates } from './candidateScore';

const parent = (over: Partial<Parent>): Parent => ({
  id: 'p', umaId: '1', blueSpark: { stat: 'spd', stars: 3 }, pinkSpark: { aptitude: 'long', stars: 2 },
  whiteSparks: [], source: 'mine', ...over,
});
const goals: CmPlan['sparkGoals'] = {
  blue: { spd: 2, sta: 3 },
  pink: [{ aptKey: { kind: 'distance', key: 'long' }, target: 'A' }],
};

describe('candidateScore', () => {
  it('sums min(parentBlueStars, goalStars) over blue goals', () => {
    // spd: min(3,2)=2 ; sta: parent has no sta blue → 0 ; pink long match → +2
    expect(candidateScore(parent({}), goals)).toBe(4);
  });

  it('adds the parent pink stars when the apt matches a pink goal', () => {
    const p = parent({ pinkSpark: { aptitude: 'sprint', stars: 3 } }); // no goal match
    expect(candidateScore(p, goals)).toBe(2); // only the spd blue contributes
  });

  it('bridges AptKey distance "short" to pink "sprint"', () => {
    expect(aptKeyToPinkKey({ kind: 'distance', key: 'short' })).toBe('sprint');
    expect(aptKeyToPinkKey({ kind: 'surface', key: 'turf' })).toBe('turf');
    expect(aptKeyToPinkKey({ kind: 'strategy', key: 'pace' })).toBe('pace');
  });

  it('topCandidates returns the n highest, sorted desc with a stable tie-break', () => {
    const a = parent({ id: 'a', blueSpark: { stat: 'spd', stars: 1 } }); // 1 + 2 = 3
    const b = parent({ id: 'b' }); // 2 + 2 = 4
    const top = topCandidates([a, b], goals, 1);
    expect(top.map((t) => t.parent.id)).toEqual(['b']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/candidateScore.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/features/inheritance/candidateScore.ts
/**
 * Heuristic pre-rank of roster parents against a plan's spark goals (P3: a
 * ranking aid, NOT a verdict). score = Σ min(parentBlueStars, goalStars) over
 * blue goals + parent pink stars where the aptitude matches a pink goal. Pink
 * plan goals store a Grade (no star) so there is no star to min against —
 * matched pink contributes the parent's own stars.
 */
import type { AptKey, CmPlan, Parent, Stat } from '@/core/types';

/** AptKey → the Parent.pinkSpark.aptitude string convention (distance short → 'sprint'). */
export function aptKeyToPinkKey(aptKey: AptKey): string {
  if (aptKey.kind === 'distance') return aptKey.key === 'short' ? 'sprint' : aptKey.key;
  return aptKey.key;
}

export function candidateScore(parent: Parent, goals: CmPlan['sparkGoals']): number {
  let score = 0;
  for (const [stat, goalStars] of Object.entries(goals.blue) as Array<[Stat, number]>) {
    if (goalStars && parent.blueSpark.stat === stat) {
      score += Math.min(parent.blueSpark.stars, goalStars);
    }
  }
  const pinkKeys = new Set(goals.pink.map((g) => aptKeyToPinkKey(g.aptKey)));
  if (pinkKeys.has(parent.pinkSpark.aptitude)) score += parent.pinkSpark.stars;
  return score;
}

export function topCandidates(
  parents: Parent[],
  goals: CmPlan['sparkGoals'],
  n = 5,
): Array<{ parent: Parent; score: number }> {
  return parents
    .map((parent) => ({ parent, score: candidateScore(parent, goals) }))
    .sort((a, b) => b.score - a.score || a.parent.id.localeCompare(b.parent.id))
    .slice(0, n);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/candidateScore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/candidateScore.ts src/features/inheritance/candidateScore.test.ts
git commit -m "feat(m1): candidate scoring heuristic for Find candidates (M1.4)"
```

---

### Task 6: Presentational parent card (`ParentCardView.tsx`)

**Files:**
- Create: `src/features/inheritance/ParentCardView.tsx`
- Test: `src/features/inheritance/ParentCardView.test.tsx`

**Interfaces:**
- Consumes: `Parent` from `@/core/types`; `aptitudeLabel`, `STAT_LABEL` from `@/features/parents/sparkMeta`.
- Produces:
  - `interface ParentCardViewProps { label: string; parent: Parent | null; portrait?: ReactNode; gpPortraits?: [ReactNode, ReactNode]; rentalToggle?: ReactNode; rentalStub?: boolean; onFindCandidates?: () => void; onChange?: () => void; onClear?: () => void; children?: ReactNode }`
  - `ParentCardView(props): JSX.Element`

This is **presentational only** — the picker/candidate dropdowns are passed in as `children`. It must render without any provider (no `GameIcon`/`useGameData` calls; portraits arrive as props).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/inheritance/ParentCardView.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { Parent } from '@/core/types';
import { ParentCardView } from './ParentCardView';

afterEach(cleanup);
const p: Parent = {
  id: '1', umaId: '101501', blueSpark: { stat: 'spd', stars: 3 }, pinkSpark: { aptitude: 'long', stars: 2 },
  whiteSparks: [{ skillId: '200361', stars: 1 }], source: 'mine',
};

describe('ParentCardView', () => {
  it('renders the empty state with Find candidates + Change', () => {
    render(<ParentCardView label="Parent 1" parent={null} onFindCandidates={vi.fn()} onChange={vi.fn()} />);
    expect(screen.getByText('Parent 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /find candidates/i })).toBeInTheDocument();
  });

  it('renders blue + pink chips and a white-spark row when filled', () => {
    render(<ParentCardView label="Parent 1" parent={p} onClear={vi.fn()} />);
    expect(screen.getByText(/Speed/)).toBeInTheDocument();
    expect(screen.getByText(/Long/)).toBeInTheDocument();
    expect(screen.getByText('200361')).toBeInTheDocument();
  });

  it('shows the rental stub when rentalStub is set', () => {
    render(<ParentCardView label="Parent 2" parent={null} rentalStub />);
    expect(screen.getByText(/coming in m1\.4b/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/ParentCardView.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/inheritance/ParentCardView.tsx
/** Presentational single-parent card (M1.4). Provider-free: portraits + picker
 *  arrive as props/children. The container (InheritanceCard) wires data. */
import type { ReactNode } from 'react';
import { aptitudeLabel, STAT_LABEL, starsGlyph } from '@/features/parents/sparkMeta';
import type { Parent } from '@/core/types';

export interface ParentCardViewProps {
  label: string;
  parent: Parent | null;
  portrait?: ReactNode;
  gpPortraits?: [ReactNode, ReactNode];
  rentalToggle?: ReactNode;
  rentalStub?: boolean;
  onFindCandidates?: () => void;
  onChange?: () => void;
  onClear?: () => void;
  children?: ReactNode;
}

export function ParentCardView({
  label, parent, portrait, gpPortraits, rentalToggle, rentalStub,
  onFindCandidates, onChange, onClear, children,
}: ParentCardViewProps) {
  return (
    <div className="inh-parent">
      <div className="inh-parent-head">
        <span className="cmp-mini-label">{label}</span>
        {rentalToggle}
        <span className="inh-parent-actions">
          {!rentalStub && onFindCandidates && (
            <button type="button" className="cmp-small-btn" onClick={onFindCandidates}>Find candidates</button>
          )}
          {!rentalStub && onChange && (
            <button type="button" className="cmp-small-btn" onClick={onChange}>{parent ? 'Change' : 'Pick'}</button>
          )}
          {parent && onClear && (
            <button type="button" className="cmp-small-btn inh-clear" aria-label="Clear" onClick={onClear}>✕</button>
          )}
        </span>
      </div>

      {rentalStub ? (
        <p className="inh-rental-stub muted small">Rental mode coming in M1.4b.</p>
      ) : parent ? (
        <div className="inh-parent-body">
          <div className="inh-parent-id">
            <span className="inh-parent-portrait">{portrait}</span>
            <span className="inh-parent-name">{parent.umaId}{parent.rating ? ` · ${parent.rating}` : ''}</span>
            {gpPortraits && (
              <span className="inh-gp">GP:{gpPortraits[0]}{gpPortraits[1]}</span>
            )}
          </div>
          <div className="spark-chips">
            <span className="badge spark-blue">{STAT_LABEL[parent.blueSpark.stat]} {starsGlyph(parent.blueSpark.stars)}</span>
            <span className="badge spark-pink">{aptitudeLabel(parent.pinkSpark.aptitude)} {starsGlyph(parent.pinkSpark.stars)}</span>
          </div>
          {parent.whiteSparks.length > 0 && (
            <ul className="inh-white-list">
              {parent.whiteSparks.map((w, i) => (
                <li key={`${w.skillId}-${i}`} className="inh-white-row">
                  <span className="inh-white-name">{w.skillId}</span>
                  <span className="inh-white-stars inh-star-own">{starsGlyph(w.stars)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="inh-parent-empty muted small">No parent selected.</p>
      )}
      {children}
    </div>
  );
}
```

> White-spark rows show the raw `skillId` here; the container (Task 7) can pass resolved names via a future prop, but M1.4 keeps the presentational view name-agnostic (it has no game-data provider). Gold-own vs gray-GP star coloring is via `inh-star-own` / `inh-star-gp` classes (Task 8 CSS); grandparent white sparks render with `inh-star-gp` when the container threads them in a later iteration — owned-parent self sparks use `inh-star-own`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/ParentCardView.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/ParentCardView.tsx src/features/inheritance/ParentCardView.test.tsx
git commit -m "feat(m1): presentational ParentCardView (M1.4)"
```

---

### Task 7: Inheritance card container (`InheritanceCard.tsx`)

**Files:**
- Create: `src/features/inheritance/InheritanceCard.tsx`
- Test: `src/features/inheritance/InheritanceCard.test.tsx`

**Interfaces:**
- Consumes: `useActivePlan` from `@/app/ActivePlanContext`; `useRoster` (Task 4); `topCandidates` (Task 5); `ParentCardView` (Task 6); `UploadDataButton` (Task 4); `SearchPicker` from `@/features/parents/SearchPicker`; `useUmas`, `umaName` from `@/features/parents/useUmas`; `GameIcon` from `@/features/data/GameIcon`.
- Produces: `InheritanceCard(): JSX.Element`

**Behavior:**
- Pool = `roster.filter((p) => p.source === 'mine')`.
- Picking a parent → `setPlan({ ...uma1Plan, parents: { ...uma1Plan.parents, [slot]: parentId } })` where `slot` is `'a'` (Parent 1) or `'b'` (Parent 2).
- Clear → set that slot to `undefined`.
- Find candidates → `topCandidates(pool, uma1Plan.sparkGoals)` shown in a `picker-results` list.
- Parent 2 Owned/Rental `cmp-control-group` toggle; Rental → `rentalStub`.
- Collapsible `cmp-plan-card` with header "Inheritance" + muted "parents 1 & 2" + (right) "Updated {importedAt}" + `UploadDataButton`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/inheritance/InheritanceCard.test.tsx
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CmPlan, Parent } from '@/core/types';
import { InheritanceCard } from './InheritanceCard';

const ROSTER: Parent[] = [
  { id: 'a', umaId: '101501', blueSpark: { stat: 'spd', stars: 3 }, pinkSpark: { aptitude: 'long', stars: 3 }, whiteSparks: [], source: 'mine' },
  { id: 'b', umaId: '100601', blueSpark: { stat: 'sta', stars: 1 }, pinkSpark: { aptitude: 'mile', stars: 1 }, whiteSparks: [], source: 'mine' },
];
const setPlan = vi.fn();
const plan = {
  id: 'p1', parents: {}, sparkGoals: { blue: { spd: 3 }, pink: [{ aptKey: { kind: 'distance', key: 'long' }, target: 'A' }] },
} as unknown as CmPlan;

vi.mock('@/app/ActivePlanContext', () => ({ useActivePlan: () => ({ uma1Plan: plan, setPlan }) }));
vi.mock('./useRoster', () => ({ useRoster: () => ({ roster: ROSTER, importedAt: null, importFromFile: vi.fn() }) }));
vi.mock('@/features/parents/useUmas', () => ({ useUmas: () => ({ umaById: new Map() }), umaName: (_m: unknown, id: string) => `Uma ${id}` }));
vi.mock('@/features/data/GameIcon', () => ({ GameIcon: () => null }));
vi.mock('./UploadDataButton', () => ({ UploadDataButton: () => null }));

afterEach(() => { cleanup(); setPlan.mockClear(); });

describe('InheritanceCard', () => {
  it('ranks candidates and persists a pick to plan.parents.a', () => {
    render(<InheritanceCard />);
    fireEvent.click(screen.getAllByRole('button', { name: /find candidates/i })[0]!);
    // top candidate is 'a' (spd 3 + long 3 = 6); click it
    fireEvent.click(screen.getByRole('button', { name: /Uma 101501/i }));
    expect(setPlan).toHaveBeenCalledWith(expect.objectContaining({ parents: { a: 'a' } }));
  });

  it('switches Parent 2 to a rental stub', () => {
    render(<InheritanceCard />);
    fireEvent.click(screen.getByRole('button', { name: /rental/i }));
    expect(screen.getByText(/coming in m1\.4b/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/InheritanceCard.test.tsx`
Expected: FAIL — module missing.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/inheritance/InheritanceCard.tsx
/** M1.4 — the "Inheritance" card: owned Parent 1 & 2 picker, Find-candidates,
 *  spark display, selection persisted to plan.parents. Rental → M1.4b stub. */
import { useMemo, useState } from 'react';
import { useActivePlan } from '@/app/ActivePlanContext';
import type { Parent } from '@/core/types';
import { GameIcon } from '@/features/data/GameIcon';
import { SearchPicker, type SearchItem } from '@/features/parents/SearchPicker';
import { umaName, useUmas } from '@/features/parents/useUmas';
import { ParentCardView } from './ParentCardView';
import { UploadDataButton } from './UploadDataButton';
import { useRoster } from './useRoster';
import { topCandidates } from './candidateScore';

type Slot = 'a' | 'b';
type Mode = null | 'find' | 'change';

export function InheritanceCard() {
  const { uma1Plan, setPlan } = useActivePlan();
  const { roster } = useRoster();
  const { umaById } = useUmas();
  const [open, setOpen] = useState(true);
  const [p2rental, setP2rental] = useState(false);
  const [mode, setMode] = useState<Record<Slot, Mode>>({ a: null, b: null });

  const pool = useMemo(() => roster.filter((p) => p.source === 'mine'), [roster]);
  if (!uma1Plan) return null;

  const byId = new Map(pool.map((p) => [p.id, p]));
  const select = (slot: Slot, parentId: string | undefined) => {
    setPlan({ ...uma1Plan, parents: { ...uma1Plan.parents, [slot]: parentId } });
    setMode((m) => ({ ...m, [slot]: null }));
  };
  const items: SearchItem[] = pool.map((p) => ({ id: p.id, name: umaName(umaById, p.umaId), sub: p.umaId }));
  const portrait = (p: Parent) => <GameIcon kind="uma" id={p.umaId} size={42} alt="" />;

  const slotPicker = (slot: Slot) => {
    const m = mode[slot];
    if (m === 'change') {
      return <SearchPicker label="Pick a veteran" placeholder="search roster…" items={items} onPick={(id) => select(slot, id)} />;
    }
    if (m === 'find') {
      const top = topCandidates(pool, uma1Plan.sparkGoals);
      return (
        <ul className="picker-results" aria-label="candidates">
          {top.length === 0 && <li className="muted">No roster veterans — Upload data.</li>}
          {top.map(({ parent, score }) => (
            <li key={parent.id}>
              <button type="button" className="picker-row" onClick={() => select(slot, parent.id)}>
                <span className="picker-name">{umaName(umaById, parent.umaId)}</span>
                <span className="badge">match {score}</span>
              </button>
            </li>
          ))}
          <li className="muted small">Heuristic pre-rank by spark-goal overlap — not a verdict.</li>
        </ul>
      );
    }
    return null;
  };

  const card = (slot: Slot, label: string, rentalToggle?: React.ReactNode, rentalStub?: boolean) => {
    const parent = uma1Plan.parents[slot] ? byId.get(uma1Plan.parents[slot]!) ?? null : null;
    return (
      <ParentCardView
        label={label}
        parent={parent}
        portrait={parent ? portrait(parent) : undefined}
        rentalToggle={rentalToggle}
        rentalStub={rentalStub}
        onFindCandidates={() => setMode((m) => ({ ...m, [slot]: m[slot] === 'find' ? null : 'find' }))}
        onChange={() => setMode((m) => ({ ...m, [slot]: m[slot] === 'change' ? null : 'change' }))}
        onClear={() => select(slot, undefined)}
      >
        {slotPicker(slot)}
      </ParentCardView>
    );
  };

  const p2toggle = (
    <span className="cmp-control-group inh-p2-mode" role="group" aria-label="Parent 2 mode">
      <button type="button" className={p2rental ? '' : 'is-active'} onClick={() => setP2rental(false)}>Owned</button>
      <button type="button" className={p2rental ? 'is-active' : ''} onClick={() => setP2rental(true)}>Rental</button>
    </span>
  );

  return (
    <div className="cmp-plan-card inh-inheritance-card">
      <button type="button" className="cmp-plan-card-head cmp-collapse-head" data-open={open} onClick={() => setOpen((o) => !o)}>
        <span className="cmp-collapse-caret" aria-hidden>▶</span>
        <span>Inheritance</span>
        <span className="muted small">parents 1 &amp; 2</span>
        <span className="inh-inherit-tools" onClick={(e) => e.stopPropagation()}>
          <UploadDataButton />
        </span>
      </button>
      {open && (
        <div className="cmp-plan-card-body inh-parent-grid">
          {card('a', 'Parent 1')}
          {card('b', 'Parent 2', p2toggle, p2rental)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/features/inheritance/InheritanceCard.test.tsx`
Expected: PASS (2 tests). If the candidate button name match is ambiguous, scope the query with `within(screen.getByLabelText('candidates'))`.

- [ ] **Step 5: Commit**

```bash
git add src/features/inheritance/InheritanceCard.tsx src/features/inheritance/InheritanceCard.test.tsx
git commit -m "feat(m1): Inheritance card container — picker + candidates + persist (M1.4)"
```

---

### Task 8: Wire into the page + CSS + docs

**Files:**
- Modify: `src/features/inheritance/InheritancePage.tsx` (swap the M1.4 placeholder)
- Modify: `src/features/inheritance/inheritance.css` (append card styles)
- Modify: `src/features/inheritance/InheritancePage.test.tsx` (assert the card renders)
- Modify: `docs/modules/module-1-inheritance.md` (record M1.4 landing)

**Interfaces:**
- Consumes: `InheritanceCard` (Task 7).

- [ ] **Step 1: Write the failing test** (modify `InheritancePage.test.tsx` — add)

```tsx
it('renders the Inheritance card (M1.4) in the center column', async () => {
  // existing test setup renders <InheritancePage deps={…} /> with a plan; reuse it.
  // After render, the M1.4 placeholder is gone and the card header shows.
  expect(await screen.findByText('Inheritance')).toBeInTheDocument();
  expect(screen.queryByText('M1.4')).not.toBeInTheDocument();
});
```

> Open `InheritancePage.test.tsx` first; reuse its existing provider/plan harness (it already renders the page with a uma1 plan). If the existing tests mock `useActivePlan`, ensure the mock plan has `parents: {}` and a `sparkGoals` object so `InheritanceCard` renders. If `InheritanceCard`'s `useRoster`/`GameIcon` need stubbing in this suite, add `vi.mock('./InheritanceCard', …)` is NOT wanted — instead mock `./useRoster` and `@/features/data/GameIcon` at the top of the file, mirroring `InheritanceCard.test.tsx`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/features/inheritance/InheritancePage.test.tsx`
Expected: FAIL — placeholder still shows "M1.4"; no "Inheritance" header.

- [ ] **Step 3: Implement — swap the placeholder**

In `src/features/inheritance/InheritancePage.tsx`, add the import:

```tsx
import { InheritanceCard } from './InheritanceCard';
```

Replace the center-column line:

```tsx
<Placeholder title="Inheritance" phase="M1.4" />
```

with:

```tsx
<InheritanceCard />
```

Append to `src/features/inheritance/inheritance.css`:

```css
/* Inheritance card (M1.4) */
.inh-inheritance-card .cmp-plan-card-head { gap: 0.5rem; }
.inh-inherit-tools { margin-left: auto; display: inline-flex; align-items: center; gap: 0.4rem; }
.inh-parent-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
@media (max-width: 760px) { .inh-parent-grid { grid-template-columns: 1fr; } }
.inh-parent { border: 1px solid var(--border); border-radius: 9px; background: var(--bg-1); padding: 0.5rem 0.55rem; display: flex; flex-direction: column; gap: 0.45rem; }
.inh-parent-head { display: flex; align-items: center; gap: 0.4rem; }
.inh-parent-actions { margin-left: auto; display: inline-flex; gap: 0.3rem; }
.inh-clear { color: var(--error); }
.inh-parent-body { display: flex; flex-direction: column; gap: 0.4rem; }
.inh-parent-id { display: flex; align-items: center; gap: 0.45rem; }
.inh-parent-name { font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.inh-gp { margin-left: auto; display: inline-flex; align-items: center; gap: 0.2rem; font-size: 0.7rem; color: var(--fg-muted); }
.inh-white-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.15rem; }
.inh-white-row { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; }
.inh-white-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.inh-white-stars { margin-left: auto; }
.inh-star-own { color: #eab308; }
.inh-star-gp { color: #9aa6b6; }
.inh-rental-stub { padding: 0.3rem 0; }
.inh-upload-input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.inh-upload { position: relative; display: inline-flex; align-items: center; gap: 0.4rem; }
.inh-p2-mode { margin-left: 0.2rem; }
```

- [ ] **Step 4: Run the test + typecheck + full suite**

Run: `pnpm vitest run src/features/inheritance/InheritancePage.test.tsx`
Expected: PASS.

Run: `pnpm typecheck`
Expected: no errors.

Run: `pnpm test`
Expected: all pass (prior 852 + the new M1.4 tests; no regressions). Re-run any UI file that flakes once (see Global Constraints).

- [ ] **Step 5: Update the module doc + commit**

Add a short M1.4 entry to `docs/modules/module-1-inheritance.md` under "Next (Plans 3–5)" / a new "M1.4" subsection: note the Inheritance card (owned Parent 1 & 2 picker, Find-candidates heuristic, spark display, selection on `plan.parents`) + the UmaExtractor importer (Upload data → `parseUmaExtractor` → `bulkUpsertParents`), the deferred items (rental → M1.4b; green-spark `100xxx→9xxxxx` + saddle→G1 mapping), and the new files.

```bash
git add src/features/inheritance/InheritancePage.tsx src/features/inheritance/inheritance.css src/features/inheritance/InheritancePage.test.tsx docs/modules/module-1-inheritance.md
git commit -m "feat(m1): wire Inheritance card into the workbench + styles + docs (M1.4)"
```

---

## Self-Review notes (addressed)

- **Spec coverage:** §3.1 parser (Task 2), §3.2 decode (Task 1), §3.3 wonRaces (Task 2 — raw saddle ids, documented), §3.4 persistence + Upload UI (Tasks 3–4), §4.1 components (Tasks 6–7), §4.2 persistence to `plan.parents` (Task 7), §4.3 candidateScore (Task 5), §5 testing (each task), §6 page wiring (Task 8). Green/unique spark intentionally omitted from import (spec §3.2 open item) — documented in Task 2's docblock + module doc.
- **Type consistency:** `DecodedFactor` (Task 1) consumed by `decodeSparks` (Task 2); `ParseDeps.resolveWhiteSkill` produced in Task 2, supplied by `makeWhiteResolver` (Task 4); `topCandidates` signature identical in Tasks 5 & 7; `parents.{a,b}` slot keys consistent (Tasks 7). Pink string convention (`'sprint'` not `'short'`) bridged by `aptKeyToPinkKey` (Task 5).
- **Deferred (M1.4b / later):** Parent 2 rental builder + search-link; resolved skill *names* in the white-spark list + gold-own/gray-GP threading for grandparent sparks; green-spark id reconciliation; saddle→G1 `wonRaces` filtering.
