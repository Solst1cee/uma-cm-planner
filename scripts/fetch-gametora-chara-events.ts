/**
 * Fetch GameTora character pages (training-event data) for every uma in
 * public/data/umas.json, cached to scripts/borrowed/gametora-chara/<umaId>.json.
 *
 * ⚠️ PROVENANCE PATH B (docs/provenance.md §10): GameTora data, owner-authorized
 * for the maintainer's PRIVATE build only. Raw snapshots stay gitignored
 * (scripts/borrowed/gametora-chara/). Endpoint pattern mirrors the vendored
 * upstream's own fetch-event-skill-sources.ts (characters instead of supports).
 *
 * Usage: pnpm tsx scripts/fetch-gametora-chara-events.ts [--force]
 * Then:  pnpm tsx scripts/build-uma-event-details.ts
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { BORROWED_DIR, PUBLIC_DATA_DIR, readJson } from './lib/io';

const GAMETORA_BASE = 'https://gametora.com';
const UA = 'uma-cm-planner-private/0.1 (personal build planner; single maintainer)';
const CONCURRENCY = 4;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

const CACHE_DIR = join(BORROWED_DIR, 'gametora-chara');

interface DaftuydaUma { UmaId: string; UmaSlug: string }
interface UmaRecordLite { umaId: string; nameEn: string }

async function fetchText(url: string): Promise<string> {
  const resp = await fetch(url, { headers: { 'user-agent': UA } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
  return resp.text();
}

async function fetchBuildId(): Promise<string> {
  const html = await fetchText(`${GAMETORA_BASE}/umamusume/characters`);
  const match = html.match(/"buildId":"([^"]+)"/);
  if (!match?.[1]) throw new Error('Could not find GameTora buildId in page HTML');
  return match[1];
}

async function fetchWithRetry(url: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchText(url);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }
  throw lastErr;
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const umas = readJson<UmaRecordLite[]>(join(PUBLIC_DATA_DIR, 'umas.json'));
  const daftuyda = readJson<DaftuydaUma[]>(join(BORROWED_DIR, 'daftuyda', 'uma_data.json'));
  const slugById = new Map(daftuyda.map((u) => [String(u.UmaId), u.UmaSlug]));

  mkdirSync(CACHE_DIR, { recursive: true });
  const targets = umas
    .map((u) => ({ umaId: u.umaId, nameEn: u.nameEn, slug: slugById.get(u.umaId) }))
    .filter((t): t is { umaId: string; nameEn: string; slug: string } => {
      if (!t.slug) console.warn(`no slug for ${t.umaId} ${t.nameEn} — skipped`);
      return !!t.slug;
    })
    .filter((t) => force || !existsSync(join(CACHE_DIR, `${t.umaId}.json`)));

  if (targets.length === 0) {
    console.log('all character pages already cached (use --force to refetch)');
    return;
  }
  const buildId = await fetchBuildId();
  console.log(`buildId ${buildId}; fetching ${targets.length} character pages…`);

  let done = 0;
  let failed = 0;
  const queue = [...targets];
  const worker = async () => {
    for (;;) {
      const t = queue.shift();
      if (!t) return;
      const url = `${GAMETORA_BASE}/_next/data/${buildId}/umamusume/characters/${t.slug}.json`;
      try {
        const body = await fetchWithRetry(url);
        JSON.parse(body); // sanity: cache only valid JSON
        writeFileSync(join(CACHE_DIR, `${t.umaId}.json`), body, 'utf8');
      } catch (err) {
        failed++;
        console.warn(`FAILED ${t.umaId} ${t.slug}: ${(err as Error).message}`);
      }
      done++;
      if (done % 20 === 0) console.log(`  ${done}/${targets.length}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`done: ${done - failed} fetched, ${failed} failed → ${CACHE_DIR}`);
  // touch a marker so the reader can report snapshot age
  writeFileSync(join(CACHE_DIR, '_fetched_at.txt'), `${new Date().toISOString()}\n`, 'utf8');
}

const entry = process.argv[1] ?? '';
if (entry.endsWith('fetch-gametora-chara-events.ts')) {
  void main();
}

export { CACHE_DIR };
