/**
 * Uma picker data for parents entry. Phase 2 contract: the gameData loader
 * gains `umas: UmaRecord[]` + `umaById` (landing concurrently with this
 * feature). The defensive cast keeps the feature compiling and rendering an
 * empty picker until/unless that loader change is present — it becomes a
 * plain pass-through once it lands.
 */
import { useMemo } from 'react';
import type { UmaRecord } from '@/core/types';
import { useGameData, type GameData } from '@/features/data/gameData';

type GameDataWithUmas = GameData & {
  umas?: UmaRecord[];
  umaById?: Map<string, UmaRecord>;
};

export interface UmaData {
  umas: UmaRecord[];
  umaById: Map<string, UmaRecord>;
}

export function useUmas(): UmaData {
  const data = useGameData() as GameDataWithUmas;
  const { umas, umaById } = data;
  return useMemo(() => {
    const list: UmaRecord[] = umas ?? [];
    return {
      umas: list,
      umaById: umaById ?? new Map(list.map((u) => [u.umaId, u])),
    };
  }, [umas, umaById]);
}

export function umaName(umaById: Map<string, UmaRecord>, umaId: string): string {
  return umaById.get(umaId)?.nameEn ?? `Uma ${umaId}`;
}
