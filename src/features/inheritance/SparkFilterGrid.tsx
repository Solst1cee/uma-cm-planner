/** In-game-style spark filter (M1.4). Factor sparks grouped as the in-game
 *  layout — blue stats, surface, distance, style — one line per spark. Each line
 *  carries two `− ★N +` steppers: GOLD = the veteran's own (legacy) requirement
 *  (≤3), and the lineage TOTAL (≤9). The lineage budget (3 members × 3★) and the
 *  single-legacy-per-category rule are enforced by the parent via `maxTotal` /
 *  `legacyLocked`, which disable the steppers that would break them.
 *
 *  Pure/presentational — no GameDataProvider needed. */
import { STAT_OPTIONS } from '@/features/parents/sparkMeta';
import { SparkStepper } from './SparkStepper';

export type TileKind = 'blue' | 'pink';
export interface TileValue {
  /** Required own/legacy stars (gold), 0–3. */
  legacyMin: number;
  /** Required lineage total stars, 0–9; always ≥ legacyMin. */
  totalMin: number;
}

const LEGACY_CAP = 3;
const TOTAL_CAP = 9;

/** Short labels so the style/distance lines stay compact. */
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
  const line = (kind: TileKind, key: string) => {
    const v = value(kind, key);
    const cap = maxTotal(kind, key);
    const locked = legacyLocked(kind, key);
    const name = tileLabel(kind, key);
    const legacyMax = Math.min(LEGACY_CAP, cap);
    const active = v.legacyMin > 0 || v.totalMin > 0;

    const setLegacy = (l: number) => onTile(kind, key, l, Math.max(v.totalMin, l));
    const setTotal = (t: number) => onTile(kind, key, Math.min(v.legacyMin, t), t);

    return (
      <div key={key} className={`inh-fg-line spark-${kind}${active ? ' is-active' : ''}`}>
        <span className="inh-fg-line-name">{name}</span>
        <SparkStepper
          name={name} kindLabel="legacy" value={v.legacyMin} starClass="is-gold"
          dec={() => setLegacy(Math.max(0, v.legacyMin - 1))}
          inc={() => setLegacy(Math.min(legacyMax, v.legacyMin + 1))}
          decDisabled={v.legacyMin <= 0}
          incDisabled={locked || v.legacyMin >= legacyMax}
        />
        <SparkStepper
          name={name} kindLabel="total" value={v.totalMin} starClass="is-silver"
          dec={() => setTotal(Math.max(v.legacyMin, v.totalMin - 1))}
          inc={() => setTotal(Math.min(cap, TOTAL_CAP, v.totalMin + 1))}
          decDisabled={v.totalMin <= v.legacyMin}
          incDisabled={v.totalMin >= Math.min(cap, TOTAL_CAP)}
        />
      </div>
    );
  };

  return (
    <div className="inh-fg" role="group" aria-label="Spark filters">
      {ROWS.map((row) => (
        <div key={row.label} className="inh-fg-group">
          <div className="inh-fg-group-label muted small">{row.label}</div>
          <div className="inh-fg-lines">{row.keys.map((key) => line(row.kind, key))}</div>
        </div>
      ))}
    </div>
  );
}
