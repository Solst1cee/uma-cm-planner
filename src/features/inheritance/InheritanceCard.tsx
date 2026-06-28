/** M1.4 — the "Inheritance" card: owned Parent 1 & 2 picker, Find-candidates,
 *  spark display, selection persisted to plan.parents. Rental → M1.4b stub. */
import { useMemo, useState } from 'react';
import { useActivePlan } from '@/app/ActivePlanContext';
import type { Parent } from '@/core/types';
import { GameIcon } from '@/features/data/GameIcon';
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
import { useAffinityIndex } from './useAffinityIndex';

type Slot = 'a' | 'b';
type Mode = null | 'find' | 'change';

export function InheritanceCard() {
  const { uma1Plan, setPlan } = useActivePlan();
  const { roster, importedAt } = useRoster();
  const { umaById } = useUmas();
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
  const wishlistIds = useMemo(
    () => new Set((uma1Plan?.wishlist ?? []).map((w) => w.skillId)),
    [uma1Plan?.wishlist],
  );
  if (!uma1Plan) return null;

  const isWishlisted = (skillId: string) => wishlistIds.has(skillId);
  const byId = new Map(pool.map((p) => [p.id, p]));
  const select = (slot: Slot, parentId: string | undefined) => {
    setPlan({ ...uma1Plan, parents: { ...uma1Plan.parents, [slot]: parentId } });
    setMode((m) => ({ ...m, [slot]: null }));
  };
  const portrait = (p: Parent) => <GameIcon kind="uma" id={p.umaId} size={42} alt="" />;

  const skillName = (id: string) => skillById.get(id)?.nameEn ?? id;
  const itemsFor = (slot: Slot): UmaPickerItem[] => {
    const otherId = uma1Plan.parents[slot === 'a' ? 'b' : 'a'];
    const other = otherId ? byId.get(otherId) : undefined;
    return pool.map((p) => ({
      id: p.id,
      name: umaName(umaById, p.umaId),
      rankBadge: <RankBadge rating={p.rating} size={20} />,
      portrait: <GameIcon kind="uma" id={p.umaId} size={42} alt="" />,
      parent: p,
      agg: aggregate(p),
      affinity: idx ? candidateAffinity({ idx, traineeUmaId: uma1Plan.umaId, candidate: p, other }) : null,
    }));
  };

  const slotPicker = (slot: Slot) => {
    const m = mode[slot];
    if (m === 'find') {
      const top = topCandidates(pool, uma1Plan.sparkGoals);
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
        rankBadge={parent ? <RankBadge rating={parent.rating} /> : undefined}
        portrait={parent ? portrait(parent) : undefined}
        rentalToggle={rentalToggle}
        rentalStub={rentalStub}
        onFindCandidates={() => setMode((m) => ({ ...m, [slot]: m[slot] === 'find' ? null : 'find' }))}
        onChange={() => setMode((m) => ({ ...m, [slot]: m[slot] === 'change' ? null : 'change' }))}
        onClear={() => select(slot, undefined)}
      >
        {slotPicker(slot)}
      </ParentCardView>
    );
  };

  const p2toggle = (
    <span className="cmp-control-group inh-p2-mode" role="group" aria-label="Parent 2 mode">
      <button type="button" className={p2rental ? '' : 'is-active'} onClick={() => setP2rental(false)}>Owned</button>
      <button type="button" className={p2rental ? 'is-active' : ''} onClick={() => setP2rental(true)}>Rental</button>
    </span>
  );

  const modals = (['a', 'b'] as const).map((slot) => (
    <UmaPickerModal
      key={slot}
      open={mode[slot] === 'change'}
      items={mode[slot] === 'change' ? itemsFor(slot) : []}
      skillName={skillName}
      isWishlisted={isWishlisted}
      whiteSkillOptions={whiteSkillOptions}
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
        <span>Inheritance</span>
        <span className="muted small inh-inherit-sub">parents 1 &amp; 2</span>
        <span className="inh-inherit-tools" onClick={(e) => e.stopPropagation()}>
          {importedAt && (
            <span className="muted small inh-updated" title={importedAt}>
              Updated {importedAt.slice(0, 10)}
            </span>
          )}
          <UploadDataButton />
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
