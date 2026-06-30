/** Spark requirement control (M1.4): two `− ★N +` steppers per spark — GOLD =
 *  the veteran's own (legacy) requirement (≤3), SILVER = the lineage total (≤9).
 *  Raising legacy auto-raises the total to match (legacy is part of the total).
 *  The lineage budget + single-legacy rules disable what would break them. Pure. */
const LEGACY_CAP = 3;
const TOTAL_CAP = 9;

function Stepper({
  name, kind, value, starClass, dec, inc, decDisabled, incDisabled,
}: {
  name: string; kind: string; value: number; starClass: string;
  dec: () => void; inc: () => void; decDisabled: boolean; incDisabled: boolean;
}) {
  return (
    <span className="inh-fg-step" role="group" aria-label={`${name} ${kind}`}>
      <button type="button" className="inh-fg-step-btn" aria-label={`${name} ${kind} minus`}
        disabled={decDisabled} onClick={dec}>−</button>
      <span className={`inh-fg-step-val ${starClass}`}><span className="inh-fg-star" aria-hidden>★</span>{value}</span>
      <button type="button" className="inh-fg-step-btn" aria-label={`${name} ${kind} plus`}
        disabled={incDisabled} onClick={inc}>+</button>
    </span>
  );
}

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
  const cap = Math.min(maxTotal, TOTAL_CAP);
  const legacyCap = Math.min(LEGACY_CAP, cap);
  return (
    <span className="inh-fg-control">
      <Stepper
        name={name} kind="legacy" value={legacyMin} starClass="is-gold"
        dec={() => onSet(Math.max(0, legacyMin - 1), totalMin)}
        inc={() => { const l = Math.min(legacyCap, legacyMin + 1); onSet(l, Math.max(totalMin, l)); }}
        decDisabled={legacyMin <= 0}
        incDisabled={legacyLocked || legacyMin >= legacyCap}
      />
      <Stepper
        name={name} kind="total" value={totalMin} starClass="is-silver"
        dec={() => onSet(legacyMin, Math.max(legacyMin, totalMin - 1))}
        inc={() => onSet(legacyMin, Math.min(cap, totalMin + 1))}
        decDisabled={totalMin <= legacyMin}
        incDisabled={totalMin >= cap}
      />
    </span>
  );
}
