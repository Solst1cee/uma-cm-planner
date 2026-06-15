/**
 * Module 2 core — pure, sim-free SP-basket selection (spec §4, the adaptive
 * hybrid). Operates strictly on the candidates + scores it is given; the
 * Monte-Carlo simulation that actually ranks baskets lives in the sim layer
 * (src/features/sp-optimizer/rankBaskets.ts) and is injected. Costs are the
 * on-screen effective costs (no cost calculation here — spec §2/§4).
 */
import type { HintLevel } from '@/core/coverage';
import type { Server, SkillRarity, Stat } from '@/core/types';
import type { Grade, Strategy } from '@/sim';

/** One buyable skill row on the post-run screen (M2-local). */
export interface BuyableSkill {
  skillId: string;
  rarity: SkillRarity;
  /** Effective on-screen SP cost (already discounted by hints + Fast Learner). */
  screenSpCost: number;
  /** Informational only in v1. */
  hintLevel?: HintLevel;
  /** Gold skills require their white base; a constraint, not a cost calc. */
  prereqSkillId?: string;
}

/** The post-run build context — the serialized `CaptureBundle.context`. */
export interface BuildContext {
  umaId: string;
  stats: Record<Stat, number>;
  aptitudes: { distance: Grade; surface: Grade; strategy: Grade };
  strategy: Strategy;
  /** master.mdb course id as string (matches SimRaceParams.courseId). */
  courseId: string;
  /** Available SP to spend (the runtime budget — never on CmPlan). */
  spBudget: number;
  /** Skills already learned this run; the sim base loadout (may be empty). */
  ownedSkills: string[];
  /** The buyable skills on screen. */
  candidates: BuyableSkill[];
  /** Must-buy skill ids forced into every basket. */
  pinned: string[];
}

/** The serializable import↔analysis artifact (spec §3). */
export interface CaptureBundle {
  schemaVersion: 1;
  source: 'manual' | 'ocr' | 'video';
  /** ISO timestamp; supplied by the caller (core stays clock-free). */
  capturedAt: string;
  server: Server;
  dataVersion: string;
  /** Fixed seed → deterministic sim (reproducible baskets). */
  seed?: number;
  context: BuildContext;
}

/** A selected basket of skill ids (pinned + chosen), with SP accounting. */
export interface Basket {
  skills: string[];
  spUsed: number;
  spLeft: number;
}

// --- feasibility helpers ---

/** Expand a skill-id set to include any prereqs found in `candidates`
 *  (transitively — resolves prereq chains, not just one level). */
export function prereqClosure(skillIds: string[], candidates: BuyableSkill[]): string[] {
  const byId = new Map(candidates.map((c) => [c.skillId, c]));
  const out = new Set(skillIds);
  const worklist = [...skillIds];
  while (worklist.length) {
    const id = worklist.pop()!;
    const prereq = byId.get(id)?.prereqSkillId;
    if (prereq && !out.has(prereq)) {
      out.add(prereq);
      worklist.push(prereq);
    }
  }
  return [...out];
}

/** Sum the on-screen cost of the given skills (ids not in `candidates` cost 0). */
export function basketSpCost(skillIds: string[], candidates: BuyableSkill[]): number {
  const cost = new Map(candidates.map((c) => [c.skillId, c.screenSpCost]));
  return skillIds.reduce((sum, id) => sum + (cost.get(id) ?? 0), 0);
}
