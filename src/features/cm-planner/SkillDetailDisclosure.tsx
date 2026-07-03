import { useEffect, useState, type ReactNode } from 'react';
import type { SkillSummary, SkillTechnicalDetail } from './skillTechnicalDetails';
import { loadSkillTechnicalDetail } from './skillTechnicalDetails';
import { conditionLines, describeEffect, formatDuration, type SkillEffect } from './skillTechFormat';
import { GameIcon } from '@/features/data/GameIcon';
import { SkillTraceSection } from './SkillTraceSection';
import { SourcingSection } from './SourcingSection';
import type { TraceContext } from './useSkillTrace';

type DetailStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

function EffectChip({ effect }: { effect: SkillEffect }) {
  const display = describeEffect(effect);
  if (display === null) return <span>effect data unavailable</span>;
  return (
    <span className={`cmp-effect-chip is-${display.tone}`}>
      <b>{display.label}</b>
      <strong className={`cmp-effect-value is-${display.valueTone}`}>{display.value}</strong>
      {display.target !== undefined && <small>{display.target}</small>}
      {display.meta !== undefined && <small>{display.meta}</small>}
    </span>
  );
}

function ConditionLines({ value }: { value: string | undefined }) {
  return (
    <span className="cmp-condition-lines">
      {conditionLines(value).map((line, index) => (
        <span key={`${line}-${index}`}>{line}</span>
      ))}
    </span>
  );
}

export function SkillDetailDisclosure({
  skill,
  className,
  side,
  technicalHeaderSide,
  showCost = true,
  showSourcing = false,
  traceContext,
  open: openProp,
  onOpenChange,
  collapseSignal,
}: {
  skill: SkillSummary;
  className?: string;
  side?: ReactNode;
  technicalHeaderSide?: ReactNode;
  showCost?: boolean;
  /** Render the "Where to get it" card-hint sourcing section (acquirable skills only). */
  showSourcing?: boolean;
  traceContext?: TraceContext;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  collapseSignal?: number;
}) {
  const [openState, setOpenState] = useState(false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : openState;
  const setOpen = (next: boolean) => {
    if (!isControlled) setOpenState(next);
    onOpenChange?.(next);
  };
  const [detail, setDetail] = useState<SkillTechnicalDetail | null>(null);
  const [status, setStatus] = useState<DetailStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDetail(null);
    setError(null);
    setStatus('idle');
  }, [skill.skillId]);

  useEffect(() => {
    setOpen(false);
  }, [collapseSignal]);

  useEffect(() => {
    if (!open || status !== 'idle') return;
    let cancelled = false;
    setStatus('loading');
    loadSkillTechnicalDetail(skill.skillId)
      .then((next) => {
        if (cancelled) return;
        setDetail(next);
        setStatus(next === null ? 'missing' : 'ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [open, skill.skillId, status]);

  const alternatives = detail?.alternatives ?? [];

  return (
    <details
      className={`cmp-skill-detail cmp-skill-rarity-${skill.rarity} ${className ?? ''}`.trim()}
      open={open}
      onToggle={(e) => { if (e.currentTarget.open !== open) setOpen(e.currentTarget.open); }}
    >
      <summary>
        <span className="cmp-skill-summary-main">
          <GameIcon kind="skill" id={skill.iconId} size={24} alt="" />
          <span className="cmp-skill-name">{skill.nameEn}</span>
          <span className="visually-hidden">
            {open ? 'Collapse skill details' : 'Expand skill details'}
          </span>
        </span>
        {(showCost || side) && (
          <span className="cmp-skill-summary-side">
            {showCost && <span className="cost">SP {skill.baseSpCost}</span>}
            {side}
          </span>
        )}
        <span className="cmp-disclosure-icon" aria-hidden="true" />
      </summary>

      <div className="cmp-skill-tech">
        <div className="cmp-skill-tech-head">
          <span className="cmp-skill-id-chip">ID {skill.skillId}</span>
          {technicalHeaderSide !== undefined && (
            <div className="cmp-skill-tech-head-side">{technicalHeaderSide}</div>
          )}
        </div>

        {status === 'error' && error !== null && (
          <p className="error small">Technical detail unavailable: {error}</p>
        )}
        {status === 'loading' && (
          <p className="muted small">Loading technical detail...</p>
        )}
        {status === 'missing' && (
          <p className="muted small">No runtime technical detail was found for this skill.</p>
        )}

        {alternatives.length > 0 && (
          <div className="cmp-alt-list">
            {alternatives.map((alt, index) => (
              <section key={`${skill.skillId}-${index}`} className="cmp-alt">
                <h4>Activation route {index + 1}</h4>
                <dl className="cmp-tech-list">
                  <div>
                    <dt>Precondition</dt>
                    <dd className="mono">
                      <ConditionLines value={alt.precondition} />
                    </dd>
                  </div>
                  <div>
                    <dt>Condition</dt>
                    <dd className="mono">
                      <ConditionLines value={alt.condition} />
                    </dd>
                  </div>
                </dl>
                <div className="cmp-alt-metrics">
                  <span>
                    <small>Duration</small>
                    <b>{formatDuration(alt.baseDuration)}</b>
                  </span>
                  <span>
                    <small>Cooldown</small>
                    <b>{formatDuration(alt.cooldownTime)}</b>
                  </span>
                </div>
                <ul className="cmp-effect-list" aria-label={`Effects for ${skill.nameEn}`}>
                  {(alt.effects ?? []).map((effect, effectIndex) => (
                    <li key={`${skill.skillId}-${index}-${effectIndex}`}>
                      <EffectChip effect={effect} />
                    </li>
                  ))}
                  {(alt.effects ?? []).length === 0 && <li className="muted">No raw effects.</li>}
                </ul>
              </section>
            ))}
          </div>
        )}

        {showSourcing && open && <SourcingSection skillId={skill.skillId} rarity={skill.rarity} />}

        {traceContext !== undefined && (
          <SkillTraceSection skillId={skill.skillId} ctx={traceContext} enabled={open} />
        )}
      </div>
    </details>
  );
}
