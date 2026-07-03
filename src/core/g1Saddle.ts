/**
 * M1.7 — filter raw UmaExtractor win-saddle ids down to G1-only before they
 * reach the 2.0 win-bonus (mechanics-notes §8: only shared G1 wins score
 * +3 each; G2/G3 + Triple-Crown/Tiara titles give 0). The G1 id set is
 * hand-patchable data (data-overrides/g1_saddle_ids.json, P5). An empty set
 * yields 0 win-bonus — the safe under-count, never a fabricated win.
 */
export function isG1Saddle(saddleId: string, g1Set: ReadonlySet<string>): boolean {
  return g1Set.has(saddleId);
}

export function filterG1(wonRaces: string[] | undefined, g1Set: ReadonlySet<string>): string[] {
  if (!wonRaces) return [];
  return wonRaces.filter((id) => g1Set.has(id));
}
