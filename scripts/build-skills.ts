/**
 * public/data/skills.json — SkillRecord[] for the Global-released skill set.
 *
 * Released = the keys of umalator's master skills.json (Global master.mdb
 * extract, provenance §3). GameTora's catalog supplies JP names, Global
 * condition variants (loc.en) and scenario tags.
 */
import type { SkillRarity, SkillRecord } from '@/core/types';
import type { GtConditionGroup, GtSkill, MasterSkill, MasterSkillsJson } from './lib/upstream-types';

/**
 * GameTora release-order scenario number (GT#) → game-internal
 * single_mode_scenario.id. Internal id 3 does not exist; ids ≥5 are inferred
 * (GT#+1) and need JP master.mdb verification before being relied on.
 * Source: docs/provenance.md §3.1 (resolved 2026-06-12).
 */
export const GT_TO_INTERNAL_SCENARIO: Record<number, number> = {
  1: 1, // URA Finale
  2: 2, // Aoharu Hai (Unity Cup)
  3: 4, // Make a New Track / Climax (Trackblazer)
  4: 5, // Grand Live
  5: 6, // Grand Masters
  6: 7, // Project L'Arc
  7: 8, // U.A.F. Ready GO!
  8: 9, // Great Food Festival
  9: 10, // Run! Mecha Umamusume
  10: 11, // The Twinkle Legends
  11: 12, // Design Your Island
  12: 13, // Yukoma Onsen
  13: 14, // Beyond Dreams
};

/** Internal scenario ids live on Global as of data pin c1fa2107 (provenance §3.1). */
const GLOBAL_LIVE_SCENARIOS = new Set([1, 2, 4]);

const INHERITED_UNIQUE_ID = /^9\d{5}$/;

/** GameTora sup/char list fields are flat or rarity-bucketed; flatten either. */
function flattenIds(value: number[][] | number[] | undefined): number[] {
  if (!value) return [];
  const out: number[] = [];
  for (const entry of value) {
    if (Array.isArray(entry)) out.push(...entry);
    else out.push(entry);
  }
  return out;
}

/** Global variant of a per-server field: loc.en presence replaces the JP default. */
function globalField<K extends 'sup_hint' | 'sup_e' | 'char' | 'char_e'>(
  skill: GtSkill,
  key: K,
): GtSkill[K] {
  const loc = skill.loc?.en;
  if (loc && loc[key] !== undefined) return loc[key] as GtSkill[K];
  return skill[key];
}

function mapRarity(master: MasterSkill): SkillRarity {
  // The source encodes inherited uniques as rarity-1 entries carrying a
  // unique_version backlink; their ids are the 6-digit 9xxxxx block. Both
  // signals coincide for all 84 (verified 2026-06-12).
  if (INHERITED_UNIQUE_ID.test(master.id) || master.unique_version !== undefined) {
    return 'inherited_unique';
  }
  if (master.rarity === 1) return 'white';
  if (master.rarity === 2) return 'gold';
  return 'unique'; // rarity 3–5
}

function isSelfDebuff(skill: MasterSkill): boolean {
  // target 1 = self (upstream SkillTarget.Self); mirrors umalator
  // skill-relationships.ts isSelfDebuffSkill.
  return skill.alternatives.some((alt) => alt.effects.some((e) => e.target === 1 && e.modifier < 0));
}

/**
 * Gold → white prereq, mirroring umalator getWhiteVersion (family = versions
 * field; lowest-cost white wins) with one deliberate widening: upstream
 * filters family whites by "has positive effects", which drops the white
 * prereqs of target-debuff golds (e.g. Mystifying Murmur → Murmur). We instead
 * exclude only self-debuff variants (the '×' tier), using upstream's own
 * isSelfDebuffSkill semantics, so all 10 released debuff golds resolve.
 */
function resolvePrereq(gold: MasterSkill, master: MasterSkillsJson): string | undefined {
  const whites = gold.versions
    .map((v) => master[String(v)])
    .filter((s): s is MasterSkill => s !== undefined && s.rarity === 1 && !isSelfDebuff(s));
  if (whites.length === 0) return undefined;
  whites.sort((a, b) => a.baseCost - b.baseCost || Number(a.id) - Number(b.id));
  return (whites[0] as MasterSkill).id;
}

/**
 * Serialize resolved condition groups to one DSL string. Alternative trigger
 * sets are OR'd, and '@' is the DSL's alternation operator, so they join with
 * '@'. Known loss: per-alternative preconditions (27 alternatives, all on
 * unique/inherited-unique skills) are dropped — acceptable for Phase 1 where
 * conditions are informational; the Phase 4 sim vendors its own data.
 */
function serializeConditions(groups: ReadonlyArray<{ condition?: string }>): string {
  return groups
    .map((g) => g.condition ?? '')
    .filter((c) => c !== '')
    .join('@');
}

export function buildSkills(inputs: {
  master: MasterSkillsJson;
  gametora: GtSkill[];
  dataVersion: string;
}): SkillRecord[] {
  const { master, gametora, dataVersion } = inputs;

  const gtById = new Map<string, GtSkill>(gametora.map((s) => [String(s.id), s]));
  // 9xxxxx inherited uniques never appear top-level in GameTora; they nest
  // under the native unique's gene_version (mirrors umalator skill-loader.ts).
  const gtParentOfInherited = new Map<string, GtSkill>();
  for (const s of gametora) {
    if (s.gene_version) gtParentOfInherited.set(String(s.gene_version.id), s);
  }

  /**
   * Global condition variant, mirroring umalator skill-loader.ts merge order:
   * loc.en condition_groups > GameTora base condition_groups > master extract.
   */
  function resolveConditionGroups(id: string): GtConditionGroup[] | undefined {
    const gt = gtById.get(id);
    if (gt) return gt.loc?.en?.condition_groups ?? gt.condition_groups;
    const parent = gtParentOfInherited.get(id);
    if (parent) {
      return parent.loc?.en?.gene_version?.condition_groups ?? parent.gene_version?.condition_groups;
    }
    return undefined;
  }

  function resolveNameJp(id: string): string {
    const gt = gtById.get(id);
    if (gt?.jpname) return gt.jpname;
    // Inherited uniques share the native unique's JP name.
    const parent = gtParentOfInherited.get(id);
    return parent?.jpname ?? '';
  }

  /**
   * scenarioId is set only for scenario-EXCLUSIVE skills (frozen contract,
   * src/core/types.ts): sce_e present AND no Global acquisition source
   * (support hint/event, character innate). GameTora does not tag the 21xxxx
   * scenario-skill block with sce_e at all, so those 12 released skills get
   * their scenarioId from data-overrides/skill_scenario_overrides.json
   * (provenance §3.1: hand-maintained map). As of pin c1fa2107 this sce_e path
   * yields zero records — it exists to catch future data refreshes.
   */
  function resolveScenarioId(id: string): number | undefined {
    const gt = gtById.get(id);
    if (!gt?.sce_e || gt.sce_e.length === 0) return undefined;
    const hasOtherSource =
      flattenIds(globalField(gt, 'sup_hint')).length > 0 ||
      flattenIds(globalField(gt, 'sup_e')).length > 0 ||
      (globalField(gt, 'char') ?? []).length > 0 ||
      (globalField(gt, 'char_e') ?? []).length > 0;
    if (hasOtherSource) return undefined;
    const internalIds = gt.sce_e
      .map((gtNum) => GT_TO_INTERNAL_SCENARIO[gtNum])
      .filter((n): n is number => n !== undefined);
    return internalIds.find((n) => GLOBAL_LIVE_SCENARIOS.has(n)) ?? internalIds[0];
  }

  const records: SkillRecord[] = [];
  for (const skill of Object.values(master)) {
    const groups = resolveConditionGroups(skill.id);
    const conditions =
      groups !== undefined && groups.length > 0
        ? serializeConditions(groups)
        : serializeConditions(skill.alternatives);

    const record: SkillRecord = {
      skillId: skill.id,
      nameEn: skill.name,
      nameJp: resolveNameJp(skill.id),
      baseSpCost: skill.baseCost,
      rarity: mapRarity(skill),
      iconId: skill.iconId,
      conditions,
      server: 'global',
      dataVersion,
    };
    if (skill.rarity === 2) {
      const prereq = resolvePrereq(skill, master);
      if (prereq !== undefined) record.prereqSkillId = prereq;
    }
    const scenarioId = resolveScenarioId(skill.id);
    if (scenarioId !== undefined) record.scenarioId = scenarioId;
    records.push(record);
  }

  records.sort((a, b) => Number(a.skillId) - Number(b.skillId));
  return records;
}
