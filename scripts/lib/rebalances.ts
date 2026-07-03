/**
 * Availability #4 slice 4a — versioned skill rebalances: build-time pipeline.
 * Three pieces: (1) `detectCandidates` — an AUTO feed of Global-released
 * skills whose gametora JP conditions differ from their Global conditions
 * (a signal a rebalance/condition-localization happened); (2) `loadRebalances`
 * — validate the hand-curated `data-overrides/rebalances.json` (P5: fail
 * loudly on malformed entries); (3) `bakeRebalances` — merge curated over
 * auto candidates and resolve each version's Global arrival through the one
 * foresight calibration clock (`projectReleaseDate`, shared with build-time
 * record dating and cmSynthesis — no new date math here).
 */
import { readFileSync } from 'node:fs';
import { projectReleaseDate } from './foresight-build';
import type { Calibration } from '@/core/foresight';
import type { GtSkill } from './upstream-types';
import type { RebalanceInfo, SkillVersion } from '@/core/types';

/** A curated rebalance entry as authored in data-overrides/rebalances.json.
 *  `globalArrival`/`globalDatePredicted` are resolved by `bakeRebalances`, not
 *  hand-authored. */
export interface CuratedRebalance {
  skillId: string;
  globalVer: number;
  versions: Array<Omit<SkillVersion, 'globalArrival' | 'globalDatePredicted'>>;
}

/**
 * Serialize resolved condition groups to one DSL string. Local copy of
 * build-skills.ts's `serializeConditions` (kept local to avoid coupling this
 * module to the skills build — same tiny idiom, '@' joins OR'd alternatives).
 */
function serializeConditions(groups: ReadonlyArray<{ condition?: string }>): string {
  return groups
    .map((g) => g.condition ?? '')
    .filter((c) => c !== '')
    .join('@');
}

/**
 * AUTO feed: Global-released skills (present in `masterSkillIds`) whose
 * gametora JP conditions (`condition_groups`) differ from the Global-localized
 * conditions (`loc.en.condition_groups`). Skills with no recorded Global
 * override (`loc.en.condition_groups` absent), identical conditions, or not
 * present in the Global master (JP-only) are absent from the result.
 */
export function detectCandidates(
  gametora: GtSkill[],
  masterSkillIds: ReadonlySet<string>,
): Map<string, { jp: string; global: string }> {
  const out = new Map<string, { jp: string; global: string }>();
  for (const gt of gametora) {
    const skillId = String(gt.id);
    if (!masterSkillIds.has(skillId)) continue; // JP-only, not Global-released
    const globalGroups = gt.loc?.en?.condition_groups;
    if (globalGroups === undefined) continue; // no recorded Global override
    const jp = serializeConditions(gt.condition_groups ?? []);
    const global = serializeConditions(globalGroups);
    if (jp === global) continue; // identical — no diff to surface
    out.set(skillId, { jp, global });
  }
  return out;
}

/**
 * Validate curated rebalance entries (P5: fail loudly, name the entry/field).
 * Rules: versions strictly ver-ascending + unique; ver 1 present and carries
 * NO parameter fields (baseline); `globalVer` must be one of the versions;
 * any ver ≥ 2 that sets a value field (modifier/duration/cooldown) requires
 * `sourceUrl` (honesty ladder — conditions-only versions may omit it).
 */
export function validateRebalances(entries: CuratedRebalance[]): void {
  for (const entry of entries) {
    const { skillId, globalVer, versions } = entry;
    if (typeof skillId !== 'string' || skillId === '') {
      throw new Error(`rebalances.json: entry has invalid skillId ${JSON.stringify(skillId)} — must be a non-empty string`);
    }
    if (versions.length === 0) {
      throw new Error(`rebalances.json[${skillId}]: versions must be non-empty`);
    }
    for (let i = 1; i < versions.length; i++) {
      const prevVer = versions[i - 1]!.ver;
      const curVer = versions[i]!.ver;
      if (curVer <= prevVer) {
        throw new Error(
          `rebalances.json[${skillId}]: versions must be strictly ascending and unique by ver (got ver ${prevVer} then ver ${curVer})`,
        );
      }
    }
    const first = versions[0]!;
    if (first.ver !== 1) {
      throw new Error(`rebalances.json[${skillId}]: version 1 (baseline) is required (first entry was ver ${first.ver})`);
    }
    if (first.modifier !== undefined || first.duration !== undefined || first.cooldown !== undefined) {
      throw new Error(`rebalances.json[${skillId}]: version 1 (baseline) must not carry modifier/duration/cooldown`);
    }
    const verSet = new Set(versions.map((v) => v.ver));
    if (!verSet.has(globalVer)) {
      throw new Error(
        `rebalances.json[${skillId}]: globalVer ${globalVer} is not among this entry's versions [${[...verSet].join(', ')}]`,
      );
    }
    for (const v of versions) {
      const hasValueChange = v.modifier !== undefined || v.duration !== undefined || v.cooldown !== undefined;
      if (v.ver >= 2 && hasValueChange && v.sourceUrl === undefined) {
        throw new Error(
          `rebalances.json[${skillId}] ver ${v.ver}: a value change (modifier/duration/cooldown) requires sourceUrl`,
        );
      }
      // The engine '@'-splits conditions and maps parts positionally; an explicit
      // empty part blanks an originally-non-empty alternative and reaches
      // parser.parse('') (a sim-time ParseError). Reject at author time.
      if (v.conditions !== undefined && v.conditions.split('@').some((part) => part.trim() === '')) {
        throw new Error(
          `rebalances.json[${skillId}] ver ${v.ver}: conditions has an empty '@'-part ` +
          `(${JSON.stringify(v.conditions)}) — to leave a later alternative unchanged, omit trailing parts entirely`,
        );
      }
    }
  }
}

/** Load + validate `data-overrides/rebalances.json`; throws loudly (P5) on any invalid entry. */
export function loadRebalances(path: string): CuratedRebalance[] {
  const raw = readFileSync(path, 'utf-8');
  const entries = JSON.parse(raw) as CuratedRebalance[];
  validateRebalances(entries);
  return entries;
}

/**
 * Merge curated entries over auto candidates and resolve each version's
 * Global arrival via the shared foresight calibration. Curated entries yield
 * a full `RebalanceInfo` (curated skillIds absorb any auto candidate for the
 * same skill — no `uncuratedCandidate` flag); remaining un-curated auto
 * candidates yield a minimal placeholder `RebalanceInfo` flagged for review.
 */
/** Per-skill shape facts from the master extract, for author-time guards. */
export interface SkillShape {
  /** Max `effects.length` across the skill's alternatives. */
  maxEffectsPerAlternative: number;
  /** Count of non-empty-condition alternatives — the '@'-parts the engine can map onto. */
  patchableAlternatives: number;
}

export function bakeRebalances(inputs: {
  candidates: Map<string, { jp: string; global: string }>;
  curated: CuratedRebalance[];
  cal: Calibration | null;
  /** Full merged skillId set (global + jp) in scope at build time. When
   *  provided, a curated entry whose skillId matches no skill record fails
   *  the build (P5: fail loudly — a typo here would silently drop the badge
   *  and sim patch). Optional for back-compat with existing callers/tests. */
  knownSkillIds?: ReadonlySet<string>;
  /** Per-skill shapes from the master extract. When provided, guards two
   *  engine foot-guns (P5: fail loudly): `modifier` on a multi-effect skill
   *  (the engine overwrites EVERY effect's base value) and a `conditions`
   *  string with more '@'-parts than the skill has patchable alternatives
   *  (positional mapping would silently drift on a data refresh). Skills
   *  absent from the map (JP-only, no master data) are not checked. */
  skillShapes?: ReadonlyMap<string, SkillShape>;
}): Map<string, RebalanceInfo> {
  const { candidates, curated, cal, knownSkillIds, skillShapes } = inputs;

  if (knownSkillIds) {
    const orphans = curated.filter((e) => !knownSkillIds.has(e.skillId)).map((e) => e.skillId);
    if (orphans.length > 0) {
      throw new Error(
        `rebalances.json: curated skillId(s) match no skill record: ${orphans.join(', ')} — ` +
        'a typo here would silently drop the badge and sim patch (P5: fail loudly).',
      );
    }
  }

  if (skillShapes) {
    for (const entry of curated) {
      const shape = skillShapes.get(entry.skillId);
      if (!shape) continue; // JP-only skill: no master shape data to check against
      for (const v of entry.versions) {
        if (v.modifier !== undefined && shape.maxEffectsPerAlternative > 1) {
          throw new Error(
            `rebalances.json[${entry.skillId}] ver ${v.ver}: modifier is not allowed on a multi-effect skill ` +
            `(${shape.maxEffectsPerAlternative} effects on one alternative) — the engine would overwrite every ` +
            'effect\'s base value with it. Leave modifier unset (documented limitation).',
          );
        }
        if (v.conditions !== undefined) {
          const parts = v.conditions.split('@').length;
          if (parts > shape.patchableAlternatives) {
            throw new Error(
              `rebalances.json[${entry.skillId}] ver ${v.ver}: conditions has ${parts} '@'-parts but the skill ` +
              `has only ${shape.patchableAlternatives} patchable alternative(s) — parts map positionally, so ` +
              'extra parts indicate a stale/wrong authoring against this skill\'s alternatives.',
            );
          }
        }
      }
    }
  }

  const out = new Map<string, RebalanceInfo>();

  for (const entry of curated) {
    const versions: SkillVersion[] = entry.versions.map((v) => {
      const resolved: SkillVersion = { ...v };
      const { releaseDate, predicted } = projectReleaseDate(v.jpDate, v.globalDate, cal);
      if (releaseDate !== undefined) {
        resolved.globalArrival = releaseDate;
        if (predicted) resolved.globalDatePredicted = true;
      }
      return resolved;
    });
    const jpVer = Math.max(...entry.versions.map((v) => v.ver));
    out.set(entry.skillId, { globalVer: entry.globalVer, jpVer, versions });
  }

  for (const [skillId, conditions] of candidates) {
    if (out.has(skillId)) continue; // curated entry absorbs the auto candidate
    out.set(skillId, {
      globalVer: 1,
      jpVer: 1,
      versions: [{ ver: 1 }],
      uncuratedCandidate: true,
      candidateConditions: conditions,
    });
  }

  return out;
}
