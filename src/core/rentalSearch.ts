/** M1.4b — build rental-search deep-links (provenance §6). Deep-links only; no
 *  scraping/API. Each clause's legacyMin→"own/legacy" bucket, totalMin→"total".
 *
 * ENCODING RESEARCH (2026-07-06) — see docs/provenance.md §6 "M1.4b encoding
 * confirmation" for the full write-up. Summary of what is/isn't confirmed:
 *
 * Shared factorId space (uma.moe + ChronoGenesis, per provenance §6's own
 * cross-reference "Factor IDs shared with uma.moe (Speed=10, Turf=110,
 * Long=340…)"), CONFIRMED against uma.moe's open-source frontend
 * (github.com/uma-moe/umamoe-frontend, commit 38924bb,
 * src/app/components/database-filter/database-filter.component.ts lines
 * 438-452 — a hardcoded literal list): blue = stat*10 (spd 10 … wit 50),
 * pink = aptitude-group*10 (turf 110, dirt 120, front 210, pace 220,
 * late 230, end 240, sprint 310, mile 320, medium 330, long 340). This is
 * exactly "the inverse of factorDecode.ts, ÷10" the brief predicted, and it
 * is now source-confirmed, not just inferred.
 *
 * White/green factorId — UNCONFIRMED, DROPPED (do not guess). The same
 * umamoe-frontend source (database-filter.component.ts:648-649) shows
 * white/green options are populated from `factors.json`/the "factors" REST
 * resource (master-data.service.ts → ResourceDataService, fetched live from
 * uma.moe's own API at runtime) — an opaque server-assigned id table that is
 * NOT checked into the frontend repo and has no visible arithmetic relation
 * to our skillId space (unlike blue/pink, which the source hardcodes as a
 * simple stat/aptitude-group multiple). Fetching that live endpoint would be
 * scraping a running API, which is out of scope here. So: white and green
 * clauses are not encoded for uma.moe, and (since ChronoGenesis explicitly
 * shares uma.moe's factorId space per provenance) not for ChronoGenesis
 * either. Both report them via `dropped`.
 *
 * anyBlue (aggregate "N+ total blue stars, any stat") — no equivalent field
 * exists in uma.moe's filter component (searched for blue_count/anyBlue/
 * blueTotal-shaped fields; none found — only per-stat b/p/g/w triplets) →
 * dropped for uma.moe. ChronoGenesis DOES expose it: provenance §6 lists a
 * `blue_count` key, and the brief states directly "anyBlue maps to
 * blue_count on ChronoGenesis" → encoded there, not dropped.
 *
 * ChronoGenesis leg_/tot_ buckets: provenance's inner-key list names spark
 * buckets `leg_`/`sla_`/`slb_`/`tot_` + a mode suffix `All|Any|Excl`. `leg_`
 * and `tot_` line up 1:1 with our own SparkFilter `legacyMin`/`totalMin`
 * fields; `sla_`/`slb_` have no confirmed meaning and are not used. Every
 * SparkFilter clause here is an AND-clause (src/core/sparkFilter.ts header),
 * so the `All` mode suffix is used throughout (deliberate, not a guess).
 * Multi-value encoding (repeated keys via URLSearchParams.append) is our own
 * reasonable choice — provenance names the keys but not the literal
 * multi-value wire syntax.
 *
 * pure-db — no public frontend source (closed-source SPA; provenance's
 * capture is a real-browser static/URL analysis only, and even that capture
 * says "hand-constructed payloads render but weren't fully verifiable
 * server-side"). Confirmed structurally from provenance: payload keys
 * `gameServerCode, partnerCardIds, supportCardId, blueFactors, redFactors,
 * greenFactors, …`; factor entries `{groupId, count(1-3), searchType:0|1|2,
 * enabled}`; blue groupId 1-5 (direct stat index, NOT ×10 — matches
 * factorDecode.ts's raw stat numbers); red(pink) groupId banded
 * 11-12/21-24/31-34 (direct aptitude-group number, NOT ×10 — matches
 * factorDecode.ts's raw group numbers). UNCONFIRMED and best-effort/flagged:
 * (a) `count`'s 1-3 range does not match our totalMin's 0-9 scale — it is
 * very likely a distinct "raw single-instance star level" concept, not the
 * blended total; clamped `Math.min(3, Math.max(1, totalMin || 1))` as a
 * lossy approximation (imprecise for totalMin > 3); (b) `searchType`'s 0|1|2
 * meaning is not documented anywhere — defaulted to `2`; (c)
 * `gameServerCode`'s exact enum string is not captured — defaulted to
 * `'GLOBAL'`; (d) `supportCardId` is assumed (not confirmed) to be the
 * search-subject/trainee card id, by elimination — it's the only singular
 * id-shaped key besides the plural `partnerCardIds`, and uma.moe's
 * equivalent single-id param is named `trainer_id`. green/white keys are not
 * named in provenance's capture at all → dropped, same as the other sites.
 * ALL pure-db choices above are flagged for the human's live-browser
 * check (deferred — see the task report); nothing here should be treated as
 * verified.
 */
import type { SparkFilter } from '@/core/sparkFilter';
import type { Stat } from '@/core/types';

export interface SearchArgs {
  filters: SparkFilter[];
  traineeCardId: string;
  partnerCardId?: string;
}

// Shared factorId space — CONFIRMED from uma-moe/umamoe-frontend
// src/app/components/database-filter/database-filter.component.ts:438-452
// (also used, per provenance §6, by ChronoGenesis's `leg_`/`tot_` buckets).
const BLUE_FACTOR_ID: Record<Stat, number> = { spd: 10, sta: 20, pow: 30, gut: 40, wit: 50 };
const PINK_FACTOR_ID: Record<string, number> = {
  turf: 110,
  dirt: 120,
  front: 210,
  pace: 220,
  late: 230,
  end: 240,
  sprint: 310,
  mile: 320,
  medium: 330,
  long: 340,
};

// pure-db's OWN groupId space — CONFIRMED (structurally) from docs/provenance.md
// §6: "blue groupIds 1–5, red banded 11-12/21-24/31-34" — the raw
// factorDecode.ts stat/aptitude-group numbers, no ×10 scaling.
const BLUE_GROUP: Record<Stat, number> = { spd: 1, sta: 2, pow: 3, gut: 4, wit: 5 };
const PINK_GROUP: Record<string, number> = {
  turf: 11,
  dirt: 12,
  front: 21,
  pace: 22,
  late: 23,
  end: 24,
  sprint: 31,
  mile: 32,
  medium: 33,
  long: 34,
};

function b64(json: unknown): string {
  return encodeURIComponent(globalThis.btoa(JSON.stringify(json)));
}

function clampStar(n: number): number {
  return Math.min(9, Math.max(1, Math.trunc(n) || 1));
}

/** uma.moe — `https://uma.moe/database?filters=<b64(json)>&trainer_id=…`.
 *  Encodes blue/pink (confirmed). Drops white/green (opaque server-side
 *  factor-id table, unconfirmed) and anyBlue (no aggregate field found). */
export function umaMoeUrl({ filters, traineeCardId }: SearchArgs): { url: string; dropped: SparkFilter[] } {
  const b: number[][] = [];
  const p: number[][] = [];
  const dropped: SparkFilter[] = [];

  for (const f of filters) {
    if (f.kind === 'blue') b.push([BLUE_FACTOR_ID[f.stat], clampStar(f.totalMin), 9]);
    else if (f.kind === 'pink') {
      const factorId = PINK_FACTOR_ID[f.aptitude];
      if (factorId === undefined) dropped.push(f);
      else p.push([factorId, clampStar(f.totalMin), 9]);
    }
    else dropped.push(f);
  }

  const payload: Record<string, unknown> = { lb: 4 };
  if (b.length) payload.b = b;
  if (p.length) payload.p = p;

  const url = `https://uma.moe/database?filters=${b64(payload)}&trainer_id=${encodeURIComponent(traineeCardId)}`;
  return { url, dropped };
}

interface PureDbFactorEntry {
  groupId: number;
  count: number;
  searchType: number;
  enabled: boolean;
}

function pureDbEntry(groupId: number, totalMin: number): PureDbFactorEntry {
  return { groupId, count: Math.min(3, Math.max(1, totalMin || 1)), searchType: 2, enabled: true };
}

/** pure-db — `https://uma.pure-db.com/{locale}/search?searchInfo=<b64(json)>`.
 *  Encodes blue/pink groupIds (structurally confirmed); the `count`/
 *  `searchType`/`gameServerCode`/`supportCardId` values are best-effort, see
 *  the module header — flagged for the human's live-browser check. Drops
 *  white/green (no key documented) and anyBlue (no aggregate field
 *  documented). */
export function pureDbUrl({ filters, traineeCardId, partnerCardId }: SearchArgs): { url: string; dropped: SparkFilter[] } {
  const blueFactors: PureDbFactorEntry[] = [];
  const redFactors: PureDbFactorEntry[] = [];
  const dropped: SparkFilter[] = [];

  for (const f of filters) {
    if (f.kind === 'blue') blueFactors.push(pureDbEntry(BLUE_GROUP[f.stat], f.totalMin));
    else if (f.kind === 'pink') {
      const groupId = PINK_GROUP[f.aptitude];
      if (groupId === undefined) dropped.push(f);
      else redFactors.push(pureDbEntry(groupId, f.totalMin));
    }
    else dropped.push(f);
  }

  const payload: Record<string, unknown> = {
    gameServerCode: 'GLOBAL', // UNCONFIRMED exact enum string — see header
    supportCardId: traineeCardId, // UNCONFIRMED semantics — see header
    partnerCardIds: partnerCardId ? [partnerCardId] : [],
  };
  if (blueFactors.length) payload.blueFactors = blueFactors;
  if (redFactors.length) payload.redFactors = redFactors;

  const url = `https://uma.pure-db.com/en-us/search?searchInfo=${b64(payload)}`;
  return { url, dropped };
}

/** ChronoGenesis — `https://chronogenesis.net/friend_search?query=<b64(inner
 *  querystring)>`. Encodes blue/pink into `leg_All`/`tot_All` (shared
 *  factorId space, confirmed) and anyBlue into `blue_count` (confirmed by
 *  the brief). Drops white/green (opaque factorId space, unconfirmed). */
export function chronoGenesisUrl({ filters, traineeCardId }: SearchArgs): { url: string; dropped: SparkFilter[] } {
  const inner = new URLSearchParams();
  inner.set('card_id', traineeCardId);
  const dropped: SparkFilter[] = [];

  const addBucket = (factorId: number, legacyMin: number, totalMin: number): void => {
    if (legacyMin > 0) inner.append('leg_All', String(factorId * 10 + clampStar(legacyMin)));
    if (totalMin > 0) inner.append('tot_All', String(factorId * 10 + clampStar(totalMin)));
  };

  for (const f of filters) {
    if (f.kind === 'blue') addBucket(BLUE_FACTOR_ID[f.stat], f.legacyMin, f.totalMin);
    else if (f.kind === 'pink') {
      const factorId = PINK_FACTOR_ID[f.aptitude];
      if (factorId === undefined) dropped.push(f);
      else addBucket(factorId, f.legacyMin, f.totalMin);
    }
    else if (f.kind === 'anyBlue') inner.set('blue_count', String(f.totalMin));
    else dropped.push(f);
  }

  const url = `https://chronogenesis.net/friend_search?query=${encodeURIComponent(globalThis.btoa(inner.toString()))}`;
  return { url, dropped };
}
