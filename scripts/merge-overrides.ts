/**
 * Generic override merge (P5: hand-patchable data). Each
 * data-overrides/*_overrides.json declares its target dataset and patches
 * generated records by id; overrides are applied LAST in the build and always
 * win. Unknown record ids are a build error so upstream drift is caught the
 * moment a refresh removes something an override still references.
 *
 * Merge semantics (documented in data-overrides/README.md):
 * - plain objects merge recursively, override keys win;
 * - arrays whose elements are objects sharing an identity key (skillId /
 *   cardId / id) merge element-wise by that key (first match patched,
 *   unmatched override elements appended);
 * - all other values (scalars, mixed arrays) are replaced wholesale;
 * - keys starting with '_' (e.g. "_comment") are documentation and stripped.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readJson } from './lib/io';

export interface OverrideFile {
  /** Dataset name, e.g. "skills" → patches the records destined for public/data/skills.json. */
  _target: string;
  _comment?: string;
  records: Record<string, Record<string, unknown>>;
}

export interface LoadedOverrideFile extends OverrideFile {
  fileName: string;
}

const ELEMENT_ID_KEYS = ['skillId', 'cardId', 'id'] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Deep-copy with documentation keys ('_'-prefixed) stripped. */
function stripMeta(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripMeta);
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (!k.startsWith('_')) out[k] = stripMeta(v);
    }
    return out;
  }
  return value;
}

function arrayIdentityKey(base: unknown[], patch: unknown[]): string | undefined {
  for (const key of ELEMENT_ID_KEYS) {
    const all = (arr: unknown[]): boolean =>
      arr.length > 0 && arr.every((el) => isPlainObject(el) && el[key] !== undefined);
    if (all(base) && all(patch)) return key;
  }
  return undefined;
}

function mergeArray(base: unknown[], patch: unknown[]): unknown[] {
  const key = arrayIdentityKey(base, patch);
  if (key === undefined) return stripMeta(patch) as unknown[];
  const out = [...base];
  for (const element of patch) {
    const patchEl = element as Record<string, unknown>;
    const index = out.findIndex((b) => isPlainObject(b) && b[key] === patchEl[key]);
    if (index >= 0) out[index] = mergeValue(out[index], patchEl);
    else out.push(stripMeta(patchEl));
  }
  return out;
}

function mergeObject(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (k.startsWith('_')) continue;
    out[k] = k in base ? mergeValue(base[k], v) : stripMeta(v);
  }
  return out;
}

function mergeValue(base: unknown, patch: unknown): unknown {
  if (Array.isArray(base) && Array.isArray(patch)) return mergeArray(base, patch);
  if (isPlainObject(base) && isPlainObject(patch)) return mergeObject(base, patch);
  return stripMeta(patch);
}

/**
 * Apply one override file to a generated dataset. Returns new records;
 * throws if an override id doesn't exist in the generated data.
 */
export function applyOverrides<T extends object>(
  records: T[],
  overrides: OverrideFile,
  idKey: string,
  sourceName: string,
): T[] {
  const indexById = new Map<string, number>();
  records.forEach((record, i) => {
    indexById.set(String((record as Record<string, unknown>)[idKey]), i);
  });

  const out = [...records];
  for (const [id, patch] of Object.entries(overrides.records)) {
    const index = indexById.get(id);
    if (index === undefined) {
      throw new Error(
        `${sourceName}: override targets unknown ${idKey} "${id}" ` +
          `(target "${overrides._target}") — generated data drifted out from under this override.`,
      );
    }
    out[index] = mergeObject(out[index] as Record<string, unknown>, patch) as T;
  }
  return out;
}

/** Read all data-overrides/*_overrides.json, sorted by filename for determinism. */
export function loadOverrideFiles(overridesDir: string): LoadedOverrideFile[] {
  const files = readdirSync(overridesDir)
    .filter((f) => f.endsWith('_overrides.json'))
    .sort();
  return files.map((fileName) => {
    const parsed = readJson<OverrideFile>(join(overridesDir, fileName));
    if (typeof parsed._target !== 'string' || !isPlainObject(parsed.records)) {
      throw new Error(`${fileName}: override files need a string "_target" and an object "records"`);
    }
    return { ...parsed, fileName };
  });
}
