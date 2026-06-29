/** A `legacy − ★N +` / `total − ★N +` spark requirement stepper (M1.4). Shared
 *  by the blue/pink grid and the green-spark search. Pure/presentational. */
export function SparkStepper({
  name, kindLabel, value, starClass, dec, inc, decDisabled, incDisabled,
}: {
  /** Spark name, for accessible labels. */
  name: string;
  /** 'legacy' | 'total'. */
  kindLabel: string;
  value: number;
  /** 'is-gold' | 'is-silver' — star colour. */
  starClass: string;
  dec: () => void;
  inc: () => void;
  decDisabled: boolean;
  incDisabled: boolean;
}) {
  return (
    <span className="inh-fg-step" role="group" aria-label={`${name} ${kindLabel}`}>
      <span className="inh-fg-step-label muted small">{kindLabel}</span>
      <button type="button" className="inh-fg-step-btn" aria-label={`${name} ${kindLabel} minus`}
        disabled={decDisabled} onClick={dec}>−</button>
      <span className={`inh-fg-step-val ${starClass}`}>
        <span className="inh-fg-star" aria-hidden>★</span>{value}
      </span>
      <button type="button" className="inh-fg-step-btn" aria-label={`${name} ${kindLabel} plus`}
        disabled={incDisabled} onClick={inc}>+</button>
    </span>
  );
}
