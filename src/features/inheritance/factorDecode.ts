/**
 * Pure UmaExtractor factor-id decoder. The star level is the LAST digit (1–3);
 * the leading digits identify the factor. Ranges validated against
 * spikes/repos/uma-parent-viewer/enrich_data.py + the sample veteran.
 *
 *   100–599        blue stat   (stat = floor(id/100): 1 spd 2 sta 3 pow 4 gut 5 wit)
 *   1100–1299      pink ground (11 turf, 12 dirt)
 *   2100–2499      pink style  (21 front, 22 pace, 23 late, 24 end)
 *   3100–3499      pink dist   (31 sprint, 32 mile, 33 medium, 34 long)
 *   2_000_000..    white skill (group base = floor(id/100)*10)
 *   10_000_000..   green/unique (10[middle][variant][star])
 *   1e6..1e7 else  race / scenario sparks → skip (not in the Parent model)
 */
import type { Stat, Strategy } from '@/core/types';

export type DecodedFactor =
  | { kind: 'blue'; stat: Stat; star: 1 | 2 | 3 }
  | { kind: 'pink'; aptitude: string; star: 1 | 2 | 3 }
  | { kind: 'white'; groupBase: number; star: 1 | 2 | 3 }
  | { kind: 'green'; uniqueSkillId: string; star: 1 | 2 | 3 }
  | { kind: 'skip' };

const SKIP: DecodedFactor = { kind: 'skip' };
const BLUE_STAT: Record<number, Stat> = { 1: 'spd', 2: 'sta', 3: 'pow', 4: 'gut', 5: 'wit' };
const PINK_SURFACE: Record<number, string> = { 11: 'turf', 12: 'dirt' };
const PINK_STYLE: Record<number, Strategy> = { 21: 'front', 22: 'pace', 23: 'late', 24: 'end' };
const PINK_DISTANCE: Record<number, string> = { 31: 'sprint', 32: 'mile', 33: 'medium', 34: 'long' };

function star(id: number): 1 | 2 | 3 | null {
  const s = id % 10;
  return s === 1 || s === 2 || s === 3 ? s : null;
}

export function decodeFactor(id: number): DecodedFactor {
  if (!Number.isInteger(id) || id <= 0) return SKIP;
  const s = star(id);

  // green/unique: 8-digit 10[middle:3][variant:1][star:2]
  if (id >= 10_000_000 && id < 20_000_000) {
    const str = String(id);
    if (str.length !== 8 || s === null) return SKIP;
    const middle = Number(str.slice(2, 5));
    const variant = Number(str[5]);
    const base = variant === 2 ? 110001 : 100001;
    return { kind: 'green', uniqueSkillId: String(base + middle), star: s };
  }
  // white skill spark
  if (id >= 2_000_000 && id < 3_000_000) {
    if (s === null) return SKIP;
    return { kind: 'white', groupBase: Math.floor(id / 100) * 10, star: s };
  }
  // race + scenario sparks → skip
  if (id >= 1_000_000 && id < 10_000_000) return SKIP;

  // blue stat (3-digit)
  if (id >= 100 && id <= 599) {
    const stat = BLUE_STAT[Math.floor(id / 100)];
    return stat && s !== null ? { kind: 'blue', stat, star: s } : SKIP;
  }
  // pink (4-digit)
  if (id >= 1100 && id <= 3499) {
    const group = Math.floor(id / 100);
    const aptitude = PINK_SURFACE[group] ?? PINK_STYLE[group] ?? PINK_DISTANCE[group];
    return aptitude && s !== null ? { kind: 'pink', aptitude, star: s } : SKIP;
  }
  return SKIP;
}
