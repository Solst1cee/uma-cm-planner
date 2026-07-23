/**
 * Module 2 workbench table: one row per buyable skill — lock cell (blank →
 * 🔒 locked → ✕ excluded) / skill+icon / type chip / SP cost with its
 * − Lv N + hint stepper (cost is read-only: it derives from the hint level) /
 * ΔL / L-per-SP. Fully controlled (no internal state).
 */
import type { HintLevel } from '@/core/cost';
import { useGameData } from '@/features/data/gameData';
import { GameIcon } from '@/features/data/GameIcon';
import type { CandidateRow, RankResult } from '@/features/sp-optimizer/rankBaskets';
import { basketBuyCut } from '@/features/sp-optimizer/optimizerState';
import { useSkillKinds } from '@/features/sp-optimizer/skillKind';

export interface BuyableSkillsTableProps {
  result: RankResult | null;
  rows: CandidateRow[];
  selectedIdx: number;
  pins: Set<string>;
  excluded: Set<string>;
  /** Lock cell cycle: blank → 🔒 pinned → ✕ excluded → blank. */
  onCycleLock: (id: string) => void;
  onSetHint: (id: string, lvl: HintLevel) => void;
}

const LOCK_GLYPH = { lock: '🔒', excluded: '✕', buy: '✓', avail: '' } as const;

export function BuyableSkillsTable(props: BuyableSkillsTableProps) {
  const { result, rows, selectedIdx, pins, excluded, onCycleLock, onSetHint } = props;
  const { skillById } = useGameData();
  const kinds = useSkillKinds(rows.map((r) => r.skillId));
  const { buy } = result ? basketBuyCut(result, selectedIdx) : { buy: new Set<string>() };
  const analyzed = result !== null;
  // Sort by L/SP desc when analyzed; otherwise keep input order.
  const ordered = analyzed ? [...rows].sort((a, b) => b.lPerSp - a.lPerSp) : rows;

  return (
    <table className="sp-table">
      <thead>
        <tr>
          <th>Lock</th><th>Skill</th><th>Type</th><th>SP cost · hint</th>
          <th>Δ L</th><th>L / SP <span className="muted">(×1k)</span></th>
        </tr>
      </thead>
      <tbody>
        {ordered.map((r) => {
          const skill = skillById.get(r.skillId);
          const pinned = pins.has(r.skillId);
          const isExcluded = excluded.has(r.skillId);
          const inBuy = buy.has(r.skillId);
          const state = pinned ? 'lock' : isExcluded ? 'excluded' : inBuy ? 'buy' : 'avail';
          const showNumbers = analyzed && !isExcluded;
          const kind = kinds.get(r.skillId);
          const hint = (r.hintLevel ?? 0) as HintLevel;
          return (
            <tr key={r.skillId} className={`sp-row is-${state}`}>
              <td>
                <button
                  type="button"
                  className={`sp-lock is-${state}`}
                  aria-label={`Lock ${r.skillId}`}
                  aria-pressed={pinned}
                  title={pinned ? 'Locked — click to exclude' : isExcluded ? 'Excluded — click to clear' : 'Click to lock'}
                  onClick={() => onCycleLock(r.skillId)}
                >
                  {LOCK_GLYPH[state]}
                </button>
              </td>
              <td>
                <span className="sp-skill">
                  {skill && <GameIcon kind="skill" id={skill.iconId} size={18} alt="" />}
                  <span className={r.rarity === 'gold' ? 'sk-gold' : 'sk-white'}>{skill?.nameEn ?? r.skillId}</span>
                </span>
              </td>
              <td>{kind ? <span className={`sp-kind is-${kind.tone}`}>{kind.label}</span> : null}</td>
              <td className={`sp-cost${r.hintEdited ? ' is-edited' : ''}`}>
                <span className="sp-cost-value">{r.screenSpCost}</span>
                <span className="sp-hintstep" role="group" aria-label={`Hint level for ${r.skillId}`}>
                  <button
                    type="button"
                    aria-label={`Hint down for ${r.skillId}`}
                    disabled={hint <= 0}
                    onClick={() => onSetHint(r.skillId, (hint - 1) as HintLevel)}
                  >
                    −
                  </button>
                  <span className="sp-hintstep-lv">Lv {hint}</span>
                  <button
                    type="button"
                    aria-label={`Hint up for ${r.skillId}`}
                    disabled={hint >= 5}
                    onClick={() => onSetHint(r.skillId, (hint + 1) as HintLevel)}
                  >
                    +
                  </button>
                </span>
              </td>
              <td className="sp-Lval">{showNumbers ? `${r.deltaL < 0 ? '' : '+'}${r.deltaL.toFixed(2)}` : '—'}</td>
              <td className={`sp-ratio ${showNumbers && r.lPerSp < 3 ? 'is-weak' : 'is-strong'}`}>
                {showNumbers ? r.lPerSp.toFixed(1) : '—'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
