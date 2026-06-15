# Module 2 — SP Purchase Optimizer: Design Spec

**Status:** Approved (rev. 2026-06-15b — v1 MVP scope locked, ranking finalized to the adaptive hybrid, cost-calc/M4 work removed from M2) · **Owner:** Sun
**Origin:** Brainstorm (superpowers:brainstorming), building on plan §8. **The post-run decision tool** — you're standing on the skill-purchase screen with a fixed SP pool; M2 reads what's actually in front of you, lets you lock the certain buys, then finds the best ways to spend the rest and **sims a few of them so you can pick**.

---

## 1. Problem & boundary
End of a run you have limited SP and can afford **fewer** skills than are offered. M2 solves the **basket**: given your actual post-run build + SP budget + the buyable skills on screen, search for the subsets that **maximize the build's expected length** (E[L], in bashin) — but instead of one answer, it surfaces **~3 strong, genuinely different builds**, **simulates each** (VFalator-style), and lets you **choose**. Umalator ranks *single* skills; nobody solves the *budgeted basket*, let alone offers diverse simmed alternatives. **Plus a decision aid:** head-to-head **compare** a chosen build against an **existing veteran** — *"is this run actually better than my last CM12 ace?"* — before you spend.

**Boundary vs M4:** M4 is the *pre-run ideal* planner (discovery + coverage, no SP limit, plan-time estimates). **M2 is the *post-run actual*** — it reads the real screen (your real stats, real SP, the real learnable list with the real effective costs that already bake in your hints + Fast Learner). **M2 does not depend on M4** (see §3).

## 2. Decisions (locked)
- **Input = the post-run screen in front of you** (OCR or manual), **not** an M4 carry. M4 carry is an *optional* pre-fill convenience, never required (§3). The live screen is the source of truth.
- **Costs come from the screen** (the real effective cost you'll pay), not from dataset base costs — post-run, your actual hint levels + Fast Learner are already applied and the dataset can't predict them. The dataset is used to **identify** the skill (name → effect → L-sim), not to price it.
- **Reuse the vendored umalator engine** (`src/sim/`) for **Δ L per skill** and **per-build race sims** — the same Monte-Carlo as M4.
- **Lock / pin must-buys** → forced into every build (SP deducted first; a pinned gold pulls in its white prereq); the optimizer spends the **remaining** SP over the **remaining** candidates. **Locking is algorithmically central: it collapses the basket search space enough to *simulate combinations directly* (exact ranking), not merely score them by proxy (§4).**
- **Output = top-3 near-optimal + diverse baskets**, each **simulated**, **ranked on simulated combined L** (win-rate / mean bashin), annotated with the *emergent* profile the sim reveals (where the length comes from — early vs late, stamina margin). You choose. **The simulator is the arbiter — single-skill Δ L is only a proxy to narrow the search, never to rank** (skills interact; Δ L is non-additive).
- **Build comparison (VFalator-style):** reuse the engine's **uma-vs-uma** mode (`vacuum-compare`) to race a chosen build head-to-head vs a **veteran** → win-rate + bashin gap.
- **Veteran roster + tags:** the UmaExtractor roster (shared with M1) is searchable and **taggable** (e.g. "CM12") to pick the compare opponent.
- **OCR is a first-class input** to the module — validated on real screenshots (§3) — always with **manual entry + confirm**, because the numbers are yours to verify. *(Sequencing: the v1 MVP ships **manual entry first**; OCR-assist is the immediate follow-up **F1** — see §2a.)*
- **The capture is a serializable `CaptureBundle` JSON** (§3): the single artifact **every** import path (manual / OCR / video) emits and the analysis consumes — saved locally (Dexie + JSON export/import, P2) and reused as the **test-fixture** unit. **Results are derived** from `bundle + seed`, never persisted stale; **images are process-and-discard; nothing is uploaded.**

## 2a. v1 (MVP) scope & follow-up plans
M2 is sliced so the **first plan lands a usable artifact** (plan §11), with the rest designed here but built later.

**Plan #1 — Manual-input MVP (the usable artifact):** *hand-enter the post-run screen (candidates + each on-screen cost + available SP + build context) → **3 simmed, diverse baskets ranked on simulated combined L**, each with SP used/left + a best-effort profile.* Units: `spOptimizer.ts` core, the sim layer (`evalSkillDelta` + per-build sim + the M2-scoped cache + `?worker` validation), the manual entry form, the `src/features/sp-optimizer/` UI (pin/lock table + 3 build cards + SP bar), a local **`CaptureBundle`** store (Dexie) + JSON import/export, and the validation gate (§6). **No cost calculation, no `cost.ts`, no shipped-M4 changes** — costs come from the screen (§2, §4). The analysis reads a **`CaptureBundle`** (§3), so the optimizer/sim are testable from hand-written JSON fixtures without live capture.

**Follow-up plans (designed here, built later):**
- **F1 — OCR-assist input** (§3.3): port `spikes/ocr/` into a `tesseract.js` in-browser flow, per-platform crop profiles, confirm-on-entry. The `effectiveSpCost` *fallback estimate* (for a digit OCR failed to read) appears **only** here.
- **F2 — Compare vs veteran** (§5.1): the `RosterEntry` Dexie store + user `tags` + the engine uma-vs-uma panel. This plan **creates the roster store** to the `2026-06-15-shared-data-model.md §5` shape (ownership stays M1's domain; creation is **not** gated on M1 shipping).
- **F3 — Pre-fill** (§3.1.3): optional `CmPlan`/roster pre-fill of stats/aptitudes/course/strategy; pulls in the canonical-`CmPlan` transcription + the M4 `CmPlan` migration.
- **F4 — Scroll-sync video capture** (§3.4).

**Explicitly independent of M2:** the M4 multiplicative-Fast-Learner / gold under-pricing cost bug (`coverage.ts`, `mechanics-notes §10(7,8)`) is a real fix but **not an M2 dependency** — tracked for a separate M4 pass.

## 3. Inputs — the post-run build context

> **Canonical shared types** (`CmPlan`, `Stat`, `RosterEntry`) live in [`2026-06-15-shared-data-model.md`](2026-06-15-shared-data-model.md); the veteran compare-opponent + tags use `RosterEntry`. `BuildContext` is M2-local.
`BuildContext { umaId, stats, aptitudes, strategy, courseId, spBudget, candidates: BuyableSkill[], pinned: skillId[] }`; `BuyableSkill { skillId, rarity, screenSpCost, hintLevel?, prereqSkillId? }` — `screenSpCost` is the **effective** cost as shown/entered (already discounted).

**The capture is a serializable JSON artifact — `CaptureBundle`.** All three load paths (§3.1) **converge on and emit one JSON document**, which the analysis engine then consumes (it never cares how the bundle was produced — §3.4 already routes every input through the same `BuyableSkill[]`):
```
CaptureBundle { schemaVersion, source: 'manual' | 'ocr' | 'video',
                capturedAt, server, dataVersion, seed?, context: BuildContext }
```
Making the **import ↔ analysis boundary** an explicit artifact buys three things: (1) **persistence + portability** — bundles are saved locally (Dexie) and **JSON file export/import** (P2), so a run can be reopened or shared; (2) **fixture-driven testing (P6)** — a committed **corpus of hand-written bundles** drives the optimizer/sim with **zero live capture**, so dev/validation never needs a real post-run screen; (3) **reproducibility** — with the stored `seed`, the Monte-Carlo sim is deterministic, so `bundle + seed` always yields the same baskets (stable test assertions, honest re-runs). The **capture is the saved source of truth; analysis results are derived** (recomputed from `bundle + seed`, optionally cached) so nothing stale is ever persisted.

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
  - **Hands-free auto-scroll (PC — the goal; needs a native companion).** Desired flow: open the in-career skill screen, **click once**, and the app **captures the game window and auto-scrolls it at a controlled, OCR-friendly speed** so you never scroll by hand (speed adjustable → reliable row sampling). **Honest constraint (P3):** a pure browser web app **cannot** do the scroll half — `getDisplayMedia()` is **capture-only** (read-only), and browsers are sandboxed from injecting scroll/keyboard/mouse input into another application. Auto-scroll therefore requires a **native companion** — a desktop **Electron/Tauri** build, or a small local **AutoHotkey**-style helper — that drives the game's scrollbar while the web layer captures + OCRs frames. That is **beyond the local-first pure-web boundary (P2)** → a **separate, opt-in desktop track, deferred past the web MVP** (within F4). Until then, web-only PC uses the **manual-scroll** capture above (you scroll slowly; the app paces frame sampling and coaches speed).
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

## 4. The math — basket ranking by the adaptive hybrid

**Principle: the simulator is the arbiter; single-skill Δ L is only a proxy to narrow the search; locking makes a true ranking tractable.** Skill values are **non-additive** (a recovery skill only matters if your other picks leave you stamina-starved; two same-phase speed skills have diminishing returns), so the only honest score for a *combination* is a full-build sim of that exact combination — summed single-skill Δ L is not it. You cannot sim all `2^N` affordable subsets, so **locking** (the pin step you're doing on-screen anyway) is what shrinks the residual to something simulable.

**Inputs are costs, not calculations.** Each candidate's cost is the entered/OCR'd **`screenSpCost`** (already effective — your real hints + Fast Learner are baked in by the game). The manual MVP does **no** SP-cost arithmetic. *(Only the OCR follow-up F1 needs a fallback for a digit it failed to read: `effectiveSpCost(base, hintLevel, fastLearner)` — additive hint%+FL, one multiply, `ceil`; gold = base + bundled white prereq — per `mechanics-notes §7/§10`, flagged as an estimate. Not part of v1.)*

**The adaptive hybrid — `rankBaskets(cands, budget, pinned, K=3)`:**
1. **Lock** must-buys → deduct their SP, pull each pinned gold's white prereq in as one item → residual budget `B'` + residual candidates. Locking collapses the search space — that is what makes step 2 exact.
2. **Enumerate** the prereq-closed candidate subsets that fit `B'`. **If the count ≤ a configurable threshold** (the normal locked case; ballpark ≤ a few hundred subsets, tuned at validation): **full-build sim every one** → an **exact** ranking, with no additivity assumption anywhere.
3. **Else (under-locked / large budget):** compute single-skill **`evalSkillDelta`** per residual candidate (the same values shown in the L/SP table), use them only to **shortlist ~15–20** promising, mutually-diverse, budget-feasible baskets, then **full-build sim the shortlist.**
4. **Select the top-3** that are mutually **diverse** (each differs by **≥2 skills**) and within a **max-bashin-gap band** of the optimum (configurable, so a much-worse build is never shown as "an option") — **ranked on simulated combined L** (win-rate / mean bashin), **never on the proxy.** The UI labels the result *exact* (step 2) vs *shortlisted-estimate* (step 3), P3.

**Engine primitives (wrap `src/sim/`):**
- **`evalSkillDelta(build, course, skillId, n) → BashinStats`** — with-vs-without Monte-Carlo Δ L on the **actual** build/course; powers the L/SP table and the step-3 shortlister. **M2-scoped cache** keyed `(buildHash incl. the owned-skill set, courseId, skillId)` — *not* the shared `makeDeltaCache` (unsafe across differing loadouts); opportunistically reuse M4's single-skill cache only on an exact build match.
- **Per-build sim + profile** (`runPlannerCompare`) — a full race sim per basket → **mean bashin, win-rate**, and a best-effort **emergent profile** from engine telemetry (where the gain lands — early/mid/late, stamina margin, spurt presence). **Only labelled to the extent telemetry supports it; never fabricated** (P3); cards fall back to bashin/win-rate alone when telemetry is thin.
- **`compareBuilds(buildA, buildB, course, n) → CompareResult`** *(follow-up F2, not v1)* — wraps the engine's **uma-vs-uma** sim (`vacuum-compare` / `runComparison`) → win-rate + bashin gap + distribution. Races a chosen build vs a veteran.

**Code boundary (P6):** `rankBaskets` is the **sim-layer orchestrator** (it drives the engine through steps 1–4). The pure, **sim-free** pieces it coordinates live in **`src/core/spOptimizer.ts`** — `BuyableSkill` / `BuildContext` / `Basket` types, prereq-closed subset enumeration, the Δ L shortlister, and the diversity/band filter — each taking per-skill / per-basket **scores as inputs**, so the core is fully unit-testable without the engine. `evalSkillDelta` + the per-build sim live in the sim layer (worker glue) and feed those scores in.

## 5. UI (mockup `m2-sp-optimizer.html` — to revise)
- **Build & SP bar:** input mode (Manual / OCR / pre-fill), build chips (uma · course · strategy · final stats), **editable available-SP**.
- **Buyable-skills table:** per row — **📌 pin** (must-buy), skill (rarity colour + effect badges), type, **Δ L**, **on-screen SP cost** (editable), **L / SP** (×1k), and the **L/SP + hint** info. Pinned rows lift to the top and pre-spend their SP.
- **The 3 build cards (headline):** for each of the top-3 diverse baskets — the skill list (pinned shown locked + the optimizer's picks), **SP used / left**, **mean bashin + win-rate**, and a short **profile tag** the sim revealed (e.g. "more stamina margin", "stronger final spurt", "highest raw speed"). One-click **"Compare this vs veteran"** *(F2)*. Just-missed skills greyed below each.
- **Compare vs veteran panel** *(F2)* (§5.1).
- **P3 caveat banner:** the sim can't see positional chaos — estimate, not verdict; test in room.

## 5.1 Compare vs existing veteran (decide before buying)
- Race a chosen build (one of the 3) head-to-head vs a **veteran** from your roster on the CM course — the engine's VFalator-style **uma-vs-uma** sim → **win-rate + mean bashin gap** (+ distribution).
- **Pick the opponent:** **search + tag-filter** your roster (UmaExtractor import, shared with M1). **Tags** are free-text (e.g. "CM12", "dirt ace") so you can pull up "my last CM12 ace" instantly.
- Also supports **build-A vs build-B** (compare two of the three) and **basket-on vs basket-off**, but **vs-veteran is the headline** — *"is this build worth running over the one I already have?"*
- **Honest (P3):** head-to-head bashin / win-rate is a strong prior, not a guaranteed match outcome (positional-chaos caveat).

## 6. Honest numbers (P3)
- L is a streaming estimate; each basket is a **strong prior**, not a verdict (caveat banner). The 3 builds are *options*, ranked by sim — you decide.
- **Validation (Plan #1 gate):** single-skill Δ L within noise of VFalator for **≥3 spot-checked skills** (plan §8); the `spOptimizer` core **respects budget + pins + prereqs, returns ≥2-diverse baskets, and beats greedy** on a counterexample, and the **exact branch (step 2) matches brute force** on a small fixture; final ranking is on **simulated combined L**. *(The additive-FL + gold-premium cost-rule reproduction — 160→128, 200→160, gold 200→320 at Lv1+FL from `spikes/ocr/` — moves to **F1 / the separate M4 fix**, since v1 reads costs from the screen.)*
- **Fixture-driven (P6):** the optimizer + sim are tested against a **committed corpus of hand-written `CaptureBundle` JSONs** (in the source tree, e.g. `src/core/__fixtures__/m2/`) with a **fixed seed** → deterministic, no live capture needed. *(Real personal captures stay in gitignored `spikes/samples/m2/`.)*

## 7. Data / integration
- Reuse the `src/sim/` engine; M2 uses its **own basket-scoped Δ-L cache** (the shared `makeDeltaCache` is unsafe across differing owned-skill sets), reusing M4's single-skill cache only on an exact build match. The `CmPlan` is an **optional** context source (course/stats pre-fill, F3), never the candidate source.
- **Veteran roster** (UmaExtractor import) **shared with M1** (F2); M2 adds user **`tags: string[]`** on roster entries for search + compare-opponent picking — persisted with the roster.
- **Persistence (local-only, P2).** The unit of save is the **`CaptureBundle`** (§3) — stored in a Dexie M2 store + **JSON file export/import**, so a run can be reopened/replayed/shared. **Images are never persisted** (OCR/video decode → extract → discard); **nothing is ever uploaded** (static site, no backend/telemetry). Analysis **results are derived**, not the source of truth — recomputed from `bundle + seed` (optionally cached for quick reopen).
- **Cost rules are not used in v1** (costs come from the screen). The additive-FL + `gold = base + white-prereq` rules (`mechanics-notes §7/§10`; gold→white via `SkillRecord.prereqSkillId`) are needed only by the **F1 OCR fallback estimate**. The M4 `coverage.ts` cost bug is a **separate** M4 fix, not an M2 dependency.
- **M3 phase-2** consumes `evalSkillDelta` (the sim re-parameterization loop).

## 8. Out of scope / later
- File/API extraction of the skill screen → **not pursued** (unavailable on Global; ToS/ban-risk; §3.2).
- No live in-game integration (read the screen by OCR/hand).
- **Scroll-sync video capture (§3.4) → designed, deferred** to a later phase (after single-shot OCR + the core optimizer ship).
- Multi-uma / team SP planning (single runner per plan).
- Auto-detecting hint levels from skill-row icons (manual/`screenSpCost` covers it for now).
- **SP-cost calculation in v1 / the M4 `coverage.ts` cost fix** → not M2's job; v1 reads costs from the screen, and the M4 bug is a separate M4 pass (§7).

## 9. Risks
- **Engine vendoring** (shared with M4/M1/M3) is *the* dependency — M2 is thin on top.
- **Δ L noise + full-build sim budget** → the exact branch sims every feasible residual subset (bounded by the lock-threshold), the shortlist branch sims ~15–20; enough Monte-Carlo + the M2-scoped cache keep it tractable; show streaming convergence. **Locking is the primary lever** that keeps the exact branch cheap.
- **Diversity vs quality** — the ≥2-skill diversity filter must not surface a much-worse build as "an option"; cap the K builds within a max-bashin-gap band of the optimum (configurable).
- **OCR on non-HDR/phone** — unvalidated source; normalize + add a fixture before trusting (§3.3).
- **"Emergent profile" honesty** — only label a build's survivability/spurt character to the extent the sim telemetry supports it; never fabricate a profile (P3).

## 10. Milestones

**Plan #1 (the Manual-input MVP, §2a):**
1. **Core** `spOptimizer.ts` — `BuyableSkill`/`BuildContext`/`Basket` + the serializable **`CaptureBundle`** types, prereq-closed subset enumeration, the Δ L shortlister, and the diversity/band filter. **Sim-free, scores-as-input.** Tests (fixture `CaptureBundle`s, fixed seed): greedy counterexample, pins, prereq bundling, budget respected, ≥2-diversity, band cap, and **exact == brute force** on a small fixture.
2. **Sim layer** — `evalSkillDelta` + per-build sim (`runPlannerCompare`) via the vendored engine/worker (shared with M4) + the **M2-scoped cache** + best-effort emergent-profile extraction; **fixed-seed determinism** for tests; validate the production `?worker` path (first real `SimClient` import).
3. **Manual input + persistence** — entry form (skill autocomplete vs the 578-skill dataset; editable on-screen costs + available SP + build context: uma/course/strategy/final stats/aptitudes) that **emits a `CaptureBundle`**; save/load bundles via the Dexie M2 store + **JSON file import/export**. *(OCR is F1, which emits the same bundle.)*
4. **UI** `src/features/sp-optimizer/` — pin/lock table + the 3 build cards (sim + profile + *exact/estimate* label) + SP bar; reuse `GameIcon`; enable the disabled `App.tsx` nav stub.
5. **Validation (gate, §6)** vs VFalator (≥3 single-skill Δ L within noise) + the adaptive-branch correctness check; record outcomes in `docs/mechanics-notes.md`.

**Follow-up plans:** **F1** OCR-assist (port `spikes/ocr/` → `tesseract.js` in-browser, per-platform crop profiles, confirm-on-entry, preserve aptitude marks; adds the `effectiveSpCost` fallback) · **F2** compare-vs-veteran (`RosterEntry` store + `tags` + engine uma-vs-uma panel) · **F3** optional `CmPlan`/roster pre-fill (+ canonical-`CmPlan` transcription + M4 `CmPlan` migration) · **F4** scroll-sync video capture (§3.4; spike `spikes/ocr/video-sync/` first).

> M2 is the **last module to design**. With all four specs now brainstormed, the **v1 MVP (Plan #1, §2a)** is what goes to **writing-plans** next; F1–F4 and the other modules each follow as their own plans.
