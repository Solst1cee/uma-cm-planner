/**
 * Display metadata + formatting for spark entry (Parent records, plan §6
 * step 4). Pure presentation helpers — spark *math* lives in src/core.
 */
import type { Parent, Stat } from '@/core/types';

export type Stars = 1 | 2 | 3;
export const STARS: readonly Stars[] = [1, 2, 3];

export const STAT_LABEL: Record<Stat, string> = {
  spd: 'Speed',
  sta: 'Stamina',
  pow: 'Power',
  gut: 'Guts',
  wit: 'Wit',
};

export const STAT_OPTIONS: ReadonlyArray<{ key: Stat; label: string }> = (
  ['spd', 'sta', 'pow', 'gut', 'wit'] as const
).map((key) => ({ key, label: STAT_LABEL[key] }));

/** Pink-spark aptitude keys (surface / distance / style), Global EN labels. */
export const APTITUDE_OPTIONS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'turf', label: 'Turf' },
  { key: 'dirt', label: 'Dirt' },
  { key: 'sprint', label: 'Sprint' },
  { key: 'mile', label: 'Mile' },
  { key: 'medium', label: 'Medium' },
  { key: 'long', label: 'Long' },
  { key: 'front', label: 'Front Runner' },
  { key: 'pace', label: 'Pace Chaser' },
  { key: 'late', label: 'Late Surger' },
  { key: 'end', label: 'End Closer' },
];

export function aptitudeLabel(key: string): string {
  return APTITUDE_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

export function starsGlyph(stars: Stars): string {
  return '★'.repeat(stars);
}

/** One-line spark digest, e.g. "Speed ★★★ · Turf ★★ · unique ★ · 2 white". */
export function sparkSummary(parent: Parent): string {
  const parts = [
    `${STAT_LABEL[parent.blueSpark.stat]} ${starsGlyph(parent.blueSpark.stars)}`,
    `${aptitudeLabel(parent.pinkSpark.aptitude)} ${starsGlyph(parent.pinkSpark.stars)}`,
  ];
  if (parent.greenSpark) parts.push(`unique ${starsGlyph(parent.greenSpark.stars)}`);
  if (parent.whiteSparks.length > 0) {
    parts.push(`${parent.whiteSparks.length} white`);
  }
  return parts.join(' · ');
}
