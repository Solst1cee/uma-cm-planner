import type { NewsItem } from './types';

const CUP = /(taurus|gemini|cancer|leo|virgo|libra|scorpio|sagittarius|capricorn|aquarius|pisces|aries)\s+cup/i;

export function classifyNews(title: string): NonNullable<NewsItem['kind']> {
  if (/champions?\s+meeting/i.test(title) || CUP.test(title)) return 'cm';
  if (/banner|scout|gacha|support card|new (uma|character)/i.test(title)) return 'banner';
  if (/balance|update|maintenance|adjustment|patch|version/i.test(title)) return 'patch';
  return 'other';
}

export function cupOf(title: string): string | undefined {
  const m = title.match(CUP);
  return m ? m[0].toLowerCase() : undefined;
}
