# Shared Data Model & Cross-Cutting Contracts

**Status:** Contract for writing-plans · **Date:** 2026-06-15 · **Owner:** Sun
**Why:** the four module specs (M4/M3/M1/M2) own *behavior*; this owns the *shared shapes*. It resolves the cross-spec consistency review (2026-06-15) — the root finding that no single canonical `CmPlan`/types declaration existed, so field shapes had drifted. **Transcribe this into `src/core/types.ts` as step 1 of implementation**, so `tsc` enforces it across all four modules. Module specs cite this file for any shared type.

---

## 1. Primitive tokens (canonical)
```ts
type Stat = 'spd' | 'sta' | 'pow' | 'gut' | 'wit';        // engine speed/stamina/power/guts/wisdom — map ONLY at the src/sim adapter
type Grade = 'G'|'F'|'E'|'D'|'C'|'B'|'A'|'S';             // 'S' included (career-start targets A; inheritance reaches S)
type Role = 'ace' | 'debuffer' | 'hybrid';                // UI labels: Ace / Debuffer / Hybrid
type Strategy = 'front' | 'pace' | 'late' | 'end';        // UI labels: Frontrunner / Pace Chaser / Late Surger / End Closer
type Mood = -2 | -1 | 0 | 1 | 2;                          // Awful…Great
type AptKey =
  | { kind: 'distance'; key: 'short' | 'mile' | 'medium' | 'long' }
  | { kind: 'surface';  key: 'turf' | 'dirt' }
  | { kind: 'strategy'; key: Strategy };
type CmId = `CM${number}`;                                // rule: cmNumber 14 -> 'CM14'
```
All cross-module tokens use these. `Strategy`/`Role` are stored as tokens; the UI maps to display labels. The L-cache key + `AptKey` strategy sub-key reuse the same `Strategy` token (no display-string drift).

## 2. Sparks
```ts
interface ParentSparks {
  pink:  Array<{ aptKey: AptKey; stars: 1|2|3 }>;
  blue:  Array<{ stat: Stat; stars: 1|2|3 }>;
  green: Array<{ uniqueSkillId: string; stars: 1|2|3 }>;
  white: Array<{ skillId: string; stars: 1|2|3 }>;
}
```

## 3. CmPlan — the cross-module SSOT (replaces the shipped `CmPlan`)
```ts
interface CmPlan {
  id: string;
  name: string;            // auto: "Plan #/CM#/Uma/Role/Strategy/remark"; editable (stops auto-fill once hand-edited)
  planNumber: number;
  remark?: string;
  cmRef: CmRef;
  scenarioId?: number;     // TRAINING scenario (e.g. Trackblazer) — distinct from the CM course (cmRef)
  umaId: string;
  uniqueSkillId: string;
  uniqueIsInherited?: boolean;        // native-runner vs inherited-version
  role: Role;
  strategy: Strategy;
  statProfile: { stats: Record<Stat, number>; mood: Mood };   // aptitudes are NOT here — see sparkGoals.pink
  sparkGoals: {
    pink: Array<{ aptKey: AptKey; target: Grade }>;           // CANONICAL target aptitudes; ALSO the L-sim's assumed aptitudes
    blue: Partial<Record<Stat, number>>;                      // target total spark stars (e.g. { pow: 9, sta: 9 })
  };
  wishlist: WishlistItem[];
  deck: OwnedCard[];
  parents: { a?: string; b?: string };                        // RosterEntry/Parent ids, resolved by M1
  inheritanceStopgap?: { inheritedSkills: string[]; sparks: ParentSparks };  // manual v1; IGNORED once `parents` set
  patch: { version: string; source?: string };               // stamped by M4 from M3 timeline; ≠ dataVersion
  server: 'global' | 'jp';
  dataVersion: string;
}
type CmRef = { cmId: CmId; cmNumber: number; courseId: string };
```
**Single-home rules** (resolve the duplicate-storage findings):
- **Target aptitude** lives once in `sparkGoals.pink`. `statProfile` holds only stats + mood; the L-sim reads aptitude grades from `sparkGoals.pink`. (M4 seeds it on plan creation; thereafter `sparkGoals.pink` is authoritative for both sim and inheritance.)
- **What-I'll-inherit** has one rule: `inheritanceStopgap` is the manual-v1 value; once M1 writes `parents`, M4 §3 sourcing and the §0 overlay read `parents` and ignore the stopgap.
- **Patch** is its own field (M3 supplies the timeline, M4 stamps the active version), distinct from `dataVersion` (local dataset build) and `server`.
- **`scenarioId`** stays (M4 scenario-skill filter, M2 build context need it); **SP budget** lives in M2's runtime input, not `CmPlan`.

## 4. WishlistItem (M4 owns; M1 sets flags; nobody re-declares)
```ts
interface WishlistItem {
  skillId: string;
  source: 'targeted';
  projectedL?: number;
  projectedLStale?: boolean;       // dataVersion mismatch -> recompute
  needsInheriting?: boolean;       // set by M1
  doubleUp?: boolean;              // set by M1 (target a white Parent A already has)
  manualAdd?: boolean;
}
```

## 5. RosterEntry & Parent (UmaExtractor roster — shared by M1 + M2)
```ts
interface RosterEntry {                       // UmaExtractor import target; OWN Dexie store; owned by M1
  id: string;
  umaId: string;
  stats: Record<Stat, number>;
  aptitudes: Array<{ aptKey: AptKey; grade: Grade }>;
  learnedSkills: string[];                     // skillIds — M2 uses as a compareBuilds opponent build
  sparks: ParentSparks;
  tags: string[];                              // user labels e.g. "CM12" — LIVES HERE (M2 search/compare), not on Parent
  source: 'mine' | 'friend_rental' | 'dummy';
  importSource: 'umaextractor' | 'paste' | 'roster' | 'dummy';
  trainerId?: string;
}
interface Parent {                             // M1 inheritance tree-node, DERIVED from a RosterEntry (or pasted/dummy)
  umaId: string;
  source: RosterEntry['source'];
  sparks: ParentSparks;
  grandparents: [Parent?, Parent?];            // 1-level nesting
  affinity?: { computed: number; override?: number };
  trainerId?: string;
}
```
- M1 **derives** `Parent` from a `RosterEntry`; M2 uses `RosterEntry` **directly** as a `compareBuilds` opponent; **tags edited on `RosterEntry`** only.
- Editable only when `source === 'dummy'`.
- **Generation rule:** a chosen veteran contributes itself + its 2 parents (→ the new tree's grandparents); its *own* grandparents are out of the new tree.
- **UmaExtractor caveat (both M1 + M2):** UmaExtractor reads the live game record — opt-in, ToS/ban-risk, **never required**; **manual entry is a first-class alternative**.

## 6. cm_schedule.json projection (M3 produces, M4 consumes)
Derived from `TimelineEntry where type === 'cm'` → emitted rows:
```ts
type CmScheduleRow = { date: string; cmId: CmId; name: string; courseId: string };  // courseId NON-optional on emitted rows
```
M4 §0 joins `plan.cmRef.cmId` → this row → `course_data.json`. (M3's internal `TimelineEntry.cm` = `{ cmNumber, courseId?, trackSummary? }`; the projection normalizes it to the above with `cmNumber→cmId` and a resolved `courseId`.)

## 7. Cross-cutting build decisions (resolve the Medium findings)
- **Shared L-cache** (in `src/sim`): key = `(courseId, strategy, bucketedStatHash, aptitudeHash, skillId, dataVersion)`, identical bucketing in M4 + M2. **Honest:** M2's post-run *actual* build rarely equals M4's pre-run *ideal*, so reuse is opportunistic, not assumed.
- **One cost module** `src/core/cost.ts`: the hint-discount schedule + `effectiveSpCost` live here once, imported by M4 coverage **and** M2 `spOptimizer` (no duplication; P6).
- **`evalSkillDelta` lives in `src/sim`** (not `features/sp-optimizer`) so M3 phase-2 imports it from the engine layer.
- **Combined-L / basket eval:** **vendor `skill-planner-compare.ts` (`runPlannerComparison`, multi-candidate)** — exactly what M4's "simulate the wishlist together" and M2's basket-on/off + A/B need (the one-skill `runSampling` loop doesn't give it cleanly). → update provenance vendor list ("5 files" → 6).
- **Affinity = clean-room** from the `master.mdb` `succession_relation` tables (as `mechanics-notes` §3 already does). **Do NOT port uma.moe `affinity.py`/`affinity.rs` source — it's AGPL-3.0, incompatible with this GPL-3.0 repo.** uma.moe is a *validation cross-check* only.
- **Build order** (engine-first, acyclic): M3 timeline-v1 (`cm_schedule` + dates + patch) → `src/sim` vendor (incl. `sync:data`, `skill-planner-compare`) → M4 charts → roster import → M1 (affinity core is engine-free; may parallel) → M2 (defines `evalSkillDelta`) → M3 phase-2 (consumes it). M4 may stub `cm_schedule.json` with the CM14 entry for parallel dev; real availability/patch is M3-blocked.

## 8. Governance anchors (also added to CLAUDE.md / provenance)
- **Private-use scraping exception** (owner-authorized, time-boxed) — see CLAUDE.md: OK = uma.guide, Game8 upcoming, SoulEC/Phoenix Sheets CSV; public build → ManualStatTargets/curated JSON; **GameTora + ChronoGenesis off-limits / cite-only**.
- **UmaExtractor** = live game-memory read → ToS/ban-risk, opt-in, never required; manual entry first-class (§5).

## 9. Low-severity validation items (defer to implementation)
- Verify the engine actually distinguishes Late vs End (both map to start-order `[5,9]`); if their L profiles are identical, label them shared rather than imply a false distinction.
- Render rental/paste-parent affinity as `≈`/estimate (unknown G1-win bonus); precise integers only for fully-known own lineages (P3).
- M2 reads `CmPlan.wishlist` (not "targets"); "skills hinted this run" = M2 manual input or seeded from M4 §3 sourcing, not an undefined plan field.
