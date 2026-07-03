// src/features/cm-planner/skillTechFormat.ts
/**
 * Pure formatters for engine-bundle skill technical data (duration / cooldown /
 * activation condition / raw effect). Shared by M4's SkillDetailDisclosure and
 * M1.7's SkillDetailPopover so both render identical strings.
 */
import type { SkillTechnicalDetail } from './skillTechnicalDetails';

export type SkillEffect = NonNullable<SkillTechnicalDetail['alternatives'][number]['effects']>[number];

export const EFFECT_TYPE_NAMES: Record<number, string> = {
  0: 'Noop', 1: 'Speed', 2: 'Stamina', 3: 'Power', 4: 'Guts', 5: 'Wit',
  6: 'Strategy change', 8: 'Field of view', 9: 'Recovery', 10: 'Start reaction time',
  13: 'Rushed duration', 14: 'Start delay', 21: 'Current speed', 22: 'Current speed',
  27: 'Target speed', 28: 'Lane movement speed', 31: 'Acceleration', 35: 'Lane change',
  37: 'Random gold skill', 42: 'Skill duration',
};

export const EFFECT_TARGET_NAMES: Record<number, string> = {
  1: 'Self', 2: 'All', 4: 'In FOV', 7: 'Ahead of Position', 9: 'Ahead of Self',
  10: 'Behind Self', 11: 'All Allies', 18: 'Enemy Strategy', 19: 'Kakari Ahead',
  20: 'Kakari Behind', 21: 'Kakari Strategy', 22: 'Uma ID', 23: 'Used Recovery',
};

/** Duration / cooldown in engine 1e-4 s units → "1.8s" (negative ⇒ passive). */
export function formatDuration(raw: number | undefined): string {
  if (raw === undefined) return 'n/a';
  if (raw < 0) return 'passive';
  return `${(raw / 10000).toFixed(1)}s`;
}

/** Split an activation-condition DSL into display lines (`@` = OR alt, `&` = AND). */
export function conditionLines(raw: string | undefined): string[] {
  const source = raw?.trim();
  if (!source) return ['none'];
  const lines: string[] = [];
  const alternatives = source.split('@').map((part) => part.trim()).filter(Boolean);
  for (const [altIndex, alternative] of alternatives.entries()) {
    const parts = alternative.split('&').map((part) => part.trim()).filter(Boolean);
    if (parts.length === 0) {
      lines.push(alternative);
    } else {
      parts.forEach((part, index) => {
        lines.push(index < parts.length - 1 ? `${part} &` : part);
      });
    }
    if (altIndex < alternatives.length - 1) lines.push('@ or');
  }
  return lines;
}

export type EffectTone =
  | 'target-speed' | 'current-speed' | 'acceleration' | 'recovery' | 'stat'
  | 'debuff' | 'start' | 'movement' | 'duration' | 'special';

export interface EffectDisplay {
  label: string;
  value: string;
  tone: EffectTone;
  valueTone: 'positive' | 'negative' | 'neutral';
  target?: string;
  meta?: string;
}

function trimNumber(value: number, digits = 2): string {
  return value.toFixed(digits).replace(/\.?0+$/, '');
}
function signedNumber(value: number, digits = 2): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}${trimNumber(Math.abs(value), digits)}`;
}
function scaledModifier(effect: SkillEffect): number | undefined {
  if (effect.modifier !== undefined) return effect.modifier / 10000;
  if (effect.value !== undefined) return effect.value;
  return undefined;
}
function isRandomRecovery(effect: SkillEffect): boolean {
  return effect.type === 9 && (effect.valueUsage === 8 || effect.valueUsage === 9);
}
function recoveryPercent(value: number): string {
  return `${signedNumber(value * 100, 1)}%`;
}
function effectTarget(effect: SkillEffect): string | undefined {
  if (effect.target === undefined || effect.target === 1) return undefined;
  return `Target: ${EFFECT_TARGET_NAMES[effect.target] ?? `target ${effect.target}`}`;
}
function effectMeta(effect: SkillEffect): string | undefined {
  const meta: string[] = [];
  if (effect.valueUsage !== undefined && effect.valueUsage !== 1 && !isRandomRecovery(effect)) meta.push(`usage ${effect.valueUsage}`);
  if (effect.valueLevelUsage !== undefined && effect.valueLevelUsage !== 1) meta.push(`level ${effect.valueLevelUsage}`);
  return meta.length > 0 ? meta.join(' / ') : undefined;
}
function effectTone(effect: SkillEffect, modifier: number | undefined): EffectTone {
  if ((modifier ?? 0) < 0) return 'debuff';
  switch (effect.type) {
    case 1: case 2: case 3: case 4: case 5: return 'stat';
    case 9: return 'recovery';
    case 10: case 14: return 'start';
    case 21: case 22: return 'current-speed';
    case 27: return 'target-speed';
    case 28: case 35: return 'movement';
    case 31: return 'acceleration';
    case 42: return 'duration';
    default: return 'special';
  }
}

/** Translate one raw engine effect into a readable label + value (e.g. "Recovery +1.5%"). */
export function describeEffect(effect: SkillEffect): EffectDisplay | null {
  const modifier = scaledModifier(effect);
  const target = effectTarget(effect);
  const meta = effectMeta(effect);
  const label = effect.type !== undefined ? EFFECT_TYPE_NAMES[effect.type] ?? `Effect ${effect.type}` : 'Effect';
  const fallbackValue = modifier === undefined ? 'n/a' : signedNumber(modifier, 2);
  const tone = effectTone(effect, modifier);
  const valueTone = modifier === undefined || modifier === 0 ? 'neutral' : modifier < 0 ? 'negative' : 'positive';

  if (effect.type === undefined && modifier === undefined && target === undefined && meta === undefined) return null;

  switch (effect.type) {
    case 1: case 2: case 3: case 4: case 5:
      return { label, value: modifier === undefined ? 'n/a' : signedNumber(modifier, 0), tone, valueTone, target, meta };
    case 8:
      return { label, value: modifier === undefined ? 'n/a' : signedNumber(modifier, 1), tone, valueTone, target, meta };
    case 9: {
      const recoveryLabel = (modifier ?? 0) < 0 ? 'HP drain' : 'Recovery';
      if (modifier !== undefined && isRandomRecovery(effect)) {
        return { label: recoveryLabel, value: `60% none / 30% ${recoveryPercent(modifier * 0.02)} / 10% ${recoveryPercent(modifier * 0.04)}`, tone, valueTone, target, meta };
      }
      return { label: recoveryLabel, value: modifier === undefined ? 'n/a' : recoveryPercent(modifier), tone, valueTone, target, meta };
    }
    case 10: case 42:
      return { label, value: modifier === undefined ? 'n/a' : `x${trimNumber(modifier, 2)}`, tone, valueTone, target, meta };
    case 14:
      return { label, value: modifier === undefined ? 'n/a' : `${trimNumber(modifier, 2)}s`, tone, valueTone, target, meta };
    case 21: case 22: case 27: case 28:
      return { label, value: modifier === undefined ? 'n/a' : `${signedNumber(modifier, 2)}m/s`, tone, valueTone, target, meta };
    case 31:
      return { label, value: modifier === undefined ? 'n/a' : `${signedNumber(modifier, 2)}m/s²`, tone, valueTone, target, meta };
    default:
      return { label, value: fallbackValue, tone, valueTone, target, meta };
  }
}
