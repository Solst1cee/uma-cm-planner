/** Module-level cached JSON fetches for the M1 page's lazy datasets
 *  (card effects, uma events, skill categories/details …). The page used to
 *  refetch + re-parse all six files on every route remount; caching the
 *  promise per URL makes remounts free (same pattern as
 *  src/features/cm-planner/skillTechnicalDetails.ts's collection promises).
 *  Failures are NOT cached — a rejected fetch clears its entry so a later
 *  mount can retry. */
const jsonCache = new Map<string, Promise<unknown>>();

export function fetchJsonCached<T>(url: string): Promise<T> {
  const cached = jsonCache.get(url);
  if (cached) return cached as Promise<T>;
  const p = fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
    return r.json() as Promise<unknown>;
  });
  // Don't cache rejections (allow retry); swallow here — callers attach their own .catch.
  p.catch(() => jsonCache.delete(url));
  jsonCache.set(url, p);
  return p as Promise<T>;
}

/** Test hook: reset the cache so tests with different fetch mocks stay isolated. */
export function __clearJsonCacheForTests(): void {
  jsonCache.clear();
}
