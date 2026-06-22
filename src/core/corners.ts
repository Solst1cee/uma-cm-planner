/**
 * Physical corner numbering for a course. The engine's `CourseData.corners` is a flat,
 * positional `{ start, length }[]` in race order with NO physical corner identity — so on
 * wrap-around tracks (e.g. Hanshin 3200m runs 1.5 laps → 6 corner segments) the segments aren't
 * simply C1..C6. The real corner number is recovered by counting BACK from the last corner, which
 * is always C4 (the final corner before the finish), modulo 4.
 *
 * Single source of truth ported from umalator-global's `section-bar` corner label; reused by the
 * §0 track section bar and the race-compare overlay markers.
 */

/** Physical corner number (1–4) for the `index`-th corner of a `cornerCount`-corner course. */
export function cornerNumber(cornerCount: number, index: number): number {
  return 4 - ((cornerCount - index - 1) % 4);
}

/** Physical corner label, e.g. `C3`. */
export function cornerLabel(cornerCount: number, index: number): string {
  return `C${cornerNumber(cornerCount, index)}`;
}

/** Index of the corner segment containing `pos` (start-inclusive, end-exclusive), or -1 on a
 *  straight. Corners don't overlap, so the first match wins. */
export function cornerIndexAt(
  corners: ReadonlyArray<{ readonly start: number; readonly length: number }>,
  pos: number,
): number {
  for (let i = 0; i < corners.length; i++) {
    const c = corners[i]!;
    if (pos >= c.start && pos < c.start + c.length) return i;
  }
  return -1;
}
