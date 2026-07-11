import type { HintLevel } from '@/core/coverage';
import type { CaptureBundle, BuyableSkill } from '@/core/spOptimizer';
import type { Grade, SkillRecord, Stat, Strategy } from '@/core/types';

const GRADES: Grade[] = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S'];
const GRADE_VALUE = new Map(GRADES.map((grade, index) => [grade, index]));
const STAT_KEYS: Stat[] = ['spd', 'sta', 'pow', 'gut', 'wit'];
const STRATEGIES: Strategy[] = ['front', 'pace', 'late', 'end'];

type RawObject = Record<string, unknown>;

export interface CareerCaptureImportOptions {
  skillById: Map<string, SkillRecord>;
  courseId: string;
  umaId?: string;
  dataVersion?: string;
}

function fail(message: string): never {
  throw new Error(`Invalid career capture: ${message}`);
}

function object(value: unknown, name: string): RawObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`${name} must be an object`);
  return value as RawObject;
}

function finite(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${name} must be a finite number`);
  return value;
}

function grade(value: unknown, name: string): Grade {
  if (typeof value !== 'string' || !GRADE_VALUE.has(value as Grade)) fail(`${name} must be a grade`);
  return value as Grade;
}

function gradeMap(value: unknown, name: string): Record<string, Grade> {
  const raw = object(value, name);
  return Object.fromEntries(Object.entries(raw).map(([key, item]) => [key, grade(item, `${name}.${key}`)]));
}

function bestGrade(values: Record<string, Grade>): Grade {
  return Object.values(values).reduce<Grade>((best, current) =>
    (GRADE_VALUE.get(current) ?? -1) > (GRADE_VALUE.get(best) ?? -1) ? current : best, 'G');
}

/** Convert the extractor's lossless career-capture.json into M2's internal model. */
export function parseCareerCapture(data: unknown, options: CareerCaptureImportOptions): CaptureBundle {
  const root = object(data, 'root');
  if (!Array.isArray(root['skills'])) fail('skills must be an array');
  const statsRaw = object(root['stats'], 'stats');
  const stats = {} as Record<Stat, number>;
  for (const key of STAT_KEYS) stats[key] = finite(statsRaw[key], `stats.${key}`);

  const aptitudesRaw = object(root['aptitudes'], 'aptitudes');
  const surface = gradeMap(aptitudesRaw['surface'], 'aptitudes.surface');
  const distance = gradeMap(aptitudesRaw['distance'], 'aptitudes.distance');
  const style = gradeMap(aptitudesRaw['style'], 'aptitudes.style');
  const strategy = root['strategy'];
  if (typeof strategy !== 'string' || !STRATEGIES.includes(strategy as Strategy)) fail('strategy must be valid');

  const ownedSkills: string[] = [];
  const candidates: BuyableSkill[] = [];
  for (const [index, value] of root['skills'].entries()) {
    const row = object(value, `skills[${index}]`);
    const skillId = String(row['skillId'] ?? '');
    if (!skillId) fail(`skills[${index}].skillId is required`);
    const acquired = row['isAcquired'] === 1 || row['isAcquired'] === true;
    if (acquired) ownedSkills.push(skillId);

    const record = options.skillById.get(skillId);
    const cost = row['needPoint'];
    if (acquired || !record || !['white', 'gold'].includes(record.rarity)
        || typeof cost !== 'number' || !Number.isFinite(cost) || cost <= 0) continue;
    const candidate: BuyableSkill = {
      skillId,
      rarity: record.rarity,
      screenSpCost: cost,
      matchTier: 'exact',
    };
    if (record.prereqSkillId) candidate.prereqSkillId = record.prereqSkillId;
    const hint = row['hintLv'];
    if (typeof hint === 'number' && Number.isInteger(hint) && hint >= 0 && hint <= 5) {
      candidate.hintLevel = hint as HintLevel;
    }
    candidates.push(candidate);
  }
  if (candidates.length === 0) fail('no optimizer-compatible purchasable skills were found');

  const context: CaptureBundle['context'] = {
    umaId: options.umaId ?? '',
    stats,
    aptitudes: {
      surface: bestGrade(surface),
      distance: bestGrade(distance),
      strategy: style[strategy] ?? 'G',
    },
    strategy: strategy as Strategy,
    courseId: options.courseId,
    spBudget: finite(root['spBudget'], 'spBudget'),
    ownedSkills,
    pinned: [],
    candidates,
    // The full un-reduced aptitude grade maps — nothing filtered out (per-course importer later).
    aptitudesAll: { surface, distance, style },
  };

  return {
    schemaVersion: 1,
    source: 'memory',
    capturedAt: typeof root['capturedAt'] === 'string' ? root['capturedAt'] : new Date(0).toISOString(),
    server: 'global',
    dataVersion: options.dataVersion ?? 'unknown',
    context,
  };
}
