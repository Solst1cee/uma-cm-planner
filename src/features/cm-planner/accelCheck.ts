/** Pure function: classify where on the course a speed/accel skill fires.
 *
 *  Buckets:
 *   - 'optimal' — fires in or past the final straight (>= finalStraightStart)
 *   - 'mid'     — fires in the second half but before the final straight
 *   - 'early'   — fires in the first half (< distance * 0.5)
 *   - 'none'    — never fires (activationPos is null)
 */

export type AccelTiming = 'optimal' | 'mid' | 'early' | 'none';

/** Classify the median activation position of a speed/accel skill.
 *
 *  @param activationPos  median activation position in metres, or null when the skill never fires
 *  @param finalStraightStart  start of the final straight in metres (from course geometry)
 *  @param distance  total course distance in metres
 */
export function classifyAccelTiming(
  activationPos: number | null,
  finalStraightStart: number,
  distance: number,
): AccelTiming {
  if (activationPos === null) return 'none';
  if (activationPos >= finalStraightStart) return 'optimal';
  if (activationPos >= distance * 0.5) return 'mid';
  return 'early';
}
