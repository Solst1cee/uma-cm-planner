/**
 * 2.0 compatibility overhaul (docs/mechanics-notes.md §3): only shared
 * Grade-1 (G1) wins grant a compatibility bonus, at +3 each — G2/G3 races and
 * Triple Crown/Tiara titles give 0. `wonRaces` holds G1 race ids (the
 * UmaExtractor importer filters to G1; see the M1.0 spec §6). Pure: the
 * resulting `WinBonus` feeds affinity.ts's already-injected `Lineage.winBonus`.
 */
export interface WinBonusMember {
  /** G1 race ids this member won (absent ⇒ contributes 0). */
  wonRaces?: string[];
}

export interface WinBonusLineage {
  parentA: WinBonusMember;
  parentB: WinBonusMember;
  gA1?: WinBonusMember;
  gA2?: WinBonusMember;
  gB1?: WinBonusMember;
  gB2?: WinBonusMember;
}

export interface WinBonus {
  parentA: number;
  parentB: number;
  gA1: number;
  gA2: number;
  gB1: number;
  gB2: number;
}

/** +3 per shared (deduped) G1 race id; 0 for missing/empty/disjoint sets. */
export function sharedG1(a: string[] | undefined, b: string[] | undefined): number {
  if (!a || !b || a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let shared = 0;
  for (const id of new Set(a)) if (setB.has(id)) shared += 1;
  return shared * 3;
}

export function computeWinBonus(lin: WinBonusLineage): WinBonus {
  const { parentA, parentB, gA1, gA2, gB1, gB2 } = lin;
  const aToB = sharedG1(parentA.wonRaces, parentB.wonRaces);
  const aTo1 = sharedG1(parentA.wonRaces, gA1?.wonRaces);
  const aTo2 = sharedG1(parentA.wonRaces, gA2?.wonRaces);
  const bTo1 = sharedG1(parentB.wonRaces, gB1?.wonRaces);
  const bTo2 = sharedG1(parentB.wonRaces, gB2?.wonRaces);
  return {
    parentA: aToB + aTo1 + aTo2,
    parentB: aToB + bTo1 + bTo2,
    gA1: aTo1,
    gA2: aTo2,
    gB1: bTo1,
    gB2: bTo2,
  };
}
