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
  return best ?? info.versions[0]!;
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

export function versionPatch(v: SkillVersion): SkillPatch | undefined {
  const patch: SkillPatch = {};
  if (v.conditions !== undefined) patch.conditions = v.conditions;
  if (v.modifier !== undefined) patch.modifier = v.modifier;
  if (v.duration !== undefined) patch.duration = v.duration;
  if (v.cooldown !== undefined) patch.cooldown = v.cooldown;
  return Object.keys(patch).length > 0 ? patch : undefined;
}
