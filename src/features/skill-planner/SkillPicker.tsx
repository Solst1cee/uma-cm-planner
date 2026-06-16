/**
 * Searchable skill picker: filters by EN name (case-insensitive), shows SP
 * cost + rarity badge. Global-server records only (P4 — JP-ahead content is
 * never silently offered for a Global plan).
 */
import { useEffect, useMemo, useState } from 'react';
import { useGameData } from '@/features/data/gameData';
import { GameIcon } from '@/features/data/GameIcon';

const MAX_RESULTS = 30;

export function SkillPicker({
  addedSkillIds,
  onPick,
}: {
  addedSkillIds: ReadonlySet<string>;
  onPick: (skillId: string) => void;
}) {
  const { skills } = useGameData();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return [];
    return skills
      .filter((s) => s.server === 'global' && s.nameEn.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [skills, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (results.length === 0) {
      if (activeIndex !== 0) setActiveIndex(0);
      return;
    }
    if (activeIndex >= results.length) setActiveIndex(results.length - 1);
  }, [activeIndex, results.length]);

  const pick = (skillId: string) => {
    onPick(skillId);
    setQuery('');
  };

  return (
    <div className="picker">
      <label className="field">
        <span className="visually-hidden">Search skills by name</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (results.length === 0) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, results.length - 1));
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
              return;
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              const skill = results[activeIndex];
              if (skill && !addedSkillIds.has(skill.skillId)) pick(skill.skillId);
            }
          }}
          placeholder="+ Search skills by name..."
        />
      </label>
      {query.trim() !== '' && (
        <ul className="picker-results" aria-label="Skill search results">
          {results.length === 0 && <li className="muted">No matching skills.</li>}
          {results.map((skill, index) => {
            const added = addedSkillIds.has(skill.skillId);
            return (
              <li key={skill.skillId}>
                <button
                  type="button"
                  className={`picker-row cmp-skill-plate cmp-skill-rarity-${skill.rarity} ${index === activeIndex ? 'is-active' : ''}`.trim()}
                  disabled={added}
                  aria-selected={index === activeIndex}
                  onClick={() => {
                    pick(skill.skillId);
                  }}
                >
                  <GameIcon kind="skill" id={skill.iconId} size={24} alt="" />
                  <span className="picker-name">{skill.nameEn}</span>
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
