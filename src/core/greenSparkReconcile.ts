// src/core/greenSparkReconcile.ts
/**
 * M1.7 — reconcile a parent's stored native-unique green-spark id
 * (100xxx/110xxx, what UmaExtractor decodes) to the canonical inherited-unique
 * (9xxxxx) id used by skills.json / coverage math (mechanics-notes §8).
 *
 * Native uniques are 10xxxx/11xxxx; inherited-unique (green) are 90xxxx/91xxxx.
 * The relationship is a leading-prefix swap (10→90, 11→91), cross-checked by
 * name. Pure; derived entirely from committed skills.json.
 */
import type { SkillRecord } from '@/core/types';

/** 100011 → 900011, 110011 → 910011; undefined if not a 10xxxx/11xxxx id. */
function inheritedIdFromNative(nativeId: string): string | undefined {
  if (/^10\d{4}$/.test(nativeId)) return '90' + nativeId.slice(2);
  if (/^11\d{4}$/.test(nativeId)) return '91' + nativeId.slice(2);
  return undefined;
}

export function buildUniqueToInheritedMap(skills: SkillRecord[]): {
  map: Map<string, string>;
  unresolved: string[];
} {
  const inheritedIds = new Set(
    skills.filter((s) => s.rarity === 'inherited_unique').map((s) => s.skillId),
  );
  // Inverted once (not .find() per unique): `${server} ${nameEn}` → inherited-
  // unique id. First-wins on duplicate names keeps the old insertion-order
  // .find() semantics deterministic; the server key means the fallback only
  // matches an inherited-unique on the SAME server as the unique (P4).
  const inheritedIdByServerName = new Map<string, string>();
  for (const s of skills) {
    if (s.rarity !== 'inherited_unique') continue;
    const key = `${s.server} ${s.nameEn}`;
    if (!inheritedIdByServerName.has(key)) inheritedIdByServerName.set(key, s.skillId);
  }
  const map = new Map<string, string>();
  const unresolved: string[] = [];
  for (const s of skills) {
    if (s.rarity !== 'unique') continue;
    const candidate = inheritedIdFromNative(s.skillId);
    if (candidate && inheritedIds.has(candidate)) {
      map.set(s.skillId, candidate);
      continue;
    }
    // Fallback: name-match against a same-server inherited-unique.
    const byName = inheritedIdByServerName.get(`${s.server} ${s.nameEn}`);
    if (byName) map.set(s.skillId, byName);
    else unresolved.push(s.skillId);
  }
  return { map, unresolved };
}

export function reconcileGreenSkillId(id: string, map: Map<string, string>): string {
  return map.get(id) ?? id;
}
