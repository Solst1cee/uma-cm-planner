/** Shared shape: a source's Global availability + whether it's a projection. */
export interface DateEntry {
  date: string;
  predicted: boolean;
}

/**
 * Earliest Global availability of a JP skill = the minimum date across its
 * source cards + umas. Ties resolve to the announced (non-predicted) entry.
 * Returns { predicted: false } with no releaseDate when no source is dated.
 */
export function resolveJpSkillDate(
  cardIds: readonly string[],
  umaIds: readonly string[],
  cardDates: ReadonlyMap<string, DateEntry>,
  umaDates: ReadonlyMap<string, DateEntry>,
): { releaseDate?: string; predicted: boolean } {
  const entries: DateEntry[] = [];
  for (const id of cardIds) {
    const e = cardDates.get(id);
    if (e) entries.push(e);
  }
  for (const id of umaIds) {
    const e = umaDates.get(id);
    if (e) entries.push(e);
  }
  if (entries.length === 0) return { predicted: false };
  // Earliest date wins; on a tie, announced (predicted:false) beats projected.
  entries.sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : Number(a.predicted) - Number(b.predicted),
  );
  const best = entries[0]!;
  return { releaseDate: best.date, predicted: best.predicted };
}
