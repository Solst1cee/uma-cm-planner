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

> ⚠ Kamigame claims grandparent **green** sparks can only proc in-run, not at career start (parents only at start). Unencoded — verify before modeling green career-start eligibility.

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
7. **Fast Learner stacking → ADDITIVE (CODE/DOC FIX — affects M4 coverage SP costs).** Verified vs live `master.mdb` + a real Global screenshot (2026-06-15, `spikes/ocr/`): our `baseSpCost` values are **CORRECT** (`single_mode_skill_need_point.need_skill_point`: Full Throttle 160, Glittering Star 200, Radiant Star 200 — match our dataset exactly; the earlier "gold data bug" suspicion was **wrong**). Whites at Hint Lv1 + Fast Learner show base×0.8 (160→128, 200→160), proving FL stacks **additively** (hint 10% + FL 10% = 20%), refuting the multiplicative ×0.81 in umalator's `cost-calculator.ts:31-34` and §7's old wording. **Action:** make our cost model additive (see §7); confirm with one more Lv2+/FL shot.
8. **Gold-skill cost derivation (CODE — affects M4 coverage + M2 knapsack).** `master.mdb` stores gold skills at their *white-equivalent* base (gold Radiant Star = its white Glittering Star = 200), but the gold's on-screen cost is ~2× (320 at Lv1+FL = 200 × **2** × 0.8). The 2× must be applied in **derivation**, not the stored base. umalator does it by **bundling the white prerequisite** (`cost-calculator.ts:142`), which the M2 spec already adopts (`cost = gold + white`). `coverage.ts:332` currently has no rarity/bundle term → under-prices golds ~2×; add it. **Disambiguate** bundle-vs-flat-×2 with a screenshot of a gold whose white-prereq base ≠ the gold's stored base (both coincide at 200 here, so this one shot can't tell them apart).
