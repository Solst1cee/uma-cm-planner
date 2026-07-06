// src/core/sparkFilter.ts
/** The AND-clause spark filter shape (M1.4 picker + M1.4b rental draft). Pure
 *  type — the runtime matchers live in features/inheritance/sparkFilter.ts. */
import type { Stat } from '@/core/types';

export type SparkFilter =
  | { id: string; kind: 'blue'; stat: Stat; legacyMin: number; totalMin: number }
  | { id: string; kind: 'pink'; aptitude: string; legacyMin: number; totalMin: number }
  | { id: string; kind: 'white'; skillId: string; legacyMin: number; totalMin: number }
  | { id: string; kind: 'green'; skillId: string; legacyMin: number; totalMin: number }
  | { id: string; kind: 'anyBlue'; totalMin: number };
