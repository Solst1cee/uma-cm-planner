/** Lazy-load public/data/affinity.json → AffinityIndex (memoised at module
 *  scope). null while loading or on failure (tiles then show affinity as "—"). */
import { useEffect, useState } from 'react';
import { buildAffinityIndex, type AffinityIndex } from '@/core/affinity';
import type { AffinityGroup } from '@/core/types';

let cached: AffinityIndex | null = null;
let inflight: Promise<AffinityIndex | null> | null = null;

function load(): Promise<AffinityIndex | null> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = fetch(`${import.meta.env.BASE_URL}data/affinity.json`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
    .then((j: { groups: AffinityGroup[] }) => {
      cached = buildAffinityIndex(j.groups);
      return cached;
    })
    .catch(() => { inflight = null; return null; });
  return inflight;
}

export function useAffinityIndex(): AffinityIndex | null {
  const [idx, setIdx] = useState<AffinityIndex | null>(cached);
  useEffect(() => {
    if (idx) return;
    let cancelled = false;
    void load().then((built) => { if (!cancelled) setIdx(built); });
    return () => { cancelled = true; };
  }, [idx]);
  return idx;
}
