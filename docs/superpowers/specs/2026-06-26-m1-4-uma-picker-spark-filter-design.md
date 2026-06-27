# M1.4 — Uma Picker Modal (spark-filter parent finder)

**Date:** 2026-06-26
**Module:** M1 Inheritance · extends the M1.4 Inheritance card
**Status:** design locked
**Branch:** `feat/m1-4-inheritance-card`
**Builds on:** the landed M1.4 Inheritance card (`InheritanceCard`, `ParentCardView`, `useRoster`, `umaExtractor`) and M1.0 affinity core (`affinity.ts`, `winBonus.ts`, `lineageAffinity.ts`).

## 1. Overview

The parent slot's **Pick / Change** button opens a full-screen modal that replaces the inline
`SearchPicker`. The modal is a **spark-filter search-builder over the imported roster**: the player
stacks AND-ed criteria (blue/pink/white/any-blue), and a live grid of **rich uma tiles** shows the
matches, each tile displaying the relevant spark **totals** plus a computed **affinity score**.
Picking a tile fills that slot (`plan.parents.{a,b}`) and closes the modal.

This is the heart of M1 parent-hunting (the handoff's "residual spark-goal search-builder"),
surfaced as the picker. `Find candidates` (inline scored top-5) and `Clear` are unchanged for now.

## 2. Spark model (confirmed)

For a roster **veteran** (a `Parent`), its inheritance contribution spans **three members**: the
veteran itself + its **two grandparents** (`Parent.grandparents = [ParentRef?, ParentRef?]`, the
child's would-be grandparents, from succession positions 10/20).

- **legacy** = the veteran's OWN factor stars (`Parent.blueSpark` / `pinkSpark` / its own
  `whiteSparks`).
- **total** = the sum of that factor's stars across the veteran **+ both grandparents** (the
  combined factor stars the game shows; max 9 for a single stat/apt).

Each veteran/grandparent has exactly **one** blue factor and **one** pink factor; white sparks are
arrays. Different members may carry different stats/apts, so totals are per-key sums.

## 3. Pure core (no UI, fully unit-tested)

### 3.1 `src/features/inheritance/sparkAggregate.ts`

```ts
export interface SparkAgg {
  blueTotals: Partial<Record<Stat, number>>;   // sum of stars per stat across veteran+GPs
  blueLegacy: { stat: Stat; stars: number };    // the veteran's own blue
  maxBlueTotal: number;                          // max over blueTotals (for any-blue)
  pinkTotals: Record<string, number>;            // sum per aptitude key (pinkSpark.aptitude strings)
  pinkLegacy: { aptitude: string; stars: number };
  whites: Map<string, { total: number; legacy: number }>; // skillId → summed/own stars
}
export function aggregate(veteran: Parent): SparkAgg;
```

Members = `[veteran, ...(veteran.grandparents ?? [])]` filtered to defined. For blue: add
`m.blueSpark.stars` to `blueTotals[m.blueSpark.stat]` (the veteran's own → `blueLegacy`; a
grandparent's `blueSpark` is optional — skip if absent). Pink analogous (`pinkTotals` keyed by the
`aptitude` string — `'sprint'`/`'medium'`/etc.). White: for each white spark on any member, add its
stars to `whites[skillId].total`; the veteran's own → `whites[skillId].legacy`. `maxBlueTotal` =
`Math.max(0, ...Object.values(blueTotals))`.

### 3.2 `src/features/inheritance/sparkFilter.ts`

```ts
export type SparkFilter =
  | { id: string; kind: 'blue';   stat: Stat;       legacyMin: number; totalMin: number }
  | { id: string; kind: 'pink';   aptitude: string; legacyMin: number; totalMin: number }
  | { id: string; kind: 'white';  skillId: string;  legacyMin: number; totalMin: number } // one row per skill
  | { id: string; kind: 'anyBlue'; totalMin: number };                  // maxBlueTotal ≥ totalMin

export function clauseMatches(agg: SparkAgg, f: SparkFilter): boolean;
export function matchesFilters(agg: SparkAgg, filters: SparkFilter[]): boolean; // every clause (AND)
```

Clause semantics — every threshold is a `>=` (choosing `2` means "2 or higher"); `0` = no
constraint. **legacy** is always the veteran's OWN spark only (max 3★); **total** sums across the
veteran + its two grandparents (max 9★). Blue, pink, and white are symmetric:
- **blue**: `(blueTotals[stat] ?? 0) >= totalMin` AND `(blueLegacy.stat===stat ? blueLegacy.stars : 0) >= legacyMin`.
- **pink**: `(pinkTotals[aptitude] ?? 0) >= totalMin` AND `(pinkLegacy.aptitude===aptitude ? pinkLegacy.stars : 0) >= legacyMin`.
- **white**: `(whites.get(skillId)?.total ?? 0) >= totalMin` AND `(whites.get(skillId)?.legacy ?? 0) >= legacyMin`.
  A new white row defaults `totalMin` to **1** in the UI (so picking a skill means "has it" until you
  raise the star) and `legacyMin` to 0.
- **anyBlue**: `maxBlueTotal >= totalMin`.

`matchesFilters` = `filters.every((f) => clauseMatches(agg, f))`. Empty filters ⇒ all pass.

The three worked examples (must be test cases):
1. `[{blue, stat:'pow', legacyMin:3, totalMin:8}]`
2. `[{white, groundworkId, legacyMin:0, totalMin:1}, {white, cornerAdeptId, legacyMin:0, totalMin:1}, {anyBlue, totalMin:8}]`
3. `[{pink, aptitude:'medium', legacyMin:3, totalMin:6}, {anyBlue, totalMin:8}]`

### 3.3 `src/features/inheritance/candidateAffinity.ts`

```ts
export function candidateAffinity(args: {
  idx: AffinityIndex;
  traineeUmaId: string;          // plan.umaId
  candidate: Parent;             // the veteran being scored (parentA side)
  other?: Parent;               // the parent already chosen in the OTHER slot, if any (parentB side)
}): number;
```

Compute the candidate-branch affinity (= `computeLineageAffinity`'s `memberScores.parentA`,
pair-independent except for the cross term):

```
T  = charaIdOf(traineeUmaId); A = charaIdOf(candidate.umaId)
gA1/gA2 = charaIdOf of candidate.grandparents[0/1] (undefined-safe)
base = aff2(idx,T,A) + (gA1!==undefined? aff3(idx,T,A,gA1):0) + (gA2!==undefined? aff3(idx,T,A,gA2):0)
if (other) base += aff2(idx, A, charaIdOf(other.umaId))         // cross term, only when paired
win  = computeWinBonus({ parentA:{wonRaces:candidate.wonRaces}, gA1:{wonRaces:candidate.grandparents?.[0]?.wonRaces}, gA2:{wonRaces:candidate.grandparents?.[1]?.wonRaces},
                         parentB:{wonRaces:other?.wonRaces}, gB1:{wonRaces:other?.grandparents?.[0]?.wonRaces}, gB2:{wonRaces:other?.grandparents?.[1]?.wonRaces} }).parentA
return base + win
```

Win bonus is the **graded (G1) wins** contribution (M1.0 `computeWinBonus`: +3 per shared G1).
Pure; uses only `aff2`/`aff3`/`charaIdOf`/`computeWinBonus`. Display-only — not a filter.

### 3.4 `src/features/inheritance/useAffinityIndex.ts`

```ts
export function useAffinityIndex(): AffinityIndex | null; // null while loading
```

Lazy-loads `public/data/affinity.json` once (`fetch(`${BASE_URL}data/affinity.json`)` → its
`groups` → `buildAffinityIndex`), memoised at module scope. `affinity.json` already ships (built by
the affinity-core pipeline) but no runtime loader existed; this adds it. Failure ⇒ `null` (tiles
show affinity as "—", never crash).

## 4. UI

### 4.1 `src/features/inheritance/UmaPickerModal.tsx` (presentational, portal)

Rendered through `createPortal(…, document.body)` so it escapes the card's `overflow:hidden`.
Returns `null` when `!open`.

- **Backdrop:** `.inh-uma-modal-backdrop` — `position:fixed; inset:0; z-index:60`,
  `background:rgba(0,0,0,0.55)`, flex-centered. Click on the backdrop (not the window) → `onClose`.
  `Escape` key → `onClose` (document keydown while open). The window stops click propagation.
- **Window:** `.inh-uma-modal` — card shell (`cmp-plan-card` grammar), `width:min(820px,94vw)`,
  `max-height:85vh`, column flex. **Header:** title "Pick a parent" + a muted match count
  (`{n} match`) + ✕ close. **Filter bar:** an **"+ Add filter"** menu (Blue · Pink · White skill ·
  Any-blue) that appends a `SparkFilter` row; each row renders its own inputs + a remove ✕:
  - blue: stat `<select>` (spd/sta/pow/gut/wit) + "legacy ≥" number + "total ≥" number
  - pink: aptitude `<select>` (turf/dirt/sprint/mile/medium/long/front/pace/late/end) + legacy/total
  - white: a skill search/select (white-rarity skills, by name → skillId) + "legacy ≥" + "total ≥"
    (new row defaults total to 1; legacy/total are ≥ star thresholds, legacy capped at 3, total at 9)
  - anyBlue: "total ≥" number
  - **Body:** scrollable `.inh-uma-grid` of tiles.
- **Tile** (`.inh-uma-tile`, a `<button>`): `GameIcon` portrait + name (+ rating), a spark summary
  row (blue chip `STAT total★·Lleg`, pink chip, and white-skill name chips for the matched skills),
  and a prominent **Affinity** badge (`.inh-uma-aff`). Click → `onPick(parentId)`.

Props (provider-free; container resolves names/portraits/affinity/aggregates):
```ts
interface UmaPickerItem {
  id: string; name: string; rating?: string; portrait: ReactNode;
  agg: SparkAgg; affinity: number | null;
}
interface UmaPickerModalProps {
  open: boolean;
  items: UmaPickerItem[];            // already aggregated; the modal owns filters + sort
  skillName: (skillId: string) => string;     // for white chips + the white-filter picker
  whiteSkillOptions: Array<{ id: string; name: string }>; // white-rarity skills for the picker
  onPick: (id: string) => void;
  onClose: () => void;
}
```
The modal owns the `filters` state and applies `matchesFilters(item.agg, filters)`. **Default
ordering:** affinity desc (nulls last), then name — a neutral default; the ranking algorithm is the
deferred follow-up (kept as a single comparator so it can be swapped).

### 4.2 Wiring — `InheritanceCard`

- `mode[slot] === 'change'` → render `<UmaPickerModal open … />` instead of the inline picker.
- Build `items` from `pool` (roster `source:'mine'`): `agg = aggregate(p)`,
  `affinity = idx ? candidateAffinity({idx, traineeUmaId: uma1Plan.umaId, candidate: p, other}) : null`
  where `other` = the parent in the opposite slot (`byId.get(uma1Plan.parents[otherSlot])`).
- `whiteSkillOptions` = `useGameData().skills` filtered to `rarity==='white'` → `{id,name}`;
  `skillName` from `skillById`.
- `onPick` → `select(slot, id)` (existing) + clear `mode`. `Find candidates`/`Clear` unchanged.
- `useAffinityIndex()` called in the card.

### 4.3 CSS (`inheritance.css`)

New: `.inh-uma-modal-backdrop`, `.inh-uma-modal`, `.inh-uma-filterbar`, `.inh-uma-filter-row`,
`.inh-uma-grid` (`grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))`), `.inh-uma-tile`,
`.inh-uma-aff`. Reuse `cmp-plan-card`, `spark-chips`, `badge spark-blue/spark-pink`, `cmp-small-btn`.

## 5. Testing

- **`sparkAggregate.test.ts`** — totals summed across veteran + 2 GPs (different stats/apts),
  legacy = veteran's own, white sums + legacy, `maxBlueTotal`, no-grandparents veteran.
- **`sparkFilter.test.ts`** — each clause boundary (≥), AND of multiple clauses, the **three
  worked examples**, empty filters pass-all, white presence ⇒ ≥1.
- **`candidateAffinity.test.ts`** — base aff2/aff3 sum; cross term added only when `other` set;
  win-bonus added from `wonRaces`; unknown chara ⇒ 0 (no crash); a synthetic `AffinityIndex`.
- **`UmaPickerModal.test.tsx`** — closed → renders nothing; open → lists items; adding a blue
  filter narrows the grid; tile click → `onPick`; Esc + backdrop click → `onClose`; window click
  does not close. (`afterEach(cleanup)`; portal works in jsdom.)
- **`InheritanceCard.test.tsx`** (extend) — Pick opens the modal; selecting a tile persists to
  `plan.parents` + closes. Mock `useAffinityIndex`/`useGameData` as needed.

## 6. Deferred (the "algorithm later" discussion)

- Default **ranking/sort** beyond affinity-desc (match-count weighting, best-pair suggestion).
- Whether/how `Find candidates` folds into this modal.
- Affinity precision when both slots interact (currently candidate-branch + cross term; full-pair
  refinement if needed).

## 7. Non-goals / unchanged

Rental mode (M1.4b), the importer, `ParentCardView`'s in-slot display, `Find candidates`, and
`Clear` are untouched. No Dexie schema change. The roster pool stays `source:'mine'`.
