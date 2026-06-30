/** Green (inherited-unique) spark filter (M1.4). Unique skills are many, so this
 *  is a search box rather than a fixed grid: type → pick a unique → it joins the
 *  filter with the same legacy + total `− ★N +` steppers and the same lineage
 *  budget / single-legacy rules (enforced by the parent via maxTotal / legacyLocked).
 *  Provider-free: the unique-skill options + name resolver arrive as props. */
import { useState } from 'react';
import { SparkStars } from './SparkStars';

export interface GreenClause { id: string; skillId: string; legacyMin: number; totalMin: number }

export function GreenSparkFilter({
  options,
  clauses,
  skillName,
  maxTotal,
  legacyLocked,
  onSet,
}: {
  /** Selectable unique skills. */
  options: Array<{ id: string; name: string }>;
  /** Current green requirements. */
  clauses: GreenClause[];
  skillName: (id: string) => string;
  maxTotal: (skillId: string) => number;
  legacyLocked: (skillId: string) => boolean;
  /** Set/clear a green requirement; (0,0) removes it. */
  onSet: (skillId: string, legacyMin: number, totalMin: number) => void;
}) {
  const [query, setQuery] = useState('');
  const added = new Set(clauses.map((c) => c.skillId));
  const q = query.trim().toLowerCase();
  const matches = q === '' ? [] : options.filter((o) => !added.has(o.id) && o.name.toLowerCase().includes(q)).slice(0, 8);

  return (
    <div className="inh-green">
      <div className="inh-green-search">
        <span className="badge spark-green">Green</span>
        <input
          type="search"
          className="inh-green-input"
          placeholder="Search unique skill…"
          aria-label="Search unique skill"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {matches.length > 0 && (
          <div className="inh-green-results" role="listbox">
            {matches.map((o) => (
              <button key={o.id} type="button" role="option" aria-selected={false}
                onClick={() => { onSet(o.id, 0, 1); setQuery(''); }}>{o.name}</button>
            ))}
          </div>
        )}
      </div>
      {clauses.length > 0 && (
        <div className="inh-fg-tiles inh-green-tiles">
          {clauses.map((c) => {
            const name = skillName(c.skillId);
            return (
              <div key={c.id} className="inh-fg-tile spark-green is-active">
                <span className="inh-fg-tile-name">
                  {name}
                  <button type="button" className="inh-green-x" aria-label={`Remove ${name}`}
                    onClick={() => onSet(c.skillId, 0, 0)}>✕</button>
                </span>
                <SparkStars
                  name={name}
                  legacyMin={c.legacyMin}
                  totalMin={c.totalMin}
                  maxTotal={maxTotal(c.skillId)}
                  legacyLocked={legacyLocked(c.skillId)}
                  onSet={(l, t) => onSet(c.skillId, l, t)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
