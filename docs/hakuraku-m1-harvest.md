# Hakuraku M1 Harvest Report

> **Created 2026-06-24.** Source-code read of [`ayaliz/hakuraku`](https://github.com/ayaliz/hakuraku) (**MIT**, default branch `main`) to re-derive its inheritance/affinity math into our pure-function core. Feeds [roadmap.md](roadmap.md) Phase 4 (M1) and [module-1](modules/module-1-inheritance.md).
>
> **Goal: re-derive + validate, not transcribe.** Hakuraku is MIT (freely reusable into our GPL repo), but we re-implement as pure `src/core/` functions validated against umamily.moe / Ice's sheet — owning and testing the math rather than vendoring an unmaintained single-maintainer fork.

## Headline finding

Hakuraku's **affinity** math is the *same model we already shipped* in `src/core/affinity.ts` (`aff2` / `aff3` / relation-points / tier-thresholds) — so capabilities 1–2 are **confirmation + two refinements**, not new ports. The genuinely new, high-value harvest is **capability 3 (per-parent "individual affinity" → spark-proc probability)** and **capability 4 (factor/transfer optimizer)** — neither exists in our codebase, both are pure computation over master data, both fully portable.

Hakuraku's *input* data (the `Veteran` object) comes from **packet capture — NOT portable.** But every *formula* below operates on plain numbers we feed from our own `Parent` / `RosterEntry` / imported data.

## Source files read (all `raw.githubusercontent.com/ayaliz/hakuraku/main/…`)

| File | Gave |
|---|---|
| `src/data/VeteransHelper.ts` | **Core** — all five functions + constants |
| `src/data/UMDatabaseWrapper.ts` | Master-data deps (`successionRelation`, `successionRelationMember`, `singleModeWinsSaddle`, `textData`) |
| `src/pages/VeteransPage/types.ts` | `Veteran` / `OptimizerConfig` shapes |
| `src/pages/VeteransPage/SparkProcModal.tsx` | Individual affinity + base chance → ≥1/≥2 proc odds (DP over factors, full-run squaring) |
| `src/pages/VeteransPage/OptimizerPanel.tsx` | Optimizer default weights; **sort is ascending (likely a bug)** |
| `src/pages/VeteransPage/AffinityCalculatorPanel.tsx` | Total-affinity assembly + friend-code borrow path |
| `public/notes/sparks.md` | Base spark chances + Cygames-patent `(1 + affinity/100)` + crazyfellow "individual affinity" theory |
| `public/notes/spark-generation.md` | Large-N empirical *generation* rates (validation gold) |
| `public/notes/affinity.md` + `attachments/CalcRelationPoint.ts` | Frida-verified race-bonus mechanic + worked example |

---

## Capability 1 — Affinity (parent↔child / chara↔chara)

Computed over **relation-type membership sets**, summing the per-type relation point of every type shared by all relevant charas. Reduced chara-ID = `Math.floor(card_id / 100)`.

```
charaRelationTypes[charaId] : Set<relationType>      // successionRelationMember
relationPoints[relationType] : int                   // successionRelation (values 1 / 2 / 7, NOT uniform)

sumSharedRelationPoints(A, B, C?) =
    Σ relationPoints[t]  for t in A  where B.has(t) and (C undefined or C.has(t))

calculatePairAffinity(v1, v2) = sumShared( rel[chara(v1)], rel[chara(v2)] )

calculateAffinity(parent, targetChara):
    rT, rP = rel[target], rel[chara(parent)]
    g1, g2 = parent's grandparents (succession_chara_array position_id 10 / 20)
    rg1 = (g1 && chara(g1)!=target) ? rel[chara(g1)] : ∅      // same-chara guard
    rg2 = (g2 && chara(g2)!=target) ? rel[chara(g2)] : ∅
    sum1 = sumShared(rT, rP)            # target ∩ parent           (pair)
    sum2 = sumShared(rT, rP, rg1)       # target ∩ parent ∩ gp1     (triple)
    sum3 = sumShared(rT, rP, rg2)       # target ∩ parent ∩ gp2     (triple)
    return sum1 + sum2 + sum3 + calculateRaceBonus(parent).total
```

**Race bonus (Frida-verified):** for each `win_saddle_id` the parent has, `+1` per grandparent that shares it (`0/1/2` each). Special career-race variant IDs (e.g. McQueen's Takarazuka `147` vs normal `14`) **do not overlap** — confirmed client quirk, worth a code comment.

> **⚠ SUPERSEDED by the 2.0-anniversary compatibility overhaul** (live JP/KR/TW; GLOBAL **2026-07-01 11:00 UTC**, retroactive). The `+1 per shared graded race + +1 per Triple Crown` rule above is **pre-2.0**. Post-patch: **only shared G1-grade races count, at +3 each; G2/G3 races + title bonuses give 0**; base relation points are boosted (a `master.mdb` data change). The `54 + 18 = 72` Seiun Sky/McQueen fixture below (Validation references) used the **old** race bonus → **needs a new post-patch fixture**. **M1's affinity phase implements the NEW model** (decision 2026-06-25). Canonical record: [docs/mechanics-notes.md §3](mechanics-notes.md). Capabilities 3 (spark-proc chance) + the base-chance table + the patent scaling formula are **unaffected**.

- **Data deps:** `successionRelation`, `successionRelationMember`, `singleModeWinsSaddle` (race bonus only), `textData` cat 111 (names, display only).
- **Portability: EASY** — pure integer set-arithmetic. **We already have this** (`aff2`/`aff3`/`buildAffinityIndex`); our `affinityTier` thresholds (`◎≥151, ○≥51, △`) match the display intent.
- **Two refinements to harvest into ours:**
  1. **Race/win bonus** — the exact algorithm above, wired into our currently-injected optional `winBonus`.
  2. **Same-chara grandparent guard** — zero a grandparent's relation set when `gpChara === targetChara`; our `aff3` doesn't special-case this.

## Capability 2 — Trio affinity + friend-code borrow

No single "trio" number; the displayed total is composed exactly as we do — the 3-way-ness lives *inside* `calculateAffinity`'s triples:

```
p1Aff   = calculateAffinity(parent1, mainChara)
p2Aff   = calculateAffinity(parent2, mainChara)
pairAff = calculatePairAffinity(parent1, parent2)
total   = p1Aff + p2Aff + pairAff
```

**Friend-code "borrow 2nd parent":** `onBorrowLookup(viewerId)` pulls another player's veteran as `parent2` — **account/network data, NOT portable**; our analogue is the planner's own roster + a manual/imported borrow entry. The math = **direct parity** with our `computeLineageAffinity`.

## Capability 3 — Spark proc chance ★ *(top new harvest)*

The **"individual affinity" model** (crazyfellow theory + Cygames patent `(1 + Σbonus/100)`, validated by BourBon_Polaris's 100-trial dataset). **We do not have this.**

**Base chances** (per category × star level, from BourBon_Polaris `<20 affinity` tests):

| Category (from `factorId` length) | ★1 | ★2 | ★3 |
|---|---|---|---|
| 1 Blue (stat) — len 3 | 70 | 80 | 90 |
| 2 Aptitude/Red — len 4 | 1 | 3 | 5 |
| 3 Unique/Green — len 8 | 5 | 10 | 15 |
| 4 Race — len 7, starts `1` | 1 | 2 | 3 |
| 4 Scenario — len 7, starts `3` | 3 | 6 | 9 |
| 5 Skill (white) — else | 3 | 6 | 9 |

```
level = factorId % 100
calculateSparkChance(category, level, individualAffinity):
    return min(100, base[category][level] * (1 + individualAffinity / 100))   // patent formula
```

**Individual affinity** plugged in is *not* the tree total — each source slot gets its own:

```
self (a parent): calculateAffinity(parent, target) + calculatePairAffinity(parent, otherParent)
gp1/gp2:         sumShared(target, parent, gp) + (#win_saddle_ids shared between parent and this gp)
```

**Aggregation across the run** (DP over carriers; "full run" squares single-inheritance for two inheritances):

```
dp=[1,0]; for p in probs: dp=[dp0*(1-p), dp1*(1-p)+dp0*p]   # P(0), P(1)
single:  ≥1 = 1-dp0 ;            ≥2 = 1-dp0-dp1
fullrun: p0=dp0² ; p1=2·dp0·dp1 ; ≥1 = 1-p0 ; ≥2 = 1-p0-p1
```

- **Data deps:** same relation/win tables as cap 1 + each carrier's `factor_id`/`level` (category derived purely from the numeric id — no new master data).
- **Portability: EASY–MEDIUM.** Formula + DP are trivial. The "medium" is only that our model must carry **per-factor source-slot attribution** — exactly what M1 Plan 3's nested `Parent`/`ParentSparks` rewrite adds.
- **Maps to:** new `src/core/sparkChance.ts` → M1 Plan 4's residual spark-goal search.

## Capability 4 — Factor / transfer optimizer

A weighted linear sum over **gold (◎)** factor stars, ranking candidate parents.

```
calculateOptimizerScore(v, cfg):
    blues/apt/unique/skill/scenarioStars = Σ (level) over gold factors of each category
    hvSkillCount = #(cfg.highValueSkills ∩ v.skill_array.skill_id)
    return blues*Wb + apt*Wa + unique*Wu + skill*Ws + scenario*Wsc + hvSkillCount*highValueSkillBonus
```

**Default weights:** blues 20, apt 20, unique 10, skill 5, scenario 10, highValueSkillBonus 20.

- **Two quirks:** (a) only **gold** stars count (grandparent factors aggregated for display, excluded from scoring); (b) `OptimizerPanel.calculate()` sorts **ascending** (`a.score - b.score`) — likely a UI bug; we sort **descending**.
- **Portability: EASY.** Pure arithmetic → `rankParents(roster, weights)`.
- **Maps to:** M1 Plan 4 compare-all — port as a **fast pre-rank**, with `runVacuumCompare` as the tiebreaker, not the final verdict (P3).

---

## Summary

| Capability | Portability | Master-data deps | Maps to | New? |
|---|---|---|---|---|
| 1. Affinity (pair + tree + race bonus) | Easy | `successionRelation`, `successionRelationMember`, `singleModeWinsSaddle` | `src/core/affinity.ts` (shipped) | No — harvest race-bonus + same-chara guard |
| 2. Trio + friend-borrow | Easy / borrow N/A | same as (1) | `computeLineageAffinity` (shipped) | No |
| 3. Spark proc chance | Easy–Medium | (1) + factor ids/levels | **new `src/core/sparkChance.ts`** | **Yes — top harvest** |
| 4. Factor optimizer | Easy | factor ids/levels, `skill_array` | M1 Plan 4 rank (fast pre-rank) | **Yes** (weaker than sim) |

**NOT portable (packet/account-only):** the `Veteran` object itself, the friend-code borrow lookup, `UMDatabaseWrapper` proto loading.

## Validation references (cite in mechanics-notes + tests)

- **Spark base chances:** BourBon_Polaris `<20 affinity` tests (`x.com/BourBon_Polaris/status/1806521989198413849`).
- **Individual-affinity formula:** Cygames patent **JP2022018121A** (`1 + Σbonus/100`) + crazyfellow guide + BourBon_Polaris 100-trial validation.
- **Affinity worked example (unit-test fixture):** Seiun Sky main, McQueen parent, Oguri Cap + El Condor Pasa grandparents → **Total 72 = Base 54 + RaceBonus 18** (Frida-confirmed).
- **Generation rates** (validate *generation*, distinct from proc chance): `spark-generation.md` — pink ★ 20/70/10; white/unique rank-score-banded; white-skill lineage boost ≈ `base·1.1^lineage_count` (aoneko_pochi), not the old linear `+2.5%`; blue ★ banded by stat value.

**Caveat (P3):** cap 3's per-parent split is theory-validated, not Cygames-confirmed → surface as estimate. Cap 4 is a heuristic → present as pre-rank, not verdict.

## Port-first ordering

1. **`src/core/sparkChance.ts`** (cap 3) — the real new capability + M1 Plan 4 blocker. ~60 LOC, unit-test vs the BourBon_Polaris table. Do alongside M1 Plan 3's nested `Parent`/`ParentSparks` (needs source-slot attribution).
2. **Affinity refinements into `src/core/affinity.ts`** (cap 1) — race/win-bonus + same-chara guard; lock with the `54 + 18 = 72` fixture.
3. **`rankParents`** (cap 4) — quick M1 Plan 4 win; port the weighted gold-star sum as a fast pre-rank; fix the ascending-sort bug; defer to `runVacuumCompare`.
4. **Generation rates → `docs/mechanics-notes.md`** (reference, not code).

**Confirmed-from-source vs inference:** all formulas/constants/weights/DP/table-names/race-bonus algorithm + worked example were read directly. *Inferred (flagged):* the ascending sort being a bug (could be intentional "worst-first"); that all relation/win tables we need overlap what our existing affinity pipeline consumes (confirm column names when wiring `singleModeWinsSaddle`). *Not found:* hakuraku source does **not** state the `△/○/◎` display thresholds — our `151/51` come from our own core / community refs.
