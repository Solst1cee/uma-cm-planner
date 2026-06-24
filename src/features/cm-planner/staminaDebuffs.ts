// Representative stamina-drain debuffs (Recovery effect, negative modifier, targets others).
// White: 201222 "Stamina Eater"; Gold: 201221 "Stamina Siphon" (introspected 2026-06-24).
// Both confirmed simulatable via skillsService.isSimulatable check.
import type { VacuumOpts } from '@/sim/types';

export const STAMINA_DEBUFF = { white: '201222', gold: '201221' } as const;

// Icon ids for the two representative debuffs (skills.json: Stamina Eater 30051 / Siphon 30052).
// Hardcoded alongside the skill ids so the debuff chips render without a game-data lookup.
export const STAMINA_DEBUFF_ICON = { white: '30051', gold: '30052' } as const;

/** Spread N debuffs of each tier across the mid-race (25%..75% of distance) as injected
 *  forced activations. Vacuum has no opponents, so this is an explicit estimate. */
export function buildInjectedDebuffs(
  whiteCount: number,
  goldCount: number,
  distance: number,
): NonNullable<VacuumOpts['injectedDebuffs']> {
  const spread = (count: number, skillId: string) =>
    Array.from({ length: Math.max(0, Math.floor(count)) }, (_, i) => ({
      skillId,
      position: distance * (0.25 + (0.5 * (i + 1)) / (count + 1)),
    }));
  const uma1 = [...spread(whiteCount, STAMINA_DEBUFF.white), ...spread(goldCount, STAMINA_DEBUFF.gold)];
  return { uma1, uma2: [] };
}
