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

/** uma.moe / ChronoGenesis green (unique) factorId — LIVE-DERIVED (2026-07-06)
 *  from working URLs: `Let's Pump Some Iron!` (100271) → 1027010, `Moving Past`
 *  (100591) → 1059010. factorId = `10` + (nativeId−base, 3-digit) + variant + `0`.
 *  Inherited-unique 9xxxxx normalizes to the native 1xxxxx form first. */
function greenFactorId(skillId: string): number | undefined {
  const native = skillId.length === 6 && skillId.startsWith('9') ? `1${skillId.slice(1)}` : skillId;
  if (!/^1[01]0\d{3}$/.test(native)) return undefined; // native unique: 100xxx | 110xxx
  const variant = native.startsWith('110') ? 2 : 1;
  const middle = Number(native) - (variant === 2 ? 110001 : 100001);
  if (middle < 0 || middle > 999) return undefined;
  return Number(`10${String(middle).padStart(3, '0')}${variant}0`);
}

/** uma.moe / ChronoGenesis white (skill) factorId — LIVE-DERIVED: `Long Corners`
 *  (201181/201182) → 201180, `Nimble Navigator` (200492) → 200490. factorId =
 *  floor(skillId/10)*10 — drops the ◎/○ variant digit so both circles group. */
function whiteFactorId(skillId: string): number | undefined {
  const n = Number(skillId);
  return Number.isInteger(n) && n > 0 ? Math.floor(n / 10) * 10 : undefined;
}

/** uma.moe — `https://uma.moe/database?filters=<b64(json)>`. Verified live against
 *  the frontend bundle (spikes/repos/spike6/umamoe_database.js): the serializer
 *  keys are `b/p/g/w` = TOTAL-across-lineage filters and `mb/mp/mg/mw` = the
 *  veteran's OWN ("main"/legacy) filters, each `[factorId, min, max]`. So a
 *  clause's legacyMin routes to the main key, its totalMin to the non-main key.
 *  Encodes blue/pink/green(g/mg)/white(w/mw) — green/white factorIds live-derived
 *  (see greenFactorId/whiteFactorId). Only anyBlue drops (no aggregate field).
 *  No `lb` (that's selectedLimitBreak — over-filters)
 *  and no `trainer_id` (that param is a TRAINER-ACCOUNT id, not a uma card id;
 *  passing the uma id there returns nothing — the trainee is chosen on-site). */
export function umaMoeUrl({ filters }: SearchArgs): { url: string; dropped: SparkFilter[] } {
  const b: number[][] = [], p: number[][] = [], g: number[][] = [], w: number[][] = [];
  const mb: number[][] = [], mp: number[][] = [], mg: number[][] = [], mw: number[][] = [];
  const dropped: SparkFilter[] = [];

  // own (legacy) stars → main key; total-across-lineage stars → non-main key.
  const route = (own: number[][], total: number[][], factorId: number, f: { legacyMin: number; totalMin: number }) => {
    if (f.legacyMin > 0) own.push([factorId, clampStar(f.legacyMin), 9]);
    if (f.totalMin > f.legacyMin) total.push([factorId, clampStar(f.totalMin), 9]);
  };
  const routeFid = (own: number[][], total: number[][], fid: number | undefined, f: SparkFilter & { legacyMin: number; totalMin: number }) => {
    if (fid === undefined) dropped.push(f);
    else route(own, total, fid, f);
  };

  for (const f of filters) {
    if (f.kind === 'blue') route(mb, b, BLUE_FACTOR_ID[f.stat], f);
    else if (f.kind === 'pink') routeFid(mp, p, PINK_FACTOR_ID[f.aptitude], f);
    else if (f.kind === 'green') routeFid(mg, g, greenFactorId(f.skillId), f);
    else if (f.kind === 'white') routeFid(mw, w, whiteFactorId(f.skillId), f);
    else dropped.push(f); // anyBlue — no aggregate field
  }

  const payload: Record<string, unknown> = {};
  if (b.length) payload.b = b;
  if (p.length) payload.p = p;
  if (g.length) payload.g = g;
  if (w.length) payload.w = w;
  if (mb.length) payload.mb = mb;
  if (mp.length) payload.mp = mp;
  if (mg.length) payload.mg = mg;
  if (mw.length) payload.mw = mw;

  const url = `https://uma.moe/database?filters=${b64(payload)}`;
  return { url, dropped };
}

interface PureDbFactorEntry {
  groupId: number;
  count: number;
  searchType: number;
  enabled: boolean;
}

/** pure-db — `https://uma.pure-db.com/{locale}/search?searchInfo=<b64(json)>`.
 *  LIVE-VERIFIED (2026-07-06) against a real working URL: `blueFactors` groupId =
 *  stat index (1-5), `redFactors` groupId = aptitude group (11/12/21-24/31-34),
 *  `count` = the actual star count, `searchType` 0 = normal/total · 1 = legacy
 *  (own). green → `greenFactors` (groupId = uma.moe greenFactorId / 10, e.g.
 *  100271 → 102701); white → `commonSkillFactors` (groupId = floor(skillId/10),
 *  e.g. 201182 → 20118) — both LIVE-VERIFIED. The site expects the full field set
 *  below (`gameServerCode:'global'` lowercase). Only anyBlue drops. */
export function pureDbUrl({ filters }: SearchArgs): { url: string; dropped: SparkFilter[] } {
  const blueFactors: PureDbFactorEntry[] = [];
  const redFactors: PureDbFactorEntry[] = [];
  const greenFactors: PureDbFactorEntry[] = [];
  const commonSkillFactors: PureDbFactorEntry[] = [];
  const dropped: SparkFilter[] = [];

  // legacyMin → an own (searchType 1) factor; totalMin beyond it → a normal/total
  // (searchType 0) factor. count is the star value as-is (a legacy spark that also
  // counts to total emits both, e.g. mile 3 legacy → one searchType-1 entry).
  const route = (arr: PureDbFactorEntry[], groupId: number, f: { legacyMin: number; totalMin: number }) => {
    if (f.legacyMin > 0) arr.push({ groupId, count: f.legacyMin, searchType: 1, enabled: true });
    if (f.totalMin > f.legacyMin) arr.push({ groupId, count: f.totalMin, searchType: 0, enabled: true });
  };
  const routeGid = (arr: PureDbFactorEntry[], gid: number | undefined, f: SparkFilter & { legacyMin: number; totalMin: number }) => {
    if (gid === undefined) dropped.push(f);
    else route(arr, gid, f);
  };
  const div10 = (n: number | undefined) => (n === undefined ? undefined : n / 10);

  for (const f of filters) {
    if (f.kind === 'blue') route(blueFactors, BLUE_GROUP[f.stat], f);
    else if (f.kind === 'pink') routeGid(redFactors, PINK_GROUP[f.aptitude], f);
    else if (f.kind === 'green') routeGid(greenFactors, div10(greenFactorId(f.skillId)), f);
    else if (f.kind === 'white') routeGid(commonSkillFactors, div10(whiteFactorId(f.skillId)), f);
    else dropped.push(f); // anyBlue
  }

  // Full payload shape from the verified working URL — pure-db expects every key.
  const payload = {
    gameServerCode: 'global',
    partnerCardIds: [] as number[],
    supportCardId: 0,
    supportCardLimitBreak: 4,
    excludeCardIds: [] as number[],
    excludeCardSearchType: 0,
    blueFactors,
    redFactors,
    greenFactors,
    commonSkillFactors,
    raceFactors: [] as PureDbFactorEntry[],
    scenarioFactors: [] as PureDbFactorEntry[],
    otherFactors: [] as PureDbFactorEntry[],
    whiteFactorCountConditions: [] as unknown[],
    winCount: 0,
    g1WinCount: 0,
    searchCount: 100,
    excludeFullFollowerUser: true,
    excludeArchivedChara: true,
  };

  const url = `https://uma.pure-db.com/en-us/search?searchInfo=${b64(payload)}`;
  return { url, dropped };
}

/** ChronoGenesis — `https://chronogenesis.net/friend_search?query=<b64(inner
 *  querystring)>`. LIVE-VERIFIED (2026-07-06): value = `factorId*10 + stars`
 *  (uma.moe factorId space); `leg_All` = own/legacy sparks, `tot_All` = total
 *  sparks; a legacy spark is emitted ONLY under `leg_All` (not duplicated into
 *  `tot_All`). White shares `leg_All`/`tot_All` (value = whiteFactorId*10+stars);
 *  green uses separate `legacy_green`/`totgrn_All` (value = greenFactorId*10+stars).
 *  `card_id` is left blank — the uma card id doesn't belong there (like uma.moe's
 *  trainer_id); the trainee is chosen on-site. anyBlue → `blue_count`. */
export function chronoGenesisUrl({ filters }: SearchArgs): { url: string; dropped: SparkFilter[] } {
  const leg: string[] = [], tot: string[] = [];        // blue/pink/white → leg_All/tot_All
  const legGrn: string[] = [], totGrn: string[] = [];  // green → legacy_green/totgrn_All
  const dropped: SparkFilter[] = [];
  let blueCount: number | undefined;

  // legacyMin → own bucket, totalMin (beyond legacy) → total bucket; value = factorId*10+stars.
  const addTo = (own: string[], total: string[], factorId: number, legacyMin: number, totalMin: number): void => {
    if (legacyMin > 0) own.push(String(factorId * 10 + clampStar(legacyMin)));
    if (totalMin > legacyMin) total.push(String(factorId * 10 + clampStar(totalMin)));
  };
  const addFid = (own: string[], total: string[], fid: number | undefined, f: SparkFilter & { legacyMin: number; totalMin: number }) => {
    if (fid === undefined) dropped.push(f);
    else addTo(own, total, fid, f.legacyMin, f.totalMin);
  };

  for (const f of filters) {
    if (f.kind === 'blue') addTo(leg, tot, BLUE_FACTOR_ID[f.stat], f.legacyMin, f.totalMin);
    else if (f.kind === 'pink') addFid(leg, tot, PINK_FACTOR_ID[f.aptitude], f);
    else if (f.kind === 'white') addFid(leg, tot, whiteFactorId(f.skillId), f);   // white shares leg_All/tot_All
    else if (f.kind === 'green') addFid(legGrn, totGrn, greenFactorId(f.skillId), f); // green: legacy_green/totgrn_All
    else if (f.kind === 'anyBlue') blueCount = f.totalMin;
    else dropped.push(f);
  }

  // Multiple sparks in a bucket are COMMA-joined into ONE param (verified live:
  // `tot_All=208,3206` for two total sparks), NOT repeated keys.
  const inner = new URLSearchParams();
  inner.set('card_id', '');
  if (tot.length) inner.set('tot_All', tot.join(','));
  if (leg.length) inner.set('leg_All', leg.join(','));
  if (totGrn.length) inner.set('totgrn_All', totGrn.join(','));
  if (legGrn.length) inner.set('legacy_green', legGrn.join(','));
  if (blueCount !== undefined) inner.set('blue_count', String(blueCount));

  const url = `https://chronogenesis.net/friend_search?query=${encodeURIComponent(globalThis.btoa(inner.toString()))}`;
  return { url, dropped };
}
