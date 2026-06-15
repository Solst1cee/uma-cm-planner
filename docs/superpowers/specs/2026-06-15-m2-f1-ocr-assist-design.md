# M2 · F1 — OCR-assist Input: Design Spec

**Status:** Approved (2026-06-15) · **Owner:** Sun
**Origin:** Brainstorm (superpowers:brainstorming), implementing follow-up **F1** of [`2026-06-14-m2-sp-optimizer-design.md`](2026-06-14-m2-sp-optimizer-design.md) §3.3. Builds on the validated spike `spikes/ocr/` (gitignored). **An optional image → pre-filled-form path** for the M2 SP optimizer: drop a screenshot of the post-run "Learn" screen; OCR matches skill *names* to the dataset and reads *available SP*; it pre-fills the existing manual form; you confirm/correct every value and Analyze.

---

## 1. Problem & boundary
The M2 MVP requires typing every learnable skill + SP by hand. F1 removes most of that typing for users who can screenshot the in-career skill-purchase screen — **without** trusting OCR'd numbers. It is **assistive and optional**: the manual path (M2 MVP) always remains; OCR is a pre-fill front-end to the same form, and **every value is confirm-on-entry**.

**Reconciling the spike with the M2 cost rule.** The spike takes skill *cost from the dataset* (to dodge digit-OCR); the M2 spec §2 locks *cost from the screen*. F1 bridges them: OCR yields the **name** → the dataset gives a **base-cost estimate** as the editable starting value → **you correct it to the real on-screen cost** before Analyze. OCR never reads cost digits.

**Single-shot only.** Scroll-sync video capture is **F4** (M2 spec §3.4), out of scope here.

## 2. Decisions (locked)
- **Names, not numbers.** OCR reads skill names (fuzzy-matched to the 578-skill dataset) and the *one* number it's good at after preprocessing — **available SP** — which is human-confirmed. Costs are never OCR'd.
- **Pre-fill the existing form.** OCR is a front-end that populates the existing `BuildContextForm`'s candidate rows + available SP; the user reviews/corrects in that same form (single confirm surface). F1 upgrades the form to **editable, named candidate rows** (name via `skillById`, editable cost, remove button, OCR confidence-tier badge) — which also closes the "no remove button / no name display" gaps the M2 review flagged.
- **Cost pre-fill = dataset base, flagged.** Each matched skill's editable cost is pre-filled with its dataset `baseSpCost`, labelled an *estimate to correct against the screen*. **No hint / Fast-Learner UI in v1**; the `effectiveSpCost` smarter estimate is deferred.
- **Both platforms.** Ship landscape (Steam) + portrait (mobile) **crop profiles**, auto-selected by image aspect ratio. Each is manually re-validated against its `shots/` during the build.
- **tesseract.js WASM, in-browser, lazy, local-first.** Run OCR in a Web Worker; **dynamic-import** the engine only on first OCR use (it's a multi-MB WASM bundle) so the main bundle isn't bloated; **host the WASM + `eng` traineddata locally** (no CDN fetch — P2).
- **Matcher fix: preserve aptitude marks.** The spike's matcher strips `○`/`◎`/`●`, collapsing distinct same-base-name skills (e.g. `Tokyo Racecourse ○` ≠ `◎`). F1's matcher keeps the mark as a disambiguator.

## 3. Architecture — units with clear boundaries

### 3.1 Pure core (CI-tested, P6)
- **`src/core/skillMatch.ts`** — port of `spikes/ocr/lib/match.mjs`. `normalize(s)` + `matchSkill(text, skills, opts?) → { query, best, tier: 'high'|'med'|'low', candidates }` (Sørensen–Dice on character bigrams). **Takes the skills array as an argument** (no JSON read — pure core; the data layer supplies `useGameData().skills`). Tiers: high ≥ 0.85, med ≥ 0.6, low < 0.6 (reject low). **Aptitude-mark handling:** `normalize` maps `○`/`◎`/`●`/`◯` to distinct tokens (not stripped) so same-base skills are distinguishable; mark agreement breaks near-ties.
- **`src/core/cropProfiles.ts`** — proportional region math. `selectProfile(width, height) → 'landscape' | 'portrait'` by orientation: `width ≥ height` → landscape, else portrait (Steam landscape ≈ 1573×855; mobile portrait ≈ 1206×2622). `regionsFor(width, height, profile) → { panel: Rect, sp: Rect }` where `Rect = { left, top, width, height }` in pixels, computed from per-profile W/H fractions. Pure, unit-tested (assert rects for known resolutions).

### 3.2 OCR pipeline (`src/features/sp-optimizer/ocr/`, browser; manual-validated)
- **`imagePrep.ts`** — Canvas 2D replacements for `sharp` (the spike's `preprocessPanel`/`readSp`): `cropToCanvas(img, rect)`, `greyscale(imgData)`, `upscale(canvas, factor)`, `normalise(imgData)`, `contrast(imgData, mul, add)`, `threshold(imgData, t)`. Pure `ImageData` transforms where possible (greyscale/normalise/contrast/threshold are unit-testable on synthetic `ImageData`).
- **`ocrEngine.ts`** — lazy `import('tesseract.js')`, a reusable Worker, `recognize(source, { psm, whitelist }) → { text, words, lines, confidence }`. Disposes the worker when idle.
- **`readSkillScreen.ts`** — the orchestrator (port of `analyze.mjs`): `readSkillScreen(image, deps) → Promise<OcrResult>` where `OcrResult = { availableSp: number | null, spConfidence: number, matches: OcrMatch[] }` and `OcrMatch = { skillId, nameEn, baseSpCost, rarity, tier, ocrText }`. Steps: decode image → `(W,H)` → `selectProfile` → `regionsFor` → crop panel + SP → preprocess → OCR (panel: PSM 3; SP: PSM 6 + digit whitelist on a `threshold(185)` crop) → `lineify` → strip stray digits/`sp` tokens → `matchSkill` per line (keep high/med) → assemble. `deps` (the OCR + match fns) are injectable for tests.

### 3.3 UI
- **`OcrDropZone.tsx`** — a drag-drop / file-input zone on the SP-optimizer page. On a dropped image: shows a spinner, runs `readSkillScreen`, then calls `onResult({ candidates: BuyableSkill[], availableSp })`. Renders per-skill confidence tiers and an overall "review every value" note.
- **`BuildContextForm` enhancement** — accept optional `initialCandidates` + `initialSpBudget`; render each candidate as an **editable row**: resolved name (`skillById.get(id)?.nameEn`), editable cost input (flagged "base — set to screen value"), remove button, and (for OCR-sourced rows) a tier badge. Manual add still works. The OCR result simply seeds these rows.

## 4. Data flow
`drop image → readSkillScreen → { availableSp, matches[] } → onResult → BuildContextForm pre-filled (named rows + base-cost estimates + SP) → user confirms/corrects every value → emit CaptureBundle (source: 'ocr') → rankBaskets` (the M2 core/orchestrator are **unchanged**; only `source` differs).

## 5. Crop profiles
Proportional regions = fractions of (W, H), so they track resolution (validated HDR/non-HDR identical on landscape). Constants:
- **Landscape** (validated, from `analyze.mjs`, calibrated on 1573×855): `panel = (0.140, 0.368, 0.292, 0.404)`, `sp = (0.346, 0.306, 0.086, 0.051)` as `(fLeft, fTop, fWidth, fHeight)`.
- **Portrait** (mobile): the spike confirmed names read 93–95% on iPhone 1206×2622 with a portrait profile, **but the exact fractions must be calibrated from `spikes/ocr/shots/iPhone/` during implementation** (validated-to-work, constants TBD-by-calibration — a build task, not a design gap).
- `--crop` override (spike) → a manual region override is a nice-to-have, not required for v1.

## 6. Preprocessing (sharp → Canvas)
Per the spike, accuracy depends on preprocessing. Canvas equivalents to port + their validated params:
- **Panel (names):** crop → greyscale → upscale ×3 (width) → normalise → contrast `linear(1.2, −12)` → sharpen (3×3) → OCR PSM 3.
- **SP pill (digits):** crop → greyscale → upscale ×7 → normalise → **`threshold(185)`** → OCR PSM 6 + whitelist `0123456789` → first `\d{3,5}` match.
**Risk:** Canvas won't be byte-identical to `sharp` (esp. `sharpen`/`normalise`); re-validate per profile and tune. `sharpen` may be approximated or dropped if it doesn't move accuracy.

## 7. Testing
- **CI (pure, committed):** `skillMatch` (the spike's 10 OCR-mangled-name cases reproduced + the aptitude-mark disambiguation + garbage→`low` rejected), `cropProfiles` (region math + aspect-ratio selection at known resolutions), `imagePrep` (greyscale/threshold/normalise on synthetic `ImageData`), and the form pre-fill wiring (RTL; mock the OCR service so no WASM/image is needed).
- **Manual (not CI, documented):** the full WASM + Canvas pipeline re-validated against the gitignored `spikes/ocr/shots/` (landscape + portrait) — reproduce the spike's reads (SP `2285`; the matched skill set per scroll). **Personal screenshots are never committed.** Procedure + acceptance recorded in `docs/mechanics-notes.md` (or a sibling validation note).

## 8. Local-first & dependencies (P2)
- Add **`tesseract.js`** (^5) to the app. **Host its assets locally:** the WASM core + `eng.traineddata` (gzipped) served from `public/` (or bundled), with the worker configured to load from those local paths — **no runtime CDN fetch** (P2). Document the asset-vendoring step (a `scripts/` copy or a build step), and that this adds ~a few MB of static assets fetched **only when OCR is first used** (lazy).
- No other new runtime deps; Canvas + `FileReader`/`createImageBitmap` are browser built-ins.

## 9. Honest numbers (P3)
- OCR is assistive; **everything is confirm-on-entry.** Names carry confidence tiers (low rejected, med/high shown with the badge). Available-SP is human-confirmed (portrait SP read is fragile → flagged low-confidence). Costs are dataset-base **estimates** you correct to the screen.
- The matcher can mis-match a med-tier name → the editable named row + the dataset autocomplete let you fix it.

## 10. Out of scope (F1)
- **Scroll-sync video capture** → **F4** (M2 §3.4).
- **`effectiveSpCost` smarter cost estimate** (hint/Fast-Learner-aware) — deferred; v1 pre-fills raw base.
- **Auto-detecting hint levels** from row icons.
- **`--crop` manual override UI**, camera-photo deskew/tone-normalise (only screen captures in v1).
- The M2 core/orchestrator/persistence — **unchanged** by F1.

## 11. Risks
- **Canvas ≠ sharp preprocessing** → accuracy regression; mitigated by per-profile manual re-validation + tuning (§6).
- **tesseract.js bundle/asset weight** → mitigated by lazy dynamic-import + local asset hosting; OCR users pay the download once.
- **Portrait calibration** → the exact crop fractions need extracting from the iPhone shots; the approach is validated, the constants aren't yet pinned.
- **Aptitude-mark OCR reliability** → the mark itself may mis-read; treated as a tie-breaker, not a hard filter, and the user can correct the row.

## 12. Milestones (for writing-plans)
1. **`skillMatch.ts`** (port + aptitude-mark fix) + tests.
2. **`cropProfiles.ts`** (landscape constants + aspect selection) + tests.
3. **`imagePrep.ts`** Canvas ops + `ImageData` tests.
4. **`ocrEngine.ts`** (lazy tesseract worker) + **local asset vendoring**.
5. **`readSkillScreen.ts`** orchestrator (injectable deps) + a unit test with a fake OCR/match.
6. **`OcrDropZone.tsx`** + **`BuildContextForm` editable-rows enhancement** + tests; wire into `SpOptimizerPage` (source: 'ocr').
7. **Portrait calibration** (extract fractions from iPhone shots) + **manual validation** against `shots/` (both profiles); record the procedure + results.

> F1 ships the OCR-assist input. F2 (compare-vs-veteran), F3 (pre-fill), F4 (video-sync) remain separate follow-ups.
