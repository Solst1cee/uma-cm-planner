/** The in-game evaluation-rank badge (G … LS24) for a veteran — icon only (the
 *  badge art already spells the rank). Wired (uses GameIcon → needs a
 *  GameDataProvider), so the container builds it and the presentational
 *  card/picker take it as a ReactNode. The rank label rides along as the icon's
 *  `alt` + the wrapper `title` (accessible name / hover) without showing text. */
import { GameIcon } from '@/features/data/GameIcon';

export function RankBadge({ rating, size = 22 }: { rating?: string; size?: number }) {
  if (!rating) return null;
  return (
    <span className="inh-rank-badge" title={`Rank ${rating}`}>
      <GameIcon kind="rank" id={rating} size={size} alt={`Rank ${rating}`} />
    </span>
  );
}
