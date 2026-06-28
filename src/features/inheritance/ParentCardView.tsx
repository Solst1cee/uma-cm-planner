/** Presentational single-parent card (M1.4). Provider-free: portraits + picker
 *  arrive as props/children. The container (InheritanceCard) wires data. */
import { useRef, type ReactNode } from 'react';
import type { Parent } from '@/core/types';
import { useDismissOnOutside } from '@/features/cm-planner/useDismissOnOutside';
import { LineageSparkChips } from './LineageSparkChips';

// Inline glyphs (planner-inventory icon style: 20×20, currentColor fill).
const IconSvg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">{children}</svg>
);
const SearchIcon = () => (
  <IconSvg><path d="M8.5 2a6.5 6.5 0 0 1 5.05 10.6l4 4-1.4 1.4-4-4A6.5 6.5 0 1 1 8.5 2Zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" /></IconSvg>
);
const FolderOpenIcon = () => (
  <IconSvg><path d="M2 4h5l2 2h7v2H2V4Z" /><path d="M2 9h16l-2.2 7H4.2L2 9Z" /></IconSvg>
);

export interface ParentCardViewProps {
  label: string;
  parent: Parent | null;
  /** Resolved uma name (container supplies it; falls back to the umaId code). */
  name?: string;
  /** Resolve a white-spark skillId → display name (falls back to the id). */
  skillName?: (id: string) => string;
  /** True when a spark's skill id is on the plan's wishlist → blue glow. */
  isWishlisted?: (skillId: string) => boolean;
  /** Pre-built evaluation-rank badge (icon) — container-wired. */
  rankBadge?: ReactNode;
  /** Numeric evaluation score, shown under the rank badge. */
  rankScore?: number;
  portrait?: ReactNode;
  /** Pre-built grandparent portrait nodes (the veteran's 1–2 GPs) — container-wired. */
  gpPortraits?: ReactNode[];
  rentalToggle?: ReactNode;
  rentalStub?: boolean;
  onFindCandidates?: () => void;
  /** Whether the Find-candidates popover is open (anchored to the Find button). */
  findOpen?: boolean;
  /** Close the Find popover (outside-click / Esc). */
  onCloseFind?: () => void;
  onChange?: () => void;
  onClear?: () => void;
  /** Find-candidates list — rendered inside the anchored popover when `findOpen`. */
  children?: ReactNode;
}

export function ParentCardView({
  label, parent, name, skillName, isWishlisted, rankBadge, rankScore, portrait, gpPortraits, rentalToggle, rentalStub,
  onFindCandidates, findOpen, onCloseFind, onChange, onClear, children,
}: ParentCardViewProps) {
  const findRef = useRef<HTMLSpanElement>(null);
  useDismissOnOutside(findRef, !!findOpen, onCloseFind ?? (() => {}), { esc: true });
  return (
    <div className="inh-parent cmp-plan-card">
      <div className="inh-parent-head cmp-plan-card-head">
        <span className="inh-parent-title">{label}</span>
        {rentalToggle}
        <span className="inh-parent-actions">
          {!rentalStub && onFindCandidates && (
            <span className="inh-find-anchor" ref={findRef}>
              <button type="button" className="cmp-inventory-icon-btn"
                aria-label="Find candidates" aria-expanded={!!findOpen} title="Find candidates" onClick={onFindCandidates}>
                <SearchIcon />
              </button>
              {findOpen && <div className="inh-find-popover">{children}</div>}
            </span>
          )}
          {!rentalStub && onChange && (
            <button type="button" className="cmp-inventory-icon-btn"
              aria-label={parent ? 'Change' : 'Pick'} title={parent ? 'Change' : 'Pick'} onClick={onChange}>
              <FolderOpenIcon />
            </button>
          )}
          {parent && onClear && (
            <button type="button" className="cmp-small-btn inh-clear" aria-label="Clear" onClick={onClear}>✕</button>
          )}
        </span>
      </div>

      <div className="inh-parent-content">
        {rentalStub ? (
          <p className="inh-rental-stub muted small">Rental mode coming in M1.4b.</p>
        ) : parent ? (
          <div className="inh-parent-body">
            {/* Pedigree row: uma icon ──┤ stacked grandparents, rank badge + score alongside. */}
            <div className="inh-uma-ped inh-parent-ped">
              <span className="inh-uma-tile-portrait">{portrait}</span>
              {gpPortraits && gpPortraits.length > 0 && (
                <span className="inh-uma-gp-stack" title="Grandparents">
                  {gpPortraits.map((node, i) => (
                    <span key={i} className="inh-uma-gp-item">{node}</span>
                  ))}
                </span>
              )}
              <span className="inh-parent-name">{name ?? parent.umaId}</span>
              <span className="inh-uma-rank-cell">
                {rankBadge}
                {rankScore !== undefined && (
                  <span className="inh-uma-rank-score" title="Rank score">{rankScore}</span>
                )}
              </span>
            </div>
            <LineageSparkChips parent={parent} skillName={skillName} isWishlisted={isWishlisted} />
          </div>
        ) : (
          <p className="inh-parent-empty muted small">No parent selected.</p>
        )}
      </div>
    </div>
  );
}
