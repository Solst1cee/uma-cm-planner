/** In-game-style spark filter grid (M1.4). Four labelled rows of factor tiles —
 *  blue stats, surface, distance, style — mirroring the in-game aptitude layout.
 *  Each tile carries a two-tier star strip: 3 GOLD stars = the veteran's own
 *  (legacy) requirement, then up to 6 SILVER stars = additional lineage total
 *  (gold + silver ≤ 9). A tile with all stars empty imposes no filter.
 *
 *  Provider-free: the (optional) coloured blue-stat icon arrives as a render
 *  prop, so this stays testable without a GameDataProvider. */
import type { ReactNode } from 'react';
import type { Stat } from '@/core/types';
import { STAT_OPTIONS } from '@/features/parents/sparkMeta';

export type TileKind = 'blue' | 'pink';
export interface TileValue {
  /** Required own/legacy stars (gold), 0–3. */
  legacyMin: number;
  /** Required lineage total stars (gold + silver), 0–9; always ≥ legacyMin. */
  totalMin: number;
}

const GOLD = 3;
const SILVER = 6;

/** Short labels so the style/distance tiles stay compact in the grid. */
const SHORT_LABEL: Record<string, string> = {
  turf: 'Turf', dirt: 'Dirt',
  sprint: 'Sprint', mile: 'Mile', medium: 'Medium', long: 'Long',
  front: 'Front', pace: 'Pace', late: 'Late', end: 'End',
};

interface RowDef { label: string; kind: TileKind; keys: string[] }
const ROWS: RowDef[] = [
  { label: 'Blue', kind: 'blue', keys: STAT_OPTIONS.map((o) => o.key) },
  { label: 'Surface', kind: 'pink', keys: ['turf', 'dirt'] },
  { label: 'Distance', kind: 'pink', keys: ['sprint', 'mile', 'medium', 'long'] },
  { label: 'Style', kind: 'pink', keys: ['front', 'pace', 'late', 'end'] },
];

function tileLabel(kind: TileKind, key: string): string {
  if (kind === 'blue') return STAT_OPTIONS.find((o) => o.key === key)?.label ?? key;
  return SHORT_LABEL[key] ?? key;
}

export function SparkFilterGrid({
  value,
  onTile,
  maxTotal,
  legacyLocked,
  statIcon,
}: {
  /** Current requirement for a tile (0/0 if unset). */
  value: (kind: TileKind, key: string) => TileValue;
  /** Set a tile's requirement; (0,0) clears it. */
  onTile: (kind: TileKind, key: string, legacyMin: number, totalMin: number) => void;
  /** Largest total still reachable for a tile given the 3-member budget (0–9). */
  maxTotal: (kind: TileKind, key: string) => number;
  /** Another tile in this category already holds the single legacy spark. */
  legacyLocked: (kind: TileKind, key: string) => boolean;
  /** Optional coloured blue-stat icon (container-wired; omitted in tests). */
  statIcon?: (stat: Stat) => ReactNode;
}) {
  const renderStrip = (kind: TileKind, key: string, v: TileValue) => {
    const extra = v.totalMin - v.legacyMin; // silver filled
    const name = tileLabel(kind, key);
    const cap = maxTotal(kind, key);
    const goldLocked = legacyLocked(kind, key); // another type owns this category's legacy
    // Click the i-th gold (legacy) star: toggle legacy to i (or i-1 if already i),
    // keeping the silver "extra" so the total moves with it.
    const setGold = (i: number) => {
      const legacy = v.legacyMin === i ? i - 1 : i;
      onTile(kind, key, legacy, legacy + extra);
    };
    // Click the j-th silver star: set the extra to j (or j-1 if already j).
    const setSilver = (j: number) => {
      const ex = extra === j ? j - 1 : j;
      onTile(kind, key, v.legacyMin, v.legacyMin + ex);
    };
    return (
      <span className="inh-fg-stars" role="group" aria-label={`${name} stars`}>
        {Array.from({ length: GOLD }, (_, idx) => idx + 1).map((i) => {
          const on = i <= v.legacyMin;
          // Disabled when the legacy belongs to another type, or raising legacy to i
          // would push the total past the member budget.
          const disabled = (goldLocked && !on) || (!on && i + extra > cap);
          return (
            <button
              key={`g${i}`}
              type="button"
              className={`inh-fg-star is-gold${on ? ' is-on' : ''}`}
              aria-label={`${name} gold ${i}`}
              aria-pressed={on}
              disabled={disabled}
              onClick={() => setGold(i)}
            >★</button>
          );
        })}
        {Array.from({ length: SILVER }, (_, idx) => idx + 1).map((j) => {
          const on = j <= extra;
          const disabled = !on && v.legacyMin + j > cap; // would exceed the budget
          return (
            <button
              key={`s${j}`}
              type="button"
              className={`inh-fg-star is-silver${j === 1 ? ' inh-fg-sep' : ''}${on ? ' is-on' : ''}`}
              aria-label={`${name} silver ${j}`}
              aria-pressed={on}
              disabled={disabled}
              onClick={() => setSilver(j)}
            >★</button>
          );
        })}
      </span>
    );
  };

  return (
    <div className="inh-fg" role="group" aria-label="Spark filters">
      {ROWS.map((row) => (
        <div key={row.label} className="inh-fg-row">
          <span className="inh-fg-row-label muted small">{row.label}</span>
          <div className="inh-fg-tiles">
            {row.keys.map((key) => {
              const v = value(row.kind, key);
              const active = v.legacyMin > 0 || v.totalMin > 0;
              return (
                <div key={key} className={`inh-fg-tile spark-${row.kind}${active ? ' is-active' : ''}`}>
                  <span className="inh-fg-tile-head">
                    {row.kind === 'blue' && statIcon && <span className="inh-fg-icon">{statIcon(key as Stat)}</span>}
                    <span className="inh-fg-tile-name">{tileLabel(row.kind, key)}</span>
                    {active && (
                      <span className="inh-fg-readout muted small" title={`legacy ≥${v.legacyMin}, total ≥${v.totalMin}`}>
                        {v.legacyMin}/{v.totalMin}
                      </span>
                    )}
                  </span>
                  {renderStrip(row.kind, key, v)}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
