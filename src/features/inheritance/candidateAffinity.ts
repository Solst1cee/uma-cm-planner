// src/features/inheritance/candidateAffinity.ts
/**
 * Display-only affinity for one candidate veteran in the picker — the
 * candidate-branch lineage affinity (trainee↔candidate + grandparent triples,
 * plus the cross term to the other chosen slot when set) + the G1 win bonus
 * (computeWinBonus parentA). Pair-independent when `other` is absent.
 */
import { aff2, aff3, charaIdOf, type AffinityIndex } from '@/core/affinity';
import { computeWinBonus } from '@/core/winBonus';
import type { Parent } from '@/core/types';

export function candidateAffinity(args: {
  idx: AffinityIndex;
  traineeUmaId: string;
  candidate: Parent;
  other?: Parent;
}): number {
  const { idx, traineeUmaId, candidate, other } = args;
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
    parentA: { wonRaces: candidate.wonRaces },
    parentB: { wonRaces: other?.wonRaces },
    gA1: { wonRaces: gps[0]?.wonRaces },
    gA2: { wonRaces: gps[1]?.wonRaces },
    gB1: { wonRaces: oGps[0]?.wonRaces },
    gB2: { wonRaces: oGps[1]?.wonRaces },
  }).parentA;

  return base + win;
}
