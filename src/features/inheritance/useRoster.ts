import { useCallback, useSyncExternalStore } from 'react';
import type { Parent, SkillRecord } from '@/core/types';
import { bulkUpsertParents, getSetting, listParents, setSetting } from '@/db';
import { useGameData } from '@/features/data/gameData';
import { parseUmaExtractor, type ParseDeps } from './umaExtractor';

/** jsdom (vitest) lacks File.text() — fall back to FileReader when absent. */
function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('File could not be read.'));
    reader.readAsText(file);
  });
}

export const ROSTER_IMPORTED_AT_KEY = 'umaExtractorImportedAt';

/** group base g → first white (rarity 'white') skill id in g+1..g+9. */
export function makeWhiteResolver(skills: SkillRecord[]): ParseDeps['resolveWhiteSkill'] {
  const byId = new Map(skills.map((s) => [s.skillId, s]));
  return (groupBase) => {
    for (let d = 1; d <= 9; d++) {
      const cand = String(groupBase + d);
      if (byId.get(cand)?.rarity === 'white') return cand;
    }
    return undefined;
  };
}

// Shared module-level store so every useRoster() instance (the Upload button +
// the card) stays in sync — an import refreshes the whole page, no reload.
interface RosterState { roster: Parent[]; importedAt: string | null }
let store: RosterState = { roster: [], importedAt: null };
let loaded = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}
async function reload(): Promise<void> {
  const [rows, ts] = await Promise.all([listParents(), getSetting<string>(ROSTER_IMPORTED_AT_KEY)]);
  store = { roster: rows, importedAt: ts ?? null };
  loaded = true;
  emit();
}
function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (!loaded) void reload();
  return () => listeners.delete(cb);
}

export function useRoster() {
  const { skills } = useGameData();
  const snap = useSyncExternalStore(subscribe, () => store);

  const importFromFile = useCallback(
    async (file: File): Promise<{ added: number; skipped: number }> => {
      const json: unknown = JSON.parse(await readFileText(file));
      const { parents, skipped } = parseUmaExtractor(json, { resolveWhiteSkill: makeWhiteResolver(skills) });
      const added = await bulkUpsertParents(parents);
      await setSetting(ROSTER_IMPORTED_AT_KEY, new Date().toISOString());
      await reload(); // refresh the shared store → every instance re-renders
      return { added, skipped };
    },
    [skills],
  );

  return { roster: snap.roster, importedAt: snap.importedAt, importFromFile };
}
