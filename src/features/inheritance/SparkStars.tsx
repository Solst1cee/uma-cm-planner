/** Spark requirement control (M1.4): GOLD legacy stars (the veteran's own spark,
 *  ≤3, click to set) + a TOTAL `− ★N +` stepper for the lineage total (0–9, max 9
 *  — clicking through 9 stars is tedious, so the total uses +/−). Raising a
 *  legacy star auto-raises the total to match (legacy is part of the total). The
 *  lineage budget + single-legacy rules disable what would break them. Pure. */
const GOLD = 3;
const TOTAL_MAX = 9;

export function SparkStars({
  name, legacyMin, totalMin, maxTotal, legacyLocked, onSet,
}: {
  /** Spark name, for accessible labels. */
  name: string;
  legacyMin: number;
  totalMin: number;
  /** Largest reachable total given the 3-member budget (0–9). */
  maxTotal: number;
  /** Another spark in this category already holds the single legacy spark. */
  legacyLocked: boolean;
  onSet: (legacyMin: number, totalMin: number) => void;
}) {
  const cap = Math.min(maxTotal, TOTAL_MAX);
  // Click the i-th gold star → legacy i (or i-1 if already i); bump total to ≥ i.
  const setGold = (i: number) => {
    const legacy = legacyMin === i ? i - 1 : i;
    onSet(legacy, Math.max(totalMin, legacy));
  };
  return (
    <span className="inh-fg-control">
      <span className="inh-fg-stars" role="group" aria-label={`${name} legacy stars`}>
        {Array.from({ length: GOLD }, (_, idx) => idx + 1).map((i) => {
          const on = i <= legacyMin;
          const disabled = (legacyLocked && !on) || (!on && i > cap); // budget can't fit this legacy
          return (
            <button key={`g${i}`} type="button"
              className={`inh-fg-star is-gold${on ? ' is-on' : ''}`}
              aria-label={`${name} gold ${i}`} aria-pressed={on}
              disabled={disabled} onClick={() => setGold(i)}>★</button>
          );
        })}
      </span>
      <span className="inh-fg-total" role="group" aria-label={`${name} total`}>
        <button type="button" className="inh-fg-step-btn" aria-label={`${name} total minus`}
          disabled={totalMin <= legacyMin} onClick={() => onSet(legacyMin, Math.max(legacyMin, totalMin - 1))}>−</button>
        <span className="inh-fg-total-val"><span className="inh-fg-star is-silver is-on" aria-hidden>★</span>{totalMin}</span>
        <button type="button" className="inh-fg-step-btn" aria-label={`${name} total plus`}
          disabled={totalMin >= cap} onClick={() => onSet(legacyMin, Math.min(cap, totalMin + 1))}>+</button>
      </span>
    </span>
  );
}
