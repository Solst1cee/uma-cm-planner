/** In-game-style spark filter (M1.4). Factor sparks grouped as the in-game
 *  layout — blue stats, surface, distance, style — as coloured tiles. Each tile
 *  carries a two-tier star strip: GOLD = the veteran's own (legacy) requirement
 *  (≤3), then SILVER = extra lineage total (≤9). The lineage budget (3 members ×
 *  3★) and the single-legacy-per-category rule are enforced by the parent via
 *  `maxTotal` / `legacyLocked`, which disable the stars that would break them.
 *
 *  Pure/presentational — no GameDataProvider needed. */
import { STAT_OPTIONS } from '@/features/parents/sparkMeta';
import { SparkStars } from './SparkStars';

export type TileKind = 'blue' | 'pink';
export interface TileValue {
  /** Required own/legacy stars (gold), 0–3. */
  legacyMin: number;
  /** Required lineage total stars, 0–9; always ≥ legacyMin. */
  totalMin: number;
}

/** Short labels so the style/distance tiles stay compact. */
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
}: {
  /** Current requirement for a spark (0/0 if unset). */
  value: (kind: TileKind, key: string) => TileValue;
  /** Set a spark's requirement; (0,0) clears it. */
  onTile: (kind: TileKind, key: string, legacyMin: number, totalMin: number) => void;
  /** Largest total still reachable given the 3-member budget (0–9). */
  maxTotal: (kind: TileKind, key: string) => number;
  /** Another spark in this category already holds the single legacy spark. */
  legacyLocked: (kind: TileKind, key: string) => boolean;
}) {
  const tile = (kind: TileKind, key: string) => {
    const v = value(kind, key);
    const name = tileLabel(kind, key);
    const active = v.legacyMin > 0 || v.totalMin > 0;
    return (
      <div key={key} className={`inh-fg-tile spark-${kind}${active ? ' is-active' : ''}`}>
        <span className="inh-fg-tile-name">{name}</span>
        <SparkStars
          name={name}
          legacyMin={v.legacyMin}
          totalMin={v.totalMin}
          maxTotal={maxTotal(kind, key)}
          legacyLocked={legacyLocked(kind, key)}
          onSet={(l, t) => onTile(kind, key, l, t)}
        />
      </div>
    );
  };

  return (
    <div className="inh-fg" role="group" aria-label="Spark filters">
      {ROWS.map((row) => (
        <div key={row.label} className="inh-fg-group">
          <div className="inh-fg-group-label muted small">{row.label}</div>
          <div className="inh-fg-tiles">{row.keys.map((key) => tile(row.kind, key))}</div>
        </div>
      ))}
    </div>
  );
}
