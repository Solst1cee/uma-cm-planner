/** Compatibility indicator (◎/○/△) for a lineage-affinity score — the in-game
 *  compatibility mark. Pure/presentational; used next to the picker's per-uma
 *  affinity number and beside the "Inheritance" card header for the selection.
 *  Bands (△ 0–50, ○ 51–150, ◎ 151+) come from core `affinityTier`. */
import { affinityTier } from '@/core/affinity';
import type { AffinityTier } from '@/core/types';

const CLASS: Record<AffinityTier, string> = { '◎': 'dcircle', '○': 'circle', '△': 'tri' };

export function AffinityMark({ score, title, size }: { score: number; title?: string; size?: number }) {
  const sym = affinityTier(score);
  return (
    <span
      className={`inh-aff-mark is-${CLASS[sym]}`}
      style={size ? { fontSize: `${size}px` } : undefined}
      title={title ?? `Compatibility ${sym} (affinity ${score})`}
      aria-label={`compatibility ${sym}`}
    >
      {sym}
    </span>
  );
}
