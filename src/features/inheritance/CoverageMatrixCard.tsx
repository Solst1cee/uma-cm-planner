// src/features/inheritance/CoverageMatrixCard.tsx
/** M1.7 — "Obtainable vs. wishlist" coverage card (design handoff panel 6).
 *  Provider-free: the page computes the CoverageResult and passes it in. */
import { useState, type ReactNode } from 'react';
import type { CoverageChip, CoverageColumn, CoverageResult, CoverageRow } from '@/core/coverageMatrix';
import { HeaderHelp } from '@/features/cm-planner/HeaderHelp';

/** Provider-free renderer for a support-card icon (the page supplies it). */
export type RenderCardIcon = (cardId: string, size: number) => ReactNode;

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

function Chip({ chip, renderCardIcon }: { chip: CoverageChip; renderCardIcon?: RenderCardIcon }) {
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
  return (
    <span className="inh-cov-chip-wrap" title={chip.title}>
      {icon ? (
        <span className="inh-cov-chip-icon">{icon}</span>
      ) : (
        <span className={cls} data-round={round ? '1' : undefined}>{chip.label}</span>
      )}
      {chip.pct !== undefined && <span className="inh-cov-pct">~{chip.pct}%</span>}
    </span>
  );
}

function Cell({ chips, renderCardIcon }: { chips: CoverageChip[]; renderCardIcon?: RenderCardIcon }) {
  if (chips.length === 0) return <td className="inh-cov-cell muted">·</td>;
  const shown = chips.slice(0, 2);
  const extra = chips.length - shown.length;
  return (
    <td className="inh-cov-cell">
      {shown.map((c, i) => <Chip key={i} chip={c} renderCardIcon={renderCardIcon} />)}
      {extra > 0 && <span className="inh-cov-more">+{extra}</span>}
    </td>
  );
}

function MatrixTable({ rows, renderCardIcon }: { rows: CoverageRow[]; renderCardIcon?: RenderCardIcon }) {
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
            {COLS.map((c) => <Cell key={c.key} chips={r.cells[c.key]} renderCardIcon={renderCardIcon} />)}
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

export function CoverageMatrixCard({ result, hasWishlist, hasPlanUma, renderCardIcon }: {
  result: CoverageResult; hasWishlist: boolean; hasPlanUma: boolean; renderCardIcon?: RenderCardIcon;
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
            {view === 'matrix' ? <MatrixTable rows={result.rows} renderCardIcon={renderCardIcon} /> : <Bars result={result} />}
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
