/** M1.8 — "Target spark" card (handoff §7). Provider-free: takes a computed
 *  `TargetSpark` (see targetSpark.ts) and renders BLUE / PINK / WHITE sections.
 *  Reuses the `cmp-plan-card` grammar + global `.badge.spark-*` chips. Not
 *  collapsible (matches the handoff). */
import type { TargetSpark } from './targetSpark';

export function TargetSparkCard({ spark }: { spark: TargetSpark }) {
  return (
    <div className="cmp-plan-card inh-target-spark">
      <div className="cmp-plan-card-head">Target spark</div>
      <div className="cmp-plan-card-body">
        <p className="inh-target-spark-intro">
          Sparks to hunt for on a parent / rental to complete this plan.
        </p>

        <div className="cmp-mini-label">Blue</div>
        <span className="spark-chips">
          {spark.blue.map((b) => (
            <span key={b.stat} className="badge spark-blue">
              {b.label} {b.stars}★
            </span>
          ))}
        </span>

        <div className="cmp-mini-label">Pink</div>
        <span className="spark-chips">
          {spark.pink.map((p, i) => (
            <span key={`${p.label}-${i}`} className="badge spark-pink">
              {p.label} {p.stars}★
            </span>
          ))}
        </span>

        <div className="cmp-mini-label">
          White <span className="inh-target-spark-sub">(uncovered skills)</span>
        </div>
        {spark.coverage === 'gaps' && (
          <span className="spark-chips">
            {spark.white.map((w) => (
              <span key={w.id} className="badge spark-green">
                {w.name}
              </span>
            ))}
          </span>
        )}
        {spark.coverage === 'covered' && (
          <p className="inh-target-spark-ok">✓ All wishlist skills obtainable from your setup.</p>
        )}
        {spark.coverage === 'pending' && (
          <p className="inh-target-spark-pending muted small">
            Coverage pending — needs the obtainable-vs-wishlist matrix (M1.7).
          </p>
        )}
      </div>
    </div>
  );
}
