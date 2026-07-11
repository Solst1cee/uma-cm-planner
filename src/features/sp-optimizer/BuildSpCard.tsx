import type { BuildContext, CaptureBundle } from '@/core/spOptimizer';
import { useGameData } from '@/features/data/gameData';

export interface PlanOption { id: string; label: string }
export interface MatchSummary { locked: string[]; matched: number; notBuyable: number }

export interface BuildSpCardProps {
  context: BuildContext | null;
  source: CaptureBundle['source'];
  onSourceChange: (s: 'memory' | 'manual' | 'ocr') => void;
  onSpChange: (n: number) => void;
  onLoadPlan: (planId: string) => void;
  plans: PlanOption[];
  matchSummary: MatchSummary | null;
}

const SOURCES: { key: 'memory' | 'manual' | 'ocr'; label: string }[] = [
  { key: 'memory', label: '📷 Import' },
  { key: 'manual', label: 'Manual' },
  { key: 'ocr', label: 'Carry from M4' },
];

export function BuildSpCard(props: BuildSpCardProps) {
  const { context, source, onSourceChange, onSpChange, onLoadPlan, plans, matchSummary } = props;
  const { umaById } = useGameData();
  const uma = context ? umaById?.get(context.umaId) : undefined; // umaById is optional on GameData
  const s = context?.stats;
  return (
    <div className="sp-buildcard">
      <div className="sp-buildcard-row">
        <span className="sp-seg" role="group" aria-label="Input source">
          {SOURCES.map((o) => (
            <button key={o.key} type="button" className={source === o.key ? 'on' : ''} aria-pressed={source === o.key} onClick={() => onSourceChange(o.key)}>
              {o.label}
            </button>
          ))}
        </span>
        {context && (
          <>
            <span className="sp-chip">🐎 {uma?.nameEn ?? context.umaId} · {context.strategy}</span>
            <span className="sp-chip">Apt {context.aptitudes.surface} · {context.aptitudes.distance} · {context.aptitudes.strategy}</span>
            {s && <span className="sp-chip">SPD {s.spd} · STA {s.sta} · PWR {s.pow} · GUT {s.gut} · WIT {s.wit}</span>}
          </>
        )}
        <label className="sp-available">
          <span className="muted small">Available SP</span>
          <input type="number" aria-label="Available SP" value={context?.spBudget ?? 0} onChange={(e) => onSpChange(Number(e.target.value))} />
        </label>
      </div>
      <div className="sp-buildcard-row sp-loadplan">
        <label>
          <span className="muted small">Load uma plan</span>
          <select aria-label="Load uma plan" value="" onChange={(e) => e.target.value && onLoadPlan(e.target.value)}>
            <option value="">📋 choose…</option>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        {matchSummary && (
          <span className="sp-match">
            {matchSummary.locked.map((id) => <span key={id} className="sp-chip">🔒 {id}</span>)}
            <span className="sp-chip">{matchSummary.matched} matched</span>
            {matchSummary.notBuyable > 0 && <span className="sp-chip">{matchSummary.notBuyable} not yet buyable</span>}
          </span>
        )}
      </div>
    </div>
  );
}
