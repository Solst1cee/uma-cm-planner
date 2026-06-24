export function hpStats(finalHp: number[]): { min: number; max: number; median: number; mean: number } {
  if (finalHp.length === 0) return { min: 0, max: 0, median: 0, mean: 0 };
  const s = [...finalHp].sort((a, b) => a - b);
  const m = s.length >> 1;
  const median = s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
  const mean = s.reduce((acc, v) => acc + v, 0) / s.length;
  return { min: s[0]!, max: s[s.length - 1]!, median, mean };
}

export function histogram(
  finalHp: number[],
  bins: number,
): { x0: number; x1: number; count: number }[] {
  if (finalHp.length === 0 || bins < 1) return [];
  const max = Math.max(...finalHp, 0);
  const hi = max <= 0 ? 1 : max;
  const width = hi / bins;
  const out = Array.from({ length: bins }, (_, i) => ({ x0: i * width, x1: (i + 1) * width, count: 0 }));
  for (const v of finalHp) {
    let idx = Math.floor(v / width);
    if (idx >= bins) idx = bins - 1;
    if (idx < 0) idx = 0;
    out[idx]!.count++;
  }
  return out;
}

/** Binary-search the smallest integer stamina in [lo,hi] whose spurtRate >= threshold.
 *  Assumes spurtRate is (weakly) monotonic increasing in stamina. */
export async function requiredStaminaForSpurt(
  spurtRate: (sta: number) => Promise<number>,
  threshold: number,
  range: { lo: number; hi: number },
): Promise<{ sta: number; rate: number; reachable: boolean }> {
  const loRate = await spurtRate(range.lo);
  if (loRate >= threshold) return { sta: range.lo, rate: loRate, reachable: true };
  const hiRate = await spurtRate(range.hi);
  if (hiRate < threshold) return { sta: range.hi, rate: hiRate, reachable: false };

  let lo = range.lo, hi = range.hi, bestSta = range.hi, bestRate = hiRate;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const r = await spurtRate(mid);
    if (r >= threshold) { bestSta = mid; bestRate = r; hi = mid; }
    else { lo = mid; }
  }
  return { sta: bestSta, rate: bestRate, reachable: true };
}
