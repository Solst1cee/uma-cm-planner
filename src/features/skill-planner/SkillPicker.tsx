/**
 * Searchable skill picker: filters by EN name (case-insensitive), shows SP
 * cost + rarity badge. Global-server records only (P4 — JP-ahead content is
 * never silently offered for a Global plan).
 */
import { useMemo, useState } from 'react';
import type { SkillRecord } from '@/core/types';
import { useGameData } from '@/features/data/gameData';

const MAX_RESULTS = 30;

const RARITY_LABEL: Record<SkillRecord['rarity'], string> = {
  white: 'White',
  gold: 'Gold',
  unique: 'Unique',
  inherited_unique: 'Inherited',
};

export function SkillPicker({
  addedSkillIds,
  onPick,
}: {
  addedSkillIds: ReadonlySet<string>;
  onPick: (skillId: string) => void;
}) {
  const { skills } = useGameData();
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return [];
    return skills
      .filter((s) => s.server === 'global' && s.nameEn.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [skills, query]);

  return (
    <div className="picker">
      <label className="field">
        <span>Add target skill</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search skills by name…"
        />
      </label>
      {query.trim() !== '' && (
        <ul className="picker-results" aria-label="Skill search results">
          {results.length === 0 && <li className="muted">No matching skills.</li>}
          {results.map((skill) => {
            const added = addedSkillIds.has(skill.skillId);
            return (
              <li key={skill.skillId}>
                <button
                  type="button"
                  className="picker-row"
                  disabled={added}
                  onClick={() => {
                    onPick(skill.skillId);
                    setQuery('');
                  }}
                >
                  <span className="picker-name">{skill.nameEn}</span>
                  <span className={`badge rarity-${skill.rarity}`}>
                    {RARITY_LABEL[skill.rarity]}
                  </span>
                  <span className="muted small">{skill.baseSpCost} SP</span>
                  {added && <span className="muted small">added</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
