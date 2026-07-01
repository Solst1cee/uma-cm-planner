// src/core/cardMatches.ts
/** M1.6 — cross a support card's provided skills against the plan wishlist. Exact (P3). */
import type { SupportCardRecord } from '@/core/types';

export function matchedSkillIds(card: SupportCardRecord, wishlist: ReadonlySet<string>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of card.skills) {
    if (wishlist.has(s.skillId) && !seen.has(s.skillId)) {
      seen.add(s.skillId);
      out.push(s.skillId);
    }
  }
  return out;
}

export function matchCount(card: SupportCardRecord, wishlist: ReadonlySet<string>): number {
  return matchedSkillIds(card, wishlist).length;
}
