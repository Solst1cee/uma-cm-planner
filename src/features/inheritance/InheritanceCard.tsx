/** M1.4 — the "Inheritance" card: owned Parent 1 & 2 picker, Find-candidates,
 *  spark display, selection persisted to plan.parents. Rental → M1.4b stub. */
import { useMemo, useState } from 'react';
import { useActivePlan } from '@/app/ActivePlanContext';
import type { Parent } from '@/core/types';
import { GameIcon } from '@/features/data/GameIcon';
import { HeaderHelp } from '@/features/cm-planner/HeaderHelp';
import { useGameData } from '@/features/data/gameData';
import { umaName, useUmas } from '@/features/parents/useUmas';
import { topCandidates } from './candidateScore';
import { ParentCardView } from './ParentCardView';
import { RankBadge } from './RankBadge';
import { UploadDataButton } from './UploadDataButton';
import { useRoster } from './useRoster';
import { UmaPickerModal, type UmaPickerItem } from './UmaPickerModal';
import { aggregate } from './sparkAggregate';
import { candidateAffinity } from './candidateAffinity';
import { AffinityMark } from './AffinityMark';
import { aff2, charaIdOf } from '@/core/affinity';
import { useAffinityIndex } from './useAffinityIndex';

type Slot = 'a' | 'b';
type Mode = null | 'find' | 'change';

/** Stat order for the picker tile's stat row (matches the in-game tile order). */
const STAT_KEYS = ['spd', 'sta', 'pow', 'gut', 'wit'] as const;

/** Uma portrait aspect — the icons are 230×256 (game-native ratio, ~0.9). Render
 *  the box at that ratio (not square) so the portrait isn't letterboxed. */
const UMA_ASPECT = 230 / 256;
const umaPortrait = (umaId: string, height: number, key?: number) => (
  <GameIcon key={key} kind="uma" id={umaId} height={height} width={Math.round(height * UMA_ASPECT)} alt="" />
);

export function InheritanceCard() {
  const { uma1Plan, setPlan } = useActivePlan();
  const { roster, importedAt } = useRoster();
  const { umas, umaById } = useUmas();
  const { skills, skillById } = useGameData();
  const idx = useAffinityIndex();
  const [open, setOpen] = useState(true);
  const [p2rental, setP2rental] = useState(false);
  const [mode, setMode] = useState<Record<Slot, Mode>>({ a: null, b: null });

  const pool = useMemo(() => roster.filter((p) => p.source === 'mine'), [roster]);
  // All hooks must run before the early return below — keep this useMemo above the guard.
  const whiteSkillOptions = useMemo(
    () => skills.filter((s) => s.rarity === 'white').map((s) => ({ id: s.skillId, name: s.nameEn })),
    [skills],
  );
  // Green sparks decode to the 6-digit 100xxx/110xxx unique ids; only those can
  // appear as inherited-unique sparks, so offer just them as green-search options.
  const uniqueSkillOptions = useMemo(
    () => skills
      .filter((s) => s.rarity === 'unique' && s.skillId.length === 6 && (s.skillId.startsWith('100') || s.skillId.startsWith('110')))
      .map((s) => ({ id: s.skillId, name: s.nameEn })),
    [skills],
  );
  // charaId → a representative (base-outfit) umaId, so a unique skill can show its
  // owner's portrait. A unique skill id = 90001 + charaId·10 (variant-2 alts sit
  // +10000), so charaId = (baseId − 90001)/10; the base card is charaId·100 + 1.
  const charaToUma = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of umas ?? []) if (!m.has(u.charaId)) m.set(u.charaId, u.umaId);
    return m;
  }, [umas]);
  const uniqueSkillUmaId = (skillId: string): string => {
    const n = Number(skillId);
    const base = n >= 110000 ? n - 10000 : n;
    const charaId = Math.round((base - 90001) / 10);
    return charaToUma.get(String(charaId)) ?? `${charaId * 100 + 1}`;
  };
  const wishlistIds = useMemo(
    () => new Set((uma1Plan?.wishlist ?? []).map((w) => w.skillId)),
    [uma1Plan?.wishlist],
  );
  if (!uma1Plan) return null;

  const isWishlisted = (skillId: string) => wishlistIds.has(skillId);
  const byId = new Map(pool.map((p) => [p.id, p]));
  // Current-selection compatibility for the header mark. Sum both chosen parents'
  // candidate affinity (each incl. its G1 win bonus + the parent↔parent cross),
  // subtracting the doubly-counted A↔B term. Null when no parent is picked / no idx.
  const selectionAffinity = ((): number | null => {
    if (!idx) return null;
    const pa = uma1Plan.parents.a ? byId.get(uma1Plan.parents.a) : undefined;
    const pb = uma1Plan.parents.b ? byId.get(uma1Plan.parents.b) : undefined;
    if (!pa && !pb) return null;
    let total = 0;
    if (pa) total += candidateAffinity({ idx, traineeUmaId: uma1Plan.umaId, candidate: pa, other: pb });
    if (pb) total += candidateAffinity({ idx, traineeUmaId: uma1Plan.umaId, candidate: pb, other: pa });
    if (pa && pb) total -= aff2(idx, charaIdOf(pa.umaId), charaIdOf(pb.umaId));
    return total;
  })();
  const select = (slot: Slot, parentId: string | undefined) => {
    setPlan({ ...uma1Plan, parents: { ...uma1Plan.parents, [slot]: parentId } });
    setMode((m) => ({ ...m, [slot]: null }));
  };
  const portrait = (p: Parent) => umaPortrait(p.umaId, 60);

  const skillName = (id: string) => skillById.get(id)?.nameEn ?? id;
  const gpPortraitsFor = (p: Parent) => {
    const gps = (p.grandparents ?? []).filter((g): g is NonNullable<typeof g> => !!g);
    if (gps.length === 0) return undefined;
    return gps.map((gp, i) => umaPortrait(gp.umaId, 36, i));
  };
  const statRowFor = (p: Parent) =>
    p.stats ? (
      <>
        {STAT_KEYS.map((k) => (
          <span key={k} className="inh-uma-stat">
            <GameIcon kind="ui" id={`stat-${k}`} size={15} alt={k} />
            <span>{p.stats![k]}</span>
          </span>
        ))}
      </>
    ) : undefined;
  const SLOT_LABEL: Record<Slot, string> = { a: 'Parent 1', b: 'Parent 2' };
  const itemsFor = (slot: Slot): UmaPickerItem[] => {
    const otherSlot: Slot = slot === 'a' ? 'b' : 'a';
    const otherId = uma1Plan.parents[otherSlot];
    const other = otherId ? byId.get(otherId) : undefined;
    // The two parents can't be the same CHARACTER (any outfit/copy of it), so block
    // every veteran sharing the other slot's charaId — not just the exact roster row.
    const otherChara = other ? charaIdOf(other.umaId) : undefined;
    return pool.map((p) => {
      const inSlot: Slot | undefined =
        uma1Plan.parents.a === p.id ? 'a' : uma1Plan.parents.b === p.id ? 'b' : undefined;
      const sameCharAsOther = otherChara !== undefined && charaIdOf(p.umaId) === otherChara;
      // Tag it: where it's actually selected ("Parent 1/2"), else why it's blocked
      // ("Same as Parent 1/2" — its character is already used in the other slot).
      const selectedLabel = inSlot
        ? SLOT_LABEL[inSlot]
        : sameCharAsOther ? `Same as ${SLOT_LABEL[otherSlot]}` : undefined;
      const unavailableReason = inSlot
        ? `Already selected as ${SLOT_LABEL[inSlot]}`
        : sameCharAsOther
          ? `Same character as ${SLOT_LABEL[otherSlot]} — can't use one character for both parents`
          : undefined;
      return {
        id: p.id,
        name: umaName(umaById, p.umaId),
        rankBadge: <RankBadge rating={p.rating} size={42} />,
        rankScore: p.rankScore,
        portrait: umaPortrait(p.umaId, 56),
        gpPortraits: gpPortraitsFor(p),
        statRow: statRowFor(p),
        parent: p,
        agg: aggregate(p),
        affinity: idx ? candidateAffinity({ idx, traineeUmaId: uma1Plan.umaId, candidate: p, other }) : null,
        disabled: inSlot !== undefined || sameCharAsOther,
        selectedLabel,
        unavailableReason,
      };
    });
  };

  const slotPicker = (slot: Slot) => {
    const m = mode[slot];
    if (m === 'find') {
      // Exclude any veteran sharing the other slot's character — can't use one
      // character for both parents (any outfit/copy counts).
      const otherId = uma1Plan.parents[slot === 'a' ? 'b' : 'a'];
      const otherChara = otherId ? (() => { const o = byId.get(otherId); return o ? charaIdOf(o.umaId) : undefined; })() : undefined;
      const top = topCandidates(
        pool.filter((p) => otherChara === undefined || charaIdOf(p.umaId) !== otherChara),
        uma1Plan.sparkGoals,
      );
      return (
        <ul className="picker-results" aria-label="candidates">
          {top.length === 0 && <li className="muted">No roster veterans — Upload data.</li>}
          {top.map(({ parent, score }) => (
            <li key={parent.id}>
              <button type="button" className="picker-row" onClick={() => select(slot, parent.id)}>
                <span className="picker-name">{umaName(umaById, parent.umaId)}</span>
                <span className="badge">match {score}</span>
              </button>
            </li>
          ))}
          <li className="muted small">Heuristic pre-rank by spark-goal overlap — not a verdict.</li>
        </ul>
      );
    }
    return null;
  };

  const card = (slot: Slot, label: string, rentalToggle?: React.ReactNode, rentalStub?: boolean) => {
    const parentId = uma1Plan.parents[slot];
    const parent = parentId ? (byId.get(parentId) ?? null) : null;
    return (
      <ParentCardView
        label={label}
        parent={parent}
        name={parent ? umaName(umaById, parent.umaId) : undefined}
        skillName={skillName}
        isWishlisted={isWishlisted}
        rankBadge={parent ? <RankBadge rating={parent.rating} size={42} /> : undefined}
        rankScore={parent?.rankScore}
        gpPortraits={parent ? gpPortraitsFor(parent) : undefined}
        portrait={parent ? portrait(parent) : undefined}
        rentalToggle={rentalToggle}
        rentalStub={rentalStub}
        onFindCandidates={() => setMode((m) => ({ ...m, [slot]: m[slot] === 'find' ? null : 'find' }))}
        findOpen={mode[slot] === 'find'}
        onCloseFind={() => setMode((m) => ({ ...m, [slot]: null }))}
        onChange={() => setMode((m) => ({ ...m, [slot]: m[slot] === 'change' ? null : 'change' }))}
        onClear={() => select(slot, undefined)}
      >
        {slotPicker(slot)}
      </ParentCardView>
    );
  };

  const p2toggle = (
    <button type="button" className={`inh-rental-toggle${p2rental ? ' is-on' : ''}`}
      role="switch" aria-checked={p2rental} onClick={() => setP2rental((v) => !v)}>
      <span className="inh-rental-switch" aria-hidden><span className="inh-rental-knob" /></span>
      Rental
    </button>
  );

  const modals = (['a', 'b'] as const).map((slot) => (
    <UmaPickerModal
      key={slot}
      open={mode[slot] === 'change'}
      items={mode[slot] === 'change' ? itemsFor(slot) : []}
      skillName={skillName}
      isWishlisted={isWishlisted}
      whiteSkillOptions={whiteSkillOptions}
      uniqueSkillOptions={uniqueSkillOptions}
      greenIcon={(id) => <GameIcon kind="uma" id={uniqueSkillUmaId(id)} size={44} alt="" />}
      uploadButton={<UploadDataButton />}
      onPick={(id) => select(slot, id)}
      onClose={() => setMode((m) => ({ ...m, [slot]: null }))}
    />
  ));

  return (
    <div className="cmp-plan-card inh-inheritance-card">
      <header
        className="cmp-plan-card-head cmp-collapse-head"
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        <span className="inh-inherit-title">
          Inheritance
          {selectionAffinity != null && (
            <AffinityMark score={selectionAffinity} size={18}
              title={`Lineage compatibility — affinity ${selectionAffinity}`} />
          )}
        </span>
        <span className="inh-inherit-tools" onClick={(e) => e.stopPropagation()}>
          {importedAt && (
            <span className="muted small inh-updated" title={importedAt}>
              Updated {importedAt.slice(0, 10)}
            </span>
          )}
          <UploadDataButton />
          <HeaderHelp label="How to get data.json">
            <p><strong>data.json</strong> is your trained-uma roster, exported by <strong>UmaExtractor</strong> — it reads your running Global client on the Veteran List screen (no server access; your data stays local).</p>
            <ol className="inh-help-steps">
              <li>Download &amp; run UmaExtractor on your PC with the game open.</li>
              <li>Open the in-game <em>Veteran List</em> so it dumps <code>data.json</code>.</li>
              <li>Click <strong>Upload data</strong> above and pick that file.</li>
            </ol>
            <p>
              <a href="https://github.com/xancia/UmaExtractor" target="_blank" rel="noreferrer noopener">
                github.com/xancia/UmaExtractor →
              </a>
            </p>
          </HeaderHelp>
        </span>
        <span className="cmp-collapse-caret" data-open={open || undefined} aria-hidden="true" />
      </header>
      {open && (
        <div className="cmp-plan-card-body inh-parent-grid">
          {card('a', 'Parent 1')}
          {card('b', 'Parent 2', p2toggle, p2rental)}
        </div>
      )}
      {modals}
    </div>
  );
}
