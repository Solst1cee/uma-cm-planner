// src/features/inheritance/CoverageMatrixCard.tsx
/** M1.7 — "Obtainable vs. wishlist" coverage card (design handoff panel 6).
 *  Provider-free: the page computes the CoverageResult and passes it in. */
import { useState, type ReactNode } from 'react';
import type { CoverageChip, CoverageColumn, CoverageResult, CoverageRow } from '@/core/coverageMatrix';
import { HeaderHelp } from '@/features/cm-planner/HeaderHelp';

/** Provider-free renderer for a support-card icon (the page supplies it). */
export type RenderCardIcon = (cardId: string, size: number) => ReactNode;
/** Provider-free renderer for an event-detail hint button + popup (the page
 *  supplies it). Return null when no event details exist for the skill —
 *  the cell then falls back to the plain chip. */
export type RenderEventHint = (skillId: string) => ReactNode;

const COLS: Array<{ key: CoverageColumn; label: string; sep?: boolean }> = [
  { key: 'innate', label: 'Innate' },
  { key: 'event', label: 'Event' },
  { key: 'parent', label: 'Parent', sep: true },
  { key: 'gp', label: 'G.parent' },
  { key: 'hint', label: 'Hint', sep: true },
  { key: 'chain', label: 'Chain' },
  { key: 'random', label: 'Random' },
];
const BAR_LABEL: Record<CoverageColumn | 'uncovered', string> = {
  innate: 'Innate', event: 'Event', parent: 'Parent', gp: 'G.parent', hint: 'Hint', chain: 'Chain', random: 'Random', uncovered: 'Uncovered',
};

function Chip({ chip, renderCardIcon, renderEventHint }: {
  chip: CoverageChip; renderCardIcon?: RenderCardIcon; renderEventHint?: RenderEventHint;
}) {
  // Event chips render the page-supplied hint button + popup when event details
  // exist for the covering skill; otherwise fall through to the plain chip.
  if (chip.kind === 'event' && chip.skillId && renderEventHint) {
    const hint = renderEventHint(chip.skillId);
    if (hint) return <span className="inh-cov-chip-wrap inh-cov-ev-hint" title={chip.title}>{hint}</span>;
  }
  const round = chip.kind === 'innate' || chip.kind === 'event' || chip.kind === 'parent' || chip.kind === 'gp';
  // Deck-source chips (hint/chain/random) render the real support-card icon when
  // the page supplies a renderer; otherwise fall back to the type-colored initials chip.
  const icon = chip.cardId && renderCardIcon ? renderCardIcon(chip.cardId, 20) : null;
  const cls =
    chip.kind === 'innate' ? 'inh-cov-chip tier-spark' :
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

/** One combined inherit-% per cell: the chance AT LEAST ONE priced source passes
 *  the spark down, 1 − ∏(1 − pᵢ). Hover explains the per-source breakdown. */
function CombinedPct({ chips }: { chips: CoverageChip[] }) {
  const priced = chips.filter((c): c is CoverageChip & { pct: number } => c.pct !== undefined);
  if (priced.length === 0) return null;
  const combined = Math.round((1 - priced.reduce((m, c) => m * (1 - c.pct / 100), 1)) * 100);
  const lines = priced.map((c) => `${c.title}: ~${c.pct}%`);
  if (priced.length > 1) {
    lines.push(
      `Combined (at least one succeeds): 1 − ${priced.map((c) => `(1−${c.pct}%)`).join(' × ')} ≈ ${combined}%`,
      'Each source is priced in isolation and assumed to roll independently.',
    );
  }
  return <span className="inh-cov-pct inh-cov-combined" title={lines.join('\n')}>~{combined}%</span>;
}

function Cell({ chips, renderCardIcon, renderEventHint }: {
  chips: CoverageChip[]; renderCardIcon?: RenderCardIcon; renderEventHint?: RenderEventHint;
}) {
  if (chips.length === 0) return <td className="inh-cov-cell muted">·</td>;
  // Priced parent/gp sources are fully represented by the single combined % —
  // their identity chips are hidden (the number's hover names each source).
  // Unpriced chips (gp green) stay visible so an un-numbered source isn't lost.
  const visible = chips.filter((c) => !((c.kind === 'parent' || c.kind === 'gp') && c.pct !== undefined));
  // Up to 6 chips laid out 2 rows × 3 columns; overflow collapses to "+N".
  const shown = visible.slice(0, 6);
  const extra = visible.length - shown.length;
  return (
    <td className="inh-cov-cell">
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

function MatrixTable({ rows, renderCardIcon, renderEventHint }: {
  rows: CoverageRow[]; renderCardIcon?: RenderCardIcon; renderEventHint?: RenderEventHint;
}) {
  return (
    <table className="matrix inh-cov-matrix">
      <thead>
        <tr>
          <th className="skill-col">Wishlist skill</th>
          {COLS.map((c) => <th key={c.key} className={c.sep ? 'inh-cov-sep' : undefined}>{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.skillId} className={r.covered ? undefined : 'row-uncovered'}>
            <th className="skill-col" style={r.isGold ? { color: '#c27a00' } : undefined}>{r.name}</th>
            {COLS.map((c) => <Cell key={c.key} chips={r.cells[c.key]} renderCardIcon={renderCardIcon} renderEventHint={renderEventHint} />)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Bars({ result }: { result: CoverageResult }) {
  return (
    <div className="inh-cov-bars">
      {result.bars.map((b) => (
        <div key={b.column} className="inh-cov-bar-row">
          <span className="inh-cov-bar-label">{BAR_LABEL[b.column]}</span>
          <span className="inh-cov-bar-track"><span className={`inh-cov-bar-fill col-${b.column}`} style={{ width: `${b.pct}%` }} /></span>
          <span className="inh-cov-bar-num">{b.count} · {b.pct}%</span>
        </div>
      ))}
    </div>
  );
}

export function CoverageMatrixCard({ result, hasWishlist, hasPlanUma, renderCardIcon, renderEventHint }: {
  result: CoverageResult; hasWishlist: boolean; hasPlanUma: boolean;
  renderCardIcon?: RenderCardIcon; renderEventHint?: RenderEventHint;
}) {
  const [view, setView] = useState<'matrix' | 'bars'>('matrix');
  return (
    <div className="cmp-plan-card inh-cov-card">
      <div className="cmp-plan-card-head inh-cov-head">
        <span className="inh-cov-title">Obtainable vs. wishlist</span>
        <span className="cmp-control-group inh-cov-toggle">
          <button type="button" className={view === 'matrix' ? 'is-active' : ''} onClick={() => setView('matrix')}>Matrix</button>
          <button type="button" className={view === 'bars' ? 'is-active' : ''} onClick={() => setView('bars')}>Coverage</button>
        </span>
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
            {view === 'matrix'
              ? <MatrixTable rows={result.rows} renderCardIcon={renderCardIcon} renderEventHint={renderEventHint} />
              : <Bars result={result} />}
            {result.bonus.length > 0 && (
              <div className="inh-cov-bonus">
                <div className="inh-cov-bonus-head">BONUS — obtainable, not on wishlist</div>
                {result.bonus.map((b) => (
                  <div key={b.skillId} className="inh-cov-bonus-row">
                    <span className="inh-cov-bonus-name">{b.name}</span>
                    <span className="inh-cov-bonus-chips">{b.chips.map((c, i) => <Chip key={i} chip={c} renderCardIcon={renderCardIcon} />)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
