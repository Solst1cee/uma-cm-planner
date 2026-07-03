/** Availability #4b — build-facing rebalance patch selection (pure).
 *  Turns SkillRecord.rebalance + per-plan WishlistItem.skillVer pins + the
 *  horizon clock into the engine `skillPatches` map a sim build carries.
 *  All date logic lives in resolveVersion/effectiveVersion (4a) — this module
 *  only walks the catalog and shapes the result. */
import type { SkillRecord, WishlistItem } from './types';
import { effectiveVersion, resolveVersion, versionPatch, type SkillPatch } from './rebalance';
import type { SimBuild } from '@/sim/types';
import { wishlistSkillId } from '@/features/skill-planner/skillFamilies';

export interface PatchCtx {
  skillById: ReadonlyMap<string, SkillRecord>;
  cutoffISO: string;
  todayISO: string;
  /** Per-plan pins: resolved engine skill id -> pinned version (spec H). */
  pins?: ReadonlyMap<string, number>;
}

/** Resolve WishlistItem.skillVer pins to engine skill ids (family ids resolve
 *  the same way the charts/builds do). */
export function wishlistPins(
  wishlist: readonly WishlistItem[],
  skillById: ReadonlyMap<string, SkillRecord>,
): Map<string, number> {
  const pins = new Map<string, number>();
  for (const item of wishlist) {
    if (item.skillVer === undefined) continue;
    pins.set(wishlistSkillId(item.skillId, skillById), item.skillVer);
  }
  return pins;
}

/** Effective engine patches for every rebalance-annotated skill at this horizon.
 *  Keys are sorted so JSON.stringify(map) is a stable cache signature. Undefined
 *  when empty — the adapter then omits the field entirely, keeping the no-patch
 *  engine path byte-identical (spec §6 identity backstop). */
export function skillPatchMap(ctx: PatchCtx): Record<string, SkillPatch> | undefined {
  const entries: Array<[string, SkillPatch]> = [];
  for (const rec of ctx.skillById.values()) {
    const info = rec.rebalance;
    if (!info) continue;
    const v = resolveVersion(info, ctx.pins?.get(rec.skillId), ctx.cutoffISO, ctx.todayISO);
    const patch = versionPatch(v);
    if (patch) entries.push([rec.skillId, patch]);
  }
  if (entries.length === 0) return undefined;
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entries);
}

/** Attach a patch map to a build (no-op identity when there is nothing to attach). */
export function withSkillPatches(
  build: SimBuild,
  patches: Record<string, SkillPatch> | undefined,
): SimBuild {
  return patches ? { ...build, skillPatches: patches } : build;
}

/** Stable signature fragment for sim cache/stale keys (skillPatchMap emits sorted keys). */
export function skillPatchesSig(patches: Record<string, SkillPatch> | undefined): string {
  return patches ? JSON.stringify(patches) : '';
}

/** P3 marking data: which versions the current patch map represents. */
export interface ActivePatchNote {
  skillId: string;
  name: string;
  ver: number;
  /** Version is confirmed live on Global but the frozen engine data pin predates it (spec F). */
  pinLag: boolean;
  /** Arrival is a foresight projection (never live at Current unless pinned). */
  predicted: boolean;
  arrival?: string;
  /** A wishlist pin (not the horizon default) selected this version. */
  pinned: boolean;
}

export function activePatchNotes(ctx: PatchCtx): ActivePatchNote[] {
  const notes: ActivePatchNote[] = [];
  for (const rec of ctx.skillById.values()) {
    const info = rec.rebalance;
    if (!info) continue;
    const pin = ctx.pins?.get(rec.skillId);
    const v = resolveVersion(info, pin, ctx.cutoffISO, ctx.todayISO);
    if (!versionPatch(v)) continue;
    const def = effectiveVersion(info, ctx.cutoffISO, ctx.todayISO);
    notes.push({
      skillId: rec.skillId,
      name: rec.nameEn,
      ver: v.ver,
      pinLag: v.ver <= info.globalVer,
      predicted: v.globalDatePredicted === true,
      ...(v.globalArrival !== undefined ? { arrival: v.globalArrival } : {}),
      pinned: pin !== undefined && v.ver !== def.ver,
    });
  }
  notes.sort((a, b) => (a.skillId < b.skillId ? -1 : a.skillId > b.skillId ? 1 : 0));
  return notes;
}
