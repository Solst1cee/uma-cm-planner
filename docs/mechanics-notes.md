# Mechanics Notes

Verified game mechanics with sources and dates (plan §2 P3 "honest numbers"). All values reconciled in **Phase 0 (2026-06-12)** by independent research + adversarial re-verification (two separate agent passes per number; full evidence trail in `spikes/phase0-results.json` and `spikes/phase0-completion-results.json`). Tests in `src/core/` must cite the relevant entry here.

**Source credibility order used:** datamined master.mdb tables > calculator source/internals (Ice's sheet formulas, umalator code) > curated community docs > wiki prose.

Key sources:
- **Ice's Affinity & Inspirations sheet** — https://docs.google.com/spreadsheets/d/1mT_uH79lZwEth6qGvjBOvrRKxwfKixr6vfhgzoW1s-U/ (formulas extracted from xlsx; empirical base chances credited to @BourBon_Polaris)
- **umamusu.wiki Game:Inspiration / Game:Skills** — https://umamusu.wiki/Game:Inspiration
- **umareference** — https://www.umareference.com/guide/legacies/chance-of-inheriting-sparks
- **note.com herohero_3** (JP analysis citing patent JP-2022-018121 + JP empirical runs) — https://note.com/herohero_3/n/n3516b3322d76
- **CrazyFellow's Parent/Gene guide** — https://docs.google.com/document/u/0/d/1Q3IJKbtkplmuY-PAJMNjYiLtasv0eU0aIBEqp8_C3tg/mobilebasic
- **GLOBAL master.mdb** resource_version 10006400 (app 1.22.1, fetched 2026-06-12; local: `spikes/repos/umalator-global/db/`)
- GameTora /legacies, uma.guide /guides/sparks /guides/skills, Altema/Game8/GameWith (JP)

---

## 1. Inheritance model — three phases

✅ **CONFIRMED.** Inheritance happens at:
1. **Career start** (deterministic-ish): blue stat bonuses (deterministic), pink aptitude steps (deterministic), green unique-skill hints (chance-based, 1–3 levels). **NO white skill/race/scenario procs at career start.**
2. **Inspiration event, early April Classic year** (probabilistic rolls).
3. **Inspiration event, early April Senior year** (probabilistic rolls).

All proc-chance math uses **n = 2** events: `P(career) = 1 − (1 − p_event)²` — exact formula in Ice's sheet (`non_zero_career`, Full Custom Calculation **CB18**; matches precomputed tables to float precision).

> ✅ **VERIFIED + ENCODED (2026-07-03, maintainer in-game on Global):** the DIRECT parents' **green** sparks are **guaranteed at career start** (never roll); **grandparent** greens have NO career-start grant and only **roll at the two inspiration events** with the green base table (§2) × member affinity (matches the Kamigame claim). Encoded: `sparkChance` prices gp greens via the green path; the M1.7 coverage matrix shows parent greens as 100% guaranteed and never prices them through `sparkChance`.

## 2. Base proc table (per inspiration event, before affinity, % by 1★/2★/3★)

✅ **CONFIRMED** — three independently-derived lines agree exactly (Ice/BourBon Global empirical; umareference; herohero JP citing patent JP-2022-018121 + JP trial data):

| Spark type | 1★ | 2★ | 3★ |
|---|---|---|---|
| Blue (stat) | 70 | 80 | 90 |
| Pink (aptitude) | 1 | 3 | 5 |
| Green (unique skill) | 5 | 10 | 15 |
| White — skill | 3 | 6 | 9 |
| White — race (G1 win) | 1 | 2 | 3 |
| White — scenario | 3 | 6 | 9 |

Semantics: per individual spark, per lineage member, independent rolls each event, scaled by **that member's own** affinity (§3), clamped at 100%.

> ⚠ Do NOT confuse with the spark **generation** quality table (career-end star distribution) — a common community conflation. Generation (for farming guidance only): ~20% white per learned normal skill, ~25% for ◎, ~40% for gold-tier, ×≈1.1ⁿ when n lineage members hold the same factor. (Note: owadablog.com/white-factor/ measures *generation*, not inheritance — earlier draft mis-cited it.)

## 3. Affinity scaling

✅ **CONFIRMED:** `chance = base × (1 + memberAffinityScore/100)`, clamped at 100%.
- Uses each lineage member's **individual** score, NOT the in-game displayed total (the display = sum of the 6 member scores).
- Member score decomposition (Ice's formulas): `parent_i = aff2(T,Pᵢ) + aff2(P₁,P₂) + sharedG1Wins(P₁,P₂) + aff3(T,Pᵢ,Gᵢ₁) + sharedWins(Pᵢ,Gᵢ₁) + aff3(T,Pᵢ,Gᵢ₂) + sharedWins(Pᵢ,Gᵢ₂)`; `grandparent_ij = aff3(T,Pᵢ,Gᵢⱼ) + sharedWins(Pᵢ,Gᵢⱼ)`.

**Affinity is computable, not just manual-entry** (changes plan §14.4 calculus). Verified algorithm from GLOBAL master.mdb:
- `succession_relation(relation_type, relation_point)` + `succession_relation_member(relation_type, chara_id)`.
- `aff2(a,b) = Σ relation_point over types containing both`; `aff3(a,b,c) = Σ over types containing all three`.
- Lineage total = `aff2(T,P1)+aff2(T,P2)+aff2(P1,P2)+aff3(T,P1,G11)+aff3(T,P1,G12)+aff3(T,P2,G21)+aff3(T,P2,G22)`.
- Rank thresholds: △ 0–50, ○ 51–150, ◎ 151+.
- **Validated:** reproduces ALL of Ice's hidden `_affinity` tab (528 pairs + 5456 triplets) exactly, except rows for chara 1058 (Meisho Doto — postdates the sheet's snapshot).
- Dynamic component on top of static tables: shared won-races bonus between *trained* umas (win-saddle; reference: hakuraku `WinSaddleRelationBonusCalculator`). Static tables extracted to `spikes/repos/umalator-global/db/extract/relation*.json`; reference impls: uma-moe/umamoe-backend `affinity.py`, umamoe-resources `affinity.rs`.

**⚠ 2.0-anniversary compatibility overhaul (live on JP/KR/TW; lands on GLOBAL 2026-07-01 11:00 UTC, RETROACTIVE).** Reworks the win-saddle/race bonus + base relation points; **build M1's affinity to this model** (decision: Sun, 2026-06-25 — "apply now, verify later; it follows JP/KR/TW"):
- **Race/win bonus:** only shared **G1-grade** races grant a bonus, at **+3 each** (was +1 per *any* graded race); **G2/G3 races and Triple Crown/Tiara title bonuses no longer contribute (0)**. Still per family-tree connection (parent↔grandparent, P1↔P2) — only the eligible-race filter + point value change.
- **Base relation points boosted across the board** — a `master.mdb` data change (new `succession_relation.relation_point` values), so a post-patch **data refresh (sidelist S1) auto-picks it up**; no formula change.
- **Unchanged:** the `base × (1 + memberAffinityScore/100)` scaling, the member-score decomposition shape, and the tier thresholds (△0–50 / ○51–150 / ◎151+). ◎ is just far easier to hit now (run max G1s).
- **Superseded → do NOT implement:** the hakuraku-harvest race-bonus algorithm (`+1 per shared win_saddle, all grades, +1 per Triple Crown`) and its `Seiun Sky/McQueen 54+18=72` fixture are **pre-2.0**. A new post-patch worked-example fixture is TBD (§10). Sources: [uma.guide/guides/sparks](https://uma.guide/guides/sparks), [CrazyFellow's Steam guide](https://steamcommunity.com/sharedfiles/filedetails/?id=3686542989).
- **Note:** the spark **proc-chance** base table (§2) + the scaling formula are **unaffected** — only the affinity *input* changes — so `src/core/sparkChance.ts` (M1.0) is independent of this overhaul.
- **G1 saddle-id whitelist (populated 2026-07-05, closes the M1.7 data gate).** The win-bonus filter (`g1Saddle.ts`/`filterG1`) reads `data-overrides/g1_saddle_ids.json` (+ its in-src copy). Derived authoritatively from `master.mdb`: `single_mode_wins_saddle` rows with **`win_saddle_type == 3`** are exactly the single G1-race saddles (each `race_instance_id_N` resolves via `race_instance.race_id` → `race.grade == 100`). Cross-tab is perfectly clean — type 3 → grade 100 (34 saddles), type 2 → 200 (G2), type 1 → 300 (G3), type 0 → compound **titles** (Triple Crown/Tiara/Grand Prix, multi-race, all-G1 underlying). Per §3 (titles → 0, G2/G3 → 0) the whitelist = the 34 **type-3** ids only: `10–39` + the alternate-scenario saddles `147/148/153/155` (Takarazuka Kinen / Kikka Sho / Tenno Sho (Spring) / Satsuki Sho). Verified against Sun's real roster (all 235 parents have ≥1 G1 saddle; saddle 147 appears 29×, so the variants are live). Re-derive on a data refresh via the node:sqlite snippet in provenance §5.

## 4. Grandparent multiplier

✅ **CONFIRMED: there is NO flat ×0.5.** Remove the parameter. Grandparents use the same base chances; their lower effective rate is **emergent** from structurally smaller individual affinity scores (gp score = one aff3 term + shared wins). "≈ halved" (CrazyFellow, umareference prose) is hedged empirical observation; the only quantified JP parent-vs-gp datapoint found (~10% vs ~7%, ratio 0.7) is itself inconsistent with a hardcoded 0.5. If a degraded mode must estimate from the displayed total only, use ~0.5–0.65 and label it approximate.

## 5. Pink (aptitude) sparks

✅ **CONFIRMED.**
- **Career start:** cumulative pink stars across all 6 lineage members, per aptitude type; thresholds **[1, 4, 7, 10]** stars → +1/+2/+3/+4 grades (max +4). **Cannot exceed A at career start.**
- **A→S:** only via an in-run inspiration proc of that pink spark (base 1/3/5% per star, affinity-scaled) while at A.
- Encode as `thresholds: [1,4,7,10]`, `maxSteps: 4`, `careerStartCap: 'A'`.

## 6. Blue (stat) sparks

- **Career start:** ✅ **CONFIRMED [5, 12, 21]** stat points per 1/2/3★ spark, per lineage member, additive (e.g. 21+12+5+5+5+5 = 53). Deterministic — the game previews it at parent select. (Plan §5 marked this conflicted; it isn't — three independent sources + worked examples agree.)
- **In-run proc roll ranges:** ⚠ **PROVISIONAL — single-origin + actively disputed.** EN sources all trace to CrazyFellow (1–10 / 1–16 / 1–28 for 1/2/3★); GameWith's JP empirical observations conflict (★1: 1–28, ★2: 8–19, ★3: 1–25; likely confounded by same-stat proc stacking; GameWith theorizes stars shift the distribution *probability*, not the cap). Keep [1-10, 1-16, 1-28] as placeholder, render as approximate in UI (P3), queue in-game verification with single-proc isolation.
- White **race**-spark procs grant fixed **3/6/9** stats by star (wiki, CrazyFellow-credited); white **skill**-spark procs grant the skill at hint level 1–5 (distribution unknown; `succession_factor_effect` defines the 5 possible payouts per group).

## 7. Hint SP discount schedule

✅ **CONFIRMED:** cumulative **10/20/30/35/40%** at hint Lv1–5 (increments `[10,10,10,5,5]`), cap 40%. JP wikis unanimous since launch (Altema/Game8/GameWith) + uma.guide. The umamusu.wiki "~8% per level" is **refuted** as a schedule — it's 40%/5 linearized. *Fast Learner* (切れ者) adds a further 10%. **⚠️ Stacking is ADDITIVE** — hint% + 10%, one multiply — per a real Global screenshot (2026-06-15, `spikes/ocr/`): whites at Hint Lv1 + FL show base×0.8 (Full Throttle 160→128, Glittering Star 200→160, both exact), which **refutes the multiplicative ×0.81** model used by umalator's `cost-calculator.ts:31-34` (`base×(1−hint)×0.9` → 130/162) and by the earlier wording here. Our cost model must use additive. (Badge read "Hint Lv1 10% OFF", so the extra 10% is necessarily Fast Learner — present in that run. One more shot at Lv2+/FL would fully nail additive-vs-multiplicative, where they diverge more.)
- Rounding: umalator-global implements **ceil after summing** discounted components (`skill-planner/cost-calculator.ts`); a single in-game screenshot where ceil/floor diverge would settle it first-party (e.g. base 110 at hint Lv4 → 72 vs 71).
- Gold skills bundle their white prereq cost (same calculator — reuse for Module 2 knapsack).

## 8. Factor (spark) ↔ skill identity — for the UmaExtractor importer

✅ **VERIFIED on GLOBAL master.mdb** (v10006400):
- Factor ID encoding: last 2 digits = star count; 3-digit = blue (hundreds 1–5 = spd/sta/pow/gut/wit); 4-digit = pink (group 11/12 turf/dirt, 21–24 styles, 31–34 distances); 7-digit `1…` = race, `2…` = white skill, `3…` = scenario; 8-digit = green (floor/100 = source card_id).
- Skill join: `succession_factor.factor_group_id → succession_factor_effect.factor_group_id` rows with `target_type=41`; `value_1` = skill id, `value_2` = hint level (effect rows 1–5). (`effect_group_id` joins to NOTHING — do not use.)
- ❌ The arithmetic shortcut `skillId = group×10+2` **fails for 29 of 185 white groups** (they map to `×10+1`), and for ≥4 of those returns a *real but wrong* skill (evolved-skill ids). **The join is mandatory.** Precomputed map: `spikes/repos/umalator-global/db/extract/white_spark_skills.json`.
- Green sparks grant the **9xxxxx inherited-unique** skill id (matches simulator data), not the parent's native unique id.
- JP clairvoyance dump = strict subset of current GLOBAL (904/904 identical rows; GLOBAL +55 factors) — safe as fallback, prefer GLOBAL-current extraction.

## 9. Support-card passives (hint model inputs)

✅ **CONFIRMED against GLOBAL master.mdb** (`support_card_effect_table`, all 220 cards byte-identical to GameTora's `effects` matrices):
- Row shape: `[effect_type, lv1, lv5, lv10, …, lv50]` (11 value columns, `-1` = not yet active).
- Effect ids: **17 = Hint Levels, 18 = Hint Frequency, 19 = Specialty Priority, 30 = Skill Point Bonus**. Effect 33 (Hint Quantity Bonus) does **not exist on Global yet** (zero rows) — ignore until it appears.
- Level caps per limit break: R 20/25/30/35/40, SR 25/30/35/40/45, SSR 30/35/40/45/50 (`support_card_limit`). Per-LB passive value = matrix value at the LB's cap level; between breakpoints linear-interpolate (integer floor), carry-forward after the last (reference impl: Tachyons-lab `helper.py lerp_levels`).
- Per-card hint pools: `single_mode_hint_gain` (1735 rows; `hint_gain_type=0`, `hint_value_1` = skill id, `hint_value_2` = hint levels granted). Extracted: `db/extract/hint-effects.json`.

## 10. In-game verification queue (P3 — render affected outputs as approximate until resolved)

1. Blue in-run roll ranges + distribution shape (§6) — single-proc isolation runs.
2. SP discount rounding ceil vs floor (§7) — one screenshot at hint Lv4.
3. Green spark career-start eligibility for grandparents (§1 note).
4. White skill-spark hint-level payout distribution (§6).
5. 100% clamp behavior at ≥100 affinity-scaled chance (cosmetic; planner output unaffected).
6. Patent JP-2022-018121 original text (j-platpat) would harden §2–§4 — currently second-hand via herohero note.
7. **2.0 compatibility overhaul (§3):** exact new base `succession_relation.relation_point` values (post-patch `master.mdb`) + a clean post-2026-07-01 worked-example fixture to replace the pre-2.0 `54+18=72`. Verify from JP/KR/TW data or in-game after the Global patch (2026-07-01 11:00 UTC). Until then M1's affinity uses the new *rule* (G1-only +3, no G2/G3, no titles) with current base tables; the base-boost arrives via a data refresh (S1).
7. **Fast Learner stacking → ADDITIVE (CODE/DOC FIX — affects M4 coverage SP costs).** Verified vs live `master.mdb` + a real Global screenshot (2026-06-15, `spikes/ocr/`): our `baseSpCost` values are **CORRECT** (`single_mode_skill_need_point.need_skill_point`: Full Throttle 160, Glittering Star 200, Radiant Star 200 — match our dataset exactly; the earlier "gold data bug" suspicion was **wrong**). Whites at Hint Lv1 + Fast Learner show base×0.8 (160→128, 200→160), proving FL stacks **additively** (hint 10% + FL 10% = 20%), refuting the multiplicative ×0.81 in umalator's `cost-calculator.ts:31-34` and §7's old wording. **Action:** make our cost model additive (see §7); confirm with one more Lv2+/FL shot.
9. **G1 win-saddle variant matching (win-bonus under-count, safe direction).** A few G1 races carry alternate-scenario saddle ids (147≡14 Takarazuka, 148≡16 Kikka, 153≡13 Tenno Spring, 155≡18 Satsuki). `sharedG1` (winBonus.ts) intersects saddle-id *strings* exactly, so two parents who won the same race under different saddle ids (e.g. 14 vs 147) miss the shared-win +3 — an **under-count** (the documented-safe direction, consistent with the empty-set default; never over-counts). Real-data-relevant: 147 appears in ~12% of Sun's roster parents. Fix (deferred): canonicalize variant saddle ids to their base G1 id before intersection — but first VERIFY whether the game itself dedupes variants for the affinity bonus or matches exactly (if the latter, exact match is already correct and no change is warranted).
8. **Gold-skill cost derivation (CODE — affects M4 coverage + M2 knapsack).** `master.mdb` stores gold skills at their *white-equivalent* base (gold Radiant Star = its white Glittering Star = 200), but the gold's on-screen cost is ~2× (320 at Lv1+FL = 200 × **2** × 0.8). The 2× must be applied in **derivation**, not the stored base. umalator does it by **bundling the white prerequisite** (`cost-calculator.ts:142`), which the M2 spec already adopts (`cost = gold + white`). `coverage.ts:332` currently has no rarity/bundle term → under-prices golds ~2×; add it. **Disambiguate** bundle-vs-flat-×2 with a screenshot of a gold whose white-prereq base ≠ the gold's stored base (both coincide at 200 here, so this one shot can't tell them apart).

## 11. M2 SP-optimizer validation (Plan #1 gate)

- **Automated (`rankBaskets.validation.test.ts`):** deterministic output for a
  fixed seed; ≤3 baskets; each within budget; ranked on simulated combined Δ-L;
  the pure core's exact branch == brute-force enumeration (`spOptimizer.test.ts`).
- **Manual vs VFalator (≥3 skills):** for the fixture build, run VFalator on the
  same course/strategy/stats and compare single-skill Δ-lengths against
  `evalSkillDelta` for ≥3 spot-checked skills; record date + numbers here.
  Within Monte-Carlo noise = pass.
- **Deferred (needs adapter telemetry):** per-basket phase profile (early/mid/late,
  stamina margin) — the adapter currently exposes only BashinStats, so v1 shows a
  distribution descriptor (Δ-lengths + spread), not a phase profile.


## 12. WASM re-platform parity (2026-07)

Fidelity re-baseline for the sim-engine re-platform (vendored TS bundle → upstream
umalator-global **v0.27.0 Rust/WASM**, pin `484539f5` + `engine-patches/2026-07-10-multifire-rust.patch`).
All values below are real observed outputs (P3), recorded 2026-07-10 from the committed
pkg (`src/sim/vendor/pkg/uma_sim_wasm_bg.wasm` sha256 `4fa2e875…`) and a pristine-pin pkg
built from the clean `484539f5` checkout.

### 12.1 Determinism-sort scope (adjudicated 2026-07-10 — supersedes the Task-1 "cosmetic-only" claim)

The multi-fire patch carries a determinism fix in `runner/physics.rs::tick_conditions`
(iterate the approximate-condition map name-sorted, not in `HashMap` order). Verified scope:

- **Skills NOT gated on approximate conditions** (everything except the
  `blocked_side`/`overtake` family): flag-OFF output is **byte-identical to the pristine
  pin** across full position/velocity/hp/order/activation telemetry (verified on a
  no-skill control race and every non-approximate fixture in §12.2–12.3). `201202`
  (white, `is_overtake`-gated) also happened to be byte-identical at the tested seeds —
  a perturbed draw order only changes output when the swapped values differ at a
  fire-decision moment.
- **Skills gated on `blocked_side`/`overtake`:** the sort can pick a **different — equally
  valid, expectation-equivalent — seeded realization**. Evidence (`201262`, white,
  `blocked_side_continuetime`, Hanshin 3200 `10914`, flag OFF, seed 999):

  | build | physics sha (position/velocity/hp) | バ身 mean (n=60) |
  |---|---|---|
  | pristine pin | `f4aa63…` | −0.365754 |
  | pin + sort ONLY | `0ac228…` | −0.386127 |
  | full patch (committed) | `0ac228…` | −0.386127 |

  3-build isolation: the sort alone causes the change; the flag-OFF multi-fire code is
  physics-inert. Convergence (pristine vs sorted, same fixture): |Δmean| = 0.0204 (n=60)
  → 0.0054 (n=500) → 0.0077 (n=1000), both sides → ~0 — expectation-preserving, within
  sampling noise (independent-runner noise floor ≈ ±0.2 バ身 per-seed at n=500).
- **Why the sort is kept:** on `wasm32-unknown-unknown` the `HashMap` iteration order is
  seeded from **binary layout**, so ANY engine change (multi-fire included) reshuffles the
  approximate-condition RNG draw order — the pristine pin has **no canonical value** here
  to be faithful to, and without the sort our own rebuilds would not reproduce each other.
  With it, output is byte-stable across all our builds. The affected conditions are
  themselves RNG heuristics; a different draw assignment is an equally valid realization.

### 12.2 Fidelity goldens (`src/sim/fidelity.test.ts`)

All use `200332` (Corner Adept ○, `all_corner_random` — NON-approximate, so byte-identical
to the pristine pin). Warm-up call in `beforeAll` absorbs the fresh-instance first-call
quirk; values verified stable across repeat same-instance calls AND fresh processes.

- **Test A (flag-OFF anchor):** `evalSkillDeltaWithSettings(smokeBuild, 10101, '200332', 50, 12345, {cooldownReactivation:false})`
  → mean **0.3730486665111239**. (The old TS-bundle anchor 0.2202 used
  `ignoreStaminaConsumption:true`; the new pipeline always runs stamina ON, so the values
  are not comparable — this is a new baseline, not a drift.)
- **Test A2 (settings-thread pin):** same, `stayerBuild` on `10914` → mean
  **1.0918337778601457**; flag ON on that course differs (1.15228…), so the golden
  regression-tests the flag threading itself (on `10101` ON == OFF, so Test A alone can't).
- **Test B (multi-fire oracle, flag ON default):** `skillImpact` 200 samples seed 12345 —
  Hanshin 3200 `10914`: **33/200** samples with ≥2 distinct fire starts; Kyoto mile
  `10602`: fires in **200/200** samples but **0** doubles.
- **Test C:** flag-ON mean on `10101` ≥ 0 (sanity).

### 12.3 Upstream parity spot-check (programmatic, 2026-07-10)

Upstream side = the clone's own compare pipeline (upstream adapters +
`reduceCompareRoundsPublic`, re-exported verbatim in our wrapper bundle) driving the
**pristine pin pkg**; our side = `evalSkillDelta`/`runVacuumCompare` (`src/sim/run.ts`)
on the **committed patched pkg**. Identical course/conditions/samples/seeds
(ground 1 / weather 1 / season 3 / time 2 / grade 100, mood +2, A/A/A, Pace Chaser).

| fixture | inputs | upstream (pristine) mean / median | ours (patched) mean / median | Δ |
|---|---|---|---|---|
| P1 smoke `evalSkillDelta` | smoke build (1150/800/1000/500/850), +`200332`, `10101`, n=500, seed 12345, flag OFF | 0.2315623831045815 / 0.26031216976907673 | 0.2315623831045815 / 0.26031216976907673 | **0 (byte-equal)** |
| P2 stamina-poor 3200 | sta450 vs sta900, `10914`, n=500, seed 999 (survival/full-spurt rates also byte-equal) | 15.43360786276682 / 15.76955279028698 | 15.43360786276682 / 15.76955279028698 | **0 (byte-equal)** |
| P3 skill-heavy 2200 | bare vs +5 skills (`200012`,`200052`,`200462`,`200472`,`202092`\*), `10906`, n=500, seed 4242 | 3.285352969525132 / 2.9465090955192865 | 3.285352969525132 / 2.9465090955192865 | **0 (byte-equal)** |

\* `202092` is `blocked_side`-gated (approximate) — byte-equality for such skills is
seed/fixture-dependent (§12.1's `201262` case differs); this fixture happened to agree
exactly. Max observed parity delta across all fixtures: **0.0**.

**Open item (maintainer):** a manual spot-check against upstream's *deployed* umalator
site remains open — the programmatic check above proves engine+pipeline parity, not that
the deployed site runs the same pin/data.

### 12.4 Adapter findings recorded during the re-baseline

- **Skill ordering (deck array order):** DOES change seeded per-round outputs (different
  RNG consumption order → different realization) but NOT expected values (reordered
  2-skill and 3-skill decks: means within noise, e.g. 6.589 vs 6.631). uma1/uma2 have
  **independent RNG streams** (identical decks on both runners still produce different
  per-round traces; bare-vs-bare バ身 → 0 over samples). Decision: `toWasmRunner` keeps
  the build's order **unsorted** (old-adapter precedent) — upstream's group-sort exists
  for cross-runner display alignment its head-to-head UI needs, which our vacuum
  compares don't have.
- **Empty-condition alternatives are real:** exactly **2** of 1719 skills.json ids resolve
  (`resolveSkillInput`) with an alternative whose `condition === ''` — `1000011`/`1000012`
  "Carnival Bonus". Validates `applySkillPatch`'s condIdx pairing rule (empty-condition
  alternatives consume no `@`-part).
- **Settings-thread fix (found by Test A2):** upstream's TS `compareSettingsToWasm`
  (v0.27.0, pre-dating our Rust flag) silently dropped `cooldownReactivation`, so no
  app-side settings override could ever reach the engine (default ON always). Fixed in
  the clone TS (now part of `engine-patches/2026-07-10-multifire-rust.patch`, 12 files)
  + wrapper bundle rebuilt. The wasm binary is unchanged (`4fa2e875…`).
