# M1.4b — Parent-2 rental builder + search-link (design)

> **Date:** 2026-07-06 · **Module:** M1 Inheritance workbench · **Status:** design (pre-plan)
> **Depends on:** M1.4 (Inheritance card + picker + spark filter), M1.7 (coverage matrix), M1.8 (`buildTargetSpark`).
> **Consumes contract:** M1.8 `buildTargetSpark` → the draft seed. **Closes:** the last deferred M1.4 item (Parent-2 rental builder + search-link).

## 1. Context & goal

The Parent-2 slot of the M1.4 Inheritance card currently supports only an **owned** roster parent (from the UmaExtractor `data.json` import); flipping its "Rental" toggle shows a "coming in M1.4b" stub. This spec builds that flow.

The real workflow M1.4b serves: **you rarely own two great parents, so Parent 2 is usually a rental you borrow from a friend/stranger.** The feature lets you (a) draft *what sparks to search for*, (b) generate deep-links to the community rental-search sites pre-filled with that draft, and (c) once borrowed, record the real rental so it feeds the plan's affinity + coverage exactly like an owned parent.

## 2. The 3-mode Parent-2 slot

Parent 2 becomes a **3-mode slot** (mode persisted on the plan). A segmented selector (`Owned · Draft · Rental`) replaces today's binary Rental toggle.

| Mode | What it is | Feeds affinity/coverage as… |
|---|---|---|
| **Owned** | Your `data.json` roster parent (today's behavior — unchanged) | the roster `Parent`, real computed affinity |
| **Draft** | A **spark search-spec** (`SparkFilter[]`, reusing the M1.4 picker's filter) + a **forced affinity tier** (◎ default / ○ / △). No stats, no G1 wins — just "what to search for." Drives the **search-links** and gives a *trial* picture. | a synthetic parent from the filter clauses, spark inherit-% priced at the **forced tier** — a labelled hypothetical (P3) |
| **Rental** | The real borrowed rental — **full veteran shape** (`Parent`: parent + optional 2 grandparents + sparks + optional stats/wins), manual entry | a real `Parent`, real computed affinity |

The draft is a *forced-tier search spec*, deliberately **not** a real parent: it exists to picture what to hunt for and to build the search-links, before you own anything.

## 3. Data model (additive — all optional, no Dexie version bump)

`src/core/types.ts`:

```ts
export type ForcedTier = 'double' | 'single' | 'triangle';   // ◎ / ○ / △

export interface RentalDraft {
  filters: SparkFilter[];    // the SAME union the M1.4 picker uses (sparkFilter.ts)
  forcedTier: ForcedTier;    // forced inheritance-affinity tier for the draft
}

export interface CmPlan {
  // …existing…
  parents: { a?: string; b?: string };      // b = owned roster id (mode 'owned') — UNCHANGED
  parent2Mode?: 'owned' | 'draft' | 'rental';  // default 'owned' when absent
  rentalDraft?: RentalDraft;                 // mode 'draft'
  rentalRecorded?: Parent;                   // mode 'rental' (source: 'friend_rental')
}
```

- `parents.b` is untouched — full backward compatibility (an old plan reads as `parent2Mode` absent ⇒ `'owned'`).
- The three mode-fields are independent and all persist, so you can draft → search → borrow → record without losing the draft.
- `Parent.source` gains `'friend_rental'` usage (already in the type union); `rentalRecorded` is a plain `Parent`, so every Parent-2 consumer treats it identically once resolved.
- `exportImport.ts` gains parse/validation for `parent2Mode` / `rentalDraft` / `rentalRecorded` (round-trip tested).

## 4. Draft mode

### 4.1 Spec editor = reuse `SparkFilterCards`

The draft's spark editor **is** the M1.4 picker's "Star Tracks" filter (`SparkFilterCards`), backed by the draft's `filters: SparkFilter[]`. `SparkFilter` (`sparkFilter.ts`) is already the right shape: a discriminated union over `blue | pink | white | green | anyBlue`, each carrying `legacyMin` (the parent's own stars) + `totalMin` (summed across the lineage).

- **Extract a shared hook** `useSparkFilterState(filters, setFilters)` from the ~100 lines of derived glue currently inline in `UmaPickerModal` (`setSpark` / `sparkValue` / `sparkMaxTotal` / `bpLegacyLocked` / `membersUsed` / green+white clause state). Both the picker and the draft panel consume it → one implementation, no duplication. This is a refactor-in-place of the picker (behavior identical, tests unchanged).
- **"Load from Target spark"** button → `seedFromTargetSpark(targetSpark): SparkFilter[]` builds `blue`/`pink`/`white` clauses from M1.8's `buildTargetSpark`; green is left for manual add (uniques are rarely a residual of the wishlist).

### 4.2 Forced tier → spark pricing

The draft has no computed affinity, so `forcedTier` maps to a representative affinity score via `forcedTierScore(tier)` (documented **P3 estimate**, initial values `triangle ≈ 25 · single ≈ 100 · double ≈ 175`, aligned to the `△0–50 / ○51–150 / ◎151+` tier bands — mechanics-notes §3). This score is fed to the draft's synthetic parent through `spark.ts`'s **existing** `memberAffinity` hook, so the draft's green/white inherit-% reflects "if I get this rental at ◎."

The header affinity mark in draft mode shows the **forced tier**, not a fabricated combined number.

**Multi-clause drafts are an intentional superset.** A draft spec may list several green/white clauses (many sparks worth searching for), whereas a single real rental holds one green + a few whites. The synthetic parent carries *all* draft clauses, so its coverage is a "would be covered if a rental with these sparks is found" **hypothetical** — deliberately optimistic, and always rendered under the draft's hypothetical label (never as measured coverage). This is the correct behavior for a search-planning tool; the real numbers land when Rental mode records the actual borrowed parent.

### 4.3 Search-links

`src/core/rentalSearch.ts` (pure, tested): `SparkFilter[]` → per-site URL, mapping each clause's `legacyMin`/`totalMin` onto the sites' `leg_`/`tot_` buckets, plus the trainee card id (for site-side affinity) and Parent 1's card id as partner where supported.

- `umaMoeUrl(filters, traineeCardId, partnerCardId?)` — `…/database?filters=<b64(json)>` compact `{b,p,g,w?,lb}` triplets `[factorId, minStars, maxStars]` (provenance §6).
- `pureDbUrl(...)` — `…/{locale}/search?searchInfo=<b64(json)>`, `{blue/red/greenFactors:[{groupId,count,searchType,enabled}], partnerCardIds, …}`.
- `chronoGenesisUrl(...)` — `…/friend_search?query=<enc(b64(urlencoded querystring))>`, `leg_/sla_/slb_/tot_` buckets + `blue_count/g1_count/card_id`.
- **Factor encoding** is the inverse of `factorDecode.ts`; the exact **white/green site-key format** is confirmed during the plan against uma.moe's open-source serialization (provenance §6 already verified real deep-links round-trip). `anyBlue` is encoded where a site expresses it (ChronoGenesis `blue_count`) and **skipped with a UI note** where it can't be — never silently dropped (P3).
- Buttons open in a new tab (`target=_blank rel=noreferrer`).

### 4.4 Honesty banner (P3)

Draft panel carries: *"A matching record isn't a guaranteed borrowable rental — follow-then-borrow (3/day), DB lag, private/slot-full profiles. This scores fit, not availability."* (per the original M1 spec).

## 5. Rental mode (real rental)

`RentalParentEditor` — a manual editor producing a full **veteran-shape `Parent`** (same structure as an owned roster parent, so it drops straight into affinity/coverage):

- Pick the parent **uma** (uma picker) + its 4-color sparks (blue/pink/green/white via the same pickers).
- Optional **2 grandparents**, each uma + sparks (absent ⇒ safe under-count of affinity/coverage).
- **stats/rating/wonRaces optional** — you often don't know a rental's full stats; absent fields simply don't contribute (win-bonus stays 0 for that rental, the safe direction).
- Seeded softly from the draft filters (pre-check the sparks you searched for) when promoting Draft → Rental.
- Once recorded, renders as a normal `ParentCardView` with **real computed affinity** + edit/clear.

**UmaExtractor extraction (investigated per user request):** UmaExtractor scans the **Veteran List** screen (your own trained umas) — it cannot read a friend's parent you're *considering* on the inheritance/friend-select screen (different screen; and it is an upstream tool we don't control). Rentals you *already borrowed* surface only as succession-tree nodes inside your own veterans. ⇒ **real-rental = manual entry in v1.** Friend-list extraction is a documented upstream wishlist item, not built here. (Re-verify UmaExtractor's target screens during the plan before finalizing this note.)

## 6. Resolver + consumer wiring

`src/core/resolveParent2.ts` (pure): `resolveParent2(plan, rosterById)` → discriminated
`{ kind:'owned', parent } | { kind:'draft', synthetic, forcedScore } | { kind:'rental', parent } | { kind:'none' }`.
It uses `draftToSyntheticParent(draft)` (from `rentalDraft.ts`) to synthesize a `Parent`-like from the draft's filter clauses.

Route every Parent-2 consumer through it:
- `InheritancePage` — the `planLineageAffinity(...)` Parent-2 arg + the coverage-matrix Parent-2 member.
- `InheritanceCard` — `selectionAffinity` (header mark) + the Parent-2 card render (mode selector + Owned/Draft/Rental branches).
- The **same-character guard** applies to owned/rental (they have a uma); draft has none → guard skipped.
- `buildTargetSpark` (M1.8) is **unchanged** — it reacts automatically as coverage recomputes with the draft/rental as Parent 2.

## 7. Files

**New (core, pure, TDD):** `src/core/rentalSearch.ts` (site URL builders; +test), `src/core/rentalDraft.ts` (`seedFromTargetSpark`, `forcedTierScore`, `draftToSyntheticParent`; +test), `src/core/resolveParent2.ts` (+test). *(No `RentalSpec` type — the draft spec is `SparkFilter[]`.)*
**New (UI):** `src/features/inheritance/RentalDraftPanel.tsx`, `RentalParentEditor.tsx`, `useSparkFilterState.ts` (extracted hook), CSS in `parents.css`.
**Changed:** `src/core/types.ts` (fields), `src/db/exportImport.ts` (+test), `src/features/inheritance/UmaPickerModal.tsx` (adopt the extracted hook — no behavior change), `InheritanceCard.tsx` (3-mode slot), `InheritancePage.tsx` (resolver wiring).

## 8. Testing

- **Core:** `rentalSearch` URL encoding per site vs provenance §6 verified payloads (incl. `anyBlue` skip-with-note); `seedFromTargetSpark` + `forcedTierScore`; `resolveParent2` discrimination; `draftToSyntheticParent` coverage pricing at each tier.
- **Persistence:** `exportImport` round-trip for `parent2Mode`/`rentalDraft`/`rentalRecorded` + validation errors.
- **Refactor guard:** `UmaPickerModal` tests stay green after the `useSparkFilterState` extraction (behavior identical).
- **Component:** mode selector switches; draft panel edits filters + generates links; rental editor produces a valid `Parent`. Stub `useGameData`/`useUmas` per the M1 provider-free pattern.

## 9. Honesty (P3) & provenance

- Draft coverage/affinity is a **hypothetical** at a **forced** tier — labelled as such, never presented as measured.
- `forcedTierScore` values are a **documented estimate** (mechanics-notes §3 bands), adjustable.
- Search-links are **deep-links only** — no scraping/API (ChronoGenesis stays cite-and-deep-link only; uma.moe API is AGPL + auth-gated, out of scope). Encodings cited to provenance §6.
- A record ≠ a borrowable rental (banner).

## 10. Non-goals / deferred

- **Paste-parser / native site search** — no clean structured source exists for a *specific* rental parent (per-parent site data is auth-gated/anti-bot; share-URLs encode a filter, not a parent). Manual entry is the honest v1. (Explicitly dropped per the brainstorm.)
- **UmaExtractor friend-list extraction** — upstream-tool limitation (§5); documented wishlist, not built.
- **Grandparent-deep search clauses** beyond what `SparkFilter` already expresses.

## 11. Open items to confirm during the plan

1. Exact **white/green factor site-key** format for each site's payload (from uma.moe open-source serialization + a real deep-link capture).
2. Final `forcedTierScore` representative values (spot-check one draft's inherit-% vs a real ◎/○/△ parent).
3. Re-verify UmaExtractor's target screens (§5 note) before shipping the "can't extract rentals" copy.
