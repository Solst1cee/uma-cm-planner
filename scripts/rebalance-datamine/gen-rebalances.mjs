// Generate data-overrides/rebalances.json entries by diffing two umalator-global
// master.mdb skill extracts (the engine-pin snapshot vs. a post-patch snapshot).
//
// Usage:
//   node scripts/rebalance-datamine/gen-rebalances.mjs \
//     --pin <engine-pin-skills.json> \
//     --post <post-patch-skills.json> \
//     --global-date 2026-07-01 \
//     --source-url https://github.com/jalbarrang/umalator-global/commit/<sha> \
//     [--out rebalances-generated.json]
//
// Emits ver-2 entries (over a parameter-free ver-1 baseline) for every skill
// whose sim-relevant shape changed. Conservative policy — patch a value only
// when the engine's skillPatches format can faithfully express it:
//   - conditions: only if alternative count + all preconditions unchanged and no
//                 alternative's condition itself contains an inline '@'
//   - modifier:   only if every alternative has exactly 1 effect, effect
//                 structure unchanged, and every post value is the same value
//   - duration:   only if post durations are uniform across patchable alts
//   - cooldown:   same uniformity rule
// Everything else lands in `note` (honest, badge-only — no sim patch). These
// rules mirror the build-time guards in scripts/lib/rebalances.ts, so generated
// output bakes clean; see ./README.md for the workflow and rationale.
import { readFileSync, writeFileSync } from 'node:fs';

function arg(flag, required = true) {
  const i = process.argv.indexOf(flag);
  if (i === -1 || i === process.argv.length - 1) {
    if (required) { console.error(`missing required ${flag}`); process.exit(1); }
    return undefined;
  }
  return process.argv[i + 1];
}

const PIN_PATH = arg('--pin');
const POST_PATH = arg('--post');
const GLOBAL_DATE = arg('--global-date');
const SOURCE_URL = arg('--source-url');
const OUT_PATH = arg('--out', false) ?? 'rebalances-generated.json';

const pin = JSON.parse(readFileSync(PIN_PATH, 'utf8'));
const post = JSON.parse(readFileSync(POST_PATH, 'utf8'));

const fxKey = (e) => `${e.type}/${e.target}`;
const fmtFx = (e) => `type ${e.type} value ${e.modifier}`;

const entries = [];
const report = { full: [], partial: [], noteOnly: [] };

for (const id of Object.keys(pin).sort()) {
  const p = pin[id];
  const q = post[id];
  if (!q) continue;

  const pAlts = p.alternatives ?? [];
  const qAlts = q.alternatives ?? [];
  const pPatchable = pAlts.filter((a) => (a.condition ?? '') !== '');
  const qPatchable = qAlts.filter((a) => (a.condition ?? '') !== '');

  const shape = (alts) =>
    alts.map((a) => ({
      pre: a.precondition ?? '',
      cond: a.condition ?? '',
      dur: a.baseDuration,
      cd: a.cooldownTime,
      fx: (a.effects ?? []).map((e) => ({ t: e.type, m: e.modifier, tg: e.target })),
    }));
  if (JSON.stringify(shape(pAlts)) === JSON.stringify(shape(qAlts))) continue; // unchanged

  const ver2 = { ver: 2, globalDate: GLOBAL_DATE };
  const notes = [];
  let expressible = 0; // count of change-aspects we could patch
  let inexpressible = 0;

  const altStructureChanged = pAlts.length !== qAlts.length || pPatchable.length !== qPatchable.length;
  const precondChanged = !altStructureChanged &&
    pAlts.some((a, i) => (a.precondition ?? '') !== (qAlts[i].precondition ?? ''));
  const condChanged = altStructureChanged ||
    pAlts.some((a, i) => (a.condition ?? '') !== (qAlts[i]?.condition ?? ''));

  // The engine patch '@'-splits the conditions string and maps parts onto
  // alternatives positionally — a condition that itself CONTAINS '@' (inline OR
  // stored on one alternative, e.g. Pop & Polish) cannot round-trip through
  // that format. Such skills' condition changes are note-only.
  const embeddedAt = qPatchable.some((a) => a.condition.includes('@')) ||
    pPatchable.some((a) => a.condition.includes('@'));

  // --- conditions ---
  if (embeddedAt && (condChanged || precondChanged)) {
    inexpressible++;
    pAlts.forEach((a, i) => {
      const bc = a.condition ?? '', ac = qAlts[i]?.condition ?? '';
      if (bc !== ac) notes.push(`condition changed ("${bc}" -> "${ac}") — contains an inline '@' OR-alternative, not expressible by the '@'-split patch format`);
    });
  } else if (condChanged || precondChanged) {
    if (altStructureChanged) {
      inexpressible++;
      // describe added alternatives
      for (let i = pAlts.length; i < qAlts.length; i++) {
        const a = qAlts[i];
        notes.push(
          `patch adds a fallback alternative (cond "${a.condition}", ${a.effects.map(fmtFx).join(' + ')}) — engine patches cannot add alternatives`,
        );
      }
      if (qAlts.length <= pAlts.length) notes.push('alternative structure changed — conditions not patchable');
      // primary alternative's condition may still be patchable if preconditions on
      // the COMMON alts are unchanged and its condition changed
      const commonPrecondSame = pAlts.every((a, i) => i >= qAlts.length || (a.precondition ?? '') === (qAlts[i].precondition ?? ''));
      const commonCondChanged = pAlts.some((a, i) => i < qAlts.length && (a.condition ?? '') !== (qAlts[i].condition ?? ''));
      if (commonPrecondSame && commonCondChanged && qAlts.length > pAlts.length) {
        // safe: patch the pre-existing alternatives' conditions positionally
        ver2.conditions = qAlts.slice(0, pAlts.length).filter((a) => (a.condition ?? '') !== '').map((a) => a.condition).join('@');
        expressible++;
      }
    } else if (precondChanged) {
      inexpressible++;
      pAlts.forEach((a, i) => {
        const bp = a.precondition ?? '', ap = qAlts[i].precondition ?? '';
        if (bp !== ap) notes.push(`precondition changed ("${bp}" -> "${ap}") — engine patches cannot express preconditions, conditions left unpatched`);
        const bc = a.condition ?? '', ac = qAlts[i].condition ?? '';
        if (bc !== ac) notes.push(`condition changed ("${bc}" -> "${ac}") — left unpatched (tied to the precondition change)`);
      });
    } else if (condChanged) {
      ver2.conditions = qPatchable.map((a) => a.condition).join('@');
      expressible++;
    }
  }

  // --- effects (structure + values) over the alternatives both sides share ---
  const common = Math.min(pAlts.length, qAlts.length);
  let fxStructChanged = false;
  const fxValueChanges = []; // {alt, type, from, to}
  for (let i = 0; i < common; i++) {
    const pf = pAlts[i].effects ?? [], qf = qAlts[i].effects ?? [];
    if (pf.length !== qf.length || pf.some((e, j) => fxKey(e) !== fxKey(qf[j]))) {
      fxStructChanged = true;
      const before = pf.map(fmtFx).join(' + ') || '(none)';
      const after = qf.map(fmtFx).join(' + ') || '(none)';
      notes.push(`effect list changed on alt ${i + 1} (${before} -> ${after}) — not expressible by the engine patch`);
      continue;
    }
    pf.forEach((e, j) => {
      if (e.modifier !== qf[j].modifier) fxValueChanges.push({ alt: i, type: e.type, from: e.modifier, to: qf[j].modifier });
    });
  }
  if (fxStructChanged) inexpressible++;
  if (fxValueChanges.length > 0) {
    const maxFx = pAlts.reduce((m, a) => Math.max(m, (a.effects ?? []).length), 0);
    const postValues = new Set();
    for (let i = 0; i < common; i++) for (const e of qAlts[i].effects ?? []) postValues.add(e.modifier);
    if (!fxStructChanged && maxFx === 1 && postValues.size === 1) {
      ver2.modifier = [...postValues][0] / 10000;
      expressible++;
    } else {
      inexpressible++;
      for (const c of fxValueChanges) {
        notes.push(`effect value (type ${c.type}, alt ${c.alt + 1}) ${c.from} -> ${c.to} — multi-effect/multi-value skill, modifier patch would overwrite every effect (left unpatched)`);
      }
    }
  }

  // --- duration ---
  // When the effect list itself changed, the new duration belongs to the NEW
  // effects (e.g. a passive gaining a timed speed effect) — applying it to the
  // engine's old effect list would distort behavior. Note it instead.
  const durChanged = pAlts.some((a, i) => i < common && a.baseDuration !== qAlts[i].baseDuration);
  if (durChanged && fxStructChanged) {
    pAlts.forEach((a, i) => {
      if (i < common && a.baseDuration !== qAlts[i].baseDuration) {
        notes.push(`duration (alt ${i + 1}) ${a.baseDuration / 10000}s -> ${qAlts[i].baseDuration / 10000}s — belongs to the changed effect list, left unpatched`);
      }
    });
    inexpressible++;
  } else if (durChanged) {
    const postDurs = new Set(qAlts.slice(0, common).map((a) => a.baseDuration));
    if (postDurs.size === 1) {
      ver2.duration = [...postDurs][0] / 10000;
      expressible++;
    } else {
      inexpressible++;
      pAlts.forEach((a, i) => {
        if (i < common && a.baseDuration !== qAlts[i].baseDuration) {
          notes.push(`duration (alt ${i + 1}) ${a.baseDuration / 10000}s -> ${qAlts[i].baseDuration / 10000}s — post durations differ across alternatives (left unpatched)`);
        }
      });
    }
  }

  // --- cooldown ---
  const cdChanged = pAlts.some((a, i) => i < common && a.cooldownTime !== qAlts[i].cooldownTime);
  if (cdChanged && fxStructChanged) {
    notes.push('cooldown changed alongside an effect-list change — left unpatched');
    inexpressible++;
  } else if (cdChanged) {
    const postCds = new Set(qAlts.slice(0, common).map((a) => a.cooldownTime));
    if (postCds.size === 1) {
      ver2.cooldown = [...postCds][0] / 10000;
      expressible++;
    } else {
      inexpressible++;
      notes.push('cooldown changed non-uniformly across alternatives (left unpatched)');
    }
  }

  if (notes.length > 0) ver2.note = notes.join('; ');
  ver2.sourceUrl = SOURCE_URL;

  entries.push({ skillId: id, globalVer: 2, versions: [{ ver: 1 }, ver2] });
  const cls = inexpressible === 0 ? 'full' : expressible > 0 ? 'partial' : 'noteOnly';
  report[cls].push(`${id} ${q.name}`);
}

writeFileSync(OUT_PATH, JSON.stringify(entries, null, 2) + '\n');
console.log(`entries: ${entries.length}  ->  ${OUT_PATH}`);
console.log(`fully expressible: ${report.full.length}`);
console.log(`partial (patched + note): ${report.partial.length}`);
report.partial.forEach((s) => console.log('  P ' + s));
console.log(`note-only (no sim patch): ${report.noteOnly.length}`);
report.noteOnly.forEach((s) => console.log('  N ' + s));
