import { useEffect, useState, type ReactNode } from 'react';
import type { SkillSummary, SkillTechnicalDetail } from './skillTechnicalDetails';
import { loadSkillTechnicalDetail } from './skillTechnicalDetails';
import { GameIcon } from '@/features/data/GameIcon';
import { SkillTraceSection } from './SkillTraceSection';
import type { TraceContext } from './useSkillTrace';

type DetailStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

const EFFECT_TYPE_NAMES: Record<number, string> = {
  0: 'Noop',
  1: 'Speed',
  2: 'Stamina',
  3: 'Power',
  4: 'Guts',
  5: 'Wit',
  6: 'Strategy change',
  8: 'Field of view',
  9: 'Recovery',
  10: 'Start reaction time',
  13: 'Rushed duration',
  14: 'Start delay',
  21: 'Current speed',
  22: 'Current speed',
  27: 'Target speed',
  28: 'Lane movement speed',
  31: 'Acceleration',
  35: 'Lane change',
  37: 'Random gold skill',
  42: 'Skill duration',
};

const EFFECT_TARGET_NAMES: Record<number, string> = {
  1: 'Self',
  2: 'All',
  4: 'In FOV',
  7: 'Ahead of Position',
  9: 'Ahead of Self',
  10: 'Behind Self',
  11: 'All Allies',
  18: 'Enemy Strategy',
  19: 'Kakari Ahead',
  20: 'Kakari Behind',
  21: 'Kakari Strategy',
  22: 'Uma ID',
  23: 'Used Recovery',
};

function formatDuration(raw: number | undefined): string {
  if (raw === undefined) return 'n/a';
  if (raw < 0) return 'passive';
  return `${(raw / 10000).toFixed(1)}s`;
}

function conditionLines(raw: string | undefined): string[] {
  const source = raw?.trim();
  if (!source) return ['none'];
  const lines: string[] = [];
  const alternatives = source.split('@').map((part) => part.trim()).filter(Boolean);
  for (const [altIndex, alternative] of alternatives.entries()) {
    const parts = alternative.split('&').map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) {
      lines.push(alternative);
    } else {
      parts.forEach((part, index) => {
        lines.push(index < parts.length - 1 ? `${part} &` : part);
      });
    }
    if (altIndex < alternatives.length - 1) lines.push('@ or');
  }
  return lines;
}

type SkillEffect = NonNullable<SkillTechnicalDetail['alternatives'][number]['effects']>[number];

type EffectTone =
  | 'target-speed'
  | 'current-speed'
  | 'acceleration'
  | 'recovery'
  | 'stat'
  | 'debuff'
  | 'start'
  | 'movement'
  | 'duration'
  | 'special';

type EffectDisplay = {
  label: string;
  value: string;
  tone: EffectTone;
  valueTone: 'positive' | 'negative' | 'neutral';
  target?: string;
  meta?: string;
};

function trimNumber(value: number, digits = 2): string {
  return value.toFixed(digits).replace(/\.?0+$/, '');
}

function signedNumber(value: number, digits = 2): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${trimNumber(Math.abs(value), digits)}`;
}

function scaledModifier(effect: SkillEffect): number | undefined {
  if (effect.modifier !== undefined) return effect.modifier / 10000;
  if (effect.value !== undefined) return effect.value;
  return undefined;
}

function isRandomRecovery(effect: SkillEffect): boolean {
  return effect.type === 9 && (effect.valueUsage === 8 || effect.valueUsage === 9);
}

function recoveryPercent(value: number): string {
  return `${signedNumber(value * 100, 1)}%`;
}

function effectTarget(effect: SkillEffect): string | undefined {
  if (effect.target === undefined || effect.target === 1) return undefined;
  return `Target: ${EFFECT_TARGET_NAMES[effect.target] ?? `target ${effect.target}`}`;
}

function effectMeta(effect: SkillEffect): string | undefined {
  const meta: string[] = [];
  if (effect.valueUsage !== undefined && effect.valueUsage !== 1 && !isRandomRecovery(effect)) {
    meta.push(`usage ${effect.valueUsage}`);
  }
  if (effect.valueLevelUsage !== undefined && effect.valueLevelUsage !== 1) {
    meta.push(`level ${effect.valueLevelUsage}`);
  }
  return meta.length > 0 ? meta.join(' / ') : undefined;
}

function effectTone(effect: SkillEffect, modifier: number | undefined): EffectTone {
  if ((modifier ?? 0) < 0) return 'debuff';
  switch (effect.type) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
      return 'stat';
    case 9:
      return 'recovery';
    case 10:
    case 14:
      return 'start';
    case 21:
    case 22:
      return 'current-speed';
    case 27:
      return 'target-speed';
    case 28:
    case 35:
      return 'movement';
    case 31:
      return 'acceleration';
    case 42:
      return 'duration';
    default:
      return 'special';
  }
}

function describeEffect(effect: SkillEffect): EffectDisplay | null {
  const modifier = scaledModifier(effect);
  const target = effectTarget(effect);
  const meta = effectMeta(effect);
  const label = effect.type !== undefined
    ? EFFECT_TYPE_NAMES[effect.type] ?? `Effect ${effect.type}`
    : 'Effect';
  const fallbackValue = modifier === undefined ? 'n/a' : signedNumber(modifier, 2);
  const tone = effectTone(effect, modifier);
  const valueTone = modifier === undefined || modifier === 0
    ? 'neutral'
    : modifier < 0
      ? 'negative'
      : 'positive';

  if (effect.type === undefined && modifier === undefined && target === undefined && meta === undefined) {
    return null;
  }

  switch (effect.type) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
      return {
        label,
        value: modifier === undefined ? 'n/a' : signedNumber(modifier, 0),
        tone,
        valueTone,
        target,
        meta,
      };
    case 8:
      return {
        label,
        value: modifier === undefined ? 'n/a' : signedNumber(modifier, 1),
        tone,
        valueTone,
        target,
        meta,
      };
    case 9: {
      const recoveryLabel = (modifier ?? 0) < 0 ? 'HP drain' : 'Recovery';
      if (modifier !== undefined && isRandomRecovery(effect)) {
        return {
          label: recoveryLabel,
          value: `60% none / 30% ${recoveryPercent(modifier * 0.02)} / 10% ${recoveryPercent(modifier * 0.04)}`,
          tone,
          valueTone,
          target,
          meta,
        };
      }
      return {
        label: recoveryLabel,
        value: modifier === undefined ? 'n/a' : recoveryPercent(modifier),
        tone,
        valueTone,
        target,
        meta,
      };
    }
    case 10:
    case 42:
      return {
        label,
        value: modifier === undefined ? 'n/a' : `x${trimNumber(modifier, 2)}`,
        tone,
        valueTone,
        target,
        meta,
      };
    case 14:
      return {
        label,
        value: modifier === undefined ? 'n/a' : `${trimNumber(modifier, 2)}s`,
        tone,
        valueTone,
        target,
        meta,
      };
    case 21:
    case 22:
    case 27:
    case 28:
      return {
        label,
        value: modifier === undefined ? 'n/a' : `${signedNumber(modifier, 2)}m/s`,
        tone,
        valueTone,
        target,
        meta,
      };
    case 31:
      return {
        label,
        value: modifier === undefined ? 'n/a' : `${signedNumber(modifier, 2)}m/s²`,
        tone,
        valueTone,
        target,
        meta,
      };
    default:
      return {
        label,
        value: fallbackValue,
        tone,
        valueTone,
        target,
        meta,
      };
  }
}

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
  traceContext,
  open: openProp,
  onOpenChange,
}: {
  skill: SkillSummary;
  className?: string;
  side?: ReactNode;
  technicalHeaderSide?: ReactNode;
  showCost?: boolean;
  traceContext?: TraceContext;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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

        {traceContext !== undefined && (
          <SkillTraceSection skillId={skill.skillId} ctx={traceContext} enabled={open} />
        )}
      </div>
    </details>
  );
}
