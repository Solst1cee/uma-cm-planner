/** M1.4b — Parent-2 "Draft" mode panel (docs/superpowers/specs/2026-07-06-
 *  m1-4b-rental-builder-design.md §4). A forced-tier picker (◎/○/△), a "Load
 *  from Target spark" seed button (M1.8's `buildTargetSpark` residual → draft
 *  filters), the shared `SparkFilterCards` spec editor (via `useSparkFilterState`,
 *  Task 5), three rental-search deep-link anchors, and the P3 honesty caveat —
 *  a draft is a search *spec*, not a guaranteed borrowable rental.
 *
 *  Presentational — no providers. Green/white option lists, icons, and skill-name
 *  resolution stay the page's job (mirrors `UmaPickerModal`'s wiring of the same
 *  `useSparkFilterState` hook: the hook returns raw clauses, the caller resolves
 *  display names via `skillName`). */
import type { ReactNode } from 'react';
import type { ForcedTier, RentalDraft, Stat } from '@/core/types';
import type { SparkFilter } from '@/core/sparkFilter';
import { seedFromTargetSpark } from '@/core/rentalDraft';
import { chronoGenesisUrl, pureDbUrl, umaMoeUrl } from '@/core/rentalSearch';
import { useSparkFilterState } from './useSparkFilterState';
import { SparkFilterCards } from './SparkFilterCards';

export interface RentalDraftPanelProps {
  draft: RentalDraft;
  onChange: (draft: RentalDraft) => void;
  /** M1.8 Target spark residual — seeds "Load from Target spark". */
  seed: { blue: Array<{ stat: Stat; stars: number }>; white: Array<{ id: string }> };
  traineeCardId: string;
  partnerCardId?: string;
  skillName: (id: string) => string;
  /** Selectable unique skills for the green (UNIQUE) card's search. */
  greenOptions: Array<{ id: string; name: string }>;
  /** Selectable white skills for the white (SKILL) card's search. */
  whiteOptions: Array<{ id: string; name: string }>;
  greenIcon?: (skillId: string) => ReactNode;
  whiteIcon?: (skillId: string) => ReactNode;
}

const TIERS: ForcedTier[] = ['double', 'single', 'triangle'];
const TIER_SYMBOL: Record<ForcedTier, string> = { double: '◎', single: '○', triangle: '△' };
const TIER_LABEL: Record<ForcedTier, string> = {
  double: 'Assume ◎ (double) affinity',
  single: 'Assume ○ (single) affinity',
  triangle: 'Assume △ (triangle) affinity',
};

export function RentalDraftPanel(p: RentalDraftPanelProps) {
  const setFilters = (u: (xs: SparkFilter[]) => SparkFilter[]) =>
    p.onChange({ ...p.draft, filters: u(p.draft.filters) });
  const sf = useSparkFilterState(p.draft.filters, setFilters);

  // --- name-resolution + option lists stay page-wired (the hook returns raw clauses),
  //     mirroring UmaPickerModal's identical wiring of the same hook. ---
  const activeGreen = sf.activeGreen.map((c) => ({ key: c.skillId, name: p.skillName(c.skillId) }));
  const greenOptions = p.greenOptions.filter((o) => !sf.activeGreen.some((c) => c.skillId === o.id));
  const activeWhite = sf.activeWhite.map((c) => ({ key: c.skillId, name: p.skillName(c.skillId) }));
  const whiteOptions = p.whiteOptions.filter((o) => !sf.activeWhite.some((c) => c.skillId === o.id));

  const args = { filters: p.draft.filters, traineeCardId: p.traineeCardId, partnerCardId: p.partnerCardId };
  const moe = umaMoeUrl(args);
  const pdb = pureDbUrl(args);
  const chrono = chronoGenesisUrl(args);

  const droppedNote = (n: number, site: string) =>
    n > 0 ? (
      <span className="muted small inh-rental-dropped">
        {n} filter{n === 1 ? '' : 's'} not encodable on {site}
      </span>
    ) : null;

  return (
    <div className="inh-rental-draft">
      <div className="inh-forced-tier" role="radiogroup" aria-label="Assumed affinity">
        {TIERS.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={p.draft.forcedTier === t}
            aria-label={TIER_LABEL[t]}
            title={TIER_LABEL[t]}
            className={p.draft.forcedTier === t ? 'is-on' : undefined}
            onClick={() => p.onChange({ ...p.draft, forcedTier: t })}
          >
            {TIER_SYMBOL[t]}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="inh-rental-seed"
        onClick={() => p.onChange({ ...p.draft, filters: seedFromTargetSpark(p.seed) })}
      >
        Load from Target spark
      </button>

      <SparkFilterCards
        value={sf.sparkValue}
        onSet={sf.setSpark}
        maxTotal={sf.sparkMaxTotal}
        legacyLocked={sf.legacyLocked}
        membersUsed={sf.membersUsed}
        activeGreen={activeGreen}
        greenOptions={greenOptions}
        greenIcon={p.greenIcon}
        activeWhite={activeWhite}
        whiteOptions={whiteOptions}
        whiteIcon={p.whiteIcon}
      />

      <div className="inh-rental-links">
        <div className="inh-rental-link-row">
          <a href={moe.url} target="_blank" rel="noreferrer noopener">Search uma.moe →</a>
          {droppedNote(moe.dropped.length, 'uma.moe')}
        </div>
        <div className="inh-rental-link-row">
          <a href={pdb.url} target="_blank" rel="noreferrer noopener">pure-db →</a>
          {droppedNote(pdb.dropped.length, 'pure-db')}
        </div>
        <div className="inh-rental-link-row">
          <a href={chrono.url} target="_blank" rel="noreferrer noopener">ChronoGenesis →</a>
          {droppedNote(chrono.dropped.length, 'ChronoGenesis')}
        </div>
      </div>

      <p className="inh-rental-caveat muted small">
        A matching record isn't a guaranteed borrowable rental — follow-then-borrow (3/day),
        DB lag, private/slot-full profiles. This scores fit, not availability.
      </p>
    </div>
  );
}
