import { useGameData } from '@/features/data/gameData';
import { GameIcon } from '@/features/data/GameIcon';
import type { RankResult } from '@/features/sp-optimizer/rankBaskets';

export interface BuildCardsProps {
  result: RankResult;
  selectedIdx: number;
  onSelect: (idx: number) => void;
  onCompare: (idx: number) => void;
}

export function BuildCards({ result, selectedIdx, onSelect, onCompare }: BuildCardsProps) {
  const { skillById } = useGameData();
  if (result.baskets.length === 0) {
    return <p className="muted">No feasible baskets — lower the budget floor or add candidates.</p>;
  }
  return (
    <div className="sp-cards">
      <p className="small muted">
        {result.mode === 'exact'
          ? 'Exact ranking — every feasible basket simulated.'
          : 'Shortlisted estimate — proxy-narrowed, then simulated.'}{' '}
        Ranked by simulated combined L; pick one, then compare.
      </p>
      <div className="sp-cards-row">
        {result.baskets.map((b, i) => (
          <article
            key={b.skills.join(',')}
            className={`sp-card${i === selectedIdx ? ' is-selected' : ''}`}
            aria-current={i === selectedIdx}
          >
            <button type="button" className="sp-card-head" onClick={() => onSelect(i)}>
              <span className="sp-card-title">Basket #{i + 1}</span>
              <span className="sp-card-mode">{result.mode === 'exact' ? 'EXACT' : 'ESTIMATE'}</span>
            </button>
            <div className="sp-card-L sp-Lval">+{b.score.toFixed(2)} L</div>
            <div className="small muted">{b.descriptor}</div>
            <ul className="sp-card-skills">
              {b.skills.map((id) => {
                const skill = skillById.get(id);
                return (
                  <li key={id}>
                    {skill && <GameIcon kind="skill" id={skill.iconId} size={16} alt="" />}
                    {skill?.nameEn ?? id}
                  </li>
                );
              })}
            </ul>
            <footer className="small muted">
              {b.spUsed} SP used · {b.spLeft < 0 ? <span className="sp-over">over by {-b.spLeft}</span> : `${b.spLeft} left`}
            </footer>
            <button type="button" className="sp-compare-btn" onClick={() => onCompare(i)}>
              Compare vs veteran →
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
