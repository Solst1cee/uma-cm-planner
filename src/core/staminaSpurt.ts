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

/** One stamina probe: the rate (0–100) AND the per-sample finish HP at that stamina. */
export interface SpurtSample {
  rate: number;
  finalHp: number[];
}

/** Binary-search the smallest integer stamina in [lo,hi] whose rate >= threshold.
 *  Assumes rate is (weakly) monotonic increasing in stamina. Returns the finish-HP
 *  distribution sampled AT the chosen stamina so callers can show the resulting buffer.
 *  Works for either metric (full-spurt rate or stamina survival) — the probe decides. */
export async function requiredStaminaForSpurt(
  probe: (sta: number) => Promise<SpurtSample>,
  threshold: number,
  range: { lo: number; hi: number },
): Promise<{ sta: number; rate: number; reachable: boolean; finalHp: number[] }> {
  const lo0 = await probe(range.lo);
  if (lo0.rate >= threshold) return { sta: range.lo, rate: lo0.rate, reachable: true, finalHp: lo0.finalHp };
  const hi0 = await probe(range.hi);
  if (hi0.rate < threshold) return { sta: range.hi, rate: hi0.rate, reachable: false, finalHp: hi0.finalHp };

  let lo = range.lo, hi = range.hi;
  let bestSta = range.hi, bestRate = hi0.rate, bestHp = hi0.finalHp;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const s = await probe(mid);
    if (s.rate >= threshold) { bestSta = mid; bestRate = s.rate; bestHp = s.finalHp; hi = mid; }
    else { lo = mid; }
  }
  return { sta: bestSta, rate: bestRate, reachable: true, finalHp: bestHp };
}
