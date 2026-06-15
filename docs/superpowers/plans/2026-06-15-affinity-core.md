# Affinity Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the clean-room inheritance-affinity mechanic as a pure, tested `src/core/affinity.ts` + a generated `public/data/affinity.json` dataset — the core M1 needs to score parent lineages.

**Architecture:** Plan 2 of the M1 initiative. The algorithm (verified in `mechanics-notes §3` against Ice's sheet) is: `aff2(a,b)` = Σ `relation_point` over `relation_type`s containing both a and b; `aff3(a,b,c)` = same for all three; per-member scores + △/○/◎ tiers derive from those. Source = two GLOBAL `master.mdb` extracts (`relation.json` + `relation_member.json`). Three tasks: (1) build-pipeline → `public/data/affinity.json`; (2) the pure core; (3) validation. **Static affinity only** — the dynamic +3-per-shared-G1-win bonus needs race history the planner doesn't track, so it's an optional/deferred parameter (documented, P3). Clean-room from the relation tables — **NOT** ported from uma.moe's AGPL `affinity.py`.

**Tech Stack:** TypeScript strict (`bundler`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`), Vitest, tsx build scripts. Worktree: `.claude/worktrees/feat+shared-types-reconciliation`. Gate: `pnpm typecheck && pnpm test`; data build: `pnpm data:build`.

---

## Reconciliation decisions (baked in)

- **D1 — Static affinity only.** `computeLineageAffinity` returns the verified static aff2/aff3 member scores + tiers. The dynamic `sharedG1Wins`/`sharedWins` bonus (+3 per shared G1 win; race-history-dependent) is an **optional `winBonus` parameter, default 0**, surfaced as a P3 caveat ("in-game adds shared-win bonuses"). Don't fabricate race history.
- **D2 — `charaId` is the affinity key.** The relation tables key on `chara_id` (1001–1074). Our `UmaRecord.charaId` = `floor(umaId/100)` already equals it (e.g. umaId `100201` → charaId `1002`). A `charaIdOf(umaId)` helper bridges. Grandparents are **passed in** by the caller (M1 sources them from the tree later); the core is agnostic about their origin.
- **D3 — Ship the relation groups, compute on demand (memoized).** Emit `public/data/affinity.json` = the normalized `relation_type → {point, members[]}` groups (small: 943 groups). `affinity.ts` builds a `charaId → Set<relationType>` index once and memoizes `aff2`/`aff3` — fast enough for M1's many-combo search, without precomputing all 5456 triplets.
- **D4 — Validation: structural + data-locked + optional Ice parity.** Unit tests assert structural invariants (symmetry, evenness, aff3 ≤ aff2 for shared members, tier thresholds) + a few values **computed from the shipped data and locked** (the algorithm is verified-correct per `mechanics-notes §3`, so its deterministic output on real data is the regression anchor). A best-effort one-time Ice's-sheet parity script is a documented follow-up, not a unit-test gate (chara 1058+ postdate the snapshot).

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/fetch-borrowed.ts` | **Modify.** Register the two relation extracts in `BORROWED_FILES`. |
| `scripts/build-affinity.ts` | **Create.** Normalize `relation.json` + `relation_member.json` → `AffinityGroup[]`. |
| `scripts/build-all.ts` | **Modify.** Call `buildAffinity()`, write `public/data/affinity.json`. |
| `public/data/affinity.json` | **Generated, committed.** `{ server, dataVersion, groups: AffinityGroup[] }`. |
| `src/core/types.ts` | **Modify.** Add `AffinityGroup`, `AffinityTier`, `LineageAffinity` types. |
| `src/core/affinity.ts` | **Create.** Pure core: index, `aff2`, `aff3`, `computeLineageAffinity`, `affinityTier`, `charaIdOf`. |
| `src/core/affinity.test.ts` | **Create.** Structural + data-locked tests. |
| `scripts/validate-affinity.mjs` | **Create (optional).** One-time Ice's-sheet parity check (documented follow-up). |

---

## Task 1: Build pipeline → `public/data/affinity.json`

**Files:** Modify `scripts/fetch-borrowed.ts`, `scripts/build-all.ts`; Create `scripts/build-affinity.ts`; Generated `public/data/affinity.json`.

- [ ] **Step 1: Register the relation extracts as borrowed inputs**

In `scripts/fetch-borrowed.ts`, read the existing `BORROWED_FILES` array (a list of `{ from, to }`-style entries copied from the umalator-global spike). Add two entries copying the relation extracts (source: `db/extract/relation.json` and `db/extract/relation_member.json` under the umalator-global spike → `scripts/borrowed/relation.json` and `scripts/borrowed/relation_member.json`). Match the exact shape of the existing entries (read three current entries first to copy their structure).

- [ ] **Step 2: Fetch the borrowed data**

Run: `pnpm data:fetch`
Expected: `scripts/borrowed/relation.json` and `scripts/borrowed/relation_member.json` now exist. Confirm: `ls scripts/borrowed/relation*.json`.

- [ ] **Step 3: Write `scripts/build-affinity.ts`**

```ts
// Normalize the GLOBAL succession_relation extracts into affinity groups for src/core/affinity.ts.
// relation.json:        [{ relation_type, relation_point }]   (943 rows; relation_point is 2)
// relation_member.json: [{ id, relation_type, chara_id }]     (2562 rows; chara_id 1001..1074)
import type { AffinityGroup } from '@/core/types';

interface RelationRow { relation_type: number; relation_point: number }
interface RelationMemberRow { id: number; relation_type: number; chara_id: number }

export function buildAffinity(inputs: {
  relation: RelationRow[];
  relationMember: RelationMemberRow[];
  dataVersion: string;
}): { server: 'global'; dataVersion: string; groups: AffinityGroup[] } {
  const pointByType = new Map<number, number>(inputs.relation.map((r) => [r.relation_type, r.relation_point]));
  const membersByType = new Map<number, number[]>();
  for (const m of inputs.relationMember) {
    const arr = membersByType.get(m.relation_type) ?? [];
    arr.push(m.chara_id);
    membersByType.set(m.relation_type, arr);
  }
  const groups: AffinityGroup[] = [...membersByType.entries()]
    .map(([relationType, members]) => ({
      relationType,
      point: pointByType.get(relationType) ?? 0,
      members: [...new Set(members)].sort((a, b) => a - b),
    }))
    .filter((g) => g.point > 0 && g.members.length >= 2) // a group needs ≥2 members to contribute affinity
    .sort((a, b) => a.relationType - b.relationType);
  return { server: 'global', dataVersion: inputs.dataVersion, groups };
}
```

- [ ] **Step 4: Wire `buildAffinity` into `scripts/build-all.ts`**

Read `scripts/build-all.ts`. Following the existing builder pattern (e.g. how `buildSkills` is called with `readBorrowedJson(...)` then written via `writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'skills.json'), ...)`), add:
```ts
import { buildAffinity } from './build-affinity';
// ... alongside the other readBorrowedJson calls:
const relation = readBorrowedJson<{ relation_type: number; relation_point: number }[]>('relation.json');
const relationMember = readBorrowedJson<{ id: number; relation_type: number; chara_id: number }[]>('relation_member.json');
// ... alongside the other builds:
const affinity = buildAffinity({ relation, relationMember, dataVersion });
// ... alongside the other writes:
writeJsonDeterministic(join(PUBLIC_DATA_DIR, 'affinity.json'), affinity);
```
(Use the file's actual `dataVersion`/`PUBLIC_DATA_DIR`/`readBorrowedJson`/`writeJsonDeterministic` symbols — read the file to match them exactly.)

- [ ] **Step 5: Build the dataset**

Run: `pnpm data:build`
Expected: `public/data/affinity.json` written. Confirm shape:
```sh
node -e "const a=require('./public/data/affinity.json'); console.log('groups', a.groups.length, '| sample', JSON.stringify(a.groups[0])); console.log('has multi-member groups:', a.groups.some(g=>g.members.length>2))"
```
Expected: a few hundred groups, each `{ relationType, point: 2, members: [charaIds...] }`.

- [ ] **Step 6: Commit**
```bash
git add scripts/fetch-borrowed.ts scripts/build-affinity.ts scripts/build-all.ts public/data/affinity.json scripts/borrowed/relation.json scripts/borrowed/relation_member.json
git commit -m "feat(data): emit public/data/affinity.json from succession_relation extracts"
```
> If `scripts/borrowed/` is gitignored (it may be — check `git status`), drop those two paths from the `git add` (only the generated `public/data/affinity.json` + the scripts are committed). Confirm with `git status` before committing.

---

## Task 2: `src/core/affinity.ts` (pure core)

**Files:** Modify `src/core/types.ts`; Create `src/core/affinity.ts`, `src/core/affinity.test.ts`.

- [ ] **Step 1: Add types to `src/core/types.ts`**

```ts
/** A succession_relation group: the umas (by charaId) sharing one relation_type, worth `point` each. */
export interface AffinityGroup { relationType: number; point: number; members: number[] }
export type AffinityTier = '△' | '○' | '◎';
export interface LineageAffinity {
  aff2: { tA: number; tB: number; aB: number };
  aff3: { tA_gA1: number; tA_gA2: number; tB_gB1: number; tB_gB2: number };
  /** 7-term lineage total (mechanics-notes §3); informational, NOT fed into proc chances. */
  lineageTotal: number;
  /** Per-member scores that scale proc chance: chance = base × (1 + score/100). */
  memberScores: { parentA: number; parentB: number; gA1: number; gA2: number; gB1: number; gB2: number };
  tiers: { parentA: AffinityTier; parentB: AffinityTier; gA1: AffinityTier; gA2: AffinityTier; gB1: AffinityTier; gB2: AffinityTier };
  /** Sum of member scores — the in-game "displayed" affinity (static; excludes shared-win bonuses). */
  displayTotal: number;
  /** True when shared-win bonuses were omitted (P3: render ≈ / note "+ shared-win bonuses in-game"). */
  staticOnly: boolean;
}
```

- [ ] **Step 2: Write the failing test**

Create `src/core/affinity.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { buildAffinityIndex, aff2, aff3, affinityTier, charaIdOf, computeLineageAffinity } from './affinity';
import type { AffinityGroup } from './types';

// Synthetic groups: chars 1,2,3 share type 100 (point 2); chars 1,2 also share type 101 (point 2).
const GROUPS: AffinityGroup[] = [
  { relationType: 100, point: 2, members: [1, 2, 3] },
  { relationType: 101, point: 2, members: [1, 2] },
  { relationType: 102, point: 2, members: [3, 4] },
];

describe('aff2 / aff3', () => {
  const idx = buildAffinityIndex(GROUPS);
  it('aff2 sums points over shared types and is symmetric', () => {
    expect(aff2(idx, 1, 2)).toBe(4); // types 100 + 101
    expect(aff2(idx, 2, 1)).toBe(4);
    expect(aff2(idx, 1, 3)).toBe(2); // type 100 only
    expect(aff2(idx, 1, 4)).toBe(0); // none shared
  });
  it('aff3 needs all three in one type, order-independent', () => {
    expect(aff3(idx, 1, 2, 3)).toBe(2); // only type 100 has all three
    expect(aff3(idx, 3, 2, 1)).toBe(2);
    expect(aff3(idx, 1, 2, 4)).toBe(0);
  });
});

describe('affinityTier', () => {
  it('△ 0–50 / ○ 51–150 / ◎ 151+', () => {
    expect(affinityTier(0)).toBe('△');
    expect(affinityTier(50)).toBe('△');
    expect(affinityTier(51)).toBe('○');
    expect(affinityTier(150)).toBe('○');
    expect(affinityTier(151)).toBe('◎');
  });
});

describe('charaIdOf', () => {
  it('maps umaId → 4-digit charaId', () => {
    expect(charaIdOf('100201')).toBe(1002);
    expect(charaIdOf('100101')).toBe(1001);
  });
});

describe('computeLineageAffinity', () => {
  const idx = buildAffinityIndex(GROUPS);
  it('computes member scores from the formula; grandparents optional', () => {
    // trainee=1, parentA=2, parentB=3, no grandparents.
    const r = computeLineageAffinity(idx, { trainee: 1, parentA: 2, parentB: 3 });
    expect(r.aff2.tA).toBe(4);  // aff2(1,2)
    expect(r.aff2.tB).toBe(2);  // aff2(1,3)
    expect(r.aff2.aB).toBe(2);  // aff2(2,3) (type 100)
    // parentA score = aff2(T,A) + aff2(A,B) + aff3 terms (0, no grandparents) = 4 + 2 = 6
    expect(r.memberScores.parentA).toBe(6);
    expect(r.memberScores.parentB).toBe(4); // aff2(T,B)=2 + aff2(A,B)=2
    expect(r.tiers.parentA).toBe('△');
    expect(r.staticOnly).toBe(true);
    expect(r.displayTotal).toBe(r.memberScores.parentA + r.memberScores.parentB); // grandparents 0
  });
  it('includes grandparent aff3 terms when provided', () => {
    const r = computeLineageAffinity(idx, { trainee: 1, parentA: 2, parentB: 3, gA1: 3 });
    // aff3(T=1, A=2, gA1=3) = 2 (type 100) → added to parentA and to gA1 score
    expect(r.aff3.tA_gA1).toBe(2);
    expect(r.memberScores.gA1).toBe(2);
    expect(r.memberScores.parentA).toBe(8); // 6 + 2
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm vitest run src/core/affinity.test.ts`
Expected: FAIL — `Cannot find module './affinity'`.

- [ ] **Step 4: Implement `src/core/affinity.ts`**

```ts
import type { AffinityGroup, AffinityTier, LineageAffinity } from './types';

export interface AffinityIndex {
  /** charaId → Map(relationType → point) for every group the chara belongs to. */
  byChara: Map<number, Map<number, number>>;
  aff2Cache: Map<string, number>;
  aff3Cache: Map<string, number>;
}

export function buildAffinityIndex(groups: AffinityGroup[]): AffinityIndex {
  const byChara = new Map<number, Map<number, number>>();
  for (const g of groups) {
    for (const c of g.members) {
      let m = byChara.get(c);
      if (!m) { m = new Map(); byChara.set(c, m); }
      m.set(g.relationType, g.point);
    }
  }
  return { byChara, aff2Cache: new Map(), aff3Cache: new Map() };
}

/** Σ point over relation_types containing BOTH a and b. Symmetric, memoized. */
export function aff2(idx: AffinityIndex, a: number, b: number): number {
  const key = a < b ? `${a}_${b}` : `${b}_${a}`;
  const hit = idx.aff2Cache.get(key);
  if (hit !== undefined) return hit;
  const ma = idx.byChara.get(a);
  const mb = idx.byChara.get(b);
  let sum = 0;
  if (ma && mb) {
    const [small, big] = ma.size <= mb.size ? [ma, mb] : [mb, ma];
    for (const [type, point] of small) if (big.has(type)) sum += point;
  }
  idx.aff2Cache.set(key, sum);
  return sum;
}

/** Σ point over relation_types containing ALL THREE. Order-independent, memoized. */
export function aff3(idx: AffinityIndex, a: number, b: number, c: number): number {
  const sorted = [a, b, c].sort((x, y) => x - y);
  const key = `${sorted[0]}_${sorted[1]}_${sorted[2]}`;
  const hit = idx.aff3Cache.get(key);
  if (hit !== undefined) return hit;
  const ma = idx.byChara.get(a);
  const mb = idx.byChara.get(b);
  const mc = idx.byChara.get(c);
  let sum = 0;
  if (ma && mb && mc) {
    for (const [type, point] of ma) if (mb.has(type) && mc.has(type)) sum += point;
  }
  idx.aff3Cache.set(key, sum);
  return sum;
}

export function affinityTier(score: number): AffinityTier {
  if (score >= 151) return '◎';
  if (score >= 51) return '○';
  return '△';
}

/** umaId (card_data id, e.g. "100201") → 4-digit charaId (1002). */
export function charaIdOf(umaId: string): number {
  return Math.floor(Number(umaId) / 100);
}

export interface Lineage {
  trainee: number; parentA: number; parentB: number;
  gA1?: number; gA2?: number; gB1?: number; gB2?: number;
  /** Optional shared-win bonus points (dynamic, race-history; default 0 = static). */
  winBonus?: { parentA?: number; parentB?: number; gA1?: number; gA2?: number; gB1?: number; gB2?: number };
}

/** Lineage affinity per mechanics-notes §3. Static (aff2/aff3) unless `winBonus` is supplied. */
export function computeLineageAffinity(idx: AffinityIndex, lin: Lineage): LineageAffinity {
  const { trainee: T, parentA: A, parentB: B, gA1, gA2, gB1, gB2 } = lin;
  const a2 = { tA: aff2(idx, T, A), tB: aff2(idx, T, B), aB: aff2(idx, A, B) };
  const a3 = {
    tA_gA1: gA1 === undefined ? 0 : aff3(idx, T, A, gA1),
    tA_gA2: gA2 === undefined ? 0 : aff3(idx, T, A, gA2),
    tB_gB1: gB1 === undefined ? 0 : aff3(idx, T, B, gB1),
    tB_gB2: gB2 === undefined ? 0 : aff3(idx, T, B, gB2),
  };
  const w = lin.winBonus ?? {};
  const scores = {
    parentA: a2.tA + a2.aB + a3.tA_gA1 + a3.tA_gA2 + (w.parentA ?? 0),
    parentB: a2.tB + a2.aB + a3.tB_gB1 + a3.tB_gB2 + (w.parentB ?? 0),
    gA1: a3.tA_gA1 + (w.gA1 ?? 0),
    gA2: a3.tA_gA2 + (w.gA2 ?? 0),
    gB1: a3.tB_gB1 + (w.gB1 ?? 0),
    gB2: a3.tB_gB2 + (w.gB2 ?? 0),
  };
  const lineageTotal = a2.tA + a2.tB + a2.aB + a3.tA_gA1 + a3.tA_gA2 + a3.tB_gB1 + a3.tB_gB2;
  return {
    aff2: a2, aff3: a3, lineageTotal,
    memberScores: scores,
    tiers: {
      parentA: affinityTier(scores.parentA), parentB: affinityTier(scores.parentB),
      gA1: affinityTier(scores.gA1), gA2: affinityTier(scores.gA2),
      gB1: affinityTier(scores.gB1), gB2: affinityTier(scores.gB2),
    },
    displayTotal: scores.parentA + scores.parentB + scores.gA1 + scores.gA2 + scores.gB1 + scores.gB2,
    staticOnly: lin.winBonus === undefined,
  };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm vitest run src/core/affinity.test.ts`
Expected: PASS (all cases). Then `pnpm typecheck` clean.

- [ ] **Step 6: Commit**
```bash
git add src/core/types.ts src/core/affinity.ts src/core/affinity.test.ts
git commit -m "feat(core): clean-room inheritance affinity (aff2/aff3, member scores, tiers)"
```

---

## Task 3: Validation against real data

**Files:** Modify `src/core/affinity.test.ts` (data-locked cases).

- [ ] **Step 1: Compute real reference values from the shipped dataset**

Run this to compute a few real aff2/aff3 values from `public/data/affinity.json` (pick chara pairs that actually share groups):
```sh
node -e "
const a=require('./public/data/affinity.json');
const byChara=new Map();
for(const g of a.groups){for(const c of g.members){(byChara.get(c)||byChara.set(c,new Map()).get(c)).set(g.relationType,g.point);}}
const aff2=(x,y)=>{let s=0;const mx=byChara.get(x),my=byChara.get(y);if(mx&&my)for(const[t,p]of mx)if(my.has(t))s+=p;return s;};
// pick the first two charas that share ≥1 group:
const chs=[...byChara.keys()].sort((p,q)=>p-q);
for(let i=0;i<chs.length;i++)for(let j=i+1;j<chs.length;j++){const v=aff2(chs[i],chs[j]);if(v>0){console.log('aff2('+chs[i]+','+chs[j]+') =',v);if(--globalThis.n<=0)process.exit(0);}}
" n=5 2>/dev/null || node -e "
const a=require('./public/data/affinity.json');
const byChara=new Map();
for(const g of a.groups){for(const c of g.members){let m=byChara.get(c);if(!m){m=new Map();byChara.set(c,m);}m.set(g.relationType,g.point);}}
const aff2=(x,y)=>{let s=0;const mx=byChara.get(x),my=byChara.get(y);if(mx&&my)for(const[t,p]of mx)if(my.has(t))s+=p;return s;};
const chs=[...byChara.keys()].sort((p,q)=>p-q); let printed=0;
outer: for(let i=0;i<chs.length;i++)for(let j=i+1;j<chs.length;j++){const v=aff2(chs[i],chs[j]);if(v>0){console.log('aff2('+chs[i]+','+chs[j]+') =',v);if(++printed>=5)break outer;}}
"
```
**Record 3–5 of the printed `aff2(x,y) = v` lines.**

- [ ] **Step 2: Add data-locked regression tests**

Append to `src/core/affinity.test.ts` a block that loads the real dataset and asserts the recorded values (the algorithm is verified-correct per `mechanics-notes §3`, so these lock the implementation against the shipped data):
```ts
import affinityData from '../../public/data/affinity.json';
import type { AffinityGroup } from './types';

describe('affinity on the shipped GLOBAL dataset', () => {
  const idx = buildAffinityIndex((affinityData as { groups: AffinityGroup[] }).groups);
  it('reproduces known aff2 values from the dataset', () => {
    // PASTE the recorded values from Step 1, e.g.:
    // expect(aff2(idx, 1001, 1015)).toBe(<recorded>);
  });
  it('aff2 is symmetric and even (all relation_points are 2)', () => {
    expect(aff2(idx, 1001, 1015)).toBe(aff2(idx, 1015, 1001));
    expect(aff2(idx, 1001, 1015) % 2).toBe(0);
  });
  it('aff3 ≤ aff2 for the same pair-plus-third (stricter constraint)', () => {
    // a triple can never share more types than any of its pairs
    expect(aff3(idx, 1001, 1015, 1002)).toBeLessThanOrEqual(aff2(idx, 1001, 1015));
  });
});
```
> Confirm the JSON import works under the project's `resolveJsonModule` (it's on). If a `// @vitest-environment node` directive is needed for the import, add it; otherwise jsdom default is fine for a pure import. Replace the placeholder charaIds (1001/1015/1002) with ones that actually share groups (from Step 1's output) so the assertions are meaningful and non-zero.

- [ ] **Step 3: Run + full gate**

Run: `pnpm vitest run src/core/affinity.test.ts && pnpm typecheck && pnpm test`
Expected: all green; total test count = prior + the new affinity tests.

- [ ] **Step 4: Commit**
```bash
git add src/core/affinity.test.ts
git commit -m "test(core): data-locked affinity regression on the shipped GLOBAL dataset"
```

- [ ] **Step 5: (Optional, documented follow-up) Ice's-sheet full parity**

Note in the commit message body or a `// TODO` that full parity vs Ice's `_affinity` tab (`spikes/web/ice-sheet/xl/worksheets/sheet10.xml`, 528 pairs + 5456 triplets, excl. chara 1058+) is a deeper one-time confidence check — `mechanics-notes §3` already records that the algorithm reproduces it exactly. A `scripts/validate-affinity.mjs` parser is a future enhancement, not required for this plan's gate.

---

## Self-Review

**1. Spec coverage (`mechanics-notes §3` + shared-data-model §5 affinity):** aff2/aff3 (§3 l.53-54) → Task 2. Member-score decomposition + `chance = base×(1+score/100)` consumer-side (§3 l.48,50) → `memberScores` returned for the caller to apply. Tiers △/○/◎ (§3 l.56) → `affinityTier`. No flat grandparent ×0.5 (§4 l.62) → grandparent scores are just their aff3 terms (emergent smallness). Clean-room (no AGPL port) → derived from relation tables. Dataset pipeline → Task 1.

**2. Placeholder scan:** Task 3 Step 2 has `// PASTE the recorded values` — that's an explicit execution-time fill from Step 1's output (real data), not a TODO left in shipped code. The optional Ice parity (Step 5) is a documented deferral (D4).

**3. Type consistency:** `AffinityGroup`/`AffinityTier`/`LineageAffinity` defined in Task 2 Step 1, consumed by `build-affinity.ts` (Task 1) + `affinity.ts` (Task 2) identically. `aff2`/`aff3`/`buildAffinityIndex`/`computeLineageAffinity`/`affinityTier`/`charaIdOf` signatures match between `affinity.ts` and the tests.

**Deferred (documented):** dynamic shared-win bonus (D1; optional param), full Ice's-sheet parity script (D4/Step 5), chara 1058+ (postdate the verification snapshot). The affinity **consumer** (scaling spark proc chances by member score) lands in the M1 plans, where the lineage tree supplies grandparents.

---

## Execution Handoff

Plan saved to `docs/superpowers/plans/2026-06-15-affinity-core.md`. Two options:
1. **Subagent-Driven (recommended)** — fresh subagent per task, review between.
2. **Inline Execution** — here with checkpoints.

Which approach?
