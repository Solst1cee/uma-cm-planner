# Rebalance Patches — Versioned Skills — Design

**Date:** 2026-07-03
**Status:** Approved (brainstorming), pending implementation plan
**Author:** Sun + Claude

## Context

Availability sub-project **#4** — the last piece of the epic (foresight #25 · JP-ahead content #26–#28 · app-wide planning horizon #30, all merged). The app knows *which* content exists at every horizon; it does not yet know that an existing skill's **parameters change over time**. JP rebalances skills (activation conditions, effect values) in balance patches; Global receives the same changes ~a foresight-gap later; and our **engine pin is frozen at 2026-06-05**, so even *confirmed Global* patches sim stale until an S1 pin bump.

Grounding (verified 2026-07-03):

- **The M3 timeline already has a `type:'patch'` entry kind** (shared-data-model §1.2) — the lane has been empty since the mockups.
- **gametora carries both condition sets per skill**: `condition_groups` = JP-current, `loc.en.condition_groups` = Global-current. A structural JP-vs-Global **condition diff is computable at build time for free**. Effect *values* (modifiers/durations) are NOT in gametora — the engine bundle carries a single (Global-pin) value set — so value changes must be hand-curated from datamined patch notes.
- **Global-side patches that already shipped** arrive via the S1 engine/data pin bump — that path is unchanged. #4 covers (a) JP-side changes Global hasn't received and (b) confirmed Global changes the frozen pin lags behind.
- Engine precedent for per-run overrides: `SimBuild.skillLevels` + an `engine-patches/*.patch` applied at skill construction, with an identity backstop (2026-06-29).

## Goal

Model each rebalanced skill as a **versioned parameter history** (ver 1, 2, 3…) with a flag for the version **confirmed live on Global**, preview upcoming versions at wider horizons (badges + a version-timeline readout + the M3 patch lane), and — in the second slice — make sims **use the horizon-effective version's parameters** via engine `skillPatches`.

## Decisions (locked in brainstorming)

- **(A) Version-set model, not one-shot diffs** (user design, 2026-07-03). A skill may be rebalanced multiple times; store **all versions**, each with its **full parameter set** (no delta-chaining — ver N is self-contained). `globalVer` flags the version confirmed live on Global; JP-current = the highest version.
- **(B) Two feeds:** AUTO — the build-time gametora condition diff detects "a newer version exists on JP" as an **uncurated candidate** (badge-only; undated, so it can never sim-affect); HAND — `data-overrides/rebalances.json` (P5) curates real versions: dates, condition strings, effect values (only when datamined), notes, source URLs.
- **(C) Honesty ladder (P3):** text-only note → badge only · structured but undated → badge + diff readout · structured + dated → eligible to **sim-affect** at horizons whose cutoff ≥ its Global arrival. Never fabricate numbers.
- **(D) Version selection by horizon:** effective ver = highest version whose Global arrival ≤ `cutoffISO`, where arrival = `globalDate` (announced/confirmed) else foresight-projected from `jpDate` (`releaseDatePredicted` semantics). **Predicted arrivals never activate at Current** — consistent with the horizon's strict announced-only "now" rule.
- **(E) Confirmation workflow (user-driven):** when Global patch notes land, the maintainer sets the version's `globalDate` and flips `globalVer` in `rebalances.json`, then runs `pnpm data:build`. Mirrors the `confirm-timeline` flow; extending that project skill to cover rebalance confirmations is an in-scope docs task.
- **(F) Pin-lag coverage:** if `globalVer`'s parameters differ from the engine-pin baseline (Global patched after 2026-06-05; pin not yet bumped), the sim applies `globalVer` via `skillPatches` **even at Current**, badged "confirmed patch — engine pin pending". The version model subsumes pin lag.
- **(G) Two slices under this one spec:** **4a** data + preview (no sim change) · **4b** engine `skillPatches` + horizon-gated injection. 4b gets its own implementation plan when 4a lands.

## Data model

### `data-overrides/rebalances.json` (hand-curated, P5)

```jsonc
[
  {
    "skillId": "200331",
    "globalVer": 1,                       // confirmed live on Global (maintainer flips)
    "versions": [
      { "ver": 1, "note": "original (engine-pin baseline)" },   // baseline: no parameters = pin values
      {
        "ver": 2,
        "jpDate": "2025-11-20",           // JP patch date → foresight-projects the Global arrival
        "globalDate": null,               // set when announced/confirmed (wins over projection)
        "conditions": "corner==2&…",      // full engine-DSL condition string (optional)
        "modifier": 0.25,                 // effect value overrides (optional, datamined only)
        "duration": null,
        "cooldown": null,
        "note": "activation window widened, speed up",
        "sourceUrl": "https://…patch-notes…"
      }
    ]
  }
]
```

### Baked annotation (`SkillRecord.rebalance?`, `src/core/types.ts`)

```ts
export interface SkillVersion {
  ver: number;
  jpDate?: string;
  /** Announced/confirmed Global date; else projected from jpDate. */
  globalDate?: string;
  globalDatePredicted?: boolean;
  /** Full parameter set for this version (absent field = unchanged from pin baseline). */
  conditions?: string;
  modifier?: number;
  duration?: number;
  cooldown?: number;
  note?: string;
  sourceUrl?: string;
}
export interface RebalanceInfo {
  globalVer: number;              // confirmed-live version
  jpVer: number;                  // highest version (JP-current)
  versions: SkillVersion[];       // ver-ascending, ver 1 = baseline
  /** true when the AUTO diff detected a JP≠Global condition drift not yet curated. */
  uncuratedCandidate?: boolean;
  /** The auto-detected condition pair (JP vs Global) for the candidate readout. */
  candidateConditions?: { jp: string; global: string };
}
// on SkillRecord:
rebalance?: RebalanceInfo;
```

### Effective-version selection (pure, `src/core/rebalance.ts`)

```ts
/** Highest version whose Global arrival ≤ cutoff; falls back to globalVer.
 *  Arrival = globalDate (announced) else projected date; predicted arrivals
 *  require cutoff > today (i.e. never activate at Current). */
export function effectiveVersion(info: RebalanceInfo, cutoffISO: string, todayISO: string): SkillVersion;
/** The engine-facing override for a version (undefined when ver === pin baseline AND no pin lag). */
export function versionPatch(v: SkillVersion): SkillPatch | undefined;
```

## Components

### Slice 4a — data + preview (no engine/sim change)

1. **AUTO candidate diff (`scripts/build-skills.ts`):** for each Global-released skill where both gametora condition sets exist and `serializeConditions` differs → `rebalance.uncuratedCandidate = true` + `candidateConditions`. Log the count. (JP-only skills excluded — they have no Global variant to drift from.)
2. **Curated merge (`scripts/lib/rebalances.ts` + build wiring):** load `rebalances.json`, validate (ver-ascending, unique vers, `globalVer` exists, parameters only on ver ≥ 2), project each dated version's arrival via the existing foresight `cal` (`projectReleaseDate` semantics: `globalDate` wins → `predicted:false`; else project `jpDate` → `predicted:true`), bake `RebalanceInfo` onto the matching `SkillRecord` (curated entry replaces/absorbs the auto candidate). Update `outputs.test.ts`.
3. **Timeline patch lane (`scripts/build-timeline.ts`):** each curated version with a date emits a `type:'patch'` timeline entry (title "Skill rebalance: {name} v{ver}", JP date + projected/announced Global date, source stamped, tier confirmed/prediction per `globalDate` presence). The M3 lane renders them with its existing badge grammar (✓/◆/~).
4. **UI badge + readout:** a compact `Δv{jpVer} ~{date}` **rebalance badge** on skill rows (charts + pickers, beside the TierChip; shown at every horizon — it's information, not availability), amber-family styling. In `SkillDetailDisclosure`, a **"Rebalance history"** section: the version timeline (ver, dates with ✓/~ marks, per-version parameter/notes, source links), "Global: v{globalVer}" marker, and the uncurated-candidate state ("JP conditions differ — not yet curated" + the JP/Global condition pair).
5. **`confirm-timeline` skill extension (docs):** add the rebalance-confirmation workflow (flip `globalVer` + set `globalDate` → full `pnpm data:build` — same rebuild rule as CM confirmation).

### Slice 4b — sim-affecting (engine work isolated here; own plan later)

6. **Engine `skillPatches`:** `SimBuild.skillPatches?: Record<string, { conditions?: string; modifier?: number; duration?: number; cooldown?: number }>`; an `engine-patches/2026-07-xx-skill-patches.patch` applies overrides at skill construction (`pnpm sim:build`). **Identity backstop:** absent `skillPatches` ⇒ byte-identical behavior (fidelity 0.2202 path untouched) — the `skillLevels` precedent.
7. **Horizon-gated injection:** `planToSimBuild`/`planToOverlayBuild` build `skillPatches` from each build-relevant skill's `effectiveVersion(info, cutoffISO, todayISO)` — including the **pin-lag case** (Current + confirmed `globalVer` ≠ baseline). Predicted-only versions never inject at Current (decision D).
8. **"Post-patch values" marking:** charts/sim outputs flag runs where any patch was active ("simmed with v{N} — arrives ~{date}" / "confirmed patch, engine pin pending").

## Data flow

```
gametora (JP vs loc.en conditions) ──► AUTO candidates ─┐
data-overrides/rebalances.json (versions, globalVer) ───┤→ bake SkillRecord.rebalance (+ foresight-projected arrivals)
                                                        └→ timeline type:'patch' entries (M3 lane)
UI: Δ badge on rows · version-timeline readout in skill details
4b: effectiveVersion(info, cutoffISO) → SimBuild.skillPatches → engine override → “post-patch values” marker
Confirmation: patch notes land → flip globalVer + set globalDate → pnpm data:build (re-projects + re-tiers)
```

## Testing

- **`rebalance.ts` (pure):** effectiveVersion truth table — cutoff before/at/after each arrival; predicted vs announced at Current; fallback to `globalVer`; pin-lag (globalVer ≥ 2) selected at Current.
- **AUTO diff:** differs → candidate; identical / missing `loc.en` / JP-only skill → none.
- **Curated merge:** validation failures reject the file loudly (build fails, P5); projection announced-wins; candidate absorbed by curation.
- **Timeline:** dated versions emit patch entries with correct tier; undated emit none.
- **UI:** badge renders for annotated skills only; readout shows the version timeline + Global-live marker; candidate state renders.
- **4b:** engine identity without `skillPatches`; a condition override changes activation; a value override moves L; injection respects the horizon (Current never injects predicted-only; pin-lag injects at Current).

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| AUTO diff false positives (gametora noise / translation artifacts in condition strings) | candidates are badge-only, never sim-affect; curation is the promotion gate |
| Fabricated precision on value changes | honesty ladder (C): values only from datamined sources, `sourceUrl` required on ver ≥ 2 entries with values |
| Engine patch drift vs upstream | identity test + the established `engine-patches/` workflow; 4b isolated in its own plan/PR |
| Version bookkeeping errors (wrong `globalVer`) | loader validation + the confirm workflow doc; timeline tier makes state visible |
| Stale projections after a CM confirmation re-anchors the clock | arrivals re-project on every `pnpm data:build` (same rule as record dates — encoded in confirm-timeline) |

## Out of scope

- Global-side patches already in the pin's past (S1 pin bump owns those).
- Auto-detecting **value** changes (no data source; curation only).
- Uma/card rebalances (skills only this sub-project; the model generalizes later if needed).

## Open items for the plan (4a)

1. Confirm the gametora condition-diff noise level empirically (run the diff, eyeball the candidate count/list) before wiring the badge — if it's hundreds, add a curation-list filter or tighten the comparison.
2. Exact badge placement/styling next to `TierChip` in each surface (reuse the chip grammar).
3. `SkillDetailDisclosure` section placement (after the availability/effect chips, before "Simulated performance").
4. Whether `outputs.test.ts` pins a rebalance count (probably assert shape only — the file starts near-empty).
5. Seed `rebalances.json` with at least one real, sourced JP rebalance (needs patch-note research — maintainer-supplied or a documented placeholder until then).
