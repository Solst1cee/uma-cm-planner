import type { RankResult } from '@/features/sp-optimizer/rankBaskets';

export interface ResultBannerProps {
  result: RankResult;
  selectedIdx: number;
  spBudget: number;
}

export function ResultBanner({ result, selectedIdx, spBudget }: ResultBannerProps) {
  const basket = result.baskets[selectedIdx] ?? result.baskets[0];
  if (!basket) return null;
  const vsGreedy = basket.score - result.greedyScore;
  const usedPct = spBudget > 0 ? Math.min(100, Math.round((basket.spUsed / spBudget) * 100)) : 0;
  return (
    <div className="sp-banner" role="status">
      <div className="sp-banner-head">
        <span className="sp-banner-label">
          OPTIMAL BASKET · {result.mode === 'exact' ? 'EXACT' : 'ESTIMATE'}
        </span>
        <div className="sp-banner-big">
          Buy {basket.skills.length} → <span className="sp-Lval">+{basket.score.toFixed(2)} L</span>
        </div>
      </div>
      <div className="sp-banner-bar">
        <div className="sp-bar"><i style={{ width: `${usedPct}%` }} /></div>
        {vsGreedy > 0.005 && (
          <p className="small muted">
            vs greedy-by-ratio: <b className="sp-Lval">+{vsGreedy.toFixed(2)} L</b> better
          </p>
        )}
      </div>
      <div className="sp-banner-sp">
        <div className="sp-banner-used">{basket.spUsed.toLocaleString()}</div>
        <div className="small muted">/ {spBudget.toLocaleString()} · {Math.max(0, spBudget - basket.spUsed)} SP left</div>
      </div>
    </div>
  );
}
