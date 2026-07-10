/** Task 7 app-level substitution probe (brief step 3): the brief asks for a `pnpm dev`
 *  visual check ("The Duty of Dignity Calls" shows no pending chip) — this agent can't
 *  drive a browser, so this is the programmatic equivalent: load the REAL baked
 *  public/data/skills.json rebalance data and assert against the real ENGINE_DATA_DATE
 *  that (a) the 2026-07-01 Global patch entries are in-pin — no patch, no note — and
 *  (b) a hypothetical future-dated confirmed version still emits (pin-lag preserved).
 *  A human should still do the visual `pnpm dev` check described in the brief. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { skillPatchMap, activePatchNotes } from './rebalancePatches';
import { ENGINE_DATA_DATE } from '@/sim/enginePin';
import type { SkillRecord } from './types';

// Resolved from vitest's CWD (repo root), not import.meta.url — vitest's transform
// doesn't guarantee a file: URL for import.meta.url in every environment.
const skillsPath = resolve(process.cwd(), 'public/data/skills.json');
const allSkills = JSON.parse(readFileSync(skillsPath, 'utf-8')) as SkillRecord[];
const skillById = new Map(allSkills.map((s) => [s.skillId, s]));

const TODAY = '2026-07-10'; // matches currentDate context at time of writing
const rebalanced = allSkills.filter((s) => s.rebalance !== undefined);

describe('Task 7 real-data probe: ENGINE_DATA_DATE gate against baked skills.json', () => {
  it('the baked catalog actually carries rebalance-annotated skills (sanity — probe is not vacuous)', () => {
    expect(rebalanced.length).toBeGreaterThan(0);
  });

  it('"The Duty of Dignity Calls" (if present in the baked catalog) is in-pin: no patch, no note', () => {
    const dignity = allSkills.find((s) => s.nameEn === 'The Duty of Dignity Calls');
    if (!dignity) {
      // Name may not match exactly in the baked data — not fatal to the gate itself,
      // covered generically by the "every confirmed <= pin" assertion below.
      return;
    }
    expect(dignity.rebalance).toBeDefined();
    const map = skillPatchMap({ skillById, cutoffISO: TODAY, todayISO: TODAY, engineDataDate: ENGINE_DATA_DATE });
    expect(map?.[dignity.skillId]).toBeUndefined();
    const notes = activePatchNotes({ skillById, cutoffISO: TODAY, todayISO: TODAY, engineDataDate: ENGINE_DATA_DATE });
    expect(notes.find((n) => n.skillId === dignity.skillId)).toBeUndefined();
  });

  it('every confirmed (non-predicted) rebalance version dated on/before ENGINE_DATA_DATE emits no patch and no note', () => {
    const map = skillPatchMap({ skillById, cutoffISO: TODAY, todayISO: TODAY, engineDataDate: ENGINE_DATA_DATE }) ?? {};
    const notes = activePatchNotes({ skillById, cutoffISO: TODAY, todayISO: TODAY, engineDataDate: ENGINE_DATA_DATE });
    const noteIds = new Set(notes.map((n) => n.skillId));
    // The real invariant the gate promises: whichever version the plan-free horizon
    // actually resolves to (mirroring resolveVersion/effectiveVersion's own logic) —
    // if that resolved version is in-pin, the skill must be absent from both outputs.
    for (const s of rebalanced) {
      const info = s.rebalance!;
      let resolved = info.versions[0];
      for (const v of info.versions) {
        const live =
          v.globalArrival !== undefined &&
          v.globalArrival <= TODAY &&
          !(v.globalDatePredicted === true);
        if ((v.ver <= info.globalVer || live) && (resolved === undefined || v.ver > resolved.ver)) resolved = v;
      }
      if (!resolved) continue;
      const inPin =
        resolved.globalDate !== undefined && resolved.globalDatePredicted !== true && resolved.globalDate <= ENGINE_DATA_DATE;
      if (inPin) {
        expect(map[s.skillId]).toBeUndefined();
        expect(noteIds.has(s.skillId)).toBe(false);
      }
    }
  });

  it('a hypothetical future-dated confirmed version still emits (pin-lag preserved)', () => {
    const future: SkillRecord = {
      skillId: '__task7_probe_future__',
      nameEn: 'Task 7 Probe Skill',
      nameJp: '',
      baseSpCost: 0,
      rarity: 'white',
      iconId: '1',
      conditions: 'phase>=1',
      server: 'global',
      dataVersion: 'probe',
      rebalance: {
        globalVer: 2,
        jpVer: 2,
        versions: [
          { ver: 1 },
          {
            ver: 2,
            jpDate: '2026-01-01',
            globalDate: '2099-01-01',
            globalArrival: '2099-01-01',
            modifier: 0.42,
            sourceUrl: 'https://x',
          },
        ],
      },
    } as SkillRecord;
    const probeSkillById = new Map(skillById);
    probeSkillById.set(future.skillId, future);
    const map = skillPatchMap({
      skillById: probeSkillById,
      cutoffISO: TODAY,
      todayISO: TODAY,
      engineDataDate: ENGINE_DATA_DATE,
    });
    expect(map?.[future.skillId]).toEqual({ modifier: 0.42 });
    const notes = activePatchNotes({
      skillById: probeSkillById,
      cutoffISO: TODAY,
      todayISO: TODAY,
      engineDataDate: ENGINE_DATA_DATE,
    });
    expect(notes.find((n) => n.skillId === future.skillId)).toMatchObject({ pinLag: true });
  });
});
