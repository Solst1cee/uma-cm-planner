import { useGameData } from '@/features/data/gameData';
import { GameIcon } from '@/features/data/GameIcon';
import type { RankResult } from '@/features/sp-optimizer/rankBaskets';

export interface BuildCardsProps {
  result: RankResult;
}

export function BuildCards({ result }: BuildCardsProps) {
  const { skillById } = useGameData();
  if (result.baskets.length === 0) {
    return <p className="muted">No feasible baskets — lower the budget floor or add candidates.</p>;
  }
  return (
    <div className="sp-cards">
      <p className="small muted">
        {result.mode === 'exact'
          ? 'Exact ranking (every feasible basket simulated).'
          : 'Shortlisted estimate (proxy-narrowed, then simulated).'}
      </p>
      {result.baskets.map((b, i) => (
        <article key={b.skills.join(',')} className="sp-card">
          <header>
            <span className="sp-rank">#{i + 1}</span>
            <span className="sp-descriptor">{b.descriptor}</span>
          </header>
          <ul className="sp-card-skills">
            {b.skills.map((id) => {
              const skill = skillById.get(id);
              return (
                <li key={id}>
                  {skill && <GameIcon kind="skill" id={skill.iconId} size={20} alt="" />}
                  {skill?.nameEn ?? `Skill ${id}`}
                </li>
              );
            })}
          </ul>
          <footer className="small">{b.spUsed} SP used · {b.spLeft} SP left</footer>
        </article>
      ))}
    </div>
  );
}
