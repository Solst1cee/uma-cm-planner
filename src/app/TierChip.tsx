/** Small availability-tier badge: nothing for `now` (the default, unworth
 *  flagging), an amber `upcoming` chip, a violet `future` chip. */
import type { AvailabilityTier } from '@/core/availability';

export function TierChip({ tier }: { tier: AvailabilityTier }) {
  if (tier === 'now') return null;
  return <span className={`tier-chip tier-${tier}`}>{tier}</span>;
}
