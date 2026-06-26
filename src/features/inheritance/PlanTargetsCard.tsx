/** M1 "Plan targets" card (handoff README §"2. Plan targets panel"). Collapsible
 *  cmp-plan-card: blue stat sparks (editable, shared 18★ budget across all stats),
 *  pink aptitude sparks (required career-start stars, also an 18★ budget — derived,
 *  so it warns when a bad plan exceeds it), a mid-run pink readout, and the skill
 *  wishlist (name + SP). Presentational — data + mutations come in via props. */
import type { Stat } from '@/core/types';
import {
  BLUE_TOTAL_MAX,
  PINK_TOTAL_MAX,
  type BlueSparkRow,
  type MidRunSparkRow,
  type PinkSparkRow,
  type WishlistRow,
} from './planTargets';

export interface PlanTargetsCardProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  blueRows: BlueSparkRow[];
  blueTotal: number;
  /** False when the plan's uma can't be resolved → pink/mid-run can't be computed. */
  pinkComputable: boolean;
  pinkRows: PinkSparkRow[];
  pinkTotal: number;
  midRunRows: MidRunSparkRow[];
  availableBlueStats: Array<{ stat: Stat; label: string }>;
  wishlist: WishlistRow[];
  summary: { count: number; totalSp: number };
  onSetBlueStars: (stat: Stat, stars: number) => void;
  onDeleteBlue: (stat: Stat) => void;
  onAddBlue: (stat: Stat) => void;
}

export function PlanTargetsCard({
  collapsed,
  onToggleCollapsed,
  blueRows,
  blueTotal,
  pinkComputable,
  pinkRows,
  pinkTotal,
  midRunRows,
  availableBlueStats,
  wishlist,
  summary,
  onSetBlueStars,
  onDeleteBlue,
  onAddBlue,
}: PlanTargetsCardProps) {
  const pinkOver = pinkTotal > PINK_TOTAL_MAX;
  return (
    <section className="cmp-plan-card inh-targets-card">
      <button
        type="button"
        className="cmp-plan-card-head cmp-collapse-head inh-targets-head"
        aria-expanded={!collapsed}
        onClick={onToggleCollapsed}
      >
        <span>Plan targets</span>
        <span className="cmp-collapse-caret" data-open={!collapsed ? '' : undefined} />
      </button>
      {!collapsed && (
        <div className="cmp-plan-card-body inh-targets-body">
          {/* Blue sparks — shared budget across all stats */}
          <div className="cmp-mini-label">Blue sparks</div>
          <ul className="inh-blue-list">
            {blueRows.length === 0 && <li className="muted small">No blue spark goals yet.</li>}
            {blueRows.map((r) => (
              <li className="inh-blue-row" key={r.stat}>
                <span className="cmp-spark-chip inh-blue-chip inh-spark-chip">
                  {r.label} ★{r.stars}
                </span>
                <span className="inh-stepper">
                  <button
                    type="button"
                    className="inh-step-btn"
                    aria-label={`Decrease ${r.label}`}
                    onClick={() => onSetBlueStars(r.stat, r.stars - 1)}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="inh-step-btn"
                    aria-label={`Increase ${r.label}`}
                    disabled={blueTotal >= BLUE_TOTAL_MAX}
                    onClick={() => onSetBlueStars(r.stat, r.stars + 1)}
                  >
                    +
                  </button>
                </span>
                <button
                  type="button"
                  className="inh-target-del"
                  aria-label={`Remove ${r.label}`}
                  onClick={() => onDeleteBlue(r.stat)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {availableBlueStats.length > 0 && blueTotal < BLUE_TOTAL_MAX && (
            <select
              className="inh-add-blue"
              aria-label="Add blue spark"
              value=""
              onChange={(e) => {
                if (e.target.value) onAddBlue(e.target.value as Stat);
              }}
            >
              <option value="">+ Add stat…</option>
              {availableBlueStats.map((s) => (
                <option key={s.stat} value={s.stat}>
                  {s.label}
                </option>
              ))}
            </select>
          )}

          {/* Pink sparks — required career-start stars (over-budget warning sits on the right) */}
          <div className="cmp-mini-label inh-pink-label">
            <span>Pink sparks</span>
            {pinkComputable && pinkOver && (
              <span className="inh-warn-inline" role="alert">
                ⚠ {pinkTotal}/{PINK_TOTAL_MAX}★ pink
              </span>
            )}
          </div>
          <div className="cmp-spark-chip-list inh-pink-chips">
            {!pinkComputable ? (
              <span className="cmp-spark-empty">Select this plan's uma to compute pink requirements.</span>
            ) : pinkRows.length === 0 ? (
              <span className="cmp-spark-empty">none required</span>
            ) : (
              pinkRows.map((r) => (
                <span className="cmp-spark-chip inh-spark-chip" key={r.label}>
                  {r.label} ★{r.stars}
                </span>
              ))
            )}
          </div>
          {/* Mid-run pink procs still needed after career-start inheritance */}
          {pinkComputable && midRunRows.length > 0 && (
            <>
              <div className="cmp-mini-label">Mid-run spark</div>
              <div className="cmp-spark-chip-list inh-pink-chips">
                {midRunRows.map((r) => (
                  <span className="cmp-spark-chip inh-spark-chip" key={r.label}>
                    {r.label} ×{r.steps}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* Wishlist */}
          <div className="cmp-mini-label">
            Wishlist ({summary.count} skill{summary.count === 1 ? '' : 's'} · {summary.totalSp} SP)
          </div>
          <ul className="target-list">
            {wishlist.length === 0 && <li className="target-row muted small">No wishlist skills yet.</li>}
            {wishlist.map((w) => (
              <li className="target-row" key={w.skillId}>
                <span className={`target-name ${w.gold ? 'inh-wl-gold' : ''}`.trim()}>{w.name}</span>
                <span className="inh-wl-sp">{w.sp} SP</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
