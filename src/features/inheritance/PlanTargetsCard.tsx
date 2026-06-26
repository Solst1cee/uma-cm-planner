/** M1 "Plan targets" card (handoff README §"2. Plan targets panel"). Collapsible
 *  cmp-plan-card with three sections: blue stat sparks (editable star steppers +
 *  delete + add), pink aptitude sparks (display-only, from the plan), and the
 *  skill wishlist (name + SP, gold-tinted for gold-rarity skills). Presentational
 *  — all data + mutations come in via props. */
import type { Stat } from '@/core/types';
import type { AptChip } from './umaPlanApt';
import type { BlueSparkRow, WishlistRow } from './planTargets';

export interface PlanTargetsCardProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  blueRows: BlueSparkRow[];
  pinkRows: AptChip[];
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
  pinkRows,
  availableBlueStats,
  wishlist,
  summary,
  onSetBlueStars,
  onDeleteBlue,
  onAddBlue,
}: PlanTargetsCardProps) {
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
          {/* Blue sparks (stat) */}
          <div className="cmp-mini-label">Blue sparks (stat)</div>
          <ul className="spark-list">
            {blueRows.length === 0 && <li className="muted small">No blue spark goals yet.</li>}
            {blueRows.map((r) => (
              <li className="spark-row" key={r.stat}>
                <span className="badge spark-blue inh-target-spark">{r.label}</span>
                <span className="inh-stepper">
                  <button
                    type="button"
                    className="inh-step-btn"
                    aria-label={`Decrease ${r.label}`}
                    onClick={() => onSetBlueStars(r.stat, r.stars - 1)}
                  >
                    −
                  </button>
                  <span className="inh-star-val">{r.stars}★</span>
                  <button
                    type="button"
                    className="inh-step-btn"
                    aria-label={`Increase ${r.label}`}
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
          {availableBlueStats.length > 0 && (
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

          {/* Pink sparks (aptitude / style · from plan), display-only */}
          <div className="cmp-mini-label">Pink sparks (aptitude / style · from plan)</div>
          <ul className="spark-list">
            {pinkRows.map((c) => (
              <li className="spark-row" key={c.label}>
                <span className="badge spark-pink inh-target-spark">{c.label}</span>
                <span className="inh-star-val">{c.grade}</span>
              </li>
            ))}
          </ul>

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
