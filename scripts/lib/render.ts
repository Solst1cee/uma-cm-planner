import { execFileSync } from 'node:child_process';
import { accessSync } from 'node:fs';

const CHROME_CANDIDATES = [
  process.env['CHROME_PATH'],
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter((p): p is string => Boolean(p));

/** Headless-render a URL's final DOM (runs JS). Build-time/local only — needs Chrome + network. */
export function renderDom(url: string): string {
  const chrome = CHROME_CANDIDATES.find((p) => {
    try { accessSync(p); return true; } catch { return false; }
  });
  if (!chrome) throw new Error('Chrome not found; set CHROME_PATH');
  return execFileSync(
    chrome,
    ['--headless', '--disable-gpu', '--no-sandbox', '--virtual-time-budget=8000', '--dump-dom', url],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
}
