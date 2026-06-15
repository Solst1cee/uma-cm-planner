/**
 * Module 4 steps 3–4: coverage matrix.
 * Rows = target skills (priority order); columns = owned cards + chosen
 * parents (spark % chips) + a 'Scenario' pseudo-column; cells = tier chips.
 * Tapping a covered cell opens a details drawer with the evidence behind the
 * tier (P3: show the numbers and the assumptions, never bare verdicts).
 */
import { useMemo, useState } from 'react';
import type {
  CmPlan,
  CoverageRow,
  CoverageSource,
  OwnedCard,
  Parent,
  SkillRarity,
  SkillRecord,
  SparkRates,
  SupportCardRecord,
} from '@/core/types';
import {
  buildCoverageMatrix,
  bundledSpCost,
  effectiveSpCost,
  expectedHintLevel,
} from '@/core/coverage';
import { combinedSparkChance } from '@/core/spark';
import { useGameData } from '@/features/data/gameData';
import { GameIcon } from '@/features/data/GameIcon';
import { useChosenParents } from '@/features/coverage/useChosenParents';
import {
  bestTierOf,
  formatSparkPct,
  TIER_DESCRIPTION,
  TIER_LABEL,
} from '@/features/coverage/tierMeta';

interface Column {
  key: string;
  owned: OwnedCard;
  card: SupportCardRecord | undefined;
}

/** One column per SET plan.chosenParents slot (the record may still be loading). */
interface ParentColumn {
  key: string;
  parentId: string;
  /** Uma display name when resolvable, else 'Parent N'. */
  label: string;
  /** True when label is a real uma name (gets the small 'parent' marker). */
  named: boolean;
  /** The parent's umaId for the portrait, when the record has resolved. */
  umaId?: string;
}

interface Selection {
  row: CoverageRow;
  source: CoverageSource;
  column: Column | null; // card column; null = scenario or parent cell
  /** Set for parent-column cells: the column label ("via <label>"). */
  parentLabel?: string;
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

function sparkSourcesOf(row: CoverageRow, parentId: string): CoverageSource[] {
  return row.sources.filter((s) => s.kind === 'spark' && s.parentId === parentId);
}

/** Highest-chance spark source — the one the cell opens in the drawer. */
function bestSpark(sources: CoverageSource[]): CoverageSource | undefined {
  let best: CoverageSource | undefined;
  for (const s of sources) {
    if (best === undefined || (s.sparkPct ?? 0) > (best.sparkPct ?? 0)) best = s;
  }
  return best;
}

/**
 * FINDING 4(a): combine a parent's lineage lines for a skill in a single
 * raw-float pass via core combinedSparkChance, instead of re-combining the
 * already-1dp-rounded chip values (which double-rounds). `parent` is the
 * resolved record for this column; falls back to the rounded chip combine only
 * when the record is still loading.
 */
function sparkChipText(
  sources: CoverageSource[],
  parent: Parent | undefined,
  skillId: string,
  rates: SparkRates,
  rarityById: ReadonlyMap<string, SkillRarity>,
): string {
  let pct: number;
  let approx: boolean;
  if (parent !== undefined) {
    const combined = combinedSparkChance({
      parents: [parent],
      skillId,
      rates,
      opts: { skillRarity: rarityById },
    });
    pct = combined.pct;
    approx = combined.approximate;
  } else {
    pct = sources[0]?.sparkPct ?? 0;
    approx = sources.some((s) => s.approximate === true);
  }
  return `spark ${approx ? '≈' : ''}${formatSparkPct(pct)}%`;
}

function TierChip({ tier }: { tier: CoverageSource['kind'] }) {
  return <span className={`chip tier-${tier}`}>{TIER_LABEL[tier]}</span>;
}

function SparkDetails({
  row,
  source,
  parents,
  rates,
  rarityById,
}: {
  row: CoverageRow;
  source: CoverageSource;
  parents: Parent[];
  rates: SparkRates;
  rarityById: ReadonlyMap<string, SkillRarity>;
}) {
  const detail = source.detail;
  // All spark sources on the row, and the DISTINCT parents that contribute one.
  const rowSparkSources = row.sources.filter((s) => s.kind === 'spark');
  const contributingParentIds = new Set(
    rowSparkSources.map((s) => s.parentId).filter((id): id is string => id !== undefined),
  );
  const contributingParents = parents.filter((p) => contributingParentIds.has(p.id));
  // FINDING 4(a): cross-parent "at least one procs" number in a single
  // raw-float pass (core combinedSparkChance), not re-combined rounded chips.
  const combined =
    contributingParents.length > 0
      ? combinedSparkChance({
          parents: contributingParents,
          skillId: row.skillId,
          rates,
          opts: { skillRarity: rarityById },
        })
      : undefined;
  // FINDING 4(b): a positive affinity means the parent line used the entered
  // TOTAL affinity as a per-member upper bound (overestimate) — disclose it.
  const usedAffinityHint =
    source.detail?.grandparent !== true &&
    source.detail?.affinityUsed !== undefined &&
    source.detail.affinityUsed > 0;
  const multiParent = contributingParents.length > 1;
  return (
    <>
      <dl className="detail-list">
        {detail?.sparkStars !== undefined && (
          <>
            <dt>Spark stars</dt>
            <dd>{detail.sparkStars}★</dd>
          </>
        )}
        <dt>Origin</dt>
        <dd>{detail?.grandparent === true ? 'Grandparent' : 'Parent'}</dd>
        {detail?.affinityUsed !== undefined && (
          <>
            <dt>Affinity used</dt>
            <dd>{detail.affinityUsed}</dd>
          </>
        )}
        <dt>Chance (this line)</dt>
        <dd>
          {source.approximate === true ? '≈' : ''}
          {formatSparkPct(source.sparkPct ?? 0)}%
        </dd>
        {multiParent && combined !== undefined && (
          <>
            <dt>Combined (all parents)</dt>
            <dd>
              {combined.approximate ? '≈' : ''}
              {formatSparkPct(combined.pct)}%
            </dd>
          </>
        )}
      </dl>
      <p className="muted small">
        Spark % is the probability of the spark proccing at least once across both
        inspiration events — estimation, not a guarantee.
        {usedAffinityHint &&
          ' This line uses the entered TOTAL affinity as a per-member upper bound — refined by Module 1; shown as approximately.'}
        {multiParent &&
          ' Combined across the contributing parents = the chance at least one procs.'}
        {source.approximate === true &&
          ' ≈ marks a documented approximation (e.g. grandparent affinity fallback — mechanics-notes §4).'}{' '}
        SP-cost branches for spark coverage are in the contingency view below.
      </p>
    </>
  );
}

function DetailsDrawer({
  selection,
  skill,
  parents,
  rarityById,
  onClose,
}: {
  selection: Selection;
  skill: SkillRecord | undefined;
  parents: Parent[];
  rarityById: ReadonlyMap<string, SkillRarity>;
  onClose: () => void;
}) {
  const { sparkRates, skillById } = useGameData();
  const { row, source, column, parentLabel } = selection;
  const isSpark = source.kind === 'spark';
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
    : (parentLabel ?? 'Scenario');

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
      {isSpark ? (
        <SparkDetails
          row={row}
          source={source}
          parents={parents}
          rates={sparkRates}
          rarityById={rarityById}
        />
      ) : (
        <>
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
        </>
      )}
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
  const { skills, cards, skillById, cardById, umaById, sparkRates } = useGameData();
  const { slots: parentSlots, parents } = useChosenParents(plan);
  const [selection, setSelection] = useState<Selection | null>(null);

  const rows = useMemo(() => {
    const built = buildCoverageMatrix({
      plan,
      inventory,
      cards,
      skills,
      parents,
      rates: sparkRates, // required for the spark tier — parents are ignored without it
    });
    return [...built].sort((a, b) => a.priority - b.priority); // stable: keeps plan order within a priority
  }, [plan, inventory, cards, skills, parents, sparkRates]);

  // skillId → rarity, so the combined-spark math gates white-spark pricing the
  // same way the core matrix does (FINDING 4 / mechanics-notes §8).
  const rarityById = useMemo<ReadonlyMap<string, SkillRarity>>(
    () => new Map(skills.map((s) => [s.skillId, s.rarity])),
    [skills],
  );
  const parentById = useMemo(
    () => new Map(parents.map((p) => [p.id, p])),
    [parents],
  );

  const columns = useMemo<Column[]>(
    () =>
      inventory.map((owned, i) => ({
        key: `${owned.id ?? `i${i}`}`,
        owned,
        card: cardById.get(owned.cardId),
      })),
    [inventory, cardById],
  );

  const parentColumns = useMemo<ParentColumn[]>(() => {
    const cols: ParentColumn[] = [];
    ([plan.parents.a, plan.parents.b] as const).forEach((parentId, slot) => {
      if (parentId === undefined) return;
      const parent = parentSlots[slot];
      const name = parent !== undefined ? umaById?.get(parent.umaId)?.nameEn : undefined;
      cols.push({
        key: `${slot}-${parentId}`,
        parentId,
        label: name ?? `Parent ${slot + 1}`,
        named: name !== undefined,
        umaId: parent?.umaId,
      });
    });
    return cols;
  }, [plan.parents, parentSlots, umaById]);

  if (plan.wishlist.length === 0) {
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
              {parentColumns.map((col) => (
                <th scope="col" key={col.key}>
                  <span className="col-card col-parent">
                    {col.umaId !== undefined && (
                      <GameIcon kind="uma" id={col.umaId} size={24} alt="" />
                    )}
                    {col.label}
                    {col.named && <span className="muted small"> parent</span>}
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
                      {skill && (
                        <GameIcon kind="skill" id={skill.iconId} size={22} alt="" />
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
                  {parentColumns.map((col) => {
                    const sparkSources = sparkSourcesOf(row, col.parentId);
                    const best = bestSpark(sparkSources);
                    if (best === undefined) {
                      return (
                        <td key={col.key}>
                          <span className="muted" aria-hidden="true">
                            –
                          </span>
                        </td>
                      );
                    }
                    const text = sparkChipText(
                      sparkSources,
                      parentById.get(col.parentId),
                      row.skillId,
                      sparkRates,
                      rarityById,
                    );
                    return (
                      <td key={col.key}>
                        <button
                          type="button"
                          className="cell-btn"
                          onClick={() =>
                            setSelection({ row, source: best, column: null, parentLabel: col.label })
                          }
                          aria-label={`${name} via ${col.label}: ${text}`}
                        >
                          <span className="chip tier-spark">{text}</span>
                        </button>
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
          parents={parents}
          rarityById={rarityById}
          onClose={() => setSelection(null)}
        />
      )}
    </section>
  );
}
