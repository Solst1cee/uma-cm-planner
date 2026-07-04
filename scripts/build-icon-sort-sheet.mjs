// Generate a self-contained HTML sheet of every skill icon (image + its skills +
// rarity/server + placed-vs-unlisted in ICON_SUBCATEGORIES), for hand-ordering
// the icon-sort scheme in src/features/inheritance/skillSort.ts.
//
// Usage:  node scripts/build-icon-sort-sheet.mjs [outFile]
//   default outFile: tmp-tools/skill-icon-sort-sheet.html
//
// Run it after a data refresh: any NEW icon shows as UNLISTED (amber). The hard
// gate is the coverage test in skillSort.test.ts; this sheet is the visual aid
// for deciding where a new icon goes. See docs/skill-icon-sort-workflow.md.
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const REPO = process.cwd();
const OUT = process.argv[2] ?? join(REPO, 'tmp-tools', 'skill-icon-sort-sheet.html');

const skills = JSON.parse(readFileSync(join(REPO, 'public/data/skills.json'), 'utf8'));
const sortSrc = readFileSync(join(REPO, 'src/features/inheritance/skillSort.ts'), 'utf8');

// --- parse ICON_SUBCATEGORIES: string[][] = [ ['10011','10012'], ... ] ---
const block = sortSrc.match(/ICON_SUBCATEGORIES:\s*string\[\]\[\]\s*=\s*\[([\s\S]*?)\n\];/);
if (!block) throw new Error('could not locate ICON_SUBCATEGORIES in skillSort.ts');
const rows = [];
for (const m of block[1].matchAll(/\[([^\]]*)\]/g)) {
  const ids = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  if (ids.length) rows.push(ids);
}
const iconRank = new Map();
rows.forEach((ids, i) => ids.forEach((id) => iconRank.set(id, i)));

const byIcon = new Map();
for (const s of skills) {
  const k = s.iconId ?? '(none)';
  if (!byIcon.has(k)) byIcon.set(k, []);
  byIcon.get(k).push(s);
}

const RARITY_ORDER = { unique: 0, inherited_unique: 1, gold: 2, white: 3 };
const iconB64 = (id) => {
  const p = join(REPO, 'public/data/icons/skill', `${id}.webp`);
  return existsSync(p) ? 'data:image/webp;base64,' + readFileSync(p).toString('base64') : null;
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const icons = [...byIcon.keys()].sort((a, b) => (a === '(none)' ? 1 : b === '(none)' ? -1 : Number(a) - Number(b)));
let listedCount = 0, unlistedCount = 0, missingImg = 0;

const skillLines = (list) =>
  [...list]
    .sort((a, b) => (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9) || a.nameEn.localeCompare(b.nameEn))
    .map((s) => {
      const jp = s.server === 'jp' ? '<span class="jp">JP</span>' : '';
      return `<div class="sk r-${esc(s.rarity)}"><span class="dot"></span>${esc(s.nameEn)} ${jp}<span class="rar">${esc(s.rarity)}</span></div>`;
    })
    .join('');

function card(id) {
  const list = byIcon.get(id);
  const listed = iconRank.has(id);
  if (id !== '(none)') listed ? listedCount++ : unlistedCount++;
  const img = id === '(none)' ? null : iconB64(id);
  if (id !== '(none)' && !img) missingImg++;
  const allUnique = list.every((s) => s.rarity === 'unique' || s.rarity === 'inherited_unique');
  const anyJp = list.some((s) => s.server === 'jp');
  const allJp = list.every((s) => s.server === 'jp');
  const badge = listed
    ? `<span class="badge ok">placed · row ${iconRank.get(id)}</span>`
    : `<span class="badge warn">UNLISTED</span>`;
  const uniqTag = allUnique ? `<span class="badge inert">unique · inert</span>` : '';
  const jpTag = allJp ? `<span class="badge jpb">JP-only</span>` : anyJp ? `<span class="badge jpb">has JP</span>` : '';
  const imgHtml = img
    ? `<img src="${img}" width="42" height="42" alt="">`
    : `<div class="noimg" title="no icon file">?</div>`;
  return `<div class="card ${listed ? 'is-listed' : 'is-unlisted'}" data-listed="${listed}" data-unique="${allUnique}">
    <div class="chead">${imgHtml}<div class="cmeta"><code class="iid">${esc(id)}</code>${badge}${uniqTag}${jpTag}</div></div>
    <div class="skills">${skillLines(list)}</div>
  </div>`;
}

const orderStrip = rows
  .map((ids, i) => {
    const cells = ids
      .map((id) => {
        const img = iconB64(id);
        const t = byIcon.get(id)?.[0]?.nameEn ?? '';
        return img
          ? `<span class="ocell" title="${esc(id)} — ${esc(t)}"><img src="${img}" width="26" height="26" alt=""><code>${esc(id)}</code></span>`
          : `<span class="ocell missing" title="${esc(id)}"><code>${esc(id)}</code></span>`;
      })
      .join('');
    return `<div class="orow"><span class="oidx">${i}</span>${cells}</div>`;
  })
  .join('');

const cards = icons.map(card).join('');

const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Skill icon sort sheet</title>
<style>
:root{--bg:#0f1115;--bg2:#181b22;--bg3:#20242e;--fg:#e6e8ee;--mut:#98a0b0;--bd:#2c313d;--ok:#3fb56b;--warn:#e0a23f;--jp:#8b7be0;--acc:#5aa0ff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:13px/1.4 system-ui,Segoe UI,Roboto,sans-serif}
header{position:sticky;top:0;z-index:5;background:var(--bg2);border-bottom:1px solid var(--bd);padding:.75rem 1rem;display:flex;gap:1rem;align-items:center;flex-wrap:wrap}
h1{font-size:1rem;margin:0}.stats{color:var(--mut);font-size:.8rem}.stats b{color:var(--fg)}
.filters{margin-left:auto;display:flex;gap:.35rem}
button{background:var(--bg3);color:var(--fg);border:1px solid var(--bd);border-radius:7px;padding:.35rem .7rem;cursor:pointer;font:inherit}
button.on{background:var(--acc);border-color:var(--acc);color:#04101f;font-weight:600}
.wrap{padding:1rem}
details{background:var(--bg2);border:1px solid var(--bd);border-radius:9px;margin:0 0 1rem;padding:.5rem .75rem}
summary{cursor:pointer;font-weight:600}
.order{display:flex;flex-direction:column;gap:.3rem;margin-top:.6rem}
.orow{display:flex;gap:.3rem;align-items:center;flex-wrap:wrap;padding:.15rem 0;border-bottom:1px dashed var(--bd)}
.oidx{width:1.6rem;color:var(--mut);text-align:right;font-variant-numeric:tabular-nums}
.ocell{display:inline-flex;align-items:center;gap:.25rem;background:var(--bg3);border:1px solid var(--bd);border-radius:6px;padding:.1rem .35rem}
.ocell code{font-size:.72rem;color:var(--mut)}.ocell.missing{opacity:.5}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:.7rem}
.card{background:var(--bg2);border:1px solid var(--bd);border-radius:9px;padding:.6rem;display:flex;flex-direction:column;gap:.45rem}
.card.is-unlisted{border-color:var(--warn);box-shadow:0 0 0 1px rgba(224,162,63,.25)}
.chead{display:flex;gap:.55rem;align-items:center}
.chead img{border-radius:7px;background:#fff2;flex:none}
.noimg{width:42px;height:42px;border-radius:7px;background:var(--bg3);border:1px dashed var(--bd);display:flex;align-items:center;justify-content:center;color:var(--mut);flex:none}
.cmeta{display:flex;flex-direction:column;gap:.25rem;min-width:0}
.iid{font-size:.95rem;font-weight:700;letter-spacing:.02em}
.badge{display:inline-block;font-size:.68rem;padding:.05rem .4rem;border-radius:5px;width:max-content}
.badge.ok{background:rgba(63,181,107,.15);color:var(--ok);border:1px solid rgba(63,181,107,.4)}
.badge.warn{background:rgba(224,162,63,.15);color:var(--warn);border:1px solid rgba(224,162,63,.5)}
.badge.inert{background:rgba(152,160,176,.15);color:var(--mut);border:1px solid rgba(152,160,176,.4)}
.badge.jpb{background:rgba(139,123,224,.15);color:var(--jp);border:1px solid rgba(139,123,224,.45)}
.skills{display:flex;flex-direction:column;gap:.15rem;max-height:220px;overflow:auto}
.sk{display:flex;align-items:center;gap:.35rem;font-size:.78rem;padding:.05rem 0}
.sk .dot{width:6px;height:6px;border-radius:50%;flex:none;background:var(--mut)}
.sk.r-unique .dot,.sk.r-inherited_unique .dot{background:#e6b800}
.sk.r-gold .dot{background:#f0a030}.sk.r-white .dot{background:#cfd6e4}
.sk .rar{margin-left:auto;color:var(--mut);font-size:.66rem}
.sk .jp{background:rgba(139,123,224,.2);color:var(--jp);font-size:.6rem;padding:0 .25rem;border-radius:3px}
body.f-unlisted .card.is-listed{display:none}
body.f-listed .card.is-unlisted{display:none}
</style></head><body>
<header>
  <h1>Skill icon sort sheet</h1>
  <div class="stats"><b>${byIcon.size}</b> distinct icons · <b>${listedCount}</b> placed · <b>${unlistedCount}</b> unlisted${missingImg ? ` · <b>${missingImg}</b> no icon file` : ''}</div>
  <div class="filters">
    <button data-f="all" class="on">All</button>
    <button data-f="unlisted">Unlisted only</button>
    <button data-f="listed">Placed only</button>
  </div>
</header>
<div class="wrap">
  <details><summary>Current ICON_SUBCATEGORIES order (${rows.length} rows) — extend this in skillSort.ts</summary>
    <div class="order">${orderStrip}</div>
  </details>
  <div class="grid">${cards}</div>
</div>
<script>
const b=document.body,btns=[...document.querySelectorAll('.filters button')];
btns.forEach(x=>x.onclick=()=>{btns.forEach(y=>y.classList.toggle('on',y===x));
b.classList.remove('f-unlisted','f-listed');if(x.dataset.f!=='all')b.classList.add('f-'+x.dataset.f);});
</script>
</body></html>`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html);
console.log(`wrote ${OUT}: ${byIcon.size} icons, ${listedCount} placed, ${unlistedCount} unlisted, ${missingImg} missing img`);
