/**
 * Rank-rating badge sprite catalog — the per-badge rectangles inside the
 * `Rank_tex.png` sprite atlas (the in-game evaluation-rank badges: G → LS24).
 *
 * PORTED (P1: port a known-good algorithm with attribution) from
 * daftuyda/UmaTools `js/rating-shared.js` (`BASE_GAME_RANK_SPRITE_MAP` +
 * `HIGH_RANK_SPRITE_GRID` + the grid cell constants), retrieved 2026-06-27 from
 * https://raw.githubusercontent.com/daftuyda/UmaTools/main/js/rating-shared.js
 * (atlas `assets/Rank_tex.png`, 4096×2048, sprite version 20260225). The atlas
 * art itself is Cygames property (outside any GPL grant — see docs/provenance.md
 * §2/§2.1); only these coordinates live here.
 *
 * Pure data + a pure `computeRankSpriteMap()` — unit-tested in
 * `scripts/lib/rank-sprites.test.ts`. The impure slicing lives in
 * `scripts/build-icons.ts` (`buildRankIcons`).
 */

export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Low ranks G → SS+ carry explicit rectangles in the atlas. */
const BASE_GAME_RANK_SPRITE_MAP: Readonly<Record<string, SpriteRect>> = {
  G: { x: 7, y: 1893, w: 148, h: 149 },
  'G+': { x: 7, y: 1735, w: 148, h: 149 },
  F: { x: 7, y: 1577, w: 148, h: 149 },
  'F+': { x: 7, y: 1419, w: 148, h: 149 },
  E: { x: 7, y: 1261, w: 148, h: 149 },
  'E+': { x: 7, y: 1103, w: 148, h: 149 },
  D: { x: 7, y: 945, w: 148, h: 149 },
  'D+': { x: 7, y: 787, w: 148, h: 149 },
  C: { x: 7, y: 629, w: 148, h: 149 },
  'C+': { x: 7, y: 471, w: 148, h: 149 },
  B: { x: 7, y: 313, w: 148, h: 149 },
  'B+': { x: 165, y: 471, w: 148, h: 149 },
  A: { x: 323, y: 629, w: 148, h: 149 },
  'A+': { x: 481, y: 787, w: 148, h: 149 },
  S: { x: 639, y: 945, w: 148, h: 150 },
  'S+': { x: 797, y: 1103, w: 148, h: 149 },
  SS: { x: 954, y: 1261, w: 149, h: 150 },
  'SS+': { x: 1112, y: 1419, w: 149, h: 149 },
};

/**
 * High ranks (U* and L* families) are laid out on a uniform grid; each family
 * lists its badges as `[row, col]` cells (1-based row). Family insertion order
 * is ascending rating (UG < UF < … < US < LG < … < LS).
 */
const HIGH_RANK_SPRITE_GRID: Readonly<Record<string, ReadonlyArray<readonly [number, number]>>> = {
  UG: [[10, 8], [11, 9], [12, 10], [1, 10], [2, 11], [3, 12], [12, 21], [4, 13], [11, 21], [3, 14]],
  UF: [[10, 23], [9, 16], [8, 16], [7, 16], [6, 16], [5, 16], [4, 16], [3, 16], [2, 16], [1, 16]],
  UE: [[8, 17], [8, 18], [8, 19], [8, 20], [8, 21], [8, 22], [8, 23], [8, 24], [7, 17], [6, 17]],
  UD: [[5, 17], [4, 17], [3, 17], [2, 17], [1, 17], [7, 18], [7, 19], [7, 20], [7, 21], [7, 22]],
  UC: [[7, 23], [7, 24], [6, 18], [5, 18], [4, 18], [3, 18], [2, 18], [1, 18], [6, 19], [6, 20]],
  UB: [[6, 21], [6, 22], [6, 23], [6, 24], [5, 19], [4, 19], [3, 19], [2, 19], [1, 19], [5, 20]],
  UA: [[5, 21], [5, 22], [5, 23], [5, 24], [4, 20], [3, 20], [2, 20], [1, 20], [4, 21], [4, 22]],
  US: [[4, 23], [4, 24], [3, 21], [2, 21], [1, 21], [3, 22], [3, 23], [3, 24], [2, 22], [1, 22]],
  LG: [[2, 23], [2, 24], [1, 0], [12, 1], [11, 1], [10, 1], [9, 1], [8, 1], [7, 1], [6, 1], [5, 1], [4, 1], [2, 1], [1, 1], [12, 2], [11, 2], [10, 2], [9, 2], [8, 2], [7, 2], [6, 2], [5, 2], [3, 2], [2, 2], [1, 2]],
  LF: [[12, 3], [11, 3], [10, 3], [9, 3], [8, 3], [7, 3], [6, 3], [4, 3], [3, 3], [2, 3], [1, 3], [12, 4], [11, 4], [10, 4], [9, 4], [8, 4], [7, 4], [5, 4], [4, 4], [3, 4], [2, 4], [1, 4], [12, 5], [11, 5], [10, 5]],
  LE: [[9, 5], [8, 5], [6, 5], [5, 5], [4, 5], [3, 5], [2, 5], [1, 5], [12, 6], [11, 6], [10, 6], [9, 6], [7, 6], [6, 6], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [12, 7], [11, 7], [10, 7], [8, 7], [7, 7], [6, 7]],
  LD: [[5, 7], [4, 7], [3, 7], [2, 7], [1, 7], [12, 8], [11, 8], [9, 8], [8, 8], [7, 8], [6, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [12, 9], [10, 9], [9, 9], [8, 9], [7, 9], [6, 9], [5, 9], [4, 9], [3, 9]],
  LC: [[2, 9], [1, 9], [11, 10], [10, 10], [9, 10], [8, 10], [7, 10], [6, 10], [5, 10], [4, 10], [3, 10], [2, 10], [12, 11], [11, 11], [10, 11], [9, 11], [8, 11], [7, 11], [6, 11], [5, 11], [4, 11], [3, 11], [1, 11], [12, 12], [11, 12]],
  LB: [[10, 12], [9, 12], [8, 12], [7, 12], [6, 12], [5, 12], [4, 12], [2, 12], [1, 12], [12, 13], [12, 14], [12, 15], [12, 16], [12, 17], [12, 18], [12, 19], [12, 20], [12, 22], [12, 23], [12, 24], [11, 13], [10, 13], [9, 13], [8, 13], [7, 13]],
  LA: [[6, 13], [5, 13], [3, 13], [2, 13], [1, 13], [11, 14], [11, 15], [11, 16], [11, 17], [11, 18], [11, 19], [11, 20], [11, 22], [11, 23], [11, 24], [10, 14], [9, 14], [8, 14], [7, 14], [6, 14], [5, 14], [4, 14], [2, 14], [1, 14], [10, 15]],
  LS: [[10, 16], [10, 17], [10, 18], [10, 19], [10, 20], [10, 21], [10, 22], [10, 24], [9, 15], [8, 15], [7, 15], [6, 15], [5, 15], [4, 15], [3, 15], [2, 15], [1, 15], [9, 17], [9, 18], [9, 19], [9, 20], [9, 21], [9, 22], [9, 23], [9, 24]],
};

const HIGH_RANK_SPRITE_CELL_X = 6;
const HIGH_RANK_SPRITE_CELL_Y = 155;
const HIGH_RANK_SPRITE_CELL_STEP = 158;
const HIGH_RANK_SPRITE_WIDTH = 150;
const HIGH_RANK_SPRITE_HEIGHT = 153;

/**
 * The full ordered rank → sprite-rect map (G, G+, … SS+, UG, UG1…UG9, UF, …,
 * LS, LS1…LS24). Order is canonical ascending rating; `Object.keys()` yields the
 * label list in that order.
 */
export function computeRankSpriteMap(): Record<string, SpriteRect> {
  const map: Record<string, SpriteRect> = { ...BASE_GAME_RANK_SPRITE_MAP };
  for (const [family, cells] of Object.entries(HIGH_RANK_SPRITE_GRID)) {
    cells.forEach(([row, col], idx) => {
      const label = idx === 0 ? family : `${family}${idx}`;
      map[label] = {
        x: HIGH_RANK_SPRITE_CELL_X + col * HIGH_RANK_SPRITE_CELL_STEP,
        y: HIGH_RANK_SPRITE_CELL_Y + (row - 1) * HIGH_RANK_SPRITE_CELL_STEP,
        w: HIGH_RANK_SPRITE_WIDTH,
        h: HIGH_RANK_SPRITE_HEIGHT,
      };
    });
  }
  return map;
}

/** Ordered rank labels (G … LS24). */
export function rankLabelsOrdered(): string[] {
  return Object.keys(computeRankSpriteMap());
}

/**
 * Filesystem/URL-safe filename stem for a rank label — only the `+` suffix
 * ranks (G+ … SS+) need escaping; everything else is already `[A-Za-z0-9]`.
 * `SS+` → `SS-plus`, `UG3` → `UG3`. The manifest stores the raw label; consumers
 * resolve `rank/<rankIconFilename(label)>.webp` with this same function.
 */
export function rankIconFilename(label: string): string {
  return label.replace('+', '-plus');
}
