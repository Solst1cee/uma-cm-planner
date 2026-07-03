// src/features/inheritance/CoverageMatrixCard.tsx
/** M1.7 — "Obtainable vs. wishlist" coverage card (design handoff panel 6).
 *  Provider-free: the page computes the CoverageResult and passes it in. */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { CoverageChip, CoverageColumn, CoverageResult, CoverageRow } from '@/core/coverageMatrix';
import { HeaderHelp } from '@/features/cm-planner/HeaderHelp';

/** Provider-free renderer for a support-card icon (the page supplies it). */
export type RenderCardIcon = (cardId: string, size: number) => ReactNode;
/** Provider-free renderer for the icon in front of a skill name — a skill icon,
 *  or the uma portrait for an inherited-unique (the page decides). */
export type RenderSkillIcon = (skillId: string) => ReactNode;
/** Provider-free renderer for an event-detail hint button + popup (the page
 *  supplies it). Return null when no event details exist for the skill —
 *  the cell then falls back to the plain chip. */
export type RenderEventHint = (skillId: string) => ReactNode;
/** Provider-free renderer wrapping the skill name in a click-to-open detail
 *  popup (the page supplies it). Return the name unchanged when no detail. */
export type RenderSkillDetail = (skillId: string, name: ReactNode) => ReactNode;

const COLS: Array<{ key: CoverageColumn; label: string; sep?: boolean }> = [
  { key: 'innate', label: 'Innate' },
  { key: 'event', label: 'Event' },
  { key: 'parent', label: 'Inheritance', sep: true },
  { key: 'hint', label: 'Hint', sep: true },
  { key: 'chain', label: 'Chain' },
  { key: 'random', label: 'Random' },
];

function Chip({ chip, renderCardIcon, renderEventHint }: {
  chip: CoverageChip; renderCardIcon?: RenderCardIcon; renderEventHint?: RenderEventHint;
}) {
  // Event chips render the page-supplied hint button + popup when event details
  // exist for the covering skill; otherwise fall through to the plain chip.
  if (chip.kind === 'event' && chip.skillId && renderEventHint) {
    const hint = renderEventHint(chip.skillId);
    if (hint) return <span className="inh-cov-chip-wrap inh-cov-ev-hint" title={chip.title}>{hint}</span>;
  }
  // Innate renders as plain text (e.g. "Lv5"), matching the Inheritance column —
  // no chip. The uma name / unlock level stays in the hover title.
  if (chip.kind === 'innate') {
    return <span className="inh-cov-innate-text" title={chip.title}>{chip.label}</span>;
  }
  const round = chip.kind === 'event' || chip.kind === 'parent' || chip.kind === 'gp';
  // Deck-source chips (hint/chain/random) render the real support-card icon when
  // the page supplies a renderer; otherwise fall back to the type-colored initials chip.
  const icon = chip.cardId && renderCardIcon ? renderCardIcon(chip.cardId, 20) : null;
  const cls =
    chip.kind === 'event' ? 'inh-cov-chip inh-cov-chip-event' :
    chip.kind === 'parent' ? 'inh-cov-chip inh-cov-chip-parent' :
    chip.kind === 'gp' ? 'inh-cov-chip inh-cov-chip-gp' :
    `inh-cov-chip inh-cov-chip-card type-${chip.cardType ?? 'speed'}`;
  // Per-chip % lives in the hover title; the CELL shows one combined number.
  const title = chip.pct !== undefined ? `${chip.title} — ~${chip.pct}%` : chip.title;
  return (
    <span className="inh-cov-chip-wrap" title={title}>
      {icon ? (
        <span className="inh-cov-chip-icon">{icon}</span>
      ) : (
        <span className={cls} data-round={round ? '1' : undefined}>{chip.label}</span>
      )}
    </span>
  );
}

/** Short source label from a chip title: "Mayano Top Gun · parent white spark"
 *  → { name: "Mayano Top Gun", role: "P" | "GP" }. */
function chipSource(c: CoverageChip & { pct: number }): { name: string; role: string; guaranteed: boolean } {
  return {
    name: c.title.split(' · ')[0] ?? '',
    role: c.kind === 'gp' ? 'GP' : 'P',
    guaranteed: c.pct >= 100,
  };
}

/** One combined inherit-% per cell (the chance AT LEAST ONE priced source passes
 *  the spark down, 1 − ∏(1 − pᵢ); a guaranteed source short-circuits to 100%).
 *  Hovering the number opens a styled popup: a purple "Overall" row + the
 *  formula, then one indented white row per source. */
function CombinedPct({ chips }: { chips: CoverageChip[] }) {
  const priced = chips.filter((c): c is CoverageChip & { pct: number } => c.pct !== undefined);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    // Pop from the right of the number; flip to the left if it would overflow.
    const w = 320;
    const right = r.right + 6;
    const left = right + w + 8 > window.innerWidth ? Math.max(8, r.left - w - 6) : right;
    // Nudge up by the overall-row's border+padding so its number lines up with
    // the cell number (≈1px border + 0.3rem padding ≈ 6px).
    setPos({ top: Math.max(8, r.top - 6), left });
  }, [open]);

  if (priced.length === 0) return null;
  const guaranteed = priced.some((c) => c.pct >= 100);
  const overall = guaranteed ? 100 : Math.round((1 - priced.reduce((m, c) => m * (1 - c.pct / 100), 1)) * 100);
  const showFormula = !guaranteed && priced.length > 1;
  const numberText = guaranteed ? '100%' : `~${overall}%`;

  return (
    <>
      <span
        ref={ref}
        className="inh-cov-pct inh-cov-combined"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {numberText}
      </span>
      {open && pos && createPortal(
        <div className="inh-cov-calc-pop" style={{ top: pos.top, left: pos.left }}>
          <div className="inh-cov-calc-overall">
            {numberText} Overall
            {showFormula && (
              <span className="formula">(1 − {priced.map((c) => `(1−${c.pct}%)`).join(' × ')})</span>
            )}
            {guaranteed && <span className="formula">— guaranteed</span>}
          </div>
          {priced.map((c, i) => {
            const s = chipSource(c);
            return (
              <div key={i} className="inh-cov-calc-src">
                <b>{c.pct}%</b> {s.name} <span className="role">({s.role})</span>
                {s.guaranteed ? ' — guaranteed' : ''}
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

function Cell({ chips, colKey, renderCardIcon, renderEventHint }: {
  chips: CoverageChip[]; colKey: CoverageColumn; renderCardIcon?: RenderCardIcon; renderEventHint?: RenderEventHint;
}) {
  const colCls = `inh-cov-cell inh-cov-col-${colKey}`;
  if (chips.length === 0) return <td className={`${colCls} muted`}>·</td>;
  // Priced parent/gp sources are fully represented by the single combined % —
  // their identity chips are hidden (the number's hover names each source).
  // Unpriced chips (gp green) stay visible so an un-numbered source isn't lost.
  const visible = chips.filter((c) => !((c.kind === 'parent' || c.kind === 'gp') && c.pct !== undefined));
  // Up to 6 chips laid out 2 rows × 3 columns; overflow collapses to "+N".
  const shown = visible.slice(0, 6);
  const extra = visible.length - shown.length;
  return (
    <td className={colCls}>
      {shown.length > 0 && (
        <span className="inh-cov-cell-grid">
          {shown.map((c, i) => <Chip key={i} chip={c} renderCardIcon={renderCardIcon} renderEventHint={renderEventHint} />)}
          {extra > 0 && <span className="inh-cov-more">+{extra}</span>}
        </span>
      )}
      <CombinedPct chips={chips} />
    </td>
  );
}

function MatrixTable({ rows, skillColLabel, renderCardIcon, renderEventHint, renderSkillIcon, renderSkillDetail }: {
  rows: CoverageRow[]; skillColLabel: string;
  renderCardIcon?: RenderCardIcon; renderEventHint?: RenderEventHint;
  renderSkillIcon?: RenderSkillIcon; renderSkillDetail?: RenderSkillDetail;
}) {
  return (
    <table className="matrix inh-cov-matrix">
      <thead>
        <tr>
          <th className="skill-col">{skillColLabel}</th>
          {COLS.map((c) => <th key={c.key} className={`inh-cov-col-${c.key}${c.sep ? ' inh-cov-sep' : ''}`}>{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          // The whole cell (icon + name) is the click target for the detail popup.
          const cellContent = (
            <>
              {renderSkillIcon && <span className="inh-cov-skill-icon">{renderSkillIcon(r.skillId)}</span>}
              <span className="inh-cov-skill-name">{r.name}</span>
            </>
          );
          return (
            <tr key={r.skillId} className={r.covered ? undefined : 'row-uncovered'}>
              <th className="skill-col" style={r.isGold ? { color: '#c27a00' } : undefined}>
                <span className="inh-cov-skill-cell">
                  {renderSkillDetail ? renderSkillDetail(r.skillId, cellContent) : cellContent}
                </span>
              </th>
              {COLS.map((c) => <Cell key={c.key} colKey={c.key} chips={r.cells[c.key]} renderCardIcon={renderCardIcon} renderEventHint={renderEventHint} />)}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function CoverageMatrixCard({ result, hasWishlist, hasPlanUma, renderCardIcon, renderEventHint, renderSkillIcon, renderSkillDetail }: {
  result: CoverageResult; hasWishlist: boolean; hasPlanUma: boolean;
  renderCardIcon?: RenderCardIcon; renderEventHint?: RenderEventHint;
  renderSkillIcon?: RenderSkillIcon; renderSkillDetail?: RenderSkillDetail;
}) {
  const [bonusOpen, setBonusOpen] = useState(true);
  return (
    <div className="cmp-plan-card inh-cov-card">
      <div className="cmp-plan-card-head inh-cov-head">
        <span className="inh-cov-title">Obtainable vs. wishlist</span>
        <HeaderHelp label="Obtainability matrix help">
          Crosses each wishlist skill against where you can get it: your uma's
          innate kit, its career training events, parent/grandparent sparks (with
          real inherit-%), and your deck's hint / chain-event / random-event
          skills. "Event" is availability — whether the uma's events can grant the
          skill — not a per-run guarantee. Red-striped rows are uncovered.
        </HeaderHelp>
      </div>
      <div className="cmp-plan-card-body inh-cov-body">
        {!hasPlanUma ? (
          <p className="muted">Pick a plan uma to see coverage.</p>
        ) : !hasWishlist ? (
          <p className="muted">Add skills to your wishlist to see coverage.</p>
        ) : (
          <>
            <MatrixTable rows={result.rows} skillColLabel="Wishlist skill"
              renderCardIcon={renderCardIcon} renderEventHint={renderEventHint}
              renderSkillIcon={renderSkillIcon} renderSkillDetail={renderSkillDetail} />
            {result.bonus.length > 0 && (
              <div className="inh-cov-bonus">
                <button type="button" className="inh-cov-bonus-toggle" aria-expanded={bonusOpen} onClick={() => setBonusOpen((o) => !o)}>
                  <span className="inh-cov-bonus-caret" data-open={bonusOpen ? '1' : undefined}>▸</span>
                  Bonus — obtainable, not on wishlist ({result.bonus.length})
                </button>
                {bonusOpen && (
                  <MatrixTable rows={result.bonus} skillColLabel="Bonus skill"
                    renderCardIcon={renderCardIcon} renderEventHint={renderEventHint}
                    renderSkillIcon={renderSkillIcon} renderSkillDetail={renderSkillDetail} />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
