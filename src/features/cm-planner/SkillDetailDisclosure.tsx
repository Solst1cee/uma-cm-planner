import { useEffect, useState, type ReactNode } from 'react';
import type { SkillSummary, SkillTechnicalDetail } from './skillTechnicalDetails';
import { loadSkillTechnicalDetail } from './skillTechnicalDetails';
import { GameIcon } from '@/features/data/GameIcon';

function formatDuration(raw: number | undefined): string {
  if (raw === undefined) return 'n/a';
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

function effectParts(effect: NonNullable<SkillTechnicalDetail['alternatives'][number]['effects']>[number]): string[] {
  return [
    effect.type !== undefined ? `type ${effect.type}` : undefined,
    effect.modifier !== undefined ? `modifier ${effect.modifier}` : undefined,
    effect.target !== undefined ? `target ${effect.target}` : undefined,
    effect.valueUsage !== undefined ? `usage ${effect.valueUsage}` : undefined,
    effect.valueLevelUsage !== undefined ? `level ${effect.valueLevelUsage}` : undefined,
  ].filter((part): part is string => part !== undefined);
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
  showCost = true,
}: {
  skill: SkillSummary;
  className?: string;
  side?: ReactNode;
  showCost?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<SkillTechnicalDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || detail !== null || error !== null) return;
    let cancelled = false;
    loadSkillTechnicalDetail(skill.skillId)
      .then((next) => {
        if (!cancelled) setDetail(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [detail, error, open, skill.skillId]);

  const alternatives = detail?.alternatives ?? [];

  return (
    <details
      className={`cmp-skill-detail cmp-skill-rarity-${skill.rarity} ${className ?? ''}`.trim()}
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        <span className="cmp-skill-summary-main">
          <GameIcon kind="skill" id={skill.iconId} size={24} alt="" />
          <span className="cmp-skill-name">{skill.nameEn}</span>
        </span>
        {(showCost || side) && (
          <span className="cmp-skill-summary-side">
            {showCost && <span className="cost">SP {skill.baseSpCost}</span>}
            {side}
          </span>
        )}
      </summary>

      <div className="cmp-skill-tech">
        <dl className="cmp-tech-list">
          <div>
            <dt>ID</dt>
            <dd>{skill.skillId}</dd>
          </div>
          <div>
            <dt>Condition</dt>
            <dd className="mono">
              <ConditionLines value={skill.conditions} />
            </dd>
          </div>
        </dl>

        {error !== null && <p className="error small">Technical detail unavailable: {error}</p>}
        {open && detail === null && error === null && (
          <p className="muted small">Loading technical detail...</p>
        )}

        {alternatives.length > 0 && (
          <div className="cmp-alt-list">
            {alternatives.map((alt, index) => (
              <section key={`${skill.skillId}-${index}`} className="cmp-alt">
                <h4>Alternative {index + 1}</h4>
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
                      {effectParts(effect).length > 0 ? (
                        effectParts(effect).map((part) => <span key={part}>{part}</span>)
                      ) : (
                        <span>effect data unavailable</span>
                      )}
                    </li>
                  ))}
                  {(alt.effects ?? []).length === 0 && <li className="muted">No raw effects.</li>}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
