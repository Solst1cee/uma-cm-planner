import { useRef, type ReactNode } from 'react';

import type { BuildContext, CaptureBundle } from '@/core/spOptimizer';
import { useGameData } from '@/features/data/gameData';

export interface MatchSummary { locked: string[]; matched: number; notBuyable: number }

export interface BuildSpCardProps {
  context: BuildContext | null;
  source: CaptureBundle['source'];
  /** Import segment: the chosen capture .json file. */
  onImportFile: (file: File) => void;
  /** Carry-from-M4 segment: seed from the active planner wishlist. */
  onCarryFromM4: () => void;
  carryDisabled?: boolean;
  onSpChange: (n: number) => void;
  fastLearner: boolean;
  onFastLearnerChange: (v: boolean) => void;
  /** Page-built "Load uma plan" control (provider-free card pattern). */
  loadPlan?: ReactNode;
  matchSummary: MatchSummary | null;
}

export function BuildSpCard(props: BuildSpCardProps) {
  const { context, source, onImportFile, onCarryFromM4, carryDisabled, onSpChange, fastLearner, onFastLearnerChange, loadPlan, matchSummary } = props;
  const { umaById } = useGameData();
  const fileRef = useRef<HTMLInputElement>(null);
  const uma = context ? umaById?.get(context.umaId) : undefined; // umaById is optional on GameData
  const s = context?.stats;
  return (
    <div className="sp-buildcard">
      <div className="sp-buildcard-row">
        <span className="sp-seg" role="group" aria-label="Input source">
          <button type="button" className={source === 'memory' ? 'on' : ''} aria-pressed={source === 'memory'} onClick={() => fileRef.current?.click()}>
            📷 Import
          </button>
          <button type="button" className={source === 'manual' ? 'on' : ''} aria-pressed={source === 'manual'} disabled title="Manual entry lands in F1.5">
            Manual
          </button>
          <button
            type="button"
            className={source === 'ocr' ? 'on' : ''}
            aria-pressed={source === 'ocr'}
            onClick={onCarryFromM4}
            disabled={carryDisabled}
            title="No capture handy? Build a hypothetical from the planner: the active plan's wishlist becomes the buyable list, its target stats fill the build."
          >
            Carry from M4
          </button>
        </span>
        <input
          ref={fileRef}
          type="file"
          className="sp-file-hidden"
          accept="application/json,.json"
          aria-label="Import capture (.json)"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportFile(f);
            e.target.value = ''; // allow re-importing the same file
          }}
        />
        {context && (
          <>
            <span className="sp-chip">🐎 {uma?.nameEn ?? context.umaId} · {context.strategy}</span>
            <span className="sp-chip">Apt {context.aptitudes.surface} · {context.aptitudes.distance} · {context.aptitudes.strategy}</span>
            {s && <span className="sp-chip">SPD {s.spd} · STA {s.sta} · PWR {s.pow} · GUT {s.gut} · WIT {s.wit}</span>}
          </>
        )}
        <label
          className="sp-fastlearner"
          title="Fast Learner (切れ者): −10% skill cost, stacks additively with hint discounts. Reprices every row from its base cost — leave off for an imported capture whose screen costs already include it."
        >
          <input
            type="checkbox"
            aria-label="Fast Learner"
            checked={fastLearner}
            onChange={(e) => onFastLearnerChange(e.target.checked)}
          />
          <span className="muted small">Fast Learner −10%</span>
        </label>
        <label className="sp-available">
          <span className="muted small">Available SP</span>
          <input type="number" aria-label="Available SP" value={context?.spBudget ?? 0} onChange={(e) => onSpChange(Number(e.target.value))} />
        </label>
      </div>
      <div className="sp-buildcard-row sp-loadplan">
        <span className="sp-loadplan-label">Load uma plan</span>
        {loadPlan}
        <span className="muted small">prefills matching skills as 🔒 locked in the table below</span>
        {matchSummary && (
          <span className="sp-match">
            {matchSummary.locked.map((name) => <span key={name} className="sp-chip sp-chip-lock">🔒 {name}</span>)}
            <span className="sp-chip">{matchSummary.matched} matched</span>
            {matchSummary.notBuyable > 0 && <span className="sp-chip sp-chip-dash">{matchSummary.notBuyable} not yet buyable</span>}
          </span>
        )}
      </div>
    </div>
  );
}
