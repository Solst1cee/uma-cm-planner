// src/core/skillCategory.ts
/**
 * Per-skill sort metadata baked to public/data/skill_categories.json, shared by
 * the build script (scripts/build-skill-categories.ts, which supplies the
 * master.mdb `group_id`) and the app (which reads the baked map).
 *
 * Only `group` is consumed: the M1.7 coverage table sorts by in-game ICON
 * (src/features/inheritance/skillSort.ts), and `group` clusters a skill's
 * gold/white/○/◎ family so they sort adjacently. The former `category` field
 * (unique/normal/recovery/green/debuff) drove the pre-2026-07-03 category sort
 * and was removed with it — the icon-spec sort superseded it.
 */

/** Baked per-skill sort metadata (public/data/skill_categories.json value). */
export interface SkillSortMeta { group: number; }
