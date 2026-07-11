/**
 * Module 2 workbench table (Task 6): one row per buyable skill — lock cell /
 * skill+icon / type chip / ΔL / editable SP cost / L-per-SP / hint segmented
 * control. Fully controlled (no internal state); a later task mounts it into
 * SpOptimizerPage alongside the result banner.
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
  onTogglePin: (id: string) => void;
  onEditCost: (id: string, cost: number) => void;
  onSetHint: (id: string, lvl: HintLevel) => void;
}

const HINTS: HintLevel[] = [0, 1, 2, 3, 4, 5];

export function BuyableSkillsTable(props: BuyableSkillsTableProps) {
  const { result, rows, selectedIdx, pins, onTogglePin, onEditCost, onSetHint } = props;
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
          <th>Lock</th><th>Skill</th><th>Type</th><th>Δ L</th><th>SP cost</th>
          <th>L / SP <span className="muted">(×1k)</span></th><th>Hint Lv</th>
        </tr>
      </thead>
      <tbody>
        {ordered.map((r) => {
          const skill = skillById.get(r.skillId);
          const pinned = pins.has(r.skillId);
          const inBuy = buy.has(r.skillId);
          const state = pinned ? 'lock' : inBuy ? 'buy' : 'avail';
          const kind = kinds.get(r.skillId);
          // Controller resolution 1: CandidateRow.baseSpCost is never populated
          // by the orchestrator today, so fall back to the game-data base cost;
          // never strike a 0 (uniques carry baseSpCost 0).
          const base = r.baseSpCost ?? skill?.baseSpCost;
          const discounted = base !== undefined && base > r.screenSpCost;
          return (
            <tr key={r.skillId} className={`sp-row is-${state}`}>
              <td>
                <button
                  type="button"
                  className={`sp-lock is-${state}`}
                  aria-label={`Lock ${r.skillId}`}
                  aria-pressed={pinned}
                  onClick={() => onTogglePin(r.skillId)}
                >
                  {pinned ? '🔒' : inBuy ? '✓' : ''}
                </button>
              </td>
              <td className="sp-skill">
                {skill && <GameIcon kind="skill" id={skill.iconId} size={18} alt="" />}
                <span className={r.rarity === 'gold' ? 'sk-gold' : 'sk-white'}>{skill?.nameEn ?? r.skillId}</span>
                {r.prereqSkillId && <span className="sp-bundle">+ white base</span>}
              </td>
              <td>{kind ? <span className={`sp-kind is-${kind.tone}`}>{kind.label}</span> : null}</td>
              <td className="sp-Lval">{analyzed ? `+${r.deltaL.toFixed(2)}` : '—'}</td>
              <td className="sp-cost">
                {discounted && <span className="was">{base}</span>}
                <input
                  type="number"
                  className="sp-cost-input"
                  aria-label={`Cost for ${r.skillId}`}
                  value={r.screenSpCost}
                  onChange={(e) => onEditCost(r.skillId, Number(e.target.value))}
                />
              </td>
              <td className={`sp-ratio ${analyzed && r.lPerSp < 3 ? 'is-weak' : 'is-strong'}`}>
                {analyzed ? r.lPerSp.toFixed(1) : '—'}
              </td>
              <td>
                <span className="sp-hint" role="group" aria-label={`Hint level for ${r.skillId}`}>
                  {HINTS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={r.hintLevel === h ? 'on' : ''}
                      aria-pressed={r.hintLevel === h}
                      onClick={() => onSetHint(r.skillId, h)}
                    >
                      {h}
                    </button>
                  ))}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
