// Render each design spec (and any markdown passed as a glob) to a styled, dark-themed
// sibling .html for offline re-reading. Reproducible: re-run `pnpm specs:html` after edits.
// Markdown -> HTML via `marked` (GFM tables/code); a TOC + .md->.html link rewriting added.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC_DIR = path.join(ROOT, 'docs/superpowers/specs');

// Allow `node scripts/render-specs.mjs <dir>` to target another folder (e.g. plans/).
const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : SPEC_DIR;

marked.setOptions({ gfm: true, breaks: false });

function slugify(text) {
  return text
    .replace(/<[^>]+>/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Inject heading ids + collect a TOC (h2/h3). Returns { html, toc }. */
function addAnchorsAndToc(html) {
  const used = new Map();
  const toc = [];
  const out = html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_m, level, inner) => {
    let slug = slugify(inner) || 'section';
    const n = used.get(slug) ?? 0;
    used.set(slug, n + 1);
    if (n) slug = `${slug}-${n}`;
    const lvl = Number(level);
    if (lvl === 2 || lvl === 3) toc.push({ lvl, slug, text: inner.replace(/<[^>]+>/g, '') });
    return `<h${level} id="${slug}">${inner}<a class="anchor" href="#${slug}" aria-label="link">#</a></h${level}>`;
  });
  return { html: out, toc };
}

/** Relative cross-spec links point at .md siblings; rewrite to the rendered .html. */
function rewriteMdLinks(html) {
  return html.replace(/href="([^"]+?)\.md(#[^"]*)?"/g, 'href="$1.html$2"');
}

function tocHtml(toc) {
  if (!toc.length) return '';
  const items = toc
    .map((t) => `<li class="lvl${t.lvl}"><a href="#${t.slug}">${t.text}</a></li>`)
    .join('\n');
  return `<details class="toc" open><summary>Contents</summary><ul>${items}</ul></details>`;
}

const STYLE = `
:root{--bg:#0e1014;--panel:#1a1f2b;--line:#2a3142;--text:#e7eaf0;--muted:#9aa6ba;--faint:#6b7689;
--pink:#ff5fa2;--teal:#2dd4bf;--blue:#58a6ff;--done:#3fb950;--warn:#e3b341;--radius:12px;}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:72px}
body{margin:0;color:var(--text);font:15.5px/1.68 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
-webkit-font-smoothing:antialiased;
background:radial-gradient(1200px 600px at 80% -10%,rgba(255,95,162,.10),transparent 60%),
radial-gradient(900px 500px at -10% 10%,rgba(45,212,191,.08),transparent 55%),var(--bg);}
a{color:var(--blue);text-decoration:none}a:hover{text-decoration:underline}
header.bar{position:sticky;top:0;z-index:50;backdrop-filter:blur(12px);background:rgba(14,16,20,.82);border-bottom:1px solid var(--line)}
.bar-inner{max-width:960px;margin:0 auto;padding:11px 24px;display:flex;align-items:center;gap:12px;justify-content:space-between}
.bar-inner .title{font-weight:650;font-size:14px;color:var(--text)}
.bar-inner .meta{font-size:12px;color:var(--faint)}
main{max-width:960px;margin:0 auto;padding:28px 24px 120px}
h1,h2,h3,h4{line-height:1.25;font-weight:680;scroll-margin-top:72px}
h1{font-size:1.85em;margin:.2em 0 .6em;background:linear-gradient(90deg,var(--pink),var(--teal));-webkit-background-clip:text;background-clip:text;color:transparent}
h2{font-size:1.32em;margin:1.9em 0 .5em;padding-bottom:.3em;border-bottom:1px solid var(--line)}
h3{font-size:1.1em;margin:1.5em 0 .4em;color:#cbd5e6}
h4{font-size:1em;margin:1.3em 0 .3em;color:var(--muted)}
.anchor{margin-left:.4em;color:var(--faint);opacity:0;font-weight:400;text-decoration:none}
h1:hover .anchor,h2:hover .anchor,h3:hover .anchor{opacity:1}
p,li{color:var(--text)}
strong{color:#fff}
em{color:var(--muted)}
code{font-family:ui-monospace,"SF Mono","Cascadia Code",Consolas,monospace;font-size:.86em;background:rgba(255,255,255,.06);padding:.12em .42em;border-radius:5px;color:#d7e2f1}
pre{background:#11151d;border:1px solid var(--line);border-radius:var(--radius);padding:14px 16px;overflow:auto}
pre code{background:none;padding:0;color:#d7e2f1;font-size:.85em;line-height:1.55}
blockquote{margin:1em 0;padding:.4em 1em;border-left:3px solid var(--teal);background:rgba(45,212,191,.06);border-radius:0 8px 8px 0;color:var(--muted)}
table{border-collapse:collapse;width:100%;margin:1em 0;font-size:.92em;display:block;overflow-x:auto}
th,td{border:1px solid var(--line);padding:7px 11px;text-align:left;vertical-align:top}
th{background:rgba(255,255,255,.04);color:#cbd5e6;font-weight:620}
tr:nth-child(even) td{background:rgba(255,255,255,.018)}
hr{border:none;border-top:1px solid var(--line);margin:2em 0}
ul,ol{padding-left:1.4em}
li{margin:.22em 0}
.toc{margin:0 0 2em;background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:8px 16px}
.toc summary{cursor:pointer;font-weight:620;color:var(--muted);padding:6px 0}
.toc ul{list-style:none;padding-left:0;margin:.4em 0 .6em;columns:2;column-gap:28px}
.toc li{margin:.18em 0;break-inside:avoid}
.toc li.lvl3{padding-left:1.1em;font-size:.92em}
.toc a{color:var(--muted)}.toc a:hover{color:var(--blue)}
@media(max-width:680px){.toc ul{columns:1}}
`;

function pageHtml(title, bodyHtml, toc, srcName) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${title}</title>
<style>${STYLE}</style>
</head>
<body>
<header class="bar"><div class="bar-inner"><span class="title">${title}</span><span class="meta">${srcName} · rendered from markdown</span></div></header>
<main>
${tocHtml(toc)}
${bodyHtml}
</main>
</body>
</html>`;
}

function firstH1(md, fallback) {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1].replace(/[*_`]/g, '').trim() : fallback;
}

const files = readdirSync(targetDir).filter((f) => f.endsWith('.md'));
if (!files.length) {
  console.error(`[render-specs] no .md files in ${targetDir}`);
  process.exit(1);
}

for (const file of files) {
  const md = readFileSync(path.join(targetDir, file), 'utf8');
  const title = firstH1(md, file.replace(/\.md$/, ''));
  const rendered = marked.parse(md);
  const { html, toc } = addAnchorsAndToc(rendered);
  const final = pageHtml(title, rewriteMdLinks(html), toc, file);
  const outPath = path.join(targetDir, file.replace(/\.md$/, '.html'));
  writeFileSync(outPath, final);
  console.log('[render-specs] wrote', path.relative(ROOT, outPath));
}
