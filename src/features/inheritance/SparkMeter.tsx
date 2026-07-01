/** Star meters for the "Star Tracks" spark filter (M1.4). Ported from the design
 *  handoff (docs/handoff/design_handoff_spark_filter). Two meters per spark:
 *   • LegacyMeter — 3 gold stars = the veteran's own (parent) spark, 0–3★.
 *   • TotalMeter  — 3 lineage-member boxes × 3 stars = 9★; the legacy portion is
 *     gold, the rest the category colour. Boxes past the budget cap dim/disable.
 *   • GreenTotalMeter — a single 3-star row (green total caps at 3★).
 *  Tapping star n sets the threshold to n (or n−1 if already n). Pure. */
const LEGACY_CAP = 3;
const MEMBERS = 3;

function starClass(kind: 'gold' | 'tone', filled: boolean, dead: boolean): string {
  return `spm-star is-${kind}${filled ? ' is-on' : ''}${dead ? ' is-dead' : ''}`;
}

/** 3 gold stars — the parent's own spark requirement. */
export function LegacyMeter({ name, legacy, cap, locked, onSet }: {
  name: string; legacy: number; cap: number; locked: boolean; onSet: (n: number) => void;
}) {
  const lim = locked ? 0 : Math.min(LEGACY_CAP, cap);
  return (
    <span className="spm-row" role="group" aria-label={`${name} parent stars`}>
      {[1, 2, 3].map((n) => {
        const filled = n <= legacy;
        const dead = n > lim && !filled;
        return (
          <button key={n} type="button" className={starClass('gold', filled, dead)}
            aria-label={`${name} own ${n}`} aria-pressed={filled} disabled={dead}
            onClick={() => onSet(n === legacy ? n - 1 : n)}>{filled ? '★' : '☆'}</button>
        );
      })}
    </span>
  );
}

/** 3 member boxes × 3 stars — the lineage total; boxes past the budget dim. */
export function TotalMeter({ name, legacy, total, cap, onSet }: {
  name: string; legacy: number; total: number; cap: number; onSet: (n: number) => void;
}) {
  return (
    <span className="spm-boxes" role="group" aria-label={`${name} total stars`}>
      {[0, 1, 2].map((m) => {
        const boxActive = total > m * LEGACY_CAP;
        const boxAvail = cap > m * LEGACY_CAP;
        return (
          <span key={m} className={`spm-box${m === 0 ? ' is-first' : ''}${boxActive ? ' is-active' : ''}${boxAvail ? '' : ' is-unavail'}`}>
            {[1, 2, 3].map((s) => {
              const n = m * LEGACY_CAP + s;
              const filled = n <= total;
              const fromLeg = n <= legacy;
              const dead = n > cap && !filled;
              return (
                <button key={n} type="button" className={starClass(fromLeg ? 'gold' : 'tone', filled, dead)}
                  aria-label={`${name} lineage ${n}`} aria-pressed={filled} disabled={dead}
                  onClick={() => onSet(n === total ? n - 1 : n)}>{filled ? '★' : '☆'}</button>
              );
            })}
          </span>
        );
      })}
    </span>
  );
}

/** A single 3-star row — green (unique) total caps at 3★. */
export function GreenTotalMeter({ name, legacy, total, cap, onSet }: {
  name: string; legacy: number; total: number; cap: number; onSet: (n: number) => void;
}) {
  const lim = Math.min(LEGACY_CAP, cap);
  return (
    <span className="spm-row" role="group" aria-label={`${name} total stars`}>
      {[1, 2, 3].map((n) => {
        const filled = n <= total;
        const fromLeg = n <= legacy;
        const dead = n > lim && !filled;
        return (
          <button key={n} type="button" className={starClass(fromLeg ? 'gold' : 'tone', filled, dead)}
            aria-label={`${name} lineage ${n}`} aria-pressed={filled} disabled={dead}
            onClick={() => onSet(n === total ? n - 1 : n)}>{filled ? '★' : '☆'}</button>
        );
      })}
    </span>
  );
}

export { MEMBERS, LEGACY_CAP };
