/** Compact Δ marker for rebalanced skills: Δ? = uncurated JP drift; Δv{N} [~arrival] = curated. */
import type { RebalanceInfo } from '@/core/types';

export function RebalanceBadge({ info }: { info?: RebalanceInfo }) {
  if (!info) return null;
  if (info.uncuratedCandidate) {
    return (
      <span className="rebalance-badge" title="JP conditions differ — not yet curated">
        Δ?
      </span>
    );
  }
  const latest = info.versions[info.versions.length - 1];
  const arrival = latest?.globalArrival;
  const label = arrival ? `Δv${info.jpVer} ~${arrival}` : `Δv${info.jpVer}`;
  const title = latest?.note
    ? `v${info.jpVer}: ${latest.note}`
    : `Rebalanced on JP (v${info.jpVer}); Global: v${info.globalVer}`;
  return (
    <span className="rebalance-badge" title={title}>
      {label}
    </span>
  );
}
