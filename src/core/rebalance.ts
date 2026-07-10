/** Availability #4 — versioned skill rebalances: pure version-selection math. */
import type { RebalanceInfo, SkillVersion } from './types';

export interface SkillPatch { conditions?: string; modifier?: number; duration?: number; cooldown?: number }

/** Is this version's Global arrival live at the cutoff? Predicted arrivals are
 *  never live at Current (cutoff === today) — a projection elapsing is still a guess. */
function liveAt(v: SkillVersion, cutoffISO: string, todayISO: string): boolean {
  if (v.globalArrival === undefined) return false;
  if (v.globalArrival > cutoffISO) return false;
  if (v.globalDatePredicted === true && cutoffISO <= todayISO) return false;
  return true;
}

export function effectiveVersion(info: RebalanceInfo, cutoffISO: string, todayISO: string): SkillVersion {
  let best: SkillVersion | undefined;
  for (const v of info.versions) {
    if (v.ver <= info.globalVer || liveAt(v, cutoffISO, todayISO)) {
      if (best === undefined || v.ver > best.ver) best = v;
    }
  }
  // An uncurated candidate may carry no versions at all (bare `{ candidateConditions }` shape) —
  // fall back to a patch-free synthetic baseline rather than crashing on versions[0].
  return best ?? info.versions[0] ?? { ver: info.globalVer };
}

/** Version resolution everywhere: the user's pin wins; else the horizon default. */
export function resolveVersion(
  info: RebalanceInfo,
  pinned: number | undefined,
  cutoffISO: string,
  todayISO: string,
): SkillVersion {
  if (pinned !== undefined) {
    const v = info.versions.find((x) => x.ver === pinned);
    if (v) return v;
  }
  return effectiveVersion(info, cutoffISO, todayISO);
}

/** One arrival-label convention for every surface (P3): `~date` = foresight-projected
 *  guess, `✓ date` = officially announced. Undefined when the version has no date. */
export function arrivalLabel(v: SkillVersion): string | undefined {
  if (v.globalArrival === undefined) return undefined;
  return v.globalDatePredicted === true ? `~${v.globalArrival}` : `✓ ${v.globalArrival}`;
}

export function versionPatch(v: SkillVersion): SkillPatch | undefined {
  const patch: SkillPatch = {};
  if (v.conditions !== undefined) patch.conditions = v.conditions;
  if (v.modifier !== undefined) patch.modifier = v.modifier;
  if (v.duration !== undefined) patch.duration = v.duration;
  if (v.cooldown !== undefined) patch.cooldown = v.cooldown;
  return Object.keys(patch).length > 0 ? patch : undefined;
}

/** Task 7 — is this version's parameters already baked natively into the current
 *  engine data pin (`src/sim/enginePin.ts` `ENGINE_DATA_DATE`)? An in-pin version
 *  must never be re-injected as a `skillPatches` override (the engine already
 *  computes it) and must never surface a "confirmed patch, engine pin pending"
 *  note — that note is only honest for versions the frozen engine data still
 *  lags. Predicted arrivals never count as in-pin — same strict "announced
 *  only" rule as `liveAt`: a foresight projection elapsing the pin date is
 *  still a guess, not a confirmed baked-in value. */
export function isInPin(v: SkillVersion, engineDataDate: string): boolean {
  return v.globalDate !== undefined && v.globalDatePredicted !== true && v.globalDate <= engineDataDate;
}

/** True when a *pinned* version's own parameters can no longer be reproduced in
 *  sim: some other version of this skill is in-pin (baked natively into the
 *  engine) and is NEWER than `v`, so there is no override path back down to
 *  `v`'s (older, unpatched) values — the engine will silently keep running its
 *  native in-pin behavior regardless of the pin. The picker should label such a
 *  selection "pre-patch values unavailable in sim" rather than implying the pin
 *  changes anything. */
export function versionSimUnavailable(v: SkillVersion, info: RebalanceInfo, engineDataDate: string): boolean {
  let pinnedFloor: number | undefined;
  for (const other of info.versions) {
    if (isInPin(other, engineDataDate) && (pinnedFloor === undefined || other.ver > pinnedFloor)) {
      pinnedFloor = other.ver;
    }
  }
  return pinnedFloor !== undefined && v.ver < pinnedFloor;
}
