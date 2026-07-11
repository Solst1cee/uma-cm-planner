/** Availability #4b — build-facing rebalance patch selection (pure).
 *  Turns SkillRecord.rebalance + per-plan WishlistItem.skillVer pins + the
 *  horizon clock into the engine `skillPatches` map a sim build carries.
 *  All date logic lives in resolveVersion/effectiveVersion (4a) — this module
 *  only walks the catalog and shapes the result. */
import type { SkillRecord, WishlistItem } from './types';
import { effectiveVersion, isInPin, resolveVersion, versionPatch, type SkillPatch } from './rebalance';
import type { SimBuild } from '@/sim/types';
import { wishlistSkillId } from '@/features/skill-planner/skillFamilies';

export interface PatchCtx {
  skillById: ReadonlyMap<string, SkillRecord>;
  cutoffISO: string;
  todayISO: string;
  /** Vendored engine data pin date (`src/sim/enginePin.ts` `ENGINE_DATA_DATE`).
   *  Versions confirmed live on/before this date are in-pin — already baked into
   *  the engine natively — and are gated out of both the patch map and the notes
   *  below (Task 7). Every call site threads `ENGINE_DATA_DATE` here directly. */
  engineDataDate: string;
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
    if (isInPin(v, ctx.engineDataDate)) continue; // engine already computes this version natively
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
    if (isInPin(v, ctx.engineDataDate)) continue; // in-pin: no patch, no note (the engine already IS this version)
    if (!versionPatch(v)) continue;
    const def = effectiveVersion(info, ctx.cutoffISO, ctx.todayISO);
    notes.push({
      skillId: rec.skillId,
      name: rec.nameEn,
      ver: v.ver,
      // The `!isInPin` conjunct is UNREACHABLE in the current control flow (an
      // in-pin version is `continue`d above and never produces a note) — it does
      // no work today. Kept purely as defense against a future reordering of this
      // loop, matching the task-7 spec's pinLag formula verbatim.
      pinLag: v.ver <= info.globalVer && !isInPin(v, ctx.engineDataDate),
      predicted: v.globalDatePredicted === true,
      ...(v.globalArrival !== undefined ? { arrival: v.globalArrival } : {}),
      pinned: pin !== undefined && v.ver !== def.ver,
    });
  }
  notes.sort((a, b) => (a.skillId < b.skillId ? -1 : a.skillId > b.skillId ? 1 : 0));
  return notes;
}

/** Fields the patch-note chip actually renders — the merge below dedupes on these,
 *  ignoring `name` (which is always the same skill name from the shared catalog). */
function sameNote(a: ActivePatchNote, b: ActivePatchNote): boolean {
  return (
    a.skillId === b.skillId &&
    a.ver === b.ver &&
    a.pinLag === b.pinLag &&
    a.predicted === b.predicted &&
    a.arrival === b.arrival &&
    a.pinned === b.pinned
  );
}

function annotate(n: ActivePatchNote, label: 'Uma 1' | 'Uma 2'): ActivePatchNote {
  return { ...n, name: `${n.name} (${label})` };
}

/** P3 honesty (mini-sim compare, availability #4b follow-up): merge each build's own
 *  patch notes for the compare chip row WITHOUT last-write-wins misattribution.
 *
 *  - Same skillId, identical resolution on both sides -> one chip, unchanged (the common case).
 *  - Same skillId, differing resolution (e.g. one plan pins v2, the other defaults to v3) ->
 *    two chips, each annotated with which build it applies to.
 *  - A note on only one side, where the OTHER build also sims that skillId (i.e. it resolved
 *    to baseline there, so it has no note of its own) -> the one chip is annotated, since
 *    presenting it bare would imply it applies to both builds.
 *  - A note on only one side where the other build never sims that skillId at all -> the chip
 *    is unambiguous already; left unannotated. */
export function mergeCompareNotes(
  uma1Notes: readonly ActivePatchNote[],
  uma2Notes: readonly ActivePatchNote[],
  uma1Skills: ReadonlySet<string>,
  uma2Skills: ReadonlySet<string>,
): ActivePatchNote[] {
  const map1 = new Map(uma1Notes.map((n) => [n.skillId, n]));
  const map2 = new Map(uma2Notes.map((n) => [n.skillId, n]));
  const skillIds = new Set([...map1.keys(), ...map2.keys()]);
  const merged: ActivePatchNote[] = [];
  for (const skillId of skillIds) {
    const n1 = map1.get(skillId);
    const n2 = map2.get(skillId);
    if (n1 && n2) {
      if (sameNote(n1, n2)) merged.push(n1);
      else merged.push(annotate(n1, 'Uma 1'), annotate(n2, 'Uma 2'));
    } else if (n1) {
      merged.push(uma2Skills.has(skillId) ? annotate(n1, 'Uma 1') : n1);
    } else if (n2) {
      merged.push(uma1Skills.has(skillId) ? annotate(n2, 'Uma 2') : n2);
    }
  }
  merged.sort((a, b) => (a.skillId < b.skillId ? -1 : a.skillId > b.skillId ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return merged;
}
