/** The in-game evaluation-rank badge (G … LS24) for a veteran. Wired (uses
 *  GameIcon → needs a GameDataProvider), so the container builds it and the
 *  presentational card/picker take it as a ReactNode. The text label stays
 *  beside the art (P3: images augment, never replace — and it survives a
 *  missing-asset placeholder). */
import { GameIcon } from '@/features/data/GameIcon';

export function RankBadge({ rating, size = 22 }: { rating?: string; size?: number }) {
  if (!rating) return null;
  return (
    <span className="inh-rank-badge" title={`Rank ${rating}`}>
      <GameIcon kind="rank" id={rating} size={size} alt={`Rank ${rating}`} />
      <span className="inh-rank-label">{rating}</span>
    </span>
  );
}
