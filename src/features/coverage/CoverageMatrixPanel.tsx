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
import {
  buildCoverageMatrix,
  bundledSpCost,
  effectiveSpCost,
  expectedHintLevel,
} from '@/core/coverage';
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
 * Does this source belong to this inventory copy? Match by the owning row's
 * id when both sides carry one (duplicate copies of a card must show their
 * own tiers/LB, not each other's); fall back to cardId for not-yet-persisted
 * rows or older core output without ownedId.
 */
function sourceBelongsTo(source: CoverageSource, owned: OwnedCard): boolean {
  if (source.ownedId !== undefined && owned.id !== undefined) {
    return source.ownedId === owned.id;
  }
  return source.cardId !== undefined && source.cardId === owned.cardId;
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
  const { sparkRates, skillById } = useGameData();
  const { row, source, column } = selection;
  const detail = source.detail;
  const card = column?.card;
  const cardSkill = card?.skills.find((s) => s.skillId === row.skillId);
  // Core model (mechanics-notes §9): >0 only for training-hint sources;
  // 0 for event-granted sources (chain/date/random/scenario) = full cost,
  // because event-reward hint levels are unverified (P3).
  const hintLevel = expectedHintLevel(source, card, cardSkill);
  const spCost = skill ? effectiveSpCost(skill, hintLevel, sparkRates) : undefined;
  // Gold skills bundle their white prereq (mechanics-notes §7) — this source
  // covers the gold only, so the white is assumed unhinted (Lv0, full cost).
  const prereq = skill?.prereqSkillId ? skillById.get(skill.prereqSkillId) : undefined;
  const bundled =
    skill && prereq ? bundledSpCost(skill, prereq, hintLevel, 0, sparkRates) : undefined;
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
            <dd>
              {spCost} SP
              {skill?.prereqSkillId !== undefined && prereq === undefined && (
                <span className="muted small"> (excludes white prereq)</span>
              )}
            </dd>
          </>
        )}
        {bundled !== undefined && prereq !== undefined && (
          <>
            <dt>With white prereq</dt>
            <dd>
              {bundled} SP{' '}
              <span className="muted small">
                ({skillName} {spCost} SP + {prereq.nameEn} {prereq.baseSpCost} SP at full
                cost, rounded once — mechanics-notes §7)
              </span>
            </dd>
          </>
        )}
      </dl>
      <p className="muted small">
        {hintLevel > 0
          ? `Assumes one hint event taken at Lv ${hintLevel} (hint grant + card Hint Lv passive); ` +
            'cumulative discount 10/20/30/35/40 % capped at 40 % (mechanics-notes §7). Estimate, not a guarantee.'
          : 'event-granted hint levels unverified — full SP cost shown.'}
        {prereq !== undefined &&
          ` White prereq ${prereq.nameEn} assumed unhinted (full cost).`}
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
                      row.sources.filter((s) => sourceBelongsTo(s, col.owned)),
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
