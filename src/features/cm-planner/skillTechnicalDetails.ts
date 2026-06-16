import type { SkillRarity, SkillRecord } from '@/core/types';

export interface SkillSummary {
  skillId: string;
  nameEn: string;
  iconId: string;
  rarity: SkillRarity;
  baseSpCost: number;
  conditions: string;
}

export interface RawSkillEffect {
  type?: number;
  modifier?: number;
  target?: number;
  valueUsage?: number;
  valueLevelUsage?: number;
}

export interface RawSkillAlternative {
  precondition?: string;
  condition?: string;
  baseDuration?: number;
  cooldownTime?: number;
  effects?: RawSkillEffect[];
}

export interface RawSkillSource {
  outfitId?: number | string;
  name?: string;
  outfit?: string;
}

export interface SkillTechnicalDetail {
  summary: SkillSummary;
  alternatives: RawSkillAlternative[];
  sources: RawSkillSource[];
}

interface RawSkill {
  id: string | number;
  name?: string;
  iconId?: string | number;
  baseCost?: number;
  rarity?: number;
  alternatives?: RawSkillAlternative[];
  sources?: RawSkillSource[];
  unique_version?: unknown;
}

interface RuntimeSkillsService {
  skillCollection?: Record<string, RawSkill>;
  getById?: (skillId: string) => RawSkill | undefined;
}

let skillCollectionPromise: Promise<Record<string, RawSkill>> | null = null;
let uniqueByUmaPromise: Promise<Map<string, SkillSummary>> | null = null;

export function skillRecordToSummary(skill: SkillRecord): SkillSummary {
  return {
    skillId: skill.skillId,
    nameEn: skill.nameEn,
    iconId: skill.iconId,
    rarity: skill.rarity,
    baseSpCost: skill.baseSpCost,
    conditions: skill.conditions,
  };
}

function rarityFromRaw(raw: RawSkill): SkillRarity {
  const id = String(raw.id);
  if (/^9\d{5}$/.test(id) || raw.unique_version !== undefined) return 'inherited_unique';
  if (raw.rarity === 1) return 'white';
  if (raw.rarity === 2) return 'gold';
  return 'unique';
}

function rawToSummary(raw: RawSkill): SkillSummary {
  const alternatives = raw.alternatives ?? [];
  return {
    skillId: String(raw.id),
    nameEn: raw.name ?? `Skill ${raw.id}`,
    iconId: String(raw.iconId ?? ''),
    rarity: rarityFromRaw(raw),
    baseSpCost: raw.baseCost ?? 0,
    conditions: alternatives.map((a) => a.condition ?? '').filter(Boolean).join('@'),
  };
}

async function loadSkillCollection(): Promise<Record<string, RawSkill>> {
  if (skillCollectionPromise === null) {
    skillCollectionPromise = import('@/sim/vendor/umalator.bundle.mjs').then((m) => {
      const service = m.skillsService as unknown as RuntimeSkillsService;
      return service.skillCollection ?? {};
    });
  }
  return skillCollectionPromise;
}

export async function loadSkillTechnicalDetail(
  skillId: string,
): Promise<SkillTechnicalDetail | null> {
  const skills = await loadSkillCollection();
  const raw = skills[skillId];
  if (!raw) return null;
  return {
    summary: rawToSummary(raw),
    alternatives: raw.alternatives ?? [],
    sources: raw.sources ?? [],
  };
}

export async function loadUniqueSkillByUmaId(): Promise<Map<string, SkillSummary>> {
  if (uniqueByUmaPromise === null) {
    uniqueByUmaPromise = loadSkillCollection().then((skills) => {
      const byUma = new Map<string, SkillSummary>();
      for (const raw of Object.values(skills)) {
        if (rarityFromRaw(raw) !== 'unique') continue;
        for (const source of raw.sources ?? []) {
          if (source.outfitId === undefined) continue;
          byUma.set(String(source.outfitId), rawToSummary(raw));
        }
      }
      return byUma;
    });
  }
  return uniqueByUmaPromise;
}

