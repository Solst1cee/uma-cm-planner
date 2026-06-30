/** Two-tier spark star strip (M1.4) — the in-game requirement control. 3 GOLD
 *  stars = the veteran's own (legacy) requirement (≤3); up to 6 SILVER stars =
 *  the extra lineage total beyond legacy (gold + silver ≤ 9). Click a star to
 *  fill up to it; click the highest-filled to drop it. The lineage budget +
 *  single-legacy rules disable the stars that would break them. Pure. */
const GOLD = 3;
const SILVER = 6;

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
  const extra = totalMin - legacyMin; // silver filled
  const setGold = (i: number) => {
    const legacy = legacyMin === i ? i - 1 : i;
    onSet(legacy, legacy + extra); // keep the silver extra
  };
  const setSilver = (j: number) => {
    const ex = extra === j ? j - 1 : j;
    onSet(legacyMin, legacyMin + ex);
  };
  return (
    <span className="inh-fg-stars" role="group" aria-label={`${name} stars`}>
      {Array.from({ length: GOLD }, (_, idx) => idx + 1).map((i) => {
        const on = i <= legacyMin;
        const disabled = (legacyLocked && !on) || (!on && i + extra > maxTotal);
        return (
          <button key={`g${i}`} type="button"
            className={`inh-fg-star is-gold${on ? ' is-on' : ''}`}
            aria-label={`${name} gold ${i}`} aria-pressed={on}
            disabled={disabled} onClick={() => setGold(i)}>★</button>
        );
      })}
      {Array.from({ length: SILVER }, (_, idx) => idx + 1).map((j) => {
        const on = j <= extra;
        const disabled = !on && legacyMin + j > maxTotal;
        return (
          <button key={`s${j}`} type="button"
            className={`inh-fg-star is-silver${j === 1 ? ' inh-fg-sep' : ''}${on ? ' is-on' : ''}`}
            aria-label={`${name} silver ${j}`} aria-pressed={on}
            disabled={disabled} onClick={() => setSilver(j)}>★</button>
        );
      })}
    </span>
  );
}
