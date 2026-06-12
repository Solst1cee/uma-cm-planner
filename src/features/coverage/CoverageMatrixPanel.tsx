/**
 * Module 4 step 3: read-only coverage matrix.
 * Rows = target skills (priority order); columns = owned cards + a
 * 'Scenario' pseudo-column; cells = tier chips. Tapping a covered cell opens
 * a details drawer with the evidence behind the tier (P3: show the numbers
 * and the assumptions, never bare verdicts).
 */
import { useMemo, useState } from 'react';
import type {
  CmPlan,
  CoverageRow,
  CoverageSource,
  OwnedCard,
  SkillRecord,
  SupportCardRecord,
} from '@/core/types';
import { buildCoverageMatrix, effectiveSpCost, type HintLevel } from '@/core/coverage';
import { useGameData } from '@/features/data/gameData';
import { bestTierOf, TIER_DESCRIPTION, TIER_LABEL } from '@/features/coverage/tierMeta';

interface Column {
  key: string;
  owned: OwnedCard;
  card: SupportCardRecord | undefined;
}

interface Selection {
  row: CoverageRow;
  source: CoverageSource;
  column: Column | null; // null = scenario pseudo-column
}

/**
 * Expected hint level for the SP-cost estimate: one hint event at base Lv1
 * plus the card's Hint Lv passive (effect 17, mechanics-notes §9), capped at
 * the Lv5 discount schedule. Non-hint sources assume no hint (full cost).
 */
function expectedHintLevel(source: CoverageSource, column: Column | null): HintLevel {
  if (!column?.card) return 0;
  if (source.kind !== 'chain' && source.kind !== 'hint_strong' && source.kind !== 'hint_weak') {
    return 0;
  }
  const perLevel = column.card.perLevel.find(
    (p) => p.limitBreak === column.owned.limitBreak,
  );
  const lvl = 1 + (perLevel?.hintLevels ?? 0);
  return (lvl >= 5 ? 5 : lvl) as HintLevel;
}

function TierChip({ tier }: { tier: CoverageSource['kind'] }) {
  return <span className={`chip tier-${tier}`}>{TIER_LABEL[tier]}</span>;
}

function DetailsDrawer({
  selection,
  skill,
  onClose,
}: {
  selection: Selection;
  skill: SkillRecord | undefined;
  onClose: () => void;
}) {
  const { sparkRates } = useGameData();
  const { row, source, column } = selection;
  const detail = source.detail;
  const hintLevel = expectedHintLevel(source, column);
  const spCost = skill ? effectiveSpCost(skill, hintLevel, sparkRates) : undefined;
  const skillName = skill?.nameEn ?? row.skillId;
  const sourceName = column
    ? `${column.card?.charName ?? column.owned.cardId} LB${column.owned.limitBreak}`
    : 'Scenario';

  return (
    <div className="drawer" role="dialog" aria-label={`Coverage details: ${skillName}`}>
      <div className="drawer-head">
        <h3>{skillName}</h3>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close details">
          ✕
        </button>
      </div>
      <p>
        <TierChip tier={source.kind} /> via {sourceName}
      </p>
      <p className="muted">{TIER_DESCRIPTION[source.kind]}</p>
      <dl className="detail-list">
        {detail?.hintPoolSize !== undefined && (
          <>
            <dt>Hint pool size</dt>
            <dd>{detail.hintPoolSize}</dd>
          </>
        )}
        {detail?.hintFrequency !== undefined && (
          <>
            <dt>Hint frequency passive</dt>
            <dd>{detail.hintFrequency}</dd>
          </>
        )}
        {detail?.specialtyPriority !== undefined && (
          <>
            <dt>Specialty priority</dt>
            <dd>{detail.specialtyPriority}</dd>
          </>
        )}
        {spCost !== undefined && (
          <>
            <dt>Effective SP cost</dt>
            <dd>{spCost} SP</dd>
          </>
        )}
      </dl>
      <p className="muted small">
        {hintLevel > 0
          ? `Assumes one hint event taken at Lv ${hintLevel} (base 1 + card Hint Lv passive); ` +
            'cumulative discount 10/20/30/35/40 % capped at 40 % (mechanics-notes §7). Estimate, not a guarantee.'
          : 'No hint discount assumed — full SP cost shown.'}
      </p>
    </div>
  );
}

export function CoverageMatrixPanel({
  plan,
  inventory,
}: {
  plan: CmPlan;
  inventory: OwnedCard[];
}) {
  const { skills, cards, skillById, cardById } = useGameData();
  const [selection, setSelection] = useState<Selection | null>(null);

  const rows = useMemo(() => {
    const built = buildCoverageMatrix({ plan, inventory, cards, skills });
    return [...built].sort((a, b) => a.priority - b.priority); // stable: keeps plan order within a priority
  }, [plan, inventory, cards, skills]);

  const columns = useMemo<Column[]>(
    () =>
      inventory.map((owned, i) => ({
        key: `${owned.id ?? `i${i}`}`,
        owned,
        card: cardById.get(owned.cardId),
      })),
    [inventory, cardById],
  );

  if (plan.targetSkills.length === 0) {
    return (
      <section className="panel" aria-labelledby="coverage-h">
        <h2 id="coverage-h">Coverage</h2>
        <p className="muted">Add target skills above to see coverage.</p>
      </section>
    );
  }

  return (
    <section className="panel" aria-labelledby="coverage-h">
      <h2 id="coverage-h">Coverage</h2>
      {columns.length === 0 && (
        <p className="muted">No owned cards yet — only scenario coverage is shown.</p>
      )}
      <div className="matrix-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th scope="col" className="skill-col">
                Skill
              </th>
              {columns.map((col) => (
                <th scope="col" key={col.key}>
                  <span className="col-card">
                    {col.card?.charName ?? col.owned.cardId}
                    <span className="muted small"> LB{col.owned.limitBreak}</span>
                  </span>
                </th>
              ))}
              <th scope="col">Scenario</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const skill = skillById.get(row.skillId);
              const name = skill?.nameEn ?? row.skillId;
              const uncovered = row.bestTier === 'uncovered';
              return (
                <tr key={row.skillId} className={uncovered ? 'row-uncovered' : undefined}>
                  <th scope="row" className="skill-col">
                    <span className="skill-name">
                      {uncovered && (
                        <span className="flag" role="img" aria-label="uncovered">
                          ⚑
                        </span>
                      )}
                      {name}
                    </span>
                    <span className="muted small">P{row.priority}</span>
                    {uncovered && (
                      <span className="uncovered-note">
                        no reliable source — buy at full SP or drop
                      </span>
                    )}
                  </th>
                  {columns.map((col) => {
                    const source = bestTierOf(
                      row.sources.filter(
                        (s) => s.cardId !== undefined && s.cardId === col.owned.cardId,
                      ),
                    );
                    return (
                      <td key={col.key}>
                        {source ? (
                          <button
                            type="button"
                            className="cell-btn"
                            onClick={() => setSelection({ row, source, column: col })}
                            aria-label={`${name} via ${col.card?.charName ?? col.owned.cardId} LB${col.owned.limitBreak}: ${TIER_LABEL[source.kind]}`}
                          >
                            <TierChip tier={source.kind} />
                          </button>
                        ) : (
                          <span className="muted" aria-hidden="true">
                            –
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td>
                    {(() => {
                      const source = bestTierOf(
                        row.sources.filter((s) => s.kind === 'scenario'),
                      );
                      return source ? (
                        <button
                          type="button"
                          className="cell-btn"
                          onClick={() => setSelection({ row, source, column: null })}
                          aria-label={`${name} via scenario: ${TIER_LABEL[source.kind]}`}
                        >
                          <TierChip tier={source.kind} />
                        </button>
                      ) : (
                        <span className="muted" aria-hidden="true">
                          –
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selection && (
        <DetailsDrawer
          selection={selection}
          skill={skillById.get(selection.row.skillId)}
          onClose={() => setSelection(null)}
        />
      )}
    </section>
  );
}
