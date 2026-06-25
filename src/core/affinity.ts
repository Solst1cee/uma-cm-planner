import type { AffinityGroup, AffinityTier, LineageAffinity } from './types';

export interface AffinityIndex {
  byChara: Map<number, Map<number, number>>;
  aff2Cache: Map<string, number>;
  aff3Cache: Map<string, number>;
}

export function buildAffinityIndex(groups: AffinityGroup[]): AffinityIndex {
  const byChara = new Map<number, Map<number, number>>();
  for (const g of groups) {
    for (const c of g.members) {
      let m = byChara.get(c);
      if (!m) { m = new Map(); byChara.set(c, m); }
      m.set(g.relationType, g.point);
    }
  }
  return { byChara, aff2Cache: new Map(), aff3Cache: new Map() };
}

export function aff2(idx: AffinityIndex, a: number, b: number): number {
  const key = a < b ? `${a}_${b}` : `${b}_${a}`;
  const hit = idx.aff2Cache.get(key);
  if (hit !== undefined) return hit;
  const ma = idx.byChara.get(a);
  const mb = idx.byChara.get(b);
  let sum = 0;
  if (ma && mb) {
    const [small, big] = ma.size <= mb.size ? [ma, mb] : [mb, ma];
    for (const [type, point] of small) if (big.has(type)) sum += point;
  }
  idx.aff2Cache.set(key, sum);
  return sum;
}

export function aff3(idx: AffinityIndex, a: number, b: number, c: number): number {
  const [s0, s1, s2] = [a, b, c].sort((x, y) => x - y);
  const key = `${s0}_${s1}_${s2}`;
  const hit = idx.aff3Cache.get(key);
  if (hit !== undefined) return hit;
  const ma = idx.byChara.get(a);
  const mb = idx.byChara.get(b);
  const mc = idx.byChara.get(c);
  let sum = 0;
  if (ma && mb && mc) {
    for (const [type, point] of ma) if (mb.has(type) && mc.has(type)) sum += point;
  }
  idx.aff3Cache.set(key, sum);
  return sum;
}

export function affinityTier(score: number): AffinityTier {
  if (score >= 151) return '◎';
  if (score >= 51) return '○';
  return '△';
}

export function charaIdOf(umaId: string): number {
  return Math.floor(Number(umaId) / 100);
}

export interface Lineage {
  trainee: number; parentA: number; parentB: number;
  gA1?: number; gA2?: number; gB1?: number; gB2?: number;
  winBonus?: { parentA?: number; parentB?: number; gA1?: number; gA2?: number; gB1?: number; gB2?: number };
}

export function computeLineageAffinity(idx: AffinityIndex, lin: Lineage): LineageAffinity {
  const { trainee: T, parentA: A, parentB: B, gA1, gA2, gB1, gB2 } = lin;
  const a2 = { tA: aff2(idx, T, A), tB: aff2(idx, T, B), aB: aff2(idx, A, B) };
  const a3 = {
    tA_gA1: gA1 === undefined ? 0 : aff3(idx, T, A, gA1),
    tA_gA2: gA2 === undefined ? 0 : aff3(idx, T, A, gA2),
    tB_gB1: gB1 === undefined ? 0 : aff3(idx, T, B, gB1),
    tB_gB2: gB2 === undefined ? 0 : aff3(idx, T, B, gB2),
  };
  const w = lin.winBonus ?? {};
  const scores = {
    parentA: a2.tA + a2.aB + a3.tA_gA1 + a3.tA_gA2 + (w.parentA ?? 0),
    parentB: a2.tB + a2.aB + a3.tB_gB1 + a3.tB_gB2 + (w.parentB ?? 0),
    gA1: a3.tA_gA1 + (w.gA1 ?? 0),
    gA2: a3.tA_gA2 + (w.gA2 ?? 0),
    gB1: a3.tB_gB1 + (w.gB1 ?? 0),
    gB2: a3.tB_gB2 + (w.gB2 ?? 0),
  };
  const lineageTotal = a2.tA + a2.tB + a2.aB + a3.tA_gA1 + a3.tA_gA2 + a3.tB_gB1 + a3.tB_gB2;
  return {
    aff2: a2, aff3: a3, lineageTotal,
    memberScores: scores,
    tiers: {
      parentA: affinityTier(scores.parentA), parentB: affinityTier(scores.parentB),
      gA1: affinityTier(scores.gA1), gA2: affinityTier(scores.gA2),
      gB1: affinityTier(scores.gB1), gB2: affinityTier(scores.gB2),
    },
    displayTotal: scores.parentA + scores.parentB + scores.gA1 + scores.gA2 + scores.gB1 + scores.gB2,
    staticOnly: lin.winBonus === undefined,
  };
}

/** Affinity score a member must reach for a compatibility tier (matches
 *  affinityTier: ○ ≥ 51, ◎ ≥ 151). Used for rental Parent-2 target mode. */
export function tierThreshold(tier: '○' | '◎'): number {
  return tier === '◎' ? 151 : 51;
}

/** Affinity a rental Parent 2 must still supply to reach `tier`, given the
 *  computable part of the lineage's score. Never negative. */
export function affinityNeededForTier(computablePart: number, tier: '○' | '◎'): number {
  return Math.max(0, tierThreshold(tier) - computablePart);
}
