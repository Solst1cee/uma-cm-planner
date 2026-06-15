# M2 · F1 — OCR-assist Input: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional image → pre-filled-form path to the M2 SP optimizer: drop a screenshot of the post-run "Learn" screen; OCR matches skill *names* to the dataset and reads *available SP*; it pre-fills the existing manual form's editable candidate rows; you confirm/correct every value and Analyze.

**Architecture:** A pure, CI-tested core (`skillMatch` fuzzy matcher + `cropProfiles` region math + `imagePrep` pixel transforms over a structural `PixelBuffer`) and a browser-only OCR layer (`canvasOps` + lazy `tesseract.js` `ocrEngine` + a `readSkillScreen` orchestrator with injectable deps) that the manual form consumes via an `OcrDropZone`. tesseract.js WASM + traineddata are vendored locally (no CDN, P2). The M2 core/orchestrator/persistence are unchanged.

**Tech Stack:** TypeScript, React 19, Vite, Vitest (jsdom) + Testing Library, **tesseract.js ^5** (lazy, locally hosted). Path alias `@/* → src/*`. Spec: [docs/superpowers/specs/2026-06-15-m2-f1-ocr-assist-design.md](../specs/2026-06-15-m2-f1-ocr-assist-design.md). Ports `spikes/ocr/` (gitignored).

---

## Conventions (read once)
- `import type { ... }` for types; alphabetized; `@/*` alias, never relative `../` across `src`.
- Core tests: `import { describe, expect, it } from 'vitest';`. Component tests: `import '@testing-library/jest-dom/vitest';` per file, `afterEach(cleanup)`, `userEvent.setup()`; mock `@/features/data/gameData` (spread `importOriginal` to keep `GameIcon`).
- **jsdom has no canvas/`ImageData`** (verified): pure pixel transforms take a structural `PixelBuffer = { data: Uint8ClampedArray; width; height }`, NEVER the DOM `ImageData`. Canvas/WASM code lives in **browser-only** files that **no unit test imports** — they're verified by `pnpm typecheck` + `pnpm build` + manual validation (Task 8).
- Run one file: `pnpm vitest run <path>`. Typecheck: `pnpm typecheck`. Build: `pnpm build`.
- Baseline before starting: `pnpm test` → 393 passing.

## File structure
| File | Responsibility | Task | CI-tested |
|---|---|---|---|
| `src/core/skillMatch.ts` | pure name→skill matcher (normalize keeps aptitude marks; exact + Dice fuzzy) | 1 | ✅ |
| `src/core/cropProfiles.ts` | pure proportional crop regions + orientation selection | 2 | ✅ |
| `src/core/spOptimizer.ts` | add optional `matchTier?` to `BuyableSkill` | 3 | (existing) |
| `src/features/sp-optimizer/ocr/imagePrep.ts` | pure `PixelBuffer` transforms (greyscale/normalise/contrast/threshold) | 3 | ✅ |
| `src/features/sp-optimizer/ocr/canvasOps.ts` | browser-only decode/crop/upscale ↔ `PixelBuffer` | 4 | ❌ manual |
| `src/features/sp-optimizer/ocr/ocrEngine.ts` | lazy tesseract worker, local assets | 4 | ❌ manual |
| `public/ocr/*` + `scripts/vendor-ocr-assets.mjs` | vendored WASM/worker/traineddata + fetch script | 4 | ❌ |
| `src/features/sp-optimizer/ocr/readSkillScreen.ts` | orchestrator (port of `analyze.mjs`); injectable deps | 5 | ✅ |
| `src/features/sp-optimizer/ocr/runOcr.ts` | browser-only wiring of canvasOps+ocrEngine→readSkillScreen | 6 | ❌ manual |
| `src/features/sp-optimizer/OcrDropZone.tsx` | drop/file UI → runOcr → `onExtracted` | 6 | ✅ (mock runOcr) |
| `src/features/sp-optimizer/BuildContextForm.tsx` | `initialCandidates`/`initialSpBudget` + editable named rows + remove + tier badge + `source:'ocr'` | 7 | ✅ |
| `src/features/sp-optimizer/SpOptimizerPage.tsx` | mount `OcrDropZone` + remount-key wiring | 7 | ✅ (existing) |
| `src/features/sp-optimizer/sp-optimizer.css` | row/badge/dropzone classes | 7 | — |
| `docs/provenance.md` | record vendored tesseract assets (Apache-2.0) | 4 | — |
| `docs/mechanics-notes.md` | F1 manual-validation procedure | 8 | — |

---

## Task 1: `skillMatch.ts` — pure name matcher

**Files:** Create `src/core/skillMatch.ts`; Test `src/core/skillMatch.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// src/core/skillMatch.test.ts
/** Tests for the F1 OCR skill-name matcher (spec 2026-06-15-m2-f1-ocr-assist-design §3.1). */
import { describe, expect, it } from 'vitest';

import { FIXTURE_SKILLS } from '@/core/fixtures';
import { diceCoefficient, matchSkillByName, normalizeSkillName } from '@/core/skillMatch';

const GLOBAL = FIXTURE_SKILLS.filter((s) => s.server === 'global');

describe('normalizeSkillName', () => {
  it('lowercases, keeps aptitude marks, strips other punctuation', () => {
    expect(normalizeSkillName('Corner Adept ○!')).toBe('corner adept ○');
    expect(normalizeSkillName('Right  Turns ◎')).toBe('right turns ◎');
  });
});

describe('diceCoefficient', () => {
  it('is 1 for identical strings and lower for unrelated ones', () => {
    expect(diceCoefficient('corner adept', 'corner adept')).toBe(1);
    expect(diceCoefficient('corner adept', 'cornr adept')).toBeGreaterThan(0.6);
    expect(diceCoefficient('corner adept', 'professor of curvature')).toBeLessThan(0.3);
  });
});

describe('matchSkillByName', () => {
  it('exact-matches a clean name to its skillId', () => {
    const m = matchSkillByName('Corner Adept ○', GLOBAL);
    expect(m?.skillId).toBe('200332');
    expect(m?.tier).toBe('exact');
  });

  it('keeps aptitude marks distinct: ◎ ≠ ○ (the spike bug fix)', () => {
    expect(matchSkillByName('Right Turns ○', GLOBAL)?.skillId).toBe('200012');
    expect(matchSkillByName('Right Turns ◎', GLOBAL)?.skillId).toBe('200014');
  });

  it('fuzzy-matches an OCR-mangled name', () => {
    const m = matchSkillByName('Corner Adept', GLOBAL); // typo + dropped mark
    expect(m?.skillId).toBe('200332');
    expect(m?.tier).toBe('fuzzy');
  });

  it('returns null for garbage', () => {
    expect(matchSkillByName('xqzptv restart item', GLOBAL)).toBeNull();
  });

  it('carries rarity + prereqSkillId from the matched gold record', () => {
    const m = matchSkillByName('Professor of Curvature', GLOBAL);
    expect(m?.rarity).toBe('gold');
    expect(m?.prereqSkillId).toBe('200332');
  });

  it('does not return jp-server skills when given a Global-filtered list (P4)', () => {
    const jp = FIXTURE_SKILLS.find((s) => s.server === 'jp')!;
    expect(matchSkillByName(jp.nameEn, GLOBAL)?.skillId).not.toBe(jp.skillId);
  });
});
```

- [ ] **Step 2: Run → fails** (`pnpm vitest run src/core/skillMatch.test.ts`) — module not found.

- [ ] **Step 3: Implement**

```ts
// src/core/skillMatch.ts
/**
 * Module 2 · F1 OCR-assist — pure skill-name matcher (spec
 * 2026-06-15-m2-f1-ocr-assist-design.md §3.1; ports spikes/ocr/lib/match.mjs,
 * retrieved 2026-06-15). Sørensen–Dice on character bigrams. APTITUDE-MARK FIX:
 * ○/◎/●/◯ are KEPT (not stripped) so same-base skills ("Right Turns ○" vs
 * "Right Turns ◎") stay distinguishable. Operates on the list it is given;
 * server filtering (P4) happens upstream in the data layer.
 */
import type { SkillRarity, SkillRecord } from '@/core/types';

export interface SkillMatch {
  skillId: string;
  nameEn: string;
  rarity: SkillRarity;
  baseSpCost: number;
  iconId: string;
  prereqSkillId?: string;
  tier: 'exact' | 'fuzzy';
  score: number;
}

const FUZZY_MIN = 0.6;

/** Lowercase; keep aptitude marks ○◎●◯; strip other OCR-mangled punctuation; collapse spaces. */
export function normalizeSkillName(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[☆★①②③④⑤!！?？.,;:'"`’“”·•\-_/\\()\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function bigrams(s: string): Map<string, number> {
  const t = s.replace(/\s+/g, '');
  const m = new Map<string, number>();
  for (let i = 0; i < t.length - 1; i++) {
    const b = t.slice(i, i + 2);
    m.set(b, (m.get(b) ?? 0) + 1);
  }
  return m;
}

/** Sørensen–Dice coefficient on character bigrams (0..1). */
export function diceCoefficient(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return a === b ? 1 : 0;
  let inter = 0;
  let total = 0;
  for (const [k, v] of A) {
    const bv = B.get(k);
    if (bv !== undefined) inter += Math.min(v, bv);
    total += v;
  }
  for (const v of B.values()) total += v;
  return (2 * inter) / total;
}

/**
 * Resolve an OCR'd skill name to a canonical skill. Exact (normalized equality)
 * → tier 'exact'; else best Dice ≥ 0.6 → 'fuzzy'; else null (caller falls back
 * to manual entry). Pure and total.
 */
export function matchSkillByName(ocrText: string, skills: SkillRecord[]): SkillMatch | null {
  const q = normalizeSkillName(ocrText);
  if (q.length < 2) return null;

  let exact: SkillRecord | null = null;
  let best: SkillRecord | null = null;
  let bestScore = 0;
  for (const s of skills) {
    const norm = normalizeSkillName(s.nameEn);
    if (norm === q) { exact = s; break; }
    const score = diceCoefficient(q, norm);
    if (score > bestScore) { bestScore = score; best = s; }
  }

  const out = (s: SkillRecord, tier: 'exact' | 'fuzzy', score: number): SkillMatch => ({
    skillId: s.skillId, nameEn: s.nameEn, rarity: s.rarity, baseSpCost: s.baseSpCost,
    iconId: s.iconId, prereqSkillId: s.prereqSkillId, tier, score,
  });

  if (exact) return out(exact, 'exact', 1);
  if (best && bestScore >= FUZZY_MIN) return out(best, 'fuzzy', bestScore);
  return null;
}
```

- [ ] **Step 4: Run → passes.** `pnpm vitest run src/core/skillMatch.test.ts`.
- [ ] **Step 5: Commit.** `pnpm typecheck && git add src/core/skillMatch.ts src/core/skillMatch.test.ts && git commit -m "feat(m2-f1): pure skill-name matcher (Dice + aptitude-mark fix)"`

---

## Task 2: `cropProfiles.ts` — proportional regions

**Files:** Create `src/core/cropProfiles.ts`; Test `src/core/cropProfiles.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// src/core/cropProfiles.test.ts
/** Tests for F1 crop-region math (spec §3.1/§5). Landscape fractions are the spike's validated values. */
import { describe, expect, it } from 'vitest';

import { regionsFor, selectProfile } from '@/core/cropProfiles';

describe('selectProfile', () => {
  it('picks landscape when wider-or-equal, portrait when taller', () => {
    expect(selectProfile(1573, 855)).toBe('landscape');
    expect(selectProfile(1206, 2622)).toBe('portrait');
    expect(selectProfile(800, 800)).toBe('landscape');
  });
});

describe('regionsFor', () => {
  it('computes landscape rects from fractions (validated 1573×855)', () => {
    expect(regionsFor(1573, 855, 'landscape')).toEqual({
      panel: { left: 220, top: 315, width: 459, height: 345 },
      sp: { left: 544, top: 262, width: 135, height: 44 },
    });
  });

  it('recomputes for a different resolution (non-HDR 1451×816)', () => {
    expect(regionsFor(1451, 816, 'landscape').panel).toEqual({ left: 203, top: 300, width: 424, height: 330 });
  });
});
```

- [ ] **Step 2: Run → fails.**

- [ ] **Step 3: Implement**

```ts
// src/core/cropProfiles.ts
/**
 * Module 2 · F1 OCR-assist — proportional crop regions (spec §3.1, §5).
 * Regions are fractions of (W,H) → resolution-independent. Landscape fractions
 * are validated (spikes/ocr/analyze.mjs, 1573×855). Portrait fractions are an
 * INITIAL estimate to be calibrated against shots/iPhone/ (plan Task 8).
 */
export type CropProfile = 'landscape' | 'portrait';
export interface Rect { left: number; top: number; width: number; height: number; }
export interface ScreenRegions { panel: Rect; sp: Rect; }

type Frac = [number, number, number, number]; // fLeft, fTop, fWidth, fHeight
const PROFILES: Record<CropProfile, { panel: Frac; sp: Frac }> = {
  landscape: { panel: [0.140, 0.368, 0.292, 0.404], sp: [0.346, 0.306, 0.086, 0.051] },
  portrait: { panel: [0.060, 0.300, 0.880, 0.420], sp: [0.620, 0.120, 0.300, 0.040] }, // CALIBRATE (Task 8)
};

/** Landscape when wider-or-equal, portrait when taller. */
export function selectProfile(width: number, height: number): CropProfile {
  return width >= height ? 'landscape' : 'portrait';
}

function rect(W: number, H: number, [fl, ft, fw, fh]: Frac): Rect {
  return { left: Math.round(fl * W), top: Math.round(ft * H), width: Math.round(fw * W), height: Math.round(fh * H) };
}

export function regionsFor(width: number, height: number, profile: CropProfile): ScreenRegions {
  const f = PROFILES[profile];
  return { panel: rect(width, height, f.panel), sp: rect(width, height, f.sp) };
}
```

- [ ] **Step 4: Run → passes.**
- [ ] **Step 5: Commit.** `pnpm typecheck && git add src/core/cropProfiles.ts src/core/cropProfiles.test.ts && git commit -m "feat(m2-f1): proportional crop profiles (landscape validated, portrait pending calibration)"`

---

## Task 3: `imagePrep.ts` pure transforms + `matchTier` on `BuyableSkill`

**Files:** Create `src/features/sp-optimizer/ocr/imagePrep.ts` (+ test); Modify `src/core/spOptimizer.ts`.

- [ ] **Step 1: Add `matchTier` to `BuyableSkill`** in `src/core/spOptimizer.ts`. Find the `BuyableSkill` interface and add this optional field (after `prereqSkillId?`):

```ts
  /** OCR-row provenance for the UI badge; absent/'manual' on manual entry. */
  matchTier?: 'exact' | 'fuzzy' | 'manual';
```
This is backward-compatible (all existing rows omit it; `rankBaskets`/`enumerateFeasibleBaskets` ignore it). Run `pnpm typecheck` → clean.

- [ ] **Step 2: Write the failing test**

```ts
// src/features/sp-optimizer/ocr/imagePrep.test.ts
/** Pure pixel transforms over a structural PixelBuffer (spec §3.2/§6). jsdom has no canvas/ImageData. */
import { describe, expect, it } from 'vitest';

import { contrast, greyscale, normalise, threshold, type PixelBuffer } from '@/features/sp-optimizer/ocr/imagePrep';

const buf = (...rgba: number[]): PixelBuffer => ({ data: new Uint8ClampedArray(rgba), width: rgba.length / 4, height: 1 });

describe('greyscale', () => {
  it('replaces RGB with luminance, keeps alpha', () => {
    const b = buf(255, 0, 0, 255); // red → round(0.299*255)=76
    greyscale(b);
    expect([...b.data]).toEqual([76, 76, 76, 255]);
  });
});

describe('threshold', () => {
  it('binarizes at t (>= t → 255 else 0)', () => {
    const b = buf(184, 184, 184, 255, 185, 185, 185, 255);
    threshold(b, 185);
    expect([b.data[0], b.data[4]]).toEqual([0, 255]);
  });
});

describe('normalise', () => {
  it('stretches min..max to 0..255', () => {
    const b = buf(100, 100, 100, 255, 150, 150, 150, 255);
    normalise(b);
    expect([b.data[0], b.data[4]]).toEqual([0, 255]);
  });
});

describe('contrast', () => {
  it('applies mul*v+add with Uint8Clamped clamping', () => {
    const b = buf(10, 10, 10, 255, 200, 200, 200, 255);
    contrast(b, 1.2, -12); // 10→0 (clamp), 200→228
    expect([b.data[0], b.data[4]]).toEqual([0, 228]);
  });
});
```

- [ ] **Step 3: Run → fails.**

- [ ] **Step 4: Implement**

```ts
// src/features/sp-optimizer/ocr/imagePrep.ts
/**
 * F1 OCR-assist — PURE pixel preprocessing (spec §3.2/§6). Operates on a
 * structural { data, width, height } (RGBA) so it unit-tests under jsdom
 * (which has NO canvas/ImageData). A real browser ImageData is structurally
 * assignable. Canvas glue (decode/crop/upscale) lives in canvasOps.ts.
 * All four mutate in place and return the buffer (chainable).
 */
export interface PixelBuffer {
  data: Uint8ClampedArray; // RGBA, 4 bytes/px
  width: number;
  height: number;
}

export function greyscale(buf: PixelBuffer): PixelBuffer {
  const d = buf.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = Math.round(0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!);
    d[i] = y; d[i + 1] = y; d[i + 2] = y;
  }
  return buf;
}

/** Stretch the luminance range to 0..255 (reads the R channel; assumes greyscale). */
export function normalise(buf: PixelBuffer): PixelBuffer {
  const d = buf.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i]!;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.round(((d[i]! - min) / range) * 255);
    d[i] = v; d[i + 1] = v; d[i + 2] = v;
  }
  return buf;
}

/** Linear contrast v' = mul*v + add (clamped by Uint8ClampedArray assignment). */
export function contrast(buf: PixelBuffer, mul: number, add: number): PixelBuffer {
  const d = buf.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = mul * d[i]! + add;
    d[i] = v; d[i + 1] = v; d[i + 2] = v;
  }
  return buf;
}

/** Binary threshold: v >= t → 255 else 0 (assumes greyscale). */
export function threshold(buf: PixelBuffer, t: number): PixelBuffer {
  const d = buf.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i]! >= t ? 255 : 0;
    d[i] = v; d[i + 1] = v; d[i + 2] = v;
  }
  return buf;
}
```

- [ ] **Step 5: Run → passes.**
- [ ] **Step 6: Commit.** `pnpm typecheck && git add src/core/spOptimizer.ts src/features/sp-optimizer/ocr/imagePrep.ts src/features/sp-optimizer/ocr/imagePrep.test.ts && git commit -m "feat(m2-f1): pure imagePrep transforms + BuyableSkill.matchTier"`

---

## Task 4: `canvasOps.ts` + `ocrEngine.ts` + vendor assets (browser-only, no CI test)

> These modules use canvas + the tesseract WASM worker, which jsdom cannot run. **No unit tests** — verified by `pnpm typecheck` + `pnpm build` + manual validation (Task 8). Keep them out of any file a unit test imports.

- [ ] **Step 1: Add tesseract.js + vendor the assets**

```bash
pnpm add tesseract.js
```
Create `scripts/vendor-ocr-assets.mjs`:

```js
// Copies tesseract.js runtime assets into public/ocr/ and fetches the eng
// traineddata (all Apache-2.0). Run: node scripts/vendor-ocr-assets.mjs
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve('public/ocr');
const CORE = 'node_modules/tesseract.js-core';
const TJS = 'node_modules/tesseract.js/dist';
const TRAINEDDATA = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz';

await mkdir(OUT, { recursive: true });
const copies = [
  [`${TJS}/worker.min.js`, 'worker.min.js'],
  [`${CORE}/tesseract-core-simd-lstm.wasm.js`, 'tesseract-core-simd-lstm.wasm.js'],
  [`${CORE}/tesseract-core-simd-lstm.wasm`, 'tesseract-core-simd-lstm.wasm'],
  [`${CORE}/tesseract-core-lstm.wasm.js`, 'tesseract-core-lstm.wasm.js'],
  [`${CORE}/tesseract-core-lstm.wasm`, 'tesseract-core-lstm.wasm'],
];
for (const [src, dst] of copies) await copyFile(src, path.join(OUT, dst));

const res = await fetch(TRAINEDDATA);
if (!res.ok) throw new Error(`traineddata fetch failed: ${res.status}`);
await writeFile(path.join(OUT, 'eng.traineddata.gz'), Buffer.from(await res.arrayBuffer()));
console.log('vendored OCR assets → public/ocr/');
```
Run it: `node scripts/vendor-ocr-assets.mjs`. Verify `public/ocr/` has 6 files (worker.min.js, 2 SIMD-LSTM core files, 2 LSTM fallback core files, eng.traineddata.gz). These are committed (git-tracked vendored assets, like `public/data/`; ~8 MB, fetched only on first OCR use at runtime).

- [ ] **Step 2: Record provenance.** Append to `docs/provenance.md` a section: `tesseract.js@5.x` + `tesseract.js-core@5.x` + `@tesseract.js-data/eng 4.0.0_best_int` — **Apache-2.0** (clean, no copyleft) — vendored into `public/ocr/`, retrieved 2026-06-15, source `cdn.jsdelivr.net/npm/...`. Note the ~8 MB runtime assets are lazy-fetched + cached (wasm via HTTP cache, traineddata via IndexedDB).

- [ ] **Step 3: Implement `src/features/sp-optimizer/ocr/canvasOps.ts`**

```ts
// src/features/sp-optimizer/ocr/canvasOps.ts
/**
 * F1 OCR-assist — BROWSER-ONLY canvas glue (decode/crop/upscale + PixelBuffer
 * bridge). NOT unit-tested (jsdom has no 2D canvas/ImageData). Validated
 * manually against spikes/ocr/shots/ (plan Task 8). No unit test may import this.
 */
import type { Rect } from '@/core/cropProfiles';
import type { PixelBuffer } from '@/features/sp-optimizer/ocr/imagePrep';

function ctx2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const c = canvas.getContext('2d');
  if (!c) throw new Error('2D canvas context unavailable');
  return c;
}

export function decodeImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image decode failed')); };
    img.src = url;
  });
}

/** Crop `rect` from `img`, upscaled ×`scale`, into a canvas (for OCR). */
export function cropToCanvas(img: HTMLImageElement, rect: Rect, scale = 1): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  ctx2d(canvas).drawImage(img, rect.left, rect.top, rect.width, rect.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Read a canvas into a structural PixelBuffer the pure transforms accept. */
export function canvasToPixelBuffer(canvas: HTMLCanvasElement): PixelBuffer {
  const { width, height } = canvas;
  const { data } = ctx2d(canvas).getImageData(0, 0, width, height);
  return { data, width, height };
}

/** Write a (preprocessed) PixelBuffer back onto a canvas for OCR. */
export function pixelBufferToCanvas(buf: PixelBuffer): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = buf.width;
  canvas.height = buf.height;
  ctx2d(canvas).putImageData(new ImageData(buf.data, buf.width, buf.height), 0, 0);
  return canvas;
}
```

- [ ] **Step 4: Implement `src/features/sp-optimizer/ocr/ocrEngine.ts`**

```ts
// src/features/sp-optimizer/ocr/ocrEngine.ts
/**
 * F1 OCR-assist — lazy tesseract.js worker with LOCAL assets (no CDN, P2).
 * Browser-only; not unit-tested. Assets in public/ocr/ (Apache-2.0; provenance).
 * One reusable module-scoped worker (creation loads ~8 MB once).
 */
interface TWorker {
  recognize: (image: unknown) => Promise<{ data: { text: string; confidence: number; lines: { text: string; confidence: number }[] } }>;
  setParameters: (p: Record<string, string>) => Promise<unknown>;
  terminate: () => Promise<unknown>;
}

let workerPromise: Promise<TWorker> | null = null;

async function getWorker(): Promise<TWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM } = await import('tesseract.js');
      const base = import.meta.env.BASE_URL;
      const w = await createWorker('eng', OEM.LSTM_ONLY, {
        workerPath: `${base}ocr/worker.min.js`,
        workerBlobURL: false,
        corePath: `${base}ocr/`,
        langPath: `${base}ocr/`,
        gzip: true,
        cacheMethod: 'write',
        logger: () => {},
      });
      return w as unknown as TWorker;
    })();
  }
  return workerPromise;
}

export interface RecognizeOpts { psm: '3' | '6'; whitelist?: string; }

export async function recognize(canvas: HTMLCanvasElement, opts: RecognizeOpts) {
  const worker = await getWorker();
  await worker.setParameters({ tessedit_pageseg_mode: opts.psm, tessedit_char_whitelist: opts.whitelist ?? '' });
  const { data } = await worker.recognize(canvas);
  return data;
}

export async function disposeOcr(): Promise<void> {
  if (workerPromise) {
    const w = await workerPromise;
    await w.terminate();
    workerPromise = null;
  }
}
```
> The local `TWorker` structural type avoids tesseract.js CJS/interop friction; tesseract ships its own types but the dynamic `import()` return is loosely typed.

- [ ] **Step 5: Verify + commit.** `pnpm typecheck && pnpm build` (must compile; build copies `public/ocr/` into `dist/`). Then:
```bash
git add package.json pnpm-lock.yaml scripts/vendor-ocr-assets.mjs public/ocr docs/provenance.md src/features/sp-optimizer/ocr/canvasOps.ts src/features/sp-optimizer/ocr/ocrEngine.ts
git commit -m "feat(m2-f1): browser canvas glue + lazy local tesseract.js engine + vendored assets"
```

---

## Task 5: `readSkillScreen.ts` orchestrator (injectable deps)

**Files:** Create `src/features/sp-optimizer/ocr/readSkillScreen.ts` (+ test).

- [ ] **Step 1: Write the failing test**

```ts
// src/features/sp-optimizer/ocr/readSkillScreen.test.ts
/** Orchestrator test with a FAKE OCR/decode (no canvas/WASM) + the real matcher + pure transforms. */
import { describe, expect, it } from 'vitest';

import { FIXTURE_SKILLS } from '@/core/fixtures';
import { readSkillScreen, type OcrDeps } from '@/features/sp-optimizer/ocr/readSkillScreen';

const GLOBAL = FIXTURE_SKILLS.filter((s) => s.server === 'global');

function fakeDeps(panelLines: string[], spText: string): OcrDeps {
  return {
    decode: async () => ({ width: 1573, height: 855, img: {} }),
    toPixelBuffer: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    recognize: async (_buf, opts) =>
      opts.psm === '6'
        ? { text: spText, confidence: 96, lines: [] }
        : { text: panelLines.join('\n'), confidence: 90, lines: panelLines.map((t) => ({ text: t, confidence: 90 })) },
  };
}

describe('readSkillScreen', () => {
  it('matches panel names + reads available SP', async () => {
    const r = await readSkillScreen(new Blob(), GLOBAL, fakeDeps(['Corner Adept ○', 'Professor of Curvature 160 sp'], 'SP 2285'));
    expect(r.availableSp).toBe(2285);
    expect(r.matches.map((m) => m.skillId).sort()).toEqual(['200331', '200332']);
  });

  it('drops unmatchable lines and dedupes by skillId', async () => {
    const r = await readSkillScreen(new Blob(), GLOBAL, fakeDeps(['Corner Adept ○', 'Corner Adept ○', 'xqzptv'], '2285'));
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]!.skillId).toBe('200332');
  });
});
```

- [ ] **Step 2: Run → fails.**

- [ ] **Step 3: Implement**

```ts
// src/features/sp-optimizer/ocr/readSkillScreen.ts
/**
 * F1 OCR-assist orchestrator (spec §3.2; port of spikes/ocr/analyze.mjs).
 * Browser deps (decode/crop/recognize) are INJECTED so the orchestration is
 * unit-testable with a fake OCR + the real matcher/transforms. The browser
 * wiring lives in runOcr.ts.
 */
import type { Rect } from '@/core/cropProfiles';
import { regionsFor, selectProfile } from '@/core/cropProfiles';
import { matchSkillByName, type SkillMatch } from '@/core/skillMatch';
import type { SkillRecord } from '@/core/types';
import { contrast, greyscale, normalise, threshold, type PixelBuffer } from '@/features/sp-optimizer/ocr/imagePrep';

export interface OcrLine { text: string; confidence: number; }
export interface OcrText { text: string; confidence: number; lines: OcrLine[]; }

/** Injectable browser surface (real impls in canvasOps.ts + ocrEngine.ts). */
export interface OcrDeps {
  decode: (blob: Blob) => Promise<{ width: number; height: number; img: unknown }>;
  toPixelBuffer: (img: unknown, rect: Rect, scale: number) => PixelBuffer;
  recognize: (buf: PixelBuffer, opts: { psm: '3' | '6'; whitelist?: string }) => Promise<OcrText>;
}

export interface OcrMatch extends SkillMatch { ocrText: string; }
export interface OcrResult { availableSp: number | null; spConfidence: number; matches: OcrMatch[]; }

export async function readSkillScreen(blob: Blob, skills: SkillRecord[], deps: OcrDeps): Promise<OcrResult> {
  const { width, height, img } = await deps.decode(blob);
  const { panel, sp } = regionsFor(width, height, selectProfile(width, height));

  // Names: greyscale → ×3 → normalise → contrast → OCR PSM3.
  const panelBuf = contrast(normalise(greyscale(deps.toPixelBuffer(img, panel, 3))), 1.2, -12);
  const panelOcr = await deps.recognize(panelBuf, { psm: '3' });

  // Available SP: greyscale → ×7 → threshold(185) → OCR PSM6 digits.
  const spBuf = threshold(greyscale(deps.toPixelBuffer(img, sp, 7)), 185);
  const spOcr = await deps.recognize(spBuf, { psm: '6', whitelist: '0123456789' });
  const spDigits = spOcr.text.match(/\d{3,5}/)?.[0];

  const matches: OcrMatch[] = [];
  const seen = new Set<string>();
  for (const line of panelOcr.lines) {
    const namePart = line.text.replace(/\b\d+\b/g, '').replace(/\bsp\b/gi, '').trim();
    if (namePart.replace(/\s/g, '').length < 3) continue;
    const m = matchSkillByName(namePart, skills);
    if (m && !seen.has(m.skillId)) {
      seen.add(m.skillId);
      matches.push({ ...m, ocrText: line.text });
    }
  }

  return { availableSp: spDigits ? Number(spDigits) : null, spConfidence: Math.round(spOcr.confidence), matches };
}
```

- [ ] **Step 4: Run → passes.**
- [ ] **Step 5: Commit.** `pnpm typecheck && git add src/features/sp-optimizer/ocr/readSkillScreen.ts src/features/sp-optimizer/ocr/readSkillScreen.test.ts && git commit -m "feat(m2-f1): readSkillScreen orchestrator (injectable deps)"`

---

## Task 6: `runOcr.ts` (wiring) + `OcrDropZone.tsx`

**Files:** Create `src/features/sp-optimizer/ocr/runOcr.ts` (browser-only, no CI test); `src/features/sp-optimizer/OcrDropZone.tsx` (+ test).

- [ ] **Step 1: Implement `runOcr.ts`** (wires the real browser deps; not unit-tested)

```ts
// src/features/sp-optimizer/ocr/runOcr.ts
/** F1 OCR-assist — browser-only wiring of canvasOps + ocrEngine into readSkillScreen. Not unit-tested. */
import type { SkillRecord } from '@/core/types';
import { canvasToPixelBuffer, cropToCanvas, decodeImage, pixelBufferToCanvas } from '@/features/sp-optimizer/ocr/canvasOps';
import { recognize as ocrRecognize } from '@/features/sp-optimizer/ocr/ocrEngine';
import { readSkillScreen, type OcrResult } from '@/features/sp-optimizer/ocr/readSkillScreen';

export function runOcr(blob: Blob, skills: SkillRecord[]): Promise<OcrResult> {
  return readSkillScreen(blob, skills, {
    decode: async (b) => {
      const img = await decodeImage(b);
      return { width: img.naturalWidth, height: img.naturalHeight, img };
    },
    toPixelBuffer: (img, rect, scale) => canvasToPixelBuffer(cropToCanvas(img as HTMLImageElement, rect, scale)),
    recognize: async (buf, opts) => {
      const data = await ocrRecognize(pixelBufferToCanvas(buf), opts);
      return { text: data.text, confidence: data.confidence, lines: data.lines };
    },
  });
}
```

- [ ] **Step 2: Write the failing test** (`OcrDropZone.test.tsx`)

```tsx
// src/features/sp-optimizer/OcrDropZone.test.tsx
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OcrDropZone } from '@/features/sp-optimizer/OcrDropZone';

vi.mock('@/features/data/gameData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/data/gameData')>();
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { ...actual, useGameData: () => fixtureGameData() };
});

vi.mock('@/features/sp-optimizer/ocr/runOcr', () => ({
  runOcr: vi.fn(async () => ({
    availableSp: 2285,
    spConfidence: 96,
    matches: [{ skillId: '200332', nameEn: 'Corner Adept ○', rarity: 'white', baseSpCost: 110, iconId: '10011', tier: 'exact', score: 1, ocrText: 'Corner Adept ○' }],
  })),
}));

afterEach(cleanup);

describe('OcrDropZone', () => {
  it('runs OCR on an uploaded file and emits candidates + available SP', async () => {
    const user = userEvent.setup();
    const onExtracted = vi.fn();
    render(<OcrDropZone onExtracted={onExtracted} />);

    await user.upload(screen.getByLabelText(/OCR a screenshot/i), new File(['x'], 'screen.png', { type: 'image/png' }));
    await waitFor(() => expect(onExtracted).toHaveBeenCalledTimes(1));

    const [candidates, sp] = onExtracted.mock.calls[0]!;
    expect(sp).toBe(2285);
    expect(candidates[0]).toMatchObject({ skillId: '200332', rarity: 'white', screenSpCost: 110, matchTier: 'exact' });
  });
});
```

- [ ] **Step 3: Run → fails.**

- [ ] **Step 4: Implement `OcrDropZone.tsx`**

```tsx
// src/features/sp-optimizer/OcrDropZone.tsx
import { useState } from 'react';

import type { BuyableSkill } from '@/core/spOptimizer';
import { useGameData } from '@/features/data/gameData';
import { runOcr } from '@/features/sp-optimizer/ocr/runOcr';

export interface OcrDropZoneProps {
  onExtracted: (candidates: BuyableSkill[], availableSp: number | null) => void;
}

export function OcrDropZone({ onExtracted }: OcrDropZoneProps) {
  const { skills } = useGameData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const result = await runOcr(file, skills);
      const candidates: BuyableSkill[] = result.matches.map((m) => ({
        skillId: m.skillId,
        rarity: m.rarity,
        screenSpCost: m.baseSpCost, // base estimate — user confirms against the screen
        prereqSkillId: m.prereqSkillId,
        matchTier: m.tier,
      }));
      onExtracted(candidates, result.availableSp);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sp-ocr">
      <label className="sp-ocr-drop">
        {busy ? 'Reading screen…' : 'OCR a screenshot of the skill screen'}
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
        />
      </label>
      <p className="small muted">OCR is best-effort — every matched name + cost is editable below before you Analyze.</p>
      {error && <p className="error" role="alert">OCR failed: {error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Run → passes.**
- [ ] **Step 6: Commit.** `pnpm typecheck && git add src/features/sp-optimizer/ocr/runOcr.ts src/features/sp-optimizer/OcrDropZone.tsx src/features/sp-optimizer/OcrDropZone.test.tsx && git commit -m "feat(m2-f1): OcrDropZone + runOcr wiring"`

---

## Task 7: `BuildContextForm` editable rows + `SpOptimizerPage` mount + CSS

**Files:** Modify `BuildContextForm.tsx` (+ test), `SpOptimizerPage.tsx`, `sp-optimizer.css`.

- [ ] **Step 1: Update the existing test + add new tests** (`BuildContextForm.test.tsx`)

`BuildContextForm` will now call `useGameData()`, so the existing test needs a gameData mock. Replace the file with:

```tsx
// src/features/sp-optimizer/BuildContextForm.test.tsx
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { BuyableSkill } from '@/core/spOptimizer';
import { BuildContextForm } from '@/features/sp-optimizer/BuildContextForm';

vi.mock('@/features/data/gameData', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/data/gameData')>();
  const { fixtureGameData } = await import('@/features/testing/fixtureGameData');
  return { ...actual, useGameData: () => fixtureGameData() };
});

afterEach(cleanup);

describe('BuildContextForm', () => {
  it('emits a manual CaptureBundle with the entered SP and one candidate', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    render(<BuildContextForm onAnalyze={onAnalyze} />);

    await user.clear(screen.getByLabelText('Available SP'));
    await user.type(screen.getByLabelText('Available SP'), '500');
    await user.type(screen.getByLabelText('Skill id'), '200332');
    await user.type(screen.getByLabelText('On-screen SP cost'), '120');
    await user.click(screen.getByRole('button', { name: 'Add skill' }));
    await user.click(screen.getByRole('button', { name: 'Analyze' }));

    const bundle = onAnalyze.mock.calls[0]![0];
    expect(bundle.source).toBe('manual');
    expect(bundle.context.spBudget).toBe(500);
    expect(bundle.context.candidates[0].skillId).toBe('200332');
    expect(bundle.context.candidates[0].screenSpCost).toBe(120);
  });

  it('pre-fills from initialCandidates/initialSpBudget and emits source:ocr', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    const seed: BuyableSkill[] = [{ skillId: '200332', rarity: 'white', screenSpCost: 110, matchTier: 'exact' }];
    render(<BuildContextForm onAnalyze={onAnalyze} initialCandidates={seed} initialSpBudget={2285} />);

    expect(screen.getByLabelText('Available SP')).toHaveValue(2285);
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    const bundle = onAnalyze.mock.calls[0]![0];
    expect(bundle.source).toBe('ocr');
    expect(bundle.context.candidates[0].skillId).toBe('200332');
  });

  it('lets you correct a candidate cost and remove a row', async () => {
    const user = userEvent.setup();
    const onAnalyze = vi.fn();
    const seed: BuyableSkill[] = [
      { skillId: '200332', rarity: 'white', screenSpCost: 110, matchTier: 'exact' },
      { skillId: '200331', rarity: 'gold', screenSpCost: 160, matchTier: 'fuzzy', prereqSkillId: '200332' },
    ];
    render(<BuildContextForm onAnalyze={onAnalyze} initialCandidates={seed} initialSpBudget={2285} />);

    // correct the first cost (resolved name comes from fixtureGameData; fall back to id)
    const costInputs = screen.getAllByLabelText(/^Cost for /);
    await user.clear(costInputs[0]!);
    await user.type(costInputs[0]!, '128');
    // remove the second row (each row has one "Remove …" button)
    const removeButtons = screen.getAllByRole('button', { name: /^Remove/ });
    await user.click(removeButtons[1]!);

    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    const bundle = onAnalyze.mock.calls[0]![0];
    expect(bundle.context.candidates).toHaveLength(1);
    expect(bundle.context.candidates[0].skillId).toBe('200332');
    expect(bundle.context.candidates[0].screenSpCost).toBe(128);
  });
});
```

> If the remove-button query is brittle, target it directly: each row's remove button has `aria-label={`Remove ${name}`}`; query the specific one once names resolve. The intent is: edit a cost, remove a row, assert the resulting bundle.

- [ ] **Step 2: Run → fails** (no `initialCandidates` prop / no editable rows yet).

- [ ] **Step 3: Replace `BuildContextForm.tsx`**

```tsx
// src/features/sp-optimizer/BuildContextForm.tsx
import { useState } from 'react';

import type { BuyableSkill, CaptureBundle } from '@/core/spOptimizer';
import type { Stat } from '@/core/types';
import type { Grade } from '@/sim/types';
import { GameIcon } from '@/features/data/GameIcon';
import { useGameData } from '@/features/data/gameData';

const DEFAULT_STATS: Record<Stat, number> = { spd: 1000, sta: 800, pow: 800, gut: 400, wit: 600 };

export interface BuildContextFormProps {
  onAnalyze: (bundle: CaptureBundle) => void;
  initialCandidates?: BuyableSkill[];
  initialSpBudget?: number;
  dataVersion?: string;
  /** Clock injected so the component stays testable/deterministic. */
  now?: () => string;
}

export function BuildContextForm({
  onAnalyze, initialCandidates, initialSpBudget, dataVersion = 'global-c1fa2107', now,
}: BuildContextFormProps) {
  const { skillById } = useGameData();
  const [spBudget, setSpBudget] = useState(initialSpBudget ?? 1000);
  const [courseId, setCourseId] = useState('10101');
  const [candidates, setCandidates] = useState<BuyableSkill[]>(initialCandidates ?? []);
  const [draftId, setDraftId] = useState('');
  const [draftCost, setDraftCost] = useState('');
  const [source] = useState<'manual' | 'ocr'>(
    initialCandidates && initialCandidates.length > 0 ? 'ocr' : 'manual',
  );

  function addCandidate() {
    const id = draftId.trim();
    if (!id || candidates.some((c) => c.skillId === id)) return;
    setCandidates((prev) => [...prev, { skillId: id, rarity: 'white', screenSpCost: Number(draftCost) || 0, matchTier: 'manual' }]);
    setDraftId('');
    setDraftCost('');
  }

  function setCost(skillId: string, cost: number) {
    setCandidates((prev) => prev.map((c) => (c.skillId === skillId ? { ...c, screenSpCost: cost } : c)));
  }

  function removeCandidate(skillId: string) {
    setCandidates((prev) => prev.filter((c) => c.skillId !== skillId));
  }

  function analyze() {
    const bundle: CaptureBundle = {
      schemaVersion: 1,
      source,
      capturedAt: now ? now() : new Date().toISOString(),
      server: 'global',
      dataVersion,
      seed: 12345,
      context: {
        umaId: '',
        stats: { ...DEFAULT_STATS },
        aptitudes: { distance: 'A' as Grade, surface: 'A' as Grade, strategy: 'A' as Grade },
        strategy: 'pace',
        courseId,
        spBudget,
        ownedSkills: [],
        pinned: [],
        candidates,
      },
    };
    onAnalyze(bundle);
  }

  return (
    <div className="sp-form">
      <label>
        Available SP
        <input type="number" value={spBudget} onChange={(e) => setSpBudget(Number(e.target.value))} />
      </label>
      <label>
        Course id
        <input value={courseId} onChange={(e) => setCourseId(e.target.value)} />
      </label>

      <fieldset>
        <legend>Buyable skill</legend>
        <label>
          Skill id
          <input value={draftId} onChange={(e) => setDraftId(e.target.value)} />
        </label>
        <label>
          On-screen SP cost
          <input type="number" value={draftCost} onChange={(e) => setDraftCost(e.target.value)} />
        </label>
        <button type="button" onClick={addCandidate}>Add skill</button>
      </fieldset>

      <ul className="sp-candidates">
        {candidates.map((c) => {
          const skill = skillById.get(c.skillId);
          const name = skill?.nameEn ?? `Skill ${c.skillId}`;
          return (
            <li key={c.skillId} className="sp-candidate-row">
              {skill && <GameIcon kind="skill" id={skill.iconId} size={20} alt="" />}
              <span className="sp-candidate-name">{name}</span>
              {c.matchTier && c.matchTier !== 'manual' && (
                <span className="sp-tier-badge" data-tier={c.matchTier}>{c.matchTier}</span>
              )}
              <input
                type="number"
                className="sp-candidate-cost"
                aria-label={`Cost for ${name}`}
                value={c.screenSpCost}
                onChange={(e) => setCost(c.skillId, Number(e.target.value))}
              />
              <button type="button" className="sp-candidate-remove" aria-label={`Remove ${name}`} onClick={() => removeCandidate(c.skillId)}>✕</button>
            </li>
          );
        })}
      </ul>

      <button type="button" className="sp-analyze" onClick={analyze} disabled={candidates.length === 0}>
        Analyze
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the form test → passes.** `pnpm vitest run src/features/sp-optimizer/BuildContextForm.test.tsx`

- [ ] **Step 5: Mount `OcrDropZone` in `SpOptimizerPage.tsx`.** Add the import + seed state + drop-zone + remount-key. Specifically:
  1. Add imports: `import type { BuyableSkill } from '@/core/spOptimizer';` and `import { OcrDropZone } from '@/features/sp-optimizer/OcrDropZone';`
  2. Add state (with the other `useState`s): `const [ocrSeed, setOcrSeed] = useState<{ candidates: BuyableSkill[]; sp: number | null } | null>(null); const [importKey, setImportKey] = useState(0);`
  3. Replace `<BuildContextForm onAnalyze={analyze} />` with:
```tsx
        <OcrDropZone
          onExtracted={(candidates, sp) => { setOcrSeed({ candidates, sp }); setImportKey((k) => k + 1); }}
        />
        <BuildContextForm
          key={importKey}
          onAnalyze={analyze}
          initialCandidates={ocrSeed?.candidates}
          initialSpBudget={ocrSeed?.sp ?? undefined}
        />
```

- [ ] **Step 6: Append CSS** to `src/features/sp-optimizer/sp-optimizer.css`:
```css
.sp-ocr { display: grid; gap: 0.25rem; margin-bottom: 0.5rem; }
.sp-ocr-drop { display: inline-grid; gap: 0.25rem; padding: 0.5rem 0.75rem; border: 1px dashed var(--border, #aaa); border-radius: 0.5rem; cursor: pointer; }
.sp-candidate-row { display: flex; align-items: center; gap: 0.4rem; }
.sp-candidate-name { flex: 1; }
.sp-candidate-cost { width: 5rem; }
.sp-candidate-remove { background: none; border: none; cursor: pointer; font-size: 0.9rem; }
.sp-tier-badge { font-size: 0.7rem; padding: 0 0.3rem; border-radius: 0.25rem; background: var(--chip, #eee); }
.sp-tier-badge[data-tier='fuzzy'] { background: var(--warn-bg, #fde9c8); }
```

- [ ] **Step 7: Verify the page test still passes** (it mocks gameData/db/rankBaskets and does analyze→save; `OcrDropZone` renders but its `runOcr` is never called without an upload, so no canvas runs). Run `pnpm vitest run src/features/sp-optimizer/SpOptimizerPage.test.tsx`. If it fails because `OcrDropZone`'s `runOcr` import pulls canvas at module load, that won't happen (the canvas calls are inside functions), but if the page test needs it, add `vi.mock('@/features/sp-optimizer/ocr/runOcr', () => ({ runOcr: vi.fn() }))` to that test.

- [ ] **Step 8: Full suite + commit.** `pnpm typecheck && pnpm test` (all green). Then:
```bash
git add src/features/sp-optimizer/BuildContextForm.tsx src/features/sp-optimizer/BuildContextForm.test.tsx src/features/sp-optimizer/SpOptimizerPage.tsx src/features/sp-optimizer/sp-optimizer.css
git commit -m "feat(m2-f1): editable named candidate rows + OcrDropZone wired into the page"
```

---

## Task 8: Manual validation + portrait calibration

> The full WASM+Canvas pipeline can't run in jsdom (verified). This task validates it manually against the gitignored `spikes/ocr/shots/` and calibrates the portrait crop.

- [ ] **Step 1: Build + serve.** `pnpm build && pnpm dev`. Open the SP Optimizer page.
- [ ] **Step 2: Landscape validation.** Drop 2–3 of `spikes/ocr/shots/*.png` (landscape Steam, 1573×855 / 1451×816). Confirm: available SP reads `2285`; the matched skill names + tiers reproduce the spike's `node spikes/ocr/batch.mjs` output for those shots; costs pre-fill as dataset base (editable). Note any mis-matches.
- [ ] **Step 3: Portrait calibration.** Drop `spikes/ocr/shots/iPhone/*` (1206×2622). If the panel/SP crops are off, adjust the `portrait` fractions in `src/core/cropProfiles.ts` until names read (target ≥90%, matching the spike's 93–95%). Re-run `pnpm test` (cropProfiles tests assert the math, not portrait pixel values, so they stay green) and re-validate.
- [ ] **Step 4: Record the procedure + results.** Append a section to `docs/mechanics-notes.md` (or a sibling `docs/ocr-validation.md`): the shots used (NOT committed — they're personal/gitignored), the per-shot SP + matched-skill results, the final portrait fractions, and the date. State the honest caveat (P3): OCR is assistive; the canvas preprocessing isn't byte-identical to the spike's `sharp`, so accuracy is "good enough to pre-fill, always confirm-on-entry."
- [ ] **Step 5: Commit.** `git add src/core/cropProfiles.ts docs/mechanics-notes.md && git commit -m "test(m2-f1): manual OCR validation + portrait crop calibration"`

---

## Self-review (author)
- **Spec coverage:** §3.1 skillMatch→T1, cropProfiles→T2; §3.2 imagePrep→T3, canvasOps/ocrEngine→T4, readSkillScreen→T5; §3.3 OcrDropZone+form→T6/T7; §5 crop profiles→T2(+T8 portrait calibration); §6 preprocessing→T3+T4; §7 testing (CI pure + manual)→T1-3/5/6 CI, T4/T8 manual; §8 local-first tesseract→T4; §2 cost=base→T6 (`screenSpCost: m.baseSpCost`). The matcher aptitude-mark fix→T1.
- **No-CI-test modules** (canvasOps/ocrEngine/runOcr) are explicitly verified by typecheck+build+manual (T8) — necessary because jsdom has no canvas (recon-confirmed); not a placeholder.
- **Type consistency:** `PixelBuffer` (T3) used by imagePrep/canvasOps/readSkillScreen; `Rect`/`selectProfile`/`regionsFor` (T2) used by canvasOps/readSkillScreen; `SkillMatch` (T1) extended by `OcrMatch` (T5) → mapped to `BuyableSkill.matchTier` (T3) in OcrDropZone (T6); `OcrResult`/`OcrDeps` (T5) consumed by runOcr (T6). `matchTier` union 'exact'|'fuzzy'|'manual' consistent across spOptimizer/form/matcher (matcher emits 'exact'|'fuzzy'; manual-add sets 'manual').
- **Portrait fractions** are an explicit initial estimate calibrated in T8 (the unit tests assert the math + orientation, not portrait pixel accuracy) — honest, not a placeholder.

> F1 ships OCR-assist. F2 (compare-vs-veteran), F3 (pre-fill), F4 (video-sync) remain separate follow-ups.
