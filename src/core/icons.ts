/**
 * Pure icon-path resolver (P6) for the bundled Global icon subset
 * (plan §4 "Image assets"). Maps a skill iconId / support cardId / umaId to an
 * app-base-RELATIVE WebP path under `data/icons/…`, or `undefined` when the id
 * is absent from the manifest. No `import.meta`, no `fetch`, no I/O — callers
 * prepend `import.meta.env.BASE_URL` and decide how to degrade (GameIcon).
 *
 * Layout + manifest shape are the cross-agent contract (plan §4):
 *   data/icons/skill/<iconId>.webp   (skill icon, shared across many skills)
 *   data/icons/support/<cardId>.webp (support-card chip)
 *   data/icons/uma/<umaId>.webp      (uma portrait; 17 alt outfits fall back to
 *                                     the base character portrait at build time,
 *                                     so the manifest still lists the umaId)
 */

/**
 * The shape of public/data/icons/icon-manifest.json. The three id arrays are
 * the SOURCE OF TRUTH for availability — a path is only resolved when its id is
 * present here, so a half-built / partial dump never yields a broken <img>.
 */
export interface IconManifest {
  dataVersion: string;
  format: 'webp';
  /** Available skill iconIds (SkillRecord.iconId), NOT skillIds. */
  skill: string[];
  /** Available support-card ids (SupportCardRecord.cardId). */
  card: string[];
  /** Available uma ids (UmaRecord.umaId). */
  uma: string[];
  /**
   * umaIds whose portrait fell back to the base character icon (no alt-outfit
   * trained icon in the dump). Informational; these still appear in `uma`.
   */
  _fallbackUmas?: string[];
}

/** Membership lookup that tolerates a missing/partial array on the manifest. */
function has(ids: string[] | undefined, id: string): boolean {
  return Array.isArray(ids) && ids.includes(id);
}

/**
 * App-base-relative path to a skill icon, e.g. `data/icons/skill/10011.webp`.
 * `iconId` is SkillRecord.iconId (~56 distinct), not the skillId.
 */
export function skillIconPath(iconId: string, m: IconManifest): string | undefined {
  if (!has(m.skill, iconId)) return undefined;
  return `data/icons/skill/${iconId}.${m.format}`;
}

/** App-base-relative path to a support-card chip, e.g. `data/icons/support/30028.webp`. */
export function cardIconPath(cardId: string, m: IconManifest): string | undefined {
  if (!has(m.card, cardId)) return undefined;
  return `data/icons/support/${cardId}.${m.format}`;
}

/** App-base-relative path to a uma portrait, e.g. `data/icons/uma/100201.webp`. */
export function umaIconPath(umaId: string, m: IconManifest): string | undefined {
  if (!has(m.uma, umaId)) return undefined;
  return `data/icons/uma/${umaId}.${m.format}`;
}
