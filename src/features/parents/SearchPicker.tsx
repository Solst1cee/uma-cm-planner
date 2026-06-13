/**
 * Generic searchable picker (umas / skills), following the SkillPicker and
 * InventoryPanel search conventions: name filter, capped results, clears on
 * pick. The caller supplies the already-filtered item universe — P4 server
 * gating happens before items reach this component.
 */
import { useMemo, useState, type ReactNode } from 'react';

export interface SearchItem {
  id: string;
  name: string;
  /** Secondary muted text, also matched by the search (epithet, etc.). */
  sub?: string;
  /** Optional trailing badge, e.g. a rarity tag. */
  badge?: string;
  badgeClass?: string;
  /** Disabled rows render with an "added" marker. */
  disabled?: boolean;
  /** Optional leading visual (e.g. a <GameIcon> portrait), decorative. */
  icon?: ReactNode;
}

const MAX_RESULTS = 30;

export function SearchPicker({
  label,
  placeholder,
  items,
  onPick,
}: {
  label: string;
  placeholder?: string;
  items: SearchItem[];
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return [];
    return items
      .filter(
        (i) =>
          i.name.toLowerCase().includes(q) || (i.sub?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, MAX_RESULTS);
  }, [items, query]);

  return (
    <div className="picker">
      <label className="field">
        <span>{label}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
        />
      </label>
      {query.trim() !== '' && (
        <ul className="picker-results" aria-label={`${label} results`}>
          {results.length === 0 && <li className="muted">No matches.</li>}
          {results.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="picker-row"
                disabled={item.disabled}
                onClick={() => {
                  onPick(item.id);
                  setQuery('');
                }}
              >
                {item.icon}
                <span className="picker-name">
                  {item.name}
                  {item.sub !== undefined && (
                    <span className="muted small"> {item.sub}</span>
                  )}
                </span>
                {item.badge !== undefined && (
                  <span className={`badge ${item.badgeClass ?? ''}`}>{item.badge}</span>
                )}
                {item.disabled && <span className="muted small">added</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
