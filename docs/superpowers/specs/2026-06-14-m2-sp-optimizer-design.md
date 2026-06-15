# Module 2 — SP Purchase Optimizer: Design Spec

**Status:** Draft for review (rev. 2026-06-15 — reshaped to post-run-screen-first) · **Owner:** Sun
**Origin:** Brainstorm (superpowers:brainstorming), building on plan §8. **The post-run decision tool** — you're standing on the skill-purchase screen with a fixed SP pool; M2 reads what's actually in front of you, lets you lock the certain buys, then finds the best ways to spend the rest and **sims a few of them so you can pick**.

---

## 1. Problem & boundary
End of a run you have limited SP and can afford **fewer** skills than are offered. M2 solves the **basket**: given your actual post-run build + SP budget + the buyable skills on screen, pick subsets that **maximize Σ E[L]** (length / bashin) — but instead of one answer, it surfaces **~3 strong, genuinely different builds**, **simulates each** (VFalator-style), and lets you **choose**. Umalator ranks *single* skills; nobody solves the *budgeted basket*, let alone offers diverse simmed alternatives. **Plus a decision aid:** head-to-head **compare** a chosen build against an **existing veteran** — *"is this run actually better than my last CM12 ace?"* — before you spend.

**Boundary vs M4:** M4 is the *pre-run ideal* planner (discovery + coverage, no SP limit, plan-time estimates). **M2 is the *post-run actual*** — it reads the real screen (your real stats, real SP, the real learnable list with the real effective costs that already bake in your hints + Fast Learner). **M2 does not depend on M4** (see §3).

## 2. Decisions (locked)
- **Input = the post-run screen in front of you** (OCR or manual), **not** an M4 carry. M4 carry is an *optional* pre-fill convenience, never required (§3). The live screen is the source of truth.
- **Costs come from the screen** (the real effective cost you'll pay), not from dataset base costs — post-run, your actual hint levels + Fast Learner are already applied and the dataset can't predict them. The dataset is used to **identify** the skill (name → effect → L-sim), not to price it.
- **Reuse the vendored umalator engine** (`src/sim/`) for **Δ L per skill** and **per-build race sims** — the same Monte-Carlo as M4.
- **Lock / pin must-buys** → forced into every build (SP deducted first; a pinned gold pulls in its white prereq); the optimizer spends the **remaining** SP over the **remaining** candidates.
- **Output = top-3 near-optimal + diverse baskets**, each **simulated**, ranked by win-rate / mean bashin, annotated with the *emergent* profile the sim reveals (where the length comes from — early vs late, stamina margin). You choose.
- **Build comparison (VFalator-style):** reuse the engine's **uma-vs-uma** mode (`vacuum-compare`) to race a chosen build head-to-head vs a **veteran** → win-rate + bashin gap.
- **Veteran roster + tags:** the UmaExtractor roster (shared with M1) is searchable and **taggable** (e.g. "CM12") to pick the compare opponent.
- **OCR is a first-class input here** (not deferred) — validated on real screenshots (§3) — but always with **manual entry + confirm**, because the numbers are yours to verify.

## 3. Inputs — the post-run build context

> **Canonical shared types** (`CmPlan`, `Stat`, `RosterEntry`) live in [`2026-06-15-shared-data-model.md`](2026-06-15-shared-data-model.md); the veteran compare-opponent + tags use `RosterEntry`. `BuildContext` is M2-local.
`BuildContext { umaId, stats, aptitudes, strategy, courseId, spBudget, candidates: BuyableSkill[], pinned: skillId[] }`; `BuyableSkill { skillId, rarity, screenSpCost, hintLevel?, prereqSkillId? }` — `screenSpCost` is the **effective** cost as shown/entered (already discounted).

### 3.1 Three ways to load the screen (you pick per session)
1. **Manual entry (always available, reliable):** type the learnable skills + their on-screen costs + your available SP. The skill picker autocompletes against the 578-skill dataset; you enter the cost you see. Zero extraction risk.
2. **OCR assist (validated 2026-06-15):** snap the skill screen; OCR reads skill **names** (fuzzy-matched to the dataset) + **available SP**, pre-filling the form for you to confirm/correct. See §3.3.
3. **Optional M4 / roster pre-fill:** if you made an M4 plan for this runner, pre-fill stats/aptitudes/course/strategy from its `CmPlan`; UmaExtractor (via the M1 roster path, opt-in, ToS/ban-risk) can pre-fill final stats/aptitudes/learned-skills. **Convenience only** — the candidate list + costs still come from the screen.

What M2 minimally needs to run sims: **course** (which CM — from the CM schedule or your plan), **final stats + aptitudes + strategy** (screen/manual/roster), and the **candidate skills** (screen). None of these *require* M4.

### 3.2 Why not file/API extraction (settled, still true)
The live skill-acquisition screen is **not file/API-extractable on Global** (confirmed by direct on-disk inspection 2026-06-14: the only local save `…/LocalLow/Cygames/Umamusume/d/SaveData.db` is a single **211-row obfuscated `AppSetting`** key-value table — settings only, no run/skill data; `master.mdb` is the 338-table *static* game DB; `dat/` is content-addressed asset bundles). The packet stack (CarrotJuicer → UmamusumeResponseAnalyzer / hakuraku / UmaLauncher) is **DMM/JP-only**; Steam/Global adds **CrackProof** anti-cheat. UmaExtractor reads live process *memory* and only exports the **finished-uma** record (→ M1 roster), not the in-career menu. Every extraction route is ToS/ban-risk → **never a required dependency**. So the screen is read by **OCR or by hand** — which is exactly the post-run flow you want anyway.

### 3.3 OCR — validated, and how the cost-fragility is handled
Validated on **16 real Global screenshots** of the in-career "Learn" screen (`spikes/ocr/`, 2026-06-15): **available-SP 16/16 correct** (96% conf, dedicated SP-pill crop: greyscale → threshold → PSM6 + digit whitelist) and **skill names matched across the whole scrollable list** (proportional panel crop; full-image OCR invents false rows from the adjacent Agenda panel). The bigram matcher hits 10/10 on mangled names.
- **Names** are read by OCR → fuzzy-matched to the dataset (robust; OCR's strength).
- **Costs**: post-run we want the *effective* on-screen cost. OCR digits are the fragile part (documented Tesseract "33→3" digit-drop), so **costs are confirm-on-entry**: OCR pre-fills, you verify the few numbers. (For *missing* hint/cost reads, the dataset base + your stated hint level is the fallback estimate, flagged as such.)
- **Robustness — validated across HDR + non-HDR + resolution:** the proportional crops survive both **HDR** (1573×855) and **non-HDR** (1451×816) Steam captures — 16/16 on each, identical reads (SP 2285 every shot, same skills per scroll). Resolution-independence holds because crops are fractions of W/H. **Remaining open case:** a different **aspect ratio** — an iPhone screen capture (~2.16:1) vs Steam's ~1.84:1 shifts the in-career layout, so the layout-keyed crops would need recalibration (or per-aspect crop profiles); a true camera *photo* (perspective/glare) would also need deskew + tone-normalize. Needs one iPhone sample to calibrate before trusting that source.
- **Cost-data note (verified, not a bug):** our dataset `baseSpCost` is **correct** (matches live `master.mdb`); the screen costs differ only because of your **active Fast Learner** (additive +10%) and the **gold 2× premium**. Those are M4-side cost-derivation fixes (see `mechanics-notes §7/§10`), not an M2 input problem — M2 sidesteps them entirely by reading the real screen cost.
- **Mobile validated too (iPhone portrait, 1206×2622, 2026-06-15):** with a **portrait crop profile**, names read 93–95%; available-SP reads but fragile (human-confirm, by design). Confirms the input is platform-shaped: ship **per-platform crop profiles** (landscape Steam vs portrait mobile), selected by aspect ratio. Also surfaced two matcher fixes: **preserve aptitude marks** (`Tokyo Racecourse ○` ≠ `◎` — distinct, differently-priced skills the normalizer currently collapses), and **review "unique"/SP-0 tagging** of some learnable-on-screen skills (e.g. Barcarole of Blessings) in the dataset.

### 3.4 Future version — scroll-sync video capture (PTCGP-style "sync")
*Deferred enhancement; designing the room now.* Single screenshots only cover what's on screen; the learnable list scrolls. The robust capture is the **PokémonTCG-Pocket "sync" pattern**: you **record while slowly scrolling the skill list top→bottom**, then the app reads the **video** and reconstructs the full list. Wanted on **both PC and iPhone**.
- **Capture per platform (local-first, P2 — all processing in-browser, no upload):**
  - **PC — live or file.** Live: `navigator.mediaDevices.getDisplayMedia()` captures the chosen game window/screen region straight into a `<canvas>`; OCR runs on sampled frames in real time as you scroll. Or drop a **pre-recorded screen-capture video** and process it.
  - **iPhone — record-then-import.** iOS Safari **cannot** live-capture another app from a web page, so the flow mirrors PTCGP exactly: use the **built-in iOS Screen Recorder**, scroll the skill list, stop, then **import the saved video** into the web app (file input / Share Sheet / a Shortcut). Frames decode locally via `<video>`+canvas (or WebCodecs).
- **Shared processing pipeline (`src/core` pure where possible):**
  1. **Sample frames** at ~2–4 fps (slow scroll → low fps suffices).
  2. **Locate the scroll viewport** — bound it by the static chrome (SP bar above, Confirm/Reset below) via the per-platform profile, or auto-detect the repeating card pitch.
  3. **OCR visible rows** per frame (names → dataset match; on-screen costs).
  4. **Stitch + dedup** — the same row recurs across frames at shifting `y`; track rows by fuzzy name(+cost) and the inter-frame scroll offset (optical-flow / row-pitch) to merge duplicates and order the list with **no gaps, no repeats**.
  5. **Available-SP** read once from static chrome (human-confirmed).
  6. **Confidence + confirm** — present the reconstructed list for review; low-confidence rows flagged (the SP digit especially).
- **Honest constraints (P3):** scroll too fast → rows skipped between frames (UI coaches "scroll slowly," same as PTCGP); per-platform layout profiles still needed (or robust auto-detect); iOS is record-then-import only from a web app (a native app/Shortcut could go further, out of local-first web scope). **Same engine reuse:** the reconstructed list feeds the *exact* `BuyableSkill[]` the manual/single-shot paths produce — video-sync is just a richer **front-end to the same input**, so the optimizer/sim are unaffected.
- **Reuse beyond M2:** the same scroll-sync could later import the **M1 veteran roster** (scroll the owned-uma list) — design it generic.
- **Spike room reserved:** real samples kept under `spikes/ocr/shots/iPhone/` (portrait) + `shots/` (landscape); a `spikes/ocr/video-sync/` spike is the next experiment when this is built.

## 4. The math
- **`evalSkillDelta(build, course, skillId, n) → BashinStats`** — with-vs-without Monte-Carlo Δ L on the **actual** build/course; **cache** per `(buildHash, courseId, skillId)`, reuse M4's cache where the build matches.
- **Cost** = the entered/OCR'd **`screenSpCost`** (already effective). When estimating an un-shown cost: `effectiveSpCost(base, hintLevel, fastLearner)` using the **additive** discount (hint% + Fast Learner 10%, one multiply, `ceil`) and the **gold = base + bundled-white-prereq** rule — both corrected per `mechanics-notes §7/§10`. **Gold pins its white prereq** as one item.
- **`topKBaskets(cands, budget, pinned, K=3) → Basket[]`** — exact **DP-over-SP** knapsack maximizing Σ E[L] subject to Σ cost ≤ budget and `pinned ⊆ basket`, extended to return the **K best baskets that are mutually diverse** (each differs from the others by **≥2 skills**; K-best via DP backtracking + a diversity filter). Beats greedy-by-ratio (proven counterexample test retained).
- **Per-build sim + profile:** run a full race sim for each of the K baskets → **mean bashin, win-rate**, and an **emergent profile** extracted from engine telemetry (where the gain lands — early/mid/late, stamina margin at the line, spurt presence). Honest caveat where a dimension isn't directly measurable.
- **`compareBuilds(buildA, buildB, course, n) → CompareResult`** — wraps the engine's **uma-vs-uma** sim (`vacuum-compare` / `runComparison`) → win-rate + bashin distribution. Races a chosen build vs a veteran.
- Pure core in **`src/core/spOptimizer.ts`** (`effectiveSpCost`, `topKBaskets`, diversity filter) — unit-tested (P6); `evalSkillDelta` + per-build sim wrap the sim worker.

## 5. UI (mockup `m2-sp-optimizer.html` — to revise)
- **Build & SP bar:** input mode (Manual / OCR / pre-fill), build chips (uma · course · strategy · final stats), **editable available-SP**.
- **Buyable-skills table:** per row — **📌 pin** (must-buy), skill (rarity colour + effect badges), type, **Δ L**, **on-screen SP cost** (editable), **L / SP** (×1k), and the **L/SP + hint** info. Pinned rows lift to the top and pre-spend their SP.
- **The 3 build cards (headline):** for each of the top-3 diverse baskets — the skill list (pinned shown locked + the optimizer's picks), **SP used / left**, **mean bashin + win-rate**, and a short **profile tag** the sim revealed (e.g. "more stamina margin", "stronger final spurt", "highest raw speed"). One-click **"Compare this vs veteran."** Just-missed skills greyed below each.
- **Compare vs veteran panel** (§5.1).
- **P3 caveat banner:** the sim can't see positional chaos — estimate, not verdict; test in room.

## 5.1 Compare vs existing veteran (decide before buying)
- Race a chosen build (one of the 3) head-to-head vs a **veteran** from your roster on the CM course — the engine's VFalator-style **uma-vs-uma** sim → **win-rate + mean bashin gap** (+ distribution).
- **Pick the opponent:** **search + tag-filter** your roster (UmaExtractor import, shared with M1). **Tags** are free-text (e.g. "CM12", "dirt ace") so you can pull up "my last CM12 ace" instantly.
- Also supports **build-A vs build-B** (compare two of the three) and **basket-on vs basket-off**, but **vs-veteran is the headline** — *"is this build worth running over the one I already have?"*
- **Honest (P3):** head-to-head bashin / win-rate is a strong prior, not a guaranteed match outcome (positional-chaos caveat).

## 6. Honest numbers (P3)
- L is a streaming estimate; each basket is a **strong prior**, not a verdict (caveat banner). The 3 builds are *options*, ranked by sim — you decide.
- **Validation:** single-skill Δ L within noise of VFalator for **≥3 spot-checked skills** (plan §8); `topKBaskets` **respects budget + pins + prereqs, returns diverse baskets, and beats greedy** on a counterexample test; the additive Fast Learner + gold-premium cost rules reproduce the real-screen costs (160→128, 200→160, gold 200→320 at Lv1+FL) from `spikes/ocr/`.

## 7. Data / integration
- Reuse `src/sim/` engine + **M4's Δ-L cache**; the `CmPlan` is an **optional** context source (course/stats pre-fill), never the candidate source.
- **Veteran roster** (UmaExtractor import) **shared with M1**; M2 adds user **`tags: string[]`** on roster entries for search + compare-opponent picking — persisted with the roster.
- Discount + gold rules from `mechanics-notes §7/§10` (additive Fast Learner, gold = base + white prereq). Gold⇒white prereq from `SkillRecord.prereqSkillId`.
- **M3 phase-2** consumes `evalSkillDelta` (the sim re-parameterization loop).

## 8. Out of scope / later
- File/API extraction of the skill screen → **not pursued** (unavailable on Global; ToS/ban-risk; §3.2).
- No live in-game integration (read the screen by OCR/hand).
- **Scroll-sync video capture (§3.4) → designed, deferred** to a later phase (after single-shot OCR + the core optimizer ship).
- Multi-uma / team SP planning (single runner per plan).
- Auto-detecting hint levels from skill-row icons (manual/`screenSpCost` covers it for now).

## 9. Risks
- **Engine vendoring** (shared with M4/M1/M3) is *the* dependency — M2 is thin on top.
- **Δ L noise + K full-build sims** → enough Monte-Carlo + cache; show streaming convergence; K=3 keeps sim cost bounded.
- **Diversity vs quality** — the ≥2-skill diversity filter must not surface a much-worse build as "an option"; cap the K builds within a max-bashin-gap band of the optimum (configurable).
- **OCR on non-HDR/phone** — unvalidated source; normalize + add a fixture before trusting (§3.3).
- **"Emergent profile" honesty** — only label a build's survivability/spurt character to the extent the sim telemetry supports it; never fabricate a profile (P3).

## 10. Milestones
1. **Core** `spOptimizer.ts` — `effectiveSpCost` (additive FL + gold bundle), `topKBaskets` (DP + diversity) + tests (greedy counterexample, pins, prereqs, diversity, cost-rule reproduction).
2. **`evalSkillDelta` + per-build sim** via the vendored engine/worker (shared with M4) + cache + emergent-profile extraction.
3. **Input** — Manual entry form + OCR-assist (port `spikes/ocr/` into a `tesseract.js` WASM in-browser flow with confirm; **per-platform crop profiles**; preserve aptitude marks in the matcher) + optional pre-fill.
4. **UI** — pin/lock table + the 3 build cards (sim + profile) + SP bar.
5. **Compare panel** — engine uma-vs-uma build-vs-veteran + roster **tags / search**.
6. **Validation** vs VFalator (≥3 skill deltas + a head-to-head spot-check) + the cost-rule reproduction check.
7. **(Deferred) Scroll-sync video capture (§3.4)** — PC live `getDisplayMedia` + file, iPhone record-then-import; frame-sample → viewport-locate → OCR → stitch/dedup → confirm. Spike in `spikes/ocr/video-sync/` first.

> M2 is the **last module**. Per Sun's "brainstorm each module first," all four specs now fold into **one engine-first implementation plan** (writing-plans) after this review.
