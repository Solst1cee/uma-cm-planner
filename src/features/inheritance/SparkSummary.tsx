/** Sticky match-count summary for the Star Tracks spark filter (M1.4): the live
 *  "N parents match / of M in your box" readout, a Reset-all button, and the
 *  active-filter chips (name + gold parent★ + category total★). Provider-free. */
import type { SparkCat } from './SparkFilterCards';

export interface SummaryChip {
  id: string;
  cat: SparkCat;
  name: string;
  legacy: number;
  total: number;
  onRemove: () => void;
}

export function SparkSummary({ matchCount, total, chips, onReset }: {
  matchCount: number;
  total: number;
  chips: SummaryChip[];
  onReset: () => void;
}) {
  return (
    <div className="spc-summary">
      <div className="spc-summary-top">
        <span className="spc-count">{matchCount}</span>
        <span className="spc-count-lbl">
          <b>parents match</b>
          <span className="muted small">of {total} in your box</span>
        </span>
        {chips.length > 0 && (
          <button type="button" className="spc-reset" onClick={onReset}>Reset all</button>
        )}
      </div>
      {chips.length > 0 && (
        <div className="spc-summary-chips">
          {chips.map((c) => (
            <span key={c.id} className={`spc-sum-chip spark-${c.cat}`}>
              <span className="spc-sum-name">{c.name}</span>
              <span className="spc-sum-req">
                {c.legacy > 0 && <span className="spc-sum-gold">{c.legacy}★</span>}
                {(c.legacy === 0 || c.total > c.legacy) && <span className="spc-sum-tone">{c.total}★</span>}
              </span>
              <button type="button" className="spc-sum-x" aria-label={`remove ${c.name}`} onClick={c.onRemove}>✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
