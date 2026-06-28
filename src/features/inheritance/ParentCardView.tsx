/** Presentational single-parent card (M1.4). Provider-free: portraits + picker
 *  arrive as props/children. The container (InheritanceCard) wires data. */
import type { ReactNode } from 'react';
import type { Parent } from '@/core/types';
import { LineageSparkChips } from './LineageSparkChips';

export interface ParentCardViewProps {
  label: string;
  parent: Parent | null;
  /** Resolved uma name (container supplies it; falls back to the umaId code). */
  name?: string;
  /** Resolve a white-spark skillId → display name (falls back to the id). */
  skillName?: (id: string) => string;
  /** True when a spark's skill id is on the plan's wishlist → blue glow. */
  isWishlisted?: (skillId: string) => boolean;
  /** Pre-built evaluation-rank badge (image + label) — container-wired. */
  rankBadge?: ReactNode;
  portrait?: ReactNode;
  gpPortraits?: [ReactNode, ReactNode];
  rentalToggle?: ReactNode;
  rentalStub?: boolean;
  onFindCandidates?: () => void;
  onChange?: () => void;
  onClear?: () => void;
  children?: ReactNode;
}

export function ParentCardView({
  label, parent, name, skillName, isWishlisted, rankBadge, portrait, gpPortraits, rentalToggle, rentalStub,
  onFindCandidates, onChange, onClear, children,
}: ParentCardViewProps) {
  return (
    <div className="inh-parent cmp-plan-card">
      <div className="inh-parent-head cmp-plan-card-head">
        <span className="inh-parent-title">{label}</span>
        {rentalToggle}
        <span className="inh-parent-actions">
          {!rentalStub && onFindCandidates && (
            <button type="button" className="cmp-small-btn" onClick={onFindCandidates}>Find candidates</button>
          )}
          {!rentalStub && onChange && (
            <button type="button" className="cmp-small-btn" onClick={onChange}>{parent ? 'Change' : 'Pick'}</button>
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
            <div className="inh-parent-id">
              <span className="inh-parent-portrait">{portrait}</span>
              <span className="inh-parent-name">{name ?? parent.umaId}</span>
              {rankBadge}
              {gpPortraits && (
                <span className="inh-gp">GP:{gpPortraits[0]}{gpPortraits[1]}</span>
              )}
            </div>
            <LineageSparkChips parent={parent} skillName={skillName} isWishlisted={isWishlisted} />
          </div>
        ) : (
          <p className="inh-parent-empty muted small">No parent selected.</p>
        )}
        {children}
      </div>
    </div>
  );
}
