// Diff two umalator-global master.mdb skill extracts on sim-relevant fields.
//
// Usage:
//   node scripts/rebalance-datamine/diff-skills.mjs <before.json> <after.json>
//
// Each argument is a `skills.json` extract (id -> record) pulled from the
// upstream `jalbarrang/umalator-global` clone's git history — one per game-data
// snapshot. Prints a human-readable per-skill diff of every sim-relevant change
// (precondition / condition / baseDuration / cooldownTime / effect list). Use it
// to eyeball a patch before generating override entries with gen-rebalances.mjs.
//
// See ./README.md for the full "next Global patch" workflow.
import { readFileSync } from 'node:fs';

const [beforePath, afterPath] = process.argv.slice(2);
if (!beforePath || !afterPath) {
  console.error('usage: node diff-skills.mjs <before.json> <after.json>');
  process.exit(1);
}
const pre = JSON.parse(readFileSync(beforePath, 'utf8'));
const post = JSON.parse(readFileSync(afterPath, 'utf8'));

// Normalize the sim-relevant shape of one skill record.
function simShape(s) {
  return (s.alternatives ?? []).map((a) => ({
    pre: a.precondition ?? '',
    cond: a.condition ?? '',
    dur: a.baseDuration,
    cd: a.cooldownTime,
    fx: (a.effects ?? []).map((e) => ({ t: e.type, m: e.modifier, tg: e.target })),
  }));
}

const preIds = new Set(Object.keys(pre));
const postIds = new Set(Object.keys(post));

const added = [...postIds].filter((id) => !preIds.has(id));
const removed = [...preIds].filter((id) => !postIds.has(id));
const changed = [];

for (const id of preIds) {
  if (!postIds.has(id)) continue;
  const a = JSON.stringify(simShape(pre[id]));
  const b = JSON.stringify(simShape(post[id]));
  if (a !== b) changed.push(id);
}

console.log(`pre: ${preIds.size} skills, post: ${postIds.size} skills`);
console.log(`added (new releases): ${added.length}`, added.map((i) => `${i} ${post[i].name}`).slice(0, 50));
console.log(`removed: ${removed.length}`, removed);
console.log(`CHANGED (sim-relevant): ${changed.length}\n`);

for (const id of changed) {
  const p = pre[id], q = post[id];
  console.log(`=== ${id} ${q.name} (rarity ${q.rarity}) ===`);
  const pa = p.alternatives ?? [], qa = q.alternatives ?? [];
  const n = Math.max(pa.length, qa.length);
  for (let i = 0; i < n; i++) {
    const x = pa[i], y = qa[i];
    if (!x) { console.log(`  alt[${i}] ADDED: ${JSON.stringify(y)}`); continue; }
    if (!y) { console.log(`  alt[${i}] REMOVED: ${JSON.stringify(x)}`); continue; }
    if ((x.precondition ?? '') !== (y.precondition ?? ''))
      console.log(`  alt[${i}] precondition: "${x.precondition}" -> "${y.precondition}"`);
    if ((x.condition ?? '') !== (y.condition ?? ''))
      console.log(`  alt[${i}] condition:\n    - ${x.condition}\n    + ${y.condition}`);
    if (x.baseDuration !== y.baseDuration)
      console.log(`  alt[${i}] baseDuration: ${x.baseDuration} -> ${y.baseDuration}`);
    if (x.cooldownTime !== y.cooldownTime)
      console.log(`  alt[${i}] cooldownTime: ${x.cooldownTime} -> ${y.cooldownTime}`);
    const xf = x.effects ?? [], yf = y.effects ?? [];
    const m = Math.max(xf.length, yf.length);
    for (let j = 0; j < m; j++) {
      const e = xf[j], f = yf[j];
      if (!e || !f) { console.log(`  alt[${i}].fx[${j}]: ${JSON.stringify(e)} -> ${JSON.stringify(f)}`); continue; }
      if (e.type !== f.type || e.modifier !== f.modifier || e.target !== f.target)
        console.log(`  alt[${i}].fx[${j}]: type ${e.type} mod ${e.modifier} tgt ${e.target} -> type ${f.type} mod ${f.modifier} tgt ${f.target}`);
    }
  }
  console.log();
}
