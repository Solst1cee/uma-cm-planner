// src/features/inheritance/SkillDetailPopover.tsx
/** M1.7 — click a coverage-table skill cell to open its detail popup, styled
 *  like the Event-column popup (violet header + white body). Loads the engine
 *  technical detail (condition / effect / duration / cooldown) on open + a baked
 *  description; portal + fixed position so it escapes the card overflow. */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { loadSkillTechnicalDetail, type SkillTechnicalDetail } from '@/features/cm-planner/skillTechnicalDetails';
import { conditionLines, describeEffect, formatDuration } from '@/features/cm-planner/skillTechFormat';
import { placeRightOf } from '@/features/cm-planner/anchoredPopover';

export interface SkillDetailInfo {
  skillId: string;
  name: string;
  rarity: string;
  spCost?: number;
  /** Readable effect summary (baked daftuyda desc_en). */
  description?: string;
}

const RARITY_LABEL: Record<string, string> = {
  white: 'White', gold: 'Gold', unique: 'Unique', inherited_unique: 'Inherited unique',
};

export function SkillDetailPopover({ name, skill }: { name: ReactNode; skill: SkillDetailInfo }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [tech, setTech] = useState<SkillTechnicalDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Lazy-load the engine technical detail the first time the popup opens.
  useEffect(() => {
    if (!open || tech) return;
    let cancelled = false;
    setLoading(true);
    loadSkillTechnicalDetail(skill.skillId)
      .then((d) => { if (!cancelled) { setTech(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, skill.skillId, tech]);

  useLayoutEffect(() => {
    if (!open) { setPos(null); return; }
    const place = () => {
      const r = btnRef.current?.getBoundingClientRect();
      if (!r) return;
      setPos(placeRightOf(r, 320, { w: window.innerWidth, h: window.innerHeight }));
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const alt = tech?.alternatives[0];
  const effects = (alt?.effects ?? []).map(describeEffect).filter((e): e is NonNullable<typeof e> => e !== null);
  const sec = (raw: number | undefined) => (raw !== undefined && raw >= 0 ? `${(raw / 10000).toFixed(1)} sec` : formatDuration(raw));
  // The SP badge rides the first section's label row (Description, else Condition, else Effect).
  const spBadge = skill.spCost ? <span className="inh-cov-detail-sp">{skill.spCost} SP</span> : null;
  const firstLabel: 'desc' | 'cond' | 'effect' | null =
    skill.description ? 'desc' : alt?.condition ? 'cond' : (effects.length > 0 || alt) ? 'effect' : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="inh-cov-skill-btn"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
      >
        {name}
      </button>
      {open && pos && createPortal(
        <div ref={popRef} className="inh-cov-detail-pop" style={{ top: pos.top, left: pos.left }} role="dialog">
          <div className="inh-cov-detail-head">
            {skill.name}
            <span className="inh-cov-detail-rarity">{RARITY_LABEL[skill.rarity] ?? skill.rarity}</span>
          </div>
          <div className="inh-cov-detail-body">
            {skill.description && (
              <div className="inh-cov-detail-row">
                <div className="inh-cov-detail-label">Description {firstLabel === 'desc' && spBadge}</div>
                <div>{skill.description}</div>
              </div>
            )}
            {alt?.condition && (
              <div className="inh-cov-detail-row is-cond">
                <div className="inh-cov-detail-label">Condition {firstLabel === 'cond' && spBadge}</div>
                <code className="inh-cov-detail-cond">
                  {conditionLines(alt.condition).map((line, i) => <span key={i}>{line}</span>)}
                </code>
              </div>
            )}
            {(effects.length > 0 || alt) && (
              <div className="inh-cov-detail-row">
                <div className="inh-cov-detail-label">Effect {firstLabel === 'effect' && spBadge}</div>
                {effects.map((e, i) => (
                  <div key={i} className="inh-cov-detail-eff">{e.label} <b>{e.value}</b>{e.target ? ` (${e.target})` : ''}</div>
                ))}
                {alt && <div className="inh-cov-detail-eff">Duration <b>{sec(alt.baseDuration)}</b></div>}
                {alt && <div className="inh-cov-detail-eff">Cooldown <b>{sec(alt.cooldownTime)}</b></div>}
              </div>
            )}
            {loading && !tech && <div className="inh-cov-detail-row muted">Loading…</div>}
            {!skill.description && !alt && !loading && <div className="inh-cov-detail-row muted">No details available.</div>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
