# M2 · F1 — Capture Import (CaptureBundle JSON) + native-companion contract

**Status:** Approved (rev. 2026-06-15b — re-architected: web imports a CaptureBundle JSON; OCR/capture/resize/scroll move to a separate native companion) · **Owner:** Sun
**Origin:** Brainstorm (superpowers:brainstorming), follow-up **F1** of [`2026-06-14-m2-sp-optimizer-design.md`](2026-06-14-m2-sp-optimizer-design.md) §3.3. Earlier rev designed in-browser OCR; revised because a browser **cannot resize or scroll the game window**, so the real capture convenience belongs in a native PC companion (UmaExtractor pattern) that emits a **`CaptureBundle` JSON** this web app imports.

---

## 1. Problem & boundary
The M2 MVP requires typing the post-run skill screen by hand. F1 adds a **file-import path**: a `CaptureBundle` JSON (produced by a native companion — or any source) is dropped into the app, which validates it and pre-fills the editable form for confirm-on-entry, then Analyze.

**Why a native companion, not in-browser OCR.** A browser web app is sandboxed: it cannot **resize the game window to a fixed preset** (which is what makes crops consistent) nor **auto-scroll** the skill list (needed to capture the full list) — `getDisplayMedia` is capture-only and there is no web API to control another app's window/input. Those are exactly the conveniences worth having, and they are only possible in a **native program** (like UmaExtractor). So:
- **The native companion** (a *separate project/repo*, not this web app) owns: window-resize-to-preset → capture (single-shot or scroll-sync) → OCR names + available SP → name→skill match → **emit a `CaptureBundle` JSON**.
- **This web app** owns: **import + validate that JSON → editable form → Analyze.** No OCR, no canvas, no WASM in the web bundle.
- **Manual entry (M2 MVP)** remains the zero-install baseline.

The three M2-spec follow-ups F1 (this), and the capture conveniences formerly in **F4 (video-sync)**, now converge inside the **one native companion**; the web app's only job is to consume its `CaptureBundle` output.

## 2. Decisions (locked)
- **Web = JSON-import only.** No in-browser OCR (`tesseract.js`/canvas dropped). The web F1 deliverable is: import a `CaptureBundle` JSON, validate it, pre-fill the editable form, confirm-on-entry, Analyze.
- **`CaptureBundle` JSON is the contract** (§4). Any producer (native companion, a future tool, a hand-authored file, the app's own export) that emits a valid `CaptureBundle` can feed M2. This is the UmaExtractor → JSON → web-app role, reusing the existing artifact (M2 spec §3).
- **Auto-resize + auto-scroll live in the native companion**, which is **out of scope for this repo** (separate project, native stack). We define its output contract; we don't build it here. (This also absorbs the old F4 video-sync conveniences.)
- **Confirm-on-entry.** Imported candidate rows are editable (name shown, editable cost, remove); the user reviews before Analyze. The companion's matches/costs are best-effort.
- **The validated `spikes/ocr/` approach is the companion's reference design** (§6 appendix), preserved so whoever builds the companion has it — not web-app code.

## 3. Web architecture — units with clear boundaries (all CI-tested)

### 3.1 Pure core
- **`parseCaptureBundle(data: unknown): CaptureBundle`** (in `src/core/spOptimizer.ts`, beside the `CaptureBundle` type) — validates an imported JSON is a well-formed `CaptureBundle`: `schemaVersion === 1`, `source ∈ {manual,ocr,video}`, a `context` with `umaId/stats{spd,sta,pow,gut,wit}/aptitudes/strategy/courseId/spBudget/ownedSkills[]/pinned[]/candidates[]`, each candidate a valid `BuyableSkill` (`skillId:string`, `rarity`, `screenSpCost:number`, optional `prereqSkillId`/`hintLevel`/`matchTier`). Throws a descriptive `Error` on malformed input (mirrors `src/db/exportImport.ts`'s `asArray`/typed-parse discipline). Pure and total otherwise. **This also closes the M2-review "captures import lacks per-field validation" follow-up.**

### 3.2 UI
- **`BuildContextForm` enhancement** — accept `initialCandidates?: BuyableSkill[]` + `initialSpBudget?: number` + `initialCourseId?: string`; render **editable named candidate rows** (name via `useGameData().skillById` + `GameIcon`, editable cost input, remove button, and a `matchTier` badge when present). Manual add still works. `source` is `'ocr'`/`'video'`/`'manual'` per provenance. (Closes the M2-review "no remove button / no name display" form gaps.)
- **Import control on `SpOptimizerPage`** — a file input ("Import capture (.json)"): read the file → `JSON.parse` → `parseCaptureBundle` → pre-fill the form via `initialCandidates`/`initialSpBudget`/`initialCourseId` + a remount `key` (the form is uncontrolled). Show a clear error on a malformed/incompatible file. The page already holds `analyze()`, save/load, etc.

> The imported bundle's `context.candidates` + `spBudget` (+ `courseId`) pre-fill the form. The bundle's other context fields (`stats`/`aptitudes`/`strategy`) are **not** editable in the MVP form, so they fall to the form's defaults — the companion can't read those off the skill screen anyway. Honoring a fuller imported context (real stats/aptitudes) is **F3 (pre-fill)** territory, not F1.

## 4. The `CaptureBundle` JSON contract (for the native companion)
The contract is the **existing `CaptureBundle`** (M2 spec §3; `src/core/spOptimizer.ts`). A companion producing OCR output sets:
```jsonc
{
  "schemaVersion": 1,
  "source": "ocr",              // or "video" for scroll-sync capture
  "capturedAt": "<ISO 8601>",
  "server": "global",
  "dataVersion": "<dataset version it matched against>",
  "seed": 12345,
  "context": {
    "umaId": "",                // unknown from the skill screen → "" (user/F3 supplies)
    "stats":  { "spd": 0, "sta": 0, "pow": 0, "gut": 0, "wit": 0 },  // unknown → 0/defaults
    "aptitudes": { "distance": "A", "surface": "A", "strategy": "A" }, // unknown → "A"
    "strategy": "pace",         // unknown → a default; user confirms
    "courseId": "10101",        // the CM course if known, else a default
    "spBudget": 2285,           // available SP read off the SP pill (REQUIRED, real)
    "ownedSkills": [],
    "pinned": [],
    "candidates": [             // one per learnable skill the companion matched
      { "skillId": "200332", "rarity": "white", "screenSpCost": 110, "matchTier": "exact" },
      { "skillId": "200331", "rarity": "gold",  "screenSpCost": 160, "prereqSkillId": "200332", "matchTier": "fuzzy" }
    ]
  }
}
```
- **What the companion CAN read off the skill screen:** the learnable skill **names** (→ `skillId` via fuzzy match) + their **on-screen SP costs** (or dataset base as a fallback) + **available SP**. These populate `candidates` + `spBudget`.
- **What it CANNOT** (the skill screen doesn't show them): final **stats/aptitudes/strategy/course** — left at defaults; the user confirms/edits (or F3 supplies). `matchTier` records the companion's match confidence for the UI badge.
- `parseCaptureBundle` (web) is the **authoritative validator** of this contract; the companion targets whatever it accepts.

## 5. The native companion (separate project — out of scope here, documented)
Not built in this repo. Documented so it can be built (by Sun or a contributor) to target §4. Its design = the **validated `spikes/ocr/` approach** (§6), now with the two browser-impossible conveniences it can natively do:
- **Resize the game window to a fixed preset** before capture (consistent, calibrated crops — removes the aspect/letterbox fragility).
- **Single-shot OCR** (the validated `analyze.mjs` pipeline) and/or **scroll-sync** (auto-scroll the skill list, stitch frames — the former F4).
- **Emit a `CaptureBundle` JSON** per §4.
Stack is its own choice (Electron/Tauri/.NET/Python+tesseract). License note: tesseract is Apache-2.0 (clean). This app stays local-first and never bundles OCR.

## 6. Appendix — validated `spikes/ocr/` reference design (for the companion)
Preserved from the spike (gitignored `spikes/ocr/`, validated 2026-06-15) so the companion has a proven starting point:
- **Names, not numbers:** OCR the skill name → fuzzy-match (Sørensen–Dice on character bigrams, `lib/match.mjs`, 10/10 mangled names) to the 578-skill dataset; **keep aptitude marks** `○/◎/●` (they distinguish same-base skills). Take cost from the dataset/screen, never from OCR'd cost digits.
- **Available SP** is the one digit-OCR: a tight crop on the orange "Skill Points" pill, greyscale → `threshold(185)` → PSM6 + digit whitelist → 16/16 correct.
- **Proportional crops** (fractions of W/H): landscape `panel=(0.140,0.368,0.292,0.404)`, `sp=(0.346,0.306,0.086,0.051)` (validated 1573×855, HDR/non-HDR identical); a portrait profile for mobile (needs calibration). With native window-resize-to-preset, the companion can pin one known resolution and skip aspect fragility entirely.
- Preprocessing (the spike used `sharp`): greyscale → upscale → normalise → contrast → (sharpen) for names; greyscale → upscale → `threshold(185)` for SP.

## 7. Data flow
`companion (separate) → CaptureBundle JSON file → [web] import → parseCaptureBundle (validate) → pre-fill editable form (candidates + SP + course) → user confirms/corrects → emit CaptureBundle (source preserved) → rankBaskets` (M2 core/orchestrator unchanged).

## 8. Testing (all CI — no WASM/canvas in the web app)
- `parseCaptureBundle`: valid bundle round-trips; each malformed case (wrong `schemaVersion`, missing `context`, bad `candidates`, non-string `skillId`, etc.) throws a descriptive error; tolerant where the M2 spec allows.
- `BuildContextForm`: `initialCandidates`/`initialSpBudget` pre-fill + editable rows + remove + `source` provenance (extends the existing tests).
- Import UI on `SpOptimizerPage`: a dropped valid JSON pre-fills the form; a malformed JSON shows an error (mock the file read; RTL).
- **No manual-validation gate** (the OCR pipeline is not in this repo).

## 9. Honest notes (P3)
- Imported names/costs are **confirm-on-entry** (companion matches are best-effort; the `matchTier` badge flags fuzzy ones).
- The companion can't read sim-context (stats/aptitudes/strategy/course) off the skill screen → those stay at form defaults until the user edits them (or F3). available-SP is the one real number it captures.

## 10. Out of scope (F1)
- **In-browser OCR** (tesseract.js/canvas) — moved to the native companion.
- **The native companion itself** — separate project/repo (§5); we publish the contract only.
- **Scroll-sync video** — also the companion's job (was F4).
- **Full context pre-fill** (stats/aptitudes editing) — **F3**.

## 11. Milestones (for writing-plans)
1. **`parseCaptureBundle`** validator (pure) + tests.
2. **`BuildContextForm`** editable named rows + `initialCandidates`/`initialSpBudget`/`initialCourseId` + remove + `matchTier` badge + `source` provenance; update/extend tests.
3. **Import control** on `SpOptimizerPage` (file → parse → pre-fill via remount key) + tests; CSS.
4. **Document the companion contract** (§4) in `docs/provenance.md` or a sibling `docs/capture-bundle-contract.md` so the separate companion project can target it.

> F1 ships the JSON-import path + the contract. The native companion is a separate effort. F2 (compare-vs-veteran), F3 (pre-fill incl. stats) remain follow-ups.
