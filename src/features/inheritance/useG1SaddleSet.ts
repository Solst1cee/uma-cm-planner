// src/features/inheritance/useG1SaddleSet.ts
/**
 * Lazy-load the G1 saddle id whitelist → Set<string>.
 * Returns an empty set on failure (win-bonus stays 0 — safe).
 *
 * Import path note: data-overrides/g1_saddle_ids.json lives OUTSIDE src/, which
 * is the tsconfig rootDir boundary.  Vite allows out-of-root imports but tsc
 * --noEmit rejects them when `include` is ["src", ...].  The JSON is therefore
 * COPIED to src/features/inheritance/g1_saddle_ids.json and imported from
 * there; data-overrides/g1_saddle_ids.json remains the P5 hand-patch source
 * and should be kept in sync (or a data:build step can refresh the copy).
 */
import g1 from './g1_saddle_ids.json';

export function useG1SaddleSet(): ReadonlySet<string> {
  return new Set((g1 as { g1SaddleIds?: string[] }).g1SaddleIds ?? []);
}
