// src/features/inheritance/candidateAffinity.ts
/**
 * Display-only affinity for one candidate veteran in the picker — the
 * candidate-branch lineage affinity (trainee↔candidate + grandparent triples,
 * plus the cross term to the other chosen slot when set) + the G1 win bonus
 * (computeWinBonus parentA). Pair-independent when `other` is absent.
 *
 * `wonRaces` arrive RAW from the importer (all grades), so every member's list
 * is filtered to G1-only via `g1Set` before the win bonus — same as
 * planLineageAffinity (src/core/lineageAffinity.ts). An empty set ⇒ 0 bonus
 * (the safe under-count).
 */
import { aff2, aff3, charaIdOf, type AffinityIndex } from '@/core/affinity';
import { filterG1 } from '@/core/g1Saddle';
import { computeWinBonus } from '@/core/winBonus';
import type { Parent } from '@/core/types';

export function candidateAffinity(args: {
  idx: AffinityIndex;
  traineeUmaId: string;
  candidate: Parent;
  other?: Parent;
  g1Set?: ReadonlySet<string>;
}): number {
  const { idx, traineeUmaId, candidate, other, g1Set = new Set<string>() } = args;
  const T = charaIdOf(traineeUmaId);
  const A = charaIdOf(candidate.umaId);
  const gps = candidate.grandparents ?? [];
  const gA1 = gps[0] ? charaIdOf(gps[0].umaId) : undefined;
  const gA2 = gps[1] ? charaIdOf(gps[1].umaId) : undefined;

  let base = aff2(idx, T, A);
  if (gA1 !== undefined) base += aff3(idx, T, A, gA1);
  if (gA2 !== undefined) base += aff3(idx, T, A, gA2);
  if (other) base += aff2(idx, A, charaIdOf(other.umaId));

  const oGps = other?.grandparents ?? [];
  const win = computeWinBonus({
    parentA: { wonRaces: filterG1(candidate.wonRaces, g1Set) },
    parentB: { wonRaces: filterG1(other?.wonRaces, g1Set) },
    gA1: { wonRaces: filterG1(gps[0]?.wonRaces, g1Set) },
    gA2: { wonRaces: filterG1(gps[1]?.wonRaces, g1Set) },
    gB1: { wonRaces: filterG1(oGps[0]?.wonRaces, g1Set) },
    gB2: { wonRaces: filterG1(oGps[1]?.wonRaces, g1Set) },
  }).parentA;

  return base + win;
}
