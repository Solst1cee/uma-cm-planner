/**
 * Adapter: planner `Parent`s → the affinity pipeline, computing the 2.0 win
 * bonus (winBonus.ts) and folding it into `computeLineageAffinity`. The
 * per-member scores it returns feed spark.ts (de-approximated proc chances).
 */
import { type AffinityIndex, charaIdOf, computeLineageAffinity } from '@/core/affinity';
import { filterG1 } from '@/core/g1Saddle';
import { computeWinBonus } from '@/core/winBonus';
import type { LineageAffinity, Parent } from '@/core/types';

export function planLineageAffinity(
  idx: AffinityIndex,
  traineeUmaId: string,
  parentA: Parent,
  parentB: Parent,
  g1Set: ReadonlySet<string> = new Set(),
): LineageAffinity {
  const gpChara = (p: Parent, i: 0 | 1): number | undefined => {
    const gp = p.grandparents?.[i];
    return gp ? charaIdOf(gp.umaId) : undefined;
  };
  const winBonus = computeWinBonus({
    parentA: { wonRaces: filterG1(parentA.wonRaces, g1Set) },
    parentB: { wonRaces: filterG1(parentB.wonRaces, g1Set) },
    gA1: { wonRaces: filterG1(parentA.grandparents?.[0]?.wonRaces, g1Set) },
    gA2: { wonRaces: filterG1(parentA.grandparents?.[1]?.wonRaces, g1Set) },
    gB1: { wonRaces: filterG1(parentB.grandparents?.[0]?.wonRaces, g1Set) },
    gB2: { wonRaces: filterG1(parentB.grandparents?.[1]?.wonRaces, g1Set) },
  });
  return computeLineageAffinity(idx, {
    trainee: charaIdOf(traineeUmaId),
    parentA: charaIdOf(parentA.umaId),
    parentB: charaIdOf(parentB.umaId),
    gA1: gpChara(parentA, 0),
    gA2: gpChara(parentA, 1),
    gB1: gpChara(parentB, 0),
    gB2: gpChara(parentB, 1),
    winBonus,
  });
}
