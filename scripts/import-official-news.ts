import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATA_VERSION } from './fetch-borrowed';
import { renderDom } from './lib/render';
import { parseOfficialNews } from './parse-official-news';
import { classifyNews } from '@/core/newsMatch';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = renderDom('https://umamusume.com/news/');
const items = parseOfficialNews(html).map((it) => ({ ...it, kind: classifyNews(it.title) }));
const out = { dataVersion: DATA_VERSION, items };
mkdirSync(path.join(ROOT, 'public/data'), { recursive: true });
writeFileSync(path.join(ROOT, 'public/data/official_news.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`official_news.json: ${items.length} items (${items.filter((i) => i.kind === 'cm').length} cm)`);
