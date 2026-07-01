/**
 * Spark-filter feasibility (M1.4). A candidate lineage has exactly
 * LINEAGE_MEMBERS individuals (the veteran + its 2 grandparents), and **each
 * provides one blue spark and one pink spark**, max 3★ each. So per category
 * (blue, pink) the reachable maximum is 9★ across at most 3 types.
 *
 * Because each member's spark is a single type, a total of `T` for one type
 * needs `ceil(T/3)` members (e.g. 4★ = 3+1 or 2+2 → 2 members). A filter is only
 * satisfiable when the members it demands fit the budget:
 *   sum over types of ceil(total/3) ≤ LINEAGE_MEMBERS.
 * Hence "4 Power AND 4 Stamina" is impossible (2 + 2 = 4 > 3).
 *
 * Legacy (gold) = the veteran's *own* spark: at most ONE type per category may
 * carry a legacy requirement (the veteran has one blue + one pink spark), ≤ 3★.
 */
export const LINEAGE_MEMBERS = 3;
export const MAX_LEGACY = 3; // one member's own spark caps at 3★
export const MAX_TOTAL = LINEAGE_MEMBERS * MAX_LEGACY; // 9

/** Members needed to reach a per-type total (each contributes ≤ 3★). */
export const membersForTotal = (total: number): number => Math.ceil(Math.max(0, total) / MAX_LEGACY);

/**
 * The largest total still reachable for `key` given the other types in the same
 * category already claim part of the 3-member budget. Each remaining member can
 * add up to 3★, so the cap is `remainingMembers × 3` (0…9).
 */
export function maxTotalForKey(totalsByKey: Record<string, number>, key: string): number {
  let usedByOthers = 0;
  for (const [k, t] of Object.entries(totalsByKey)) {
    if (k === key) continue;
    usedByOthers += membersForTotal(t);
  }
  const remaining = Math.max(0, LINEAGE_MEMBERS - usedByOthers);
  return Math.min(MAX_TOTAL, remaining * MAX_LEGACY);
}
