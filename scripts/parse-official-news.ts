/**
 * Pure parser for umamusume.com/news/ Svelte-rendered HTML.
 * Source: https://umamusume.com/news/ (headless-rendered via scripts/lib/render.ts)
 * Retrieved: 2026-06-15
 */
import type { NewsItem } from '@/core/types';

/**
 * Extract each `<li class="news-item …">` block's id, date, title, category.
 *
 * Markup pattern (Svelte):
 *   <a class="news-card …" href="/news/826">
 *     <dl …>
 *       <dd …><span …>Game<!----></span> <time …>2026/06/14&nbsp;22:00&nbsp;(UTC)<!----></time></dd>
 *       <dt …>Some Title<!----></dt>
 *     </dl>
 *   </a>
 */
export function parseOfficialNews(html: string): NewsItem[] {
  // Match each news card block; use non-greedy to avoid crossing items.
  // The block starts at <a class="news-card …" href="/news/<id>"> and ends before the next </a>
  const blockRe = /<a[^>]*class="news-card[^"]*"[^>]*href="\/news\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g;

  const seen = new Set<string>();
  const items: NewsItem[] = [];

  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    const id = m[1]!;
    if (seen.has(id)) continue;
    seen.add(id);

    const block = m[2]!;

    // Extract <time>…<!----></time> — content may contain &nbsp; between parts
    const timeMatch = block.match(/<time[^>]*>([\s\S]*?)<!----><\/time>/);
    if (!timeMatch) continue;
    const rawTime = timeMatch[1]!;
    // Decode &nbsp; and grab the YYYY/MM/DD prefix
    const decoded = rawTime.replace(/&nbsp;/g, ' ').replace(/ /g, ' ');
    const datePrefixMatch = decoded.match(/(\d{4})\/(\d{2})\/(\d{2})/);
    if (!datePrefixMatch) continue;
    const date = `${datePrefixMatch[1]}-${datePrefixMatch[2]}-${datePrefixMatch[3]}`;

    // Extract <dt …>Title<!----></dt>
    const dtMatch = block.match(/<dt[^>]*>([\s\S]*?)<!----><\/dt>/);
    if (!dtMatch) continue;
    const title = decodeHtmlEntities(stripTags(dtMatch[1]!)).trim();
    if (!title) continue;

    // Extract <span …>Category<!----></span> inside <dd>
    const spanMatch = block.match(/<dd[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<!----><\/span>/);
    const category = spanMatch ? decodeHtmlEntities(stripTags(spanMatch[1]!)).trim() : undefined;

    items.push({
      id,
      title,
      date,
      url: `https://umamusume.com/news/${id}/`,
      ...(category ? { category } : {}),
    });
  }

  // Sort descending by date, then by numeric id descending (stable tiebreak)
  items.sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date);
    if (dateCmp !== 0) return dateCmp;
    return Number(b.id) - Number(a.id);
  });

  return items;
}

/** Remove all HTML tags from a string. */
function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

/** Decode common HTML entities. */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/ /g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'");
}
