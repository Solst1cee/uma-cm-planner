import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseOfficialNews } from './parse-official-news';

const html = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '__fixtures__/official-news.html'), 'utf8');

describe('parseOfficialNews', () => {
  const items = parseOfficialNews(html);
  it('extracts ≥5 items with id, ISO date, title, url', () => {
    expect(items.length).toBeGreaterThanOrEqual(5);
    for (const it of items.slice(0, 5)) {
      expect(it.id).toMatch(/^\d+$/);
      expect(it.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(it.url).toBe(`https://umamusume.com/news/${it.id}/`);
      expect(it.title.length).toBeGreaterThan(0);
      expect(it.title).not.toMatch(/[<>]|&nbsp;/); // tags + entities stripped
    }
  });
  it('captures a known recent id (800-899 family) with a 2026-06 date', () => {
    const recent = items.find((i) => Number(i.id) >= 800 && Number(i.id) < 900);
    expect(recent).toBeDefined();
    expect(recent!.date.startsWith('2026-06')).toBe(true);
  });
});
