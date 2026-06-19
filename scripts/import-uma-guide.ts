/**
 * Importer: uma.guide/cm-schedule/ → public/data/cm_tracks.json
 *
 * Fetches the uma.guide CM schedule page, parses the Vue SSR HTML,
 * and writes the structured CM#→track mapping to the static data directory.
 *
 * Run via: tsx scripts/import-uma-guide.ts
 * (Invoked by pnpm timeline:import — do NOT run directly during CI/build.)
 *
 * Source: https://uma.guide/cm-schedule/
 * Per docs/provenance.md scraping exception (private use, 2026-06-15):
 * uma.guide is a permissive feed OK for maintainer private use.
 * Switch to curated JSON before public release.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_VERSION } from './fetch-borrowed';
import { parseUmaGuideSchedule } from './parse-uma-guide';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await fetch('https://uma.guide/cm-schedule/').then((r) => r.text());
const tracks = parseUmaGuideSchedule(html);
const out = { dataVersion: DATA_VERSION, tracks };
mkdirSync(path.join(ROOT, 'public/data'), { recursive: true });
writeFileSync(path.join(ROOT, 'public/data/cm_tracks.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`cm_tracks.json: ${tracks.length} CMs`);
