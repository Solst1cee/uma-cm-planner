/**
 * Module 4 core — deck suggester (plan §6 build step 5). Pure functions only.
 *
 * Greedy fill of unlocked slots maximizing Σ(priorityWeight × tierWeight)
 * over the plan's target skills (per target: the best tier achieved across
 * the deck + scenario + parents), then one full 1-swap refinement pass.
 *
 * The score is a planning heuristic over the qualitative reliability tiers
 * (plan §6) — NOT a probability (P3): tune weights in DECK_TUNABLES freely.
 *
 * Invariants:
 * - Locked slots are never violated: cardId locks echo their card verbatim
 *   (even when the card is not in inventory — noted in rationale, scored at
 *   LB0 as a conservative floor); cardType locks restrict that slot's
 *   candidates to the type.
 * - A card appears at most once across the suggester's picks; when the
 *   inventory holds duplicate copies, the highest-LB copy is the candidate
 *   (better hint passives → better tiers and SP discounts).
 */
import { tierForCardSkill, tierRank } from '@/core/coverage';
import { parentCoversSkill } from '@/core/spark';
import type {
  CmPlan,
  DeckSuggestion,
  LimitBreak,
  OwnedCard,
  Parent,
  Priority,
  SkillRecord,
  SupportCardRecord,
  Tier,
} from '@/core/types';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/**
 * All scoring weights in one place. TIER_WEIGHTS follow the reliability
 * ordering (plan §6); 'spark' is 0 on purpose — sparks come from parents,
 * not from deck picks, so they must never motivate a card slot.
 */
export const DECK_TUNABLES: {
  PRIORITY_WEIGHTS: Record<Priority, number>;
  TIER_WEIGHTS: Record<Tier, number>;
} = {
  PRIORITY_WEIGHTS: { 1: 4, 2: 2, 3: 1 },
  TIER_WEIGHTS: {
    chain: 5,
    scenario: 4.5,
    date_event: 4,
    hint_strong: 3,
    hint_weak: 1.5,
    random: 0.5,
    spark: 0,
    uncovered: 0,
  },
};

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

type Slot = 0 | 1 | 2 | 3 | 4 | 5;
const ALL_SLOTS: readonly Slot[] = [0, 1, 2, 3, 4, 5];

interface SlotState {
  slot: Slot;
  lockedBy?: 'cardId' | 'cardType';
  /** Type restriction when lockedBy === 'cardType'. */
  cardType?: SupportCardRecord['type'];
  /** Current occupant (locked card or pick). */
  cardId?: string;
}

interface Candidate {
  cardId: string;
  nameEn: string;
  type: SupportCardRecord['type'] | undefined;
  limitBreak: LimitBreak;
  /** target skillId → best tier this card grants for it, at its LB. */
  tiers: Map<string, Tier>;
  inInventory: boolean;
}

function betterTier(a: Tier | undefined, b: Tier): Tier {
  return a !== undefined && tierRank(a) < tierRank(b) ? a : b;
}

/** target skillId → best tier the card grants, evaluated at the given LB. */
function cardTargetTiers(
  card: SupportCardRecord,
  lb: LimitBreak,
  targetIds: ReadonlySet<string>,
): Map<string, Tier> {
  const tiers = new Map<string, Tier>();
  for (const cardSkill of card.skills) {
    if (!targetIds.has(cardSkill.skillId)) continue;
    const tier = tierForCardSkill(card, lb, cardSkill.sourceType);
    tiers.set(cardSkill.skillId, betterTier(tiers.get(cardSkill.skillId), tier));
  }
  return tiers;
}

// ---------------------------------------------------------------------------
// suggestDeck
// ---------------------------------------------------------------------------

export function suggestDeck(args: {
  plan: CmPlan;
  inventory: OwnedCard[];
  cards: SupportCardRecord[];
  skills: SkillRecord[];
  parents?: Parent[];
}): DeckSuggestion {
  const { plan, inventory, cards, skills, parents } = args;
  const cardById = new Map(cards.map((c) => [c.cardId, c]));
  const skillById = new Map(skills.map((s) => [s.skillId, s]));

  // Targets in priority order (stable for equal priority) — drives rationale
  // and uncovered ordering. Variable length; priority drives weighting.
  const targets = [...plan.targetSkills].sort((a, b) => a.priority - b.priority);
  const targetIds = new Set(targets.map((t) => t.skillId));

  // --- deck-independent baseline tier per target ---------------------------
  // scenario: plan's scenario covers its exclusive skills with no card;
  // spark: parents cover (weight 0 but counts as covered for `uncovered`).
  const baseline = new Map<string, Tier>();
  for (const target of targets) {
    let tier: Tier = 'uncovered';
    const skill = skillById.get(target.skillId);
    if (skill?.scenarioId !== undefined && skill.scenarioId === plan.scenario.id) {
      tier = betterTier(tier, 'scenario');
    }
    if ((parents ?? []).some((p) => parentCoversSkill(p, target.skillId))) {
      tier = betterTier(tier, 'spark');
    }
    baseline.set(target.skillId, tier);
  }

  // --- candidates: best (highest-LB) owned copy per cardId -----------------
  const bestCopy = new Map<string, OwnedCard>();
  for (const owned of inventory) {
    if (!cardById.has(owned.cardId)) continue; // unknown id: skip gracefully
    const prev = bestCopy.get(owned.cardId);
    if (!prev || owned.limitBreak > prev.limitBreak) bestCopy.set(owned.cardId, owned);
  }
  const candidates: Candidate[] = [...bestCopy.values()].map((owned) => {
    const card = cardById.get(owned.cardId);
    if (!card) throw new Error('unreachable: filtered above');
    return {
      cardId: card.cardId,
      nameEn: card.nameEn,
      type: card.type,
      limitBreak: owned.limitBreak,
      tiers: cardTargetTiers(card, owned.limitBreak, targetIds),
      inInventory: true,
    };
  });

  // --- slots + locks --------------------------------------------------------
  const slots: SlotState[] = ALL_SLOTS.map((slot) => ({ slot }));
  const lockNotes: string[] = [];
  for (const lock of plan.lockedDeckSlots) {
    const state = slots[lock.slot];
    if (!state || state.lockedBy) continue; // ignore duplicate locks on a slot
    if (lock.cardId !== undefined) {
      state.lockedBy = 'cardId';
      state.cardId = lock.cardId;
    } else if (lock.cardType !== undefined) {
      state.lockedBy = 'cardType';
      state.cardType = lock.cardType;
    }
  }

  // Locked-card occupants: scored like picks. A locked card missing from
  // inventory is honored anyway (lock invariant) at an assumed LB0 floor.
  const occupants = new Map<Slot, Candidate>();
  const used = new Set<string>();
  for (const state of slots) {
    if (state.lockedBy !== 'cardId' || state.cardId === undefined) continue;
    const card = cardById.get(state.cardId);
    const owned = bestCopy.get(state.cardId);
    const lb: LimitBreak = owned?.limitBreak ?? 0;
    occupants.set(state.slot, {
      cardId: state.cardId,
      nameEn: card?.nameEn ?? state.cardId,
      type: card?.type,
      limitBreak: lb,
      tiers: card ? cardTargetTiers(card, lb, targetIds) : new Map(),
      inInventory: owned !== undefined,
    });
    used.add(state.cardId);
    if (!owned) {
      lockNotes.push(
        `slot ${state.slot}: locked card ${card?.nameEn ?? state.cardId} is not in inventory — assumed LB0`,
      );
    }
  }

  // --- scoring ---------------------------------------------------------------
  const score = (occ: ReadonlyMap<Slot, Candidate>): number => {
    let sum = 0;
    for (const target of targets) {
      let best = baseline.get(target.skillId) ?? 'uncovered';
      for (const cand of occ.values()) {
        const tier = cand.tiers.get(target.skillId);
        if (tier !== undefined) best = betterTier(tier, best);
      }
      sum +=
        DECK_TUNABLES.PRIORITY_WEIGHTS[target.priority] * DECK_TUNABLES.TIER_WEIGHTS[best];
    }
    return sum;
  };

  const eligible = (cand: Candidate, state: SlotState): boolean =>
    state.lockedBy !== 'cardId' &&
    (state.lockedBy !== 'cardType' || cand.type === state.cardType);

  // --- greedy fill -----------------------------------------------------------
  // Slots in index order; per slot the unused candidate with the highest
  // strict score gain (ties: first in inventory order). Gain-0 candidates are
  // skipped — an empty slot honestly signals "free for training needs" (P3)
  // instead of an arbitrary pick.
  for (const state of slots) {
    if (state.lockedBy === 'cardId') continue;
    let bestGain = 0;
    let bestCand: Candidate | undefined;
    const before = score(occupants);
    for (const cand of candidates) {
      if (used.has(cand.cardId) || !eligible(cand, state)) continue;
      occupants.set(state.slot, cand);
      const gain = score(occupants) - before;
      occupants.delete(state.slot);
      if (gain > bestGain) {
        bestGain = gain;
        bestCand = cand;
      }
    }
    if (bestCand) {
      occupants.set(state.slot, bestCand);
      state.cardId = bestCand.cardId;
      used.add(bestCand.cardId);
    }
  }

  // --- 1-swap refinement pass ------------------------------------------------
  // One full pass: per non-cardId-locked slot, try every unused eligible
  // candidate in place of the current pick (or into the empty slot); keep
  // strict improvements immediately.
  for (const state of slots) {
    if (state.lockedBy === 'cardId') continue;
    const current = occupants.get(state.slot);
    let bestScore = score(occupants);
    let bestCand: Candidate | undefined;
    for (const cand of candidates) {
      if (used.has(cand.cardId) || !eligible(cand, state)) continue;
      occupants.set(state.slot, cand);
      const swapped = score(occupants);
      if (current) occupants.set(state.slot, current);
      else occupants.delete(state.slot);
      if (swapped > bestScore) {
        bestScore = swapped;
        bestCand = cand;
      }
    }
    if (bestCand) {
      if (current) used.delete(current.cardId);
      occupants.set(state.slot, bestCand);
      state.cardId = bestCand.cardId;
      used.add(bestCand.cardId);
    }
  }

  // --- outputs ---------------------------------------------------------------
  const coverageScore = score(occupants);

  const uncovered: string[] = [];
  for (const target of targets) {
    let best = baseline.get(target.skillId) ?? 'uncovered';
    for (const cand of occupants.values()) {
      const tier = cand.tiers.get(target.skillId);
      if (tier !== undefined) best = betterTier(tier, best);
    }
    if (best === 'uncovered') uncovered.push(target.skillId);
  }

  const skillName = (skillId: string): string => skillById.get(skillId)?.nameEn ?? skillId;
  const rationale: string[] = [];
  for (const state of slots) {
    const occ = occupants.get(state.slot);
    if (!occ) {
      rationale.push(
        state.lockedBy === 'cardType'
          ? `slot ${state.slot}: no ${state.cardType ?? ''} pick adds coverage — free for training needs`
          : `slot ${state.slot}: no skill-relevant pick — free for training needs`,
      );
      continue;
    }
    const covers = targets
      .filter((t) => occ.tiers.has(t.skillId))
      .map((t) => `${skillName(t.skillId)}(${occ.tiers.get(t.skillId) ?? 'uncovered'})`);
    const lockTag =
      state.lockedBy === 'cardId'
        ? ' [locked]'
        : state.lockedBy === 'cardType'
          ? ` [locked type: ${state.cardType ?? ''}]`
          : '';
    rationale.push(
      `slot ${state.slot}: ${occ.nameEn}${lockTag} — covers ${
        covers.length > 0 ? covers.join(', ') : 'no targets'
      }`,
    );
  }
  rationale.push(...lockNotes);

  return {
    deck: slots.map((state) => ({
      slot: state.slot,
      ...(state.cardId !== undefined ? { cardId: state.cardId } : {}),
      ...(state.lockedBy !== undefined ? { lockedBy: state.lockedBy } : {}),
    })),
    coverageScore,
    uncovered,
    rationale,
  };
}
