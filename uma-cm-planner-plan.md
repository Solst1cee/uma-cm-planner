# Uma CM Planner — Full Project Plan

> Working name: **uma-cm-planner** (branding TBD — naming session later, NightCalc-style)
> Target: Champions Meeting build planning for Umamusume: Pretty Derby **Global** server
> Author context: handoff plan for implementation in Claude Code, written 2026-06.

---

## 1. Vision & Scope

A local-first web app that supports the monthly Champions Meeting (CM) build cycle end-to-end:

1. **Module 4 — Skill Acquisition Planner** *(build first)*: given the CM's target skill list (anywhere from 1–2 to 6–7 skills depending on priority — list length is variable, never assume a fixed count), solve the *coverage* problem — which support cards + which parents get me these skills, what's missing, what should I match together.
2. **Module 1 — Inheritance Planner**: given target aptitudes for the CM track, compute what pink-spark stars are needed from parents/grandparents to hit A/S, and the probability of getting there.
3. **Module 2 — SP Purchase Optimizer**: given limited skill points at the end of a run, rank purchases by expected race-length gain (bashin) per SP, solved as a knapsack under the SP budget.
4. **Module 3 — Meta Intel Workspace**: per-CM comparison of JP/TW historical data (prior) vs Global observed data (update) vs simulation output (calculation), because Global meta diverges (e.g. style distribution differences shift pace and therefore which skills proc).

**Non-goals (v1):** rebuilding a race simulator (reuse umalator engine), rebuilding parent-search (link out to chronogenesis / pure-db / uma.moe), automated scraping of JP sites, account systems, server-side anything.

**Deployment story:** runs locally via `pnpm dev`; deployable unchanged to GitHub Pages later. All user data stays in the browser (IndexedDB) with JSON export/import.

---

## 2. Guiding Principles (standing rules for all implementation sessions)

> These apply to every module and every Claude Code session working on this repo.
> Mirror this section into the repo's `CLAUDE.md`.

**P1. REUSE FIRST — always search before building.**
This game has existed for 5+ years (JP). The community has built an enormous amount of tooling: simulators, calculators, extracted datasets, reference docs, spreadsheets. Before implementing *any* mechanic, calculation, or dataset from scratch:
1. Search the Resource Map (§3) for an existing tool/doc that covers it.
2. Search the web for community tools/repos beyond the map (GitHub topic `umamusume`, GameTora, uma.guide, umamusu.wiki, umareference.com).
3. Prefer, in order: **import as dependency** > **vendor/borrow data files** > **port a known-good algorithm with attribution** > **build from scratch (last resort)**.
4. When porting, record the source URL + retrieval date in a code comment and in `docs/provenance.md`.
5. **Keep the Resource Map (§3) alive:** whenever a useful tool, dataset, doc, or community resource is discovered in any future session, add it to §3 with a one-line "use for" note before ending the session. The map is a living document, not a snapshot.

**P2. Local-first, zero backend.** Static site; game data baked at build time; user data in IndexedDB; one-click JSON export/import for backup and device transfer.

**P3. Honest numbers.** Where mechanics are calculable (spark inheritance probability, SP discounts), show real numbers. Where they are RNG-soup (hint pool draws, chain completion), show qualitative reliability tiers + the underlying evidence (pool size, hint frequency) instead of fabricated precision. This is the umalator-misuse trap: simulations are estimations, not verdicts. Surface caveats in the UI.

**P4. Server-versioned data.** Every skill/card/uma record carries `server: "global" | "jp"` availability and a `dataVersion`. JP-ahead content is visible as *preview*, never silently mixed into Global calculations. Anniversary rebalances (see snep.pw charts) mean skill parameters change over time — keep the version axis.

**P5. Hand-patchable data.** Extraction will never be perfect (e.g. chain vs random event classification). Every generated dataset has a sibling `*_overrides.json` that is merged last and maintained by hand. Never edit generated files directly.

**P6. Pure-function core.** All game-mechanics logic lives in `src/core/` as pure TypeScript functions with unit tests, validated against the community references in §3. UI is a thin layer on top. (Compatible with the existing `pre-ship-review` skill workflow.)

---

## 3. Resource Map (existing tools — consult before building anything)

> **Living document (P1.5):** any useful tool/resource found in future sessions must be added here with a "use for" note. Date new entries.

### Simulators / engines
| Resource | Use for | Notes |
|---|---|---|
| [jalbarrang/umalator-global](https://github.com/jalbarrang/umalator-global) | **The engine to reuse** for Module 2 | TypeScript + Vite + pnpm; README confirms it ships (a) web app, (b) simulation engine, (c) data tooling incl. `pnpm run db:fetch` to pull `master.mdb` and extraction scripts. **GPL-3.0** — see §4 licensing. Releases up to v0.4.3 (Mar 2026). |
| [kachi-dev VFalator](https://kachi-dev.github.io/uma-tools/umalator-global/) | Reference behavior; wit-variance mechanics (downhill mode, rushed, proc chance) | Direct umalator fork with fixes; spurt-rate accuracy cross-checked vs packet data. |
| [alpha123/uma-tools](https://github.com/alpha123/uma-tools) + [uma-skill-tools](https://github.com/alpha123/uma-skill-tools) | Original engine lineage; data file formats | Upstream of everything. |
| [Andrew123Shi/Umalator](https://github.com/Andrew123Shi/Umalator) | Ideas: OCR import of uma screenshots, multi-track compare modes, saved profiles | Steal concepts later, not v1. |
| [Kachi's umasim-en](https://kachi-dev.github.io/umasim-en/race) | Stamina sims reference | |

### Calculators / references for inheritance (Module 1 & 4)
| Resource | Use for |
|---|---|
| [Umamily.moe](https://umamily.moe/) | Pedigree/affinity-maker UI (Phase 0 finding: no proc tables in its bundle, no public source) — useful as a manual cross-check, but **Ice's sheet + master.mdb relation tables are the primary validation targets** for our math (validated 2026-06-12, see `docs/mechanics-notes.md` §3) |
| [Ice's Affinity & Inspirations sheet](https://docs.google.com/spreadsheets/d/1mT_uH79lZwEth6qGvjBOvrRKxwfKixr6vfhgzoW1s-U/edit?gid=1680923329) | Affinity + spark proc math cross-check |
| [CrazyFellow's Parent/Gene guide](https://docs.google.com/document/u/0/d/1Q3IJKbtkplmuY-PAJMNjYiLtasv0eU0aIBEqp8_C3tg/mobilebasic) | Spark proc rate tables (base % by stars, affinity scaling, grandparent halving) |
| [umareference.com](https://www.umareference.com/) | Digested mechanics incl. spark inheritance chance tables, support card passives |
| [uma.guide Roster Viewer](https://uma.guide/roster-viewer/) + **UmaExtractor** | Community-standard **veteran roster export (JSON)**: stats, rating, skills, sparks, legacy. We import the same format to populate the user's own-parent roster — no manual entry (added 2026-06) |

### Mechanics documentation
| Resource | Use for |
|---|---|
| [Race Mechanics doc](https://docs.google.com/document/d/15VzW9W2tXBBTibBRbZ8IVpW6HaMX8H0RP03kq6Az7Xg/edit) | Ground-truth formulas when verifying engine behavior |
| [Global reference doc](https://docs.google.com/document/d/11X2P7pLuh-k9E7PhRiD20nDX22rNWtCpC1S4IMx_8pQ/preview) | General concepts |
| [uma.guide](https://uma.guide/) / [umamusu.wiki](https://umamusu.wiki/) / GameTora | Mechanics cross-checks (hint discount schedule, spark rules) |
| [1st anni changelog](https://docs.google.com/spreadsheets/d/1o7cQRpRM0_YkmipvLzqRFn8opygabi_QycWm55pyPa8/edit?gid=1837731317), [anni skill changes](https://pages.snep.pw/uma/anni-skill-changes/), [anni2 skill changes](https://pages.snep.pw/uma/anni2-skill-changes/) | Data versioning: what Global will inherit |
| [Timeline sheet](https://docs.google.com/spreadsheets/u/1/d/e/2PACX-1vQ1bJUx-NQHJvwYE3Jcs9UP5aFVdWwoPVZc5Z7GN3oUGyB7-Rl8YZ48y-lJEvFWTGIrQmOa-yTehPkK/pubhtml#gid=0) | Predicting upcoming CM tracks / banners (Module 3 planning input) |

### Data sources
| Resource | Use for |
|---|---|
| umalator repos' shipped JSON (skills, courses, umas) | **Step-1 borrowed datasets** (Decision: borrow, not self-extract) |
| [rockisch/umamusu-utils](https://github.com/rockisch/umamusu-utils) | Fallback: self-extraction from game files if borrowed data lags |
| GameTora | Card↔skill listings, event text (manual cross-check; respect their ToS — no bulk scraping) |
| [SimpleSandman/UmaMusumeAPI](https://github.com/SimpleSandman/UmaMusumeAPI) | Schema reference for master.mdb tables |
| [Support Card comparison (inven)](https://m.inven.co.kr/uma/compare/?col=8) | Manual cross-check of card passives |

### Community / real-world data (Module 3)
| Resource | Use for |
|---|---|
| [Moo's CM dashboard](https://moomamusumedashboard.streamlit.app/) | Global CM aggregate data feed (manual import v1) |
| [Chronogenesis friend search](https://chronogenesis.net/friend_search), [Pure-DB](https://uma.pure-db.com/en-us/search) (old `uma-global.pure-db.com/#/...` URLs are dead, 301s — updated 2026-06-12), [uma.moe/database](https://uma.moe/database) (`/inheritance` redirects here) | Finding rental parents. **All three deep-linkable — templates verified in-browser, see `docs/provenance.md` §6.** uma.moe additionally has a public JSON API (`/api/v3/search`) + open-source frontend. ChronoGenesis: no public API, blocks scrapers, operator invites email for datasets (chronogenesis.net@protonmail.com) — do that before any workaround (P1). v1 integration = spec + deep links + manual compare (§7) |
| JP CM history (GameWith/Kamigame per-CM pages) | JP prior per CM (manual curation) |

### Discovered in Phase 0 spikes (added 2026-06-12 — details & evidence in `docs/provenance.md`)
| Resource | Use for |
|---|---|
| [xancia/UmaExtractor](https://github.com/xancia/UmaExtractor) | The actual roster-export tool (v2.1, uma.guide team); export = raw game-API `trained_chara_array` |
| [rockisch/umadump](https://github.com/rockisch/umadump) | Original tool + the only public sample export (180 veterans, 2021 JP) for importer scaffolding |
| [TheCing/uma-parent-viewer](https://github.com/TheCing/uma-parent-viewer) | Reference consumer of current Global exports; ready-made factor/skill/uma EN name maps (`data/*_global.json`) |
| [Apolexian/clairvoyance masterdb_readable](https://github.com/Apolexian/clairvoyance/tree/main/masterdb_readable) | JSON dumps of master.mdb tables: `succession_factor(_effect)` (spark→skill join), `succession_relation` (affinity), `single_mode_rank` |
| [jechto/Tachyons-lab](https://github.com/jechto/Tachyons-lab) | Independent chain/random/hint dataset (217 Global cards, GPL-3.0) — cross-validation oracle for card sourceType |
| umalator-global `gametora/event-skill-sources.json` + `docs/data-extraction/support-card-skill-sources.md` | **The chain-vs-random dataset** (532 cards) + proof master.mdb lacks event→skill relations |
| [GameTora data manifest API](https://gametora.com/data/manifests/umamusume.json) | Hash-gated JSON snapshots: skills (with Global condition overrides), support cards (passive matrices), training events |
| Global master.mdb CDN (`assets-umamusume-en.akamaized.net`) + [uma.moe/api/ver](https://uma.moe/api/ver) | Authoritative Global game DB download path (implemented in umalator-global `scripts/master-data/`) |
| [SSHZ-ORG/hakuraku](https://github.com/SSHZ-ORG/hakuraku) | `TrainedCharaData.ts`: trained-chara field semantics + rank_score recomputation reference |
| [SimpleSandman/UmaMusumeAPI](https://github.com/SimpleSandman/UmaMusumeAPI) | (Promoted) authoritative master.mdb table schemas as C# models |
| [umareference inheritance page](https://www.umareference.com/guide/legacies/chance-of-inheriting-sparks), [owadablog](https://owadablog.com/white-factor/), [note.com herohero_3](https://note.com/herohero_3/n/n3516b3322d76), @BourBon_Polaris | Spark base-proc tables: Global empirical + JP 1000-trial verification + patent-cited analysis (see `docs/mechanics-notes.md`) |
| [Altema hint page](https://altema.jp/umamusume/hint) (+ Game8/GameWith) | JP-unanimous hint discount schedule 10/20/30/35/40% |
| uma-skill-tools `cmdefs/*.cmdef.json` + umalator-global `cm-presets.json` | Ready-made Champions Meeting race-definition formats (18 JP defs + 31 presets) for our CmPlan picker |
| [Werseter/umadump](https://github.com/Werseter/umadump) + [UmaDump-JSON-Viewer](https://github.com/Werseter/UmaDump-JSON-Viewer) | Current-format Global UmaExtractor fixtures + metadata-validated Global client class layouts (`game_structs.py`) — ground truth for importer fields (fixtures in `spikes/samples/`) |
| [UmamusumeResponseAnalyzer Gallop classes](https://github.com/UmamusumeResponseAnalyzer/UmamusumeResponseAnalyzer) | Authoritative msgpack key names for trained_chara payloads + early warning of JP format drift (`factor_extend_array`) |
| [uma-moe org](https://github.com/uma-moe) (umamoe-frontend / -backend / -resources / -ingest) | Open-source spec for uma.moe deep links + **two reference affinity implementations** (`affinity.py`, `affinity.rs`) + battle-tested import optionality rules |
| [hzyhhzy/UmaAi](https://github.com/hzyhhzy/UmaAi) | Career-sim-grade support-card models; candidate reference for hint-event proc mechanics |
| [GameWith inheritance page](https://gamewith.jp/uma-musume/article/show/270279) (JP; also [Kamigame](https://kamigame.jp/umamusume/page/154134787475434233.html)) | Independent in-run inspiration empirical data — **conflicts with CrazyFellow's blue roll ranges**; basis for keeping them provisional (`docs/mechanics-notes.md` §6) |
| [alpha123/uma-tools `icons/`](https://github.com/alpha123/uma-tools) (local: `spikes/repos/uma-tools/icons/`, 415MB) | **In-game image dump** — source for the curated bundled UI icon set (see §4 "Image assets"). Covers 578/578 skills (by `iconId`), 220/220 cards, 84/84 umas. |
| [euophrys/uma-tiers](https://github.com/euophrys/uma-tiers), pretty-derby image set | Id-keyed community image CDNs (CORS-open, jsdelivr-mirrorable) — **fallback only** for not-yet-dumped cards; never the offline baseline (P2). Full image research: `spikes/image-ui-research.json` |

---

## 4. Architecture

### Tech stack
- **TypeScript + Vite + React** (match umalator-global's stack to ease engine reuse; Sun already works in React)
- **pnpm** workspaces (again matching upstream)
- **Dexie (IndexedDB)** for user data; localStorage only for UI prefs
- **Web Worker** for Monte Carlo simulation (Module 2)
- **Vitest** for unit tests of `src/core/`
- Deploy: GitHub Pages via Actions (same pattern as upstream and NightCalc)

### Licensing decision (resolve in Phase 0)
jalbarrang/umalator-global is **GPL-3.0**. If we import its engine code, our repo must be GPL-3.0-compatible (practically: license the app GPL-3.0). Acceptable for a fan tool; decide consciously. Alternative if undesired: keep the optimizer app separate and *shell out* to their hosted sim via deep links (weaker integration). **Recommendation: adopt GPL-3.0.** Also verify alpha123/uma-tools and kachi-dev fork licenses during Phase 0 spike. → **DECIDED (Sun, 2026-06-13): GPL-3.0-only**; clean chain confirmed (`docs/provenance.md` §2).

### Image assets — sourcing decision (Sun, 2026-06-13)
The UI is **image-based, GameTora-style** (support-card chips, skill icons, uma portraits) for fast at-a-glance use mid-run. **Decision: BUNDLE a curated, Global-only icon subset — not hotlink, not the 415MB wholesale dump.** A build step copies ~360 files (56 skill icons + 220 `support_card_s` chips + 84 uma portraits) from the local `uma-tools/icons` dump, converts to **WebP (~5MB total)**, and writes them git-tracked under `public/data/icons/` with an `icon-manifest.json`. Carried under a **NOTICE that excludes all Cygames assets from our GPL-3.0 grant** (asset-exclusion model: pretty-derby/uma.moe; fair-use wording: umalator README). Rationale: **P2 (local-first/offline) forbids a hotlink primary** — every hotlink source shows broken images offline; and bundling is the **lowest legal-risk** option (curated subset under NOTICE; enforcement is narrow and targets fan-art, not tools). Resolution is deterministic and id-keyed: skill → `iconId` (now on `SkillRecord`, §5; 56 distinct, resolves `icons/skill/<iconId>.webp`), card → `cardId`, uma → `umaId` (17 alt-outfits fall back to the base character portrait). Hotlinking a community CDN stays a **lazy fallback only** for not-yet-dumped cards, never the offline baseline. Mirror into `docs/provenance.md` §2; full research in `spikes/image-ui-research.json`.

### Repo layout
```
uma-cm-planner/
├── CLAUDE.md                  # standing rules (§2) + workflow notes
├── docs/
│   ├── provenance.md          # where every dataset/algorithm came from
│   └── mechanics-notes.md     # verified mechanics w/ sources & dates
├── scripts/                   # build-time data pipeline (Node)
│   ├── fetch-borrowed.ts      # pull JSON from umalator repos / pinned commits
│   ├── build-cards.ts         # → public/data/support_cards.json
│   ├── build-skills.ts        # → public/data/skills.json
│   └── merge-overrides.ts     # apply *_overrides.json last
├── data-overrides/
│   ├── card_source_overrides.json   # chain vs random classification patches
│   └── spark_rates.json             # hand-encoded from CrazyFellow/Ice (small, curated)
├── public/data/               # generated, git-tracked, never hand-edited
├── src/
│   ├── core/                  # pure functions (mechanics) + tests
│   │   ├── coverage.ts        # Module 4
│   │   ├── inheritance.ts     # Module 1
│   │   ├── spOptimizer.ts     # Module 2
│   │   └── types.ts
│   ├── sim/                   # vendored/imported umalator engine + worker glue
│   ├── db/                    # Dexie schema, export/import
│   ├── features/              # one folder per module's UI
│   │   ├── skill-planner/     # Module 4
│   │   ├── inheritance/       # Module 1
│   │   ├── sp-optimizer/      # Module 2
│   │   └── meta-intel/        # Module 3
│   └── app/                   # shell, routing, CM plan context
└── tests/
```

### Storage schema (Dexie)
```ts
// db version 1
ownedCards:  '++id, cardId'          // {cardId, level, limitBreak, owned: true}
parents:     '++id, umaId'           // Parent record incl. sparks (below)
cmPlans:     '++id, name, month'     // CmPlan (below)
matchLogs:   '++id, cmPlanId, date'  // Module 3 observations
settings:    'key'
```
Single-blob **export/import**: `{version, exportedAt, ownedCards, parents, cmPlans, matchLogs}` as downloadable JSON. Import = validate → replace-or-merge prompt.

---

## 5. Shared Data Layer

### Generated datasets (build-time, git-tracked in `public/data/`)

```ts
// skills.json
interface SkillRecord {
  skillId: string;
  nameEn: string; nameJp: string;
  baseSpCost: number;
  rarity: 'white' | 'gold' | 'unique' | 'inherited_unique';
  prereqSkillId?: string;        // gold requires its white base
  scenarioId?: string;           // set only for scenario-exclusive skills (see §6 scenario dimension)
  conditions: string;            // raw activation condition string (engine format)
  server: 'global' | 'jp';
  dataVersion: string;           // e.g. "global-2026-06" | "jp-anni2"
}

// support_cards.json
interface SupportCardRecord {
  cardId: string;
  nameEn: string; charName: string;
  rarity: 'R' | 'SR' | 'SSR';
  type: 'speed' | 'stamina' | 'power' | 'guts' | 'wit' | 'friend' | 'group';
  perLevel: Array<{               // keyed by limit break 0–4 (representative levels)
    limitBreak: 0|1|2|3|4;
    hintFrequency: number;        // passive value
    hintLevels: number;           // passive value
    specialtyPriority: number;
  }>;
  skills: Array<{
    skillId: string;
    sourceType: 'chain' | 'hint_pool' | 'random_event';  // overrides-patchable
  }>;
  hintPoolSize: number;           // derived: count of sourceType === 'hint_pool'
  server: 'global' | 'jp';
}

// spark_rates.json  (small, hand-curated from CrazyFellow/Ice — validate vs umamily.moe)
interface SparkRates {
  whiteBaseProcPctByStars: { 1: number; 2: number; 3: number };
  grandparentMultiplier: number;          // ≈ 0.5
  affinityScaling: 'multiplicative_pct';  // chance × (1 + affinity/100)
  inspirationEvents: 2;                   // Classic + Senior April (post-start)
  pink: {
    careerStartMaxSteps: 4;               // cannot reach S at career start
    firstStepStars: number;               // ≈1★ cumulative for first grade step
    subsequentStepStars: number;          // ≈3★ per further step — VALIDATE vs umamily
    sToSRequiresInRunProcAtA: true;
  };
  blueCareerStartByStars: { 1: number; 2: number; 3: number }; // VALIDATE (sources conflict: +5/+12/+21 vs other tables)
  blueInRunRollRange: { 1: [number,number]; 2: [number,number]; 3: [number,number] }; // 1–10 / 1–16 / 1–28 per uma.guide
  hintDiscountSchedule: [0.10, 0.10, 0.10, 0.05, 0.05]; // cap 40% — uma.guide; wiki says ~8%/level → VERIFY in-game
}
```

> ⚠ Marked `VALIDATE`/`VERIFY` values have conflicting community sources. Phase-0 task: reconcile against umamily.moe + Ice's sheet + a couple of in-game observations before encoding. Record outcome in `docs/mechanics-notes.md`.

### User-data entities

```ts
interface OwnedCard { cardId: string; level: number; limitBreak: 0|1|2|3|4; }

interface Parent {
  id: string;
  umaId: string;
  blueSpark:  { stat: 'spd'|'sta'|'pow'|'gut'|'wit'; stars: 1|2|3 };
  pinkSpark:  { aptitude: string; stars: 1|2|3 };   // e.g. 'dirt', 'mile', 'front'
  greenSpark?: { skillId: string; stars: 1|2|3 };
  whiteSparks: Array<{ skillId: string; stars: 1|2|3 }>;
  grandparents?: [ParentRef?, ParentRef?];           // optional nesting, 1 level
  affinityHint?: number;                             // user-entered affinity vs target uma
  notes?: string;
  source: 'mine' | 'friend_rental';                  // rentals: link out to find them
  importSource?: 'umaextractor' | 'manual';
  stats?: Record<'spd'|'sta'|'pow'|'gut'|'wit', number>;  // from UmaExtractor; useful context
  rating?: string;                                   // e.g. SS — from UmaExtractor
}

interface CmPlan {
  id: string; name: string; month: string;
  scenario: { id: string; isDefault: boolean };
  // Default = latest available scenario on Global (app-level setting, updated per release).
  // Override only for specific strategies (e.g. runaway/oonige Suzuka builds that favor a
  // different scenario's stat profile). Scenario affects stat gains, SP economy, and
  // scenario-exclusive skills — see §6 "Scenario dimension".
  race: { courseId: string; surface: 'turf'|'dirt'; distance: number;
          condition?: string; season?: string };
  targetUmaId?: string;
  requiredAptitudes: Array<{ kind: 'surface'|'distance'|'style'; key: string; target: 'A'|'S' }>;
  targetSkills: Array<{ skillId: string; priority: 1|2|3 }>;  // 1 = core
  lockedDeckSlots: Array<{ slot: 0|1|2|3|4|5; cardType?: string; cardId?: string }>;
  chosenParents: [string?, string?];                 // Parent ids
  spBudgetEstimate?: number;
  metaIntel: MetaIntel;                              // Module 3, §9
}
```

---

## 6. Module 4 — Skill Acquisition Planner *(build first)*

**Problem.** Each CM you have a target skill list — typically 1–2 must-haves up to 6–7 including lower-priority picks (variable length; the priority field, not list size, drives weighting). GameTora answers "which cards have skill X" one at a time; nothing solves coverage across the whole list together with inheritance, under a deck that's mostly locked by training needs.

### Mechanics basis (verified, with sources in docs/mechanics-notes.md)
Skill sources by reliability:
1. **Chain events** — most reliable; cards consistently deliver their chain hints (full-chain completion is still RNG; fewer competing chain cards helps).
2. **Scenario events** — scenario-exclusive skills tied to the training scenario itself (milestone/ending rewards tend to be near-deterministic if you meet conditions; other scenario events vary). Only available if `CmPlan.scenario` matches.
3. **Hint [!] icons** — reliability ∝ card's Hint Frequency and ∝ 1/hint-pool-size (pools range ~4 to ~14 skills).
4. **Random (non-chain) events** — unreliable; never count on them for core skills.
5. **White sparks** — calculable probability: base% by stars × (1 + affinity%) per opportunity; grandparents ≈ halved.
Hint levels discount SP cost (schedule above, 40% cap) — connects to Module 2.

**Scenario dimension.** Builds default to the **latest scenario** (best stat economy, so it's the assumed baseline — make this an app-level default, bumped each scenario release). A plan may override it for strategy reasons (e.g. a runaway Suzuka build preferring a different scenario's stat profile or exclusive skills). Consequences for this module: (a) skills carry an optional `scenarioId` so scenario-exclusive skills only appear as coverable when the plan's scenario matches; (b) the coverage matrix gets a "scenario" source column; (c) data pipeline must tag scenario-skill origin (overrides file if extraction can't). Module 2 note: SP budget estimates also differ by scenario.

### Core functions (`src/core/coverage.ts`)
```ts
type Tier = 'chain' | 'scenario' | 'hint_strong' | 'hint_weak' | 'random' | 'spark' | 'uncovered';

function classifyHintTier(card: SupportCardRecord, lb: number): 'hint_strong'|'hint_weak';
  // heuristic: hintFrequency at LB vs pool size; thresholds in one tunable const

function sparkChance(parents: Parent[], skillId: string, opportunities?: number): number;
  // exact math from spark_rates.json; sums parent + grandparent contributions

function buildCoverageMatrix(plan: CmPlan, inventory: OwnedCard[], parents: Parent[]):
  Array<{ skillId: string; priority: number;
          sources: Array<{ kind: Tier; cardId?: string; parentId?: string; sparkPct?: number }>;
          bestTier: Tier }>;

function suggestDeck(plan: CmPlan, inventory: OwnedCard[]):
  { deck: string[]; coverageScore: number; uncovered: string[]; rationale: string[] };
  // greedy fill of unlocked slots maximizing Σ(priorityWeight × tierWeight),
  // prefer higher-LB copies (hint levels); then 1-swap refinement pass

function effectiveSpCost(skill: SkillRecord, expectedHintLevel: number): number; // → Module 2
```

### UI (one page, `features/skill-planner/`)
- **Panel A — Plan header:** CM picker, target-skill list editor (searchable skill picker; priority stars). Later: "import from sim ranking" (Module 2).
- **Panel B — Coverage matrix:** rows = skills (priority order), columns = chosen deck + parents; cells = tier chips (color-coded). Orphans flagged red with "buy at full SP or drop" note. Tap a cell → details (pool size, hint freq, spark %).
- **Panel C — Deck suggester:** locked-slot editor (e.g. "slots 1–3 = any speed"), suggested fill with rationale lines, "what am I missing" summary.
- Mobile-first layout (will be used mid-run on phone).

### Contingency view (links Modules 4→2)
For each spark-covered skill: branch display — "if spark procs → SP plan A; else → plan B (+N SP)". v1 = static display; auto-recompute when Module 2 lands.

### Build steps
1. **Data:** `fetch-borrowed.ts` pulls skills/cards JSON from pinned umalator-repo commits → normalize → merge overrides → emit `public/data/`. Hand-verify 5 cards vs GameTora.
2. **Inventory UI:** searchable add-as-you-go card picker (don't force full-box entry).
3. **Coverage matrix** (read-only) → **already usable for next CM**.
4. Parents entry + `sparkChance` integration.
5. Deck suggester.
6. Export/import.

### Acceptance criteria
- For a real CM plan with a realistic target list, matrix matches manual GameTora lookups for ≥3 cards (spot check). UI stays sane for both a 2-skill list and a 7-skill list.
- `sparkChance` reproduces umamily.moe / Ice-sheet numbers within rounding.
- Deck suggester never violates locked slots; rationale lists which target each pick covers.

---

## 7. Module 1 — Inheritance Planner

**Problem.** "I need Dirt A (or S) on this uma for this CM. What spark stars do I need across legacies/sub-legacies, what do I have, what's the gap, and what's P(S)?"

### Mechanics basis
- Career-start: cumulative pink stars across both legacies + 4 sub-legacies raise aptitude stepwise, max +4 steps, cannot reach S at start. Step thresholds: first step ≈1★ cumulative, further steps ≈3★ each (**validate** exact table vs umamily.moe).
- S rank: requires in-run inspiration (Classic/Senior April) proc of a pink spark while aptitude is at A.
- Proc chance scales with affinity; grandparents halved.

### Parent Sourcing & Compare (rental hunting — last pain point)
**The core question this answers:** *"For this uma/CM, if I use THIS parent of mine, what borrowed parent do I need to hit my target aptitude + skills — and between borrow candidates A and B, which combination is better?"* (e.g. A → higher P(S distance), B → covers two skill sparks: make the trade-off visible and quantified.)

No public APIs exist on the rental sites; ChronoGenesis blocks scrapers but invites email contact for dataset use cases.

Workflow (v1, no scraping):
1. **Own-roster import (kills manual entry):** import **UmaExtractor JSON** — the community-standard veteran export already consumed by uma.guide's Roster Viewer (stats, rating, skills, sparks, legacy). Importer maps it onto `Parent` records (`importSource: 'umaextractor'`). Manual entry remains the fallback for users without the extractor. **Phase 0 spike:** obtain a sample export, document the schema, write the mapping spec.
2. **Own-parent selection:** pick from roster — or let the app scan the whole box and rank own veterans against the CmPlan (`evaluateParentSet` with the borrow slot empty), answering "which of MY umas is the best anchor for this build."
3. **Residual Spec builder:** with the own parent fixed, compute what the borrow slot must still supply: remaining pink ★ for A/S target, missing target-skill white sparks (Module 4 tie-in), desired blue type. Rendered as a compact checklist card — this is the precise search query for the rental sites.
4. **Deep links:** pre-filled search URLs from the residual spec, if site filter state is URL-encoded (**Phase 0 spike**). Fallback: plain links + pinned residual checklist.
5. **Pairwise Candidate Compare (the differentiator):** own parent fixed in slot 1; each borrow candidate (entered as `Parent` with `source: 'friend_rental'`, trainer ID in notes) slots into slot 2. Compare table ranks *combinations*, with separate columns so trade-offs stay visible rather than collapsed into one score: start grade, gap to A, **P(S)**, blue stat preview, **target-skill spark coverage %**, overall fit. Neither rental site scores candidates against a build plan, let alone jointly with your own parent.
6. **Honest feasibility note (P3):** without API access the app cannot confirm a matching parent *exists* — it produces the minimal residual query and scores whatever you find. If the invited-API path succeeds, an existence check / auto-search becomes possible.
7. **Entry friction reduction (later):** paste-parser for the rental sites' result text; screenshot OCR (shared spike with Module 2's build import).
8. **Invited API path:** email the ChronoGenesis operator describing the use case before building anything heavier (P1). Never use undocumented internal endpoints without permission.

### Core functions (`src/core/inheritance.ts`)
```ts
function careerStartAptitude(base: Grade, totalPinkStars: number): Grade;     // table-driven
function starsNeededFor(base: Grade, target: 'A'|'S', current: number): number;
function probReachS(parents: Parent[], aptKey: string, affinity: number): number;
function evaluateParentSet(plan: CmPlan, parents: Parent[]): {
  startGrade: Grade; gapToA: number; pS: number;
  blueBonus: Record<Stat, number>;                    // career-start stat bonus preview
  skillCoverageBonus: Array<{skillId: string; pct: number}>; // ← Module 4 tie-in
};
```

### UI
- Target uma + required aptitude (auto-filled from CmPlan).
- Parent roster picker (records from §5) + affinity input (manual; computing full affinity graphs is out of scope v1 — **reuse**: link to umamily.moe / Ice's sheet for affinity lookup, store the number).
- Output card: start grade, stars missing for A, P(S), blue-spark stat preview, and *secondary score*: target-skill white-spark coverage (Module 4 integration).
- **Inverse mode (killer feature):** "need 6 more dirt ★ → candidate farming targets" (list owned parents by pink type; rentals → link out to chronogenesis/pure-db/uma.moe).

### Acceptance criteria
- Reproduces umamily.moe results for ≥5 hand-checked parent sets.
- Inverse mode gap math consistent with forward mode.

---

## 8. Module 2 — SP Purchase Optimizer

**Problem.** End-of-run, limited SP, which skills to buy. Community measures skill value as **length (bashin)** gained on the CM course. Umalator ranks single skills; nobody solves the *basket* under an SP budget with prereqs and hint discounts.

### Approach — reuse the engine (P1)
- Vendor/import the simulation engine from **jalbarrang/umalator-global** (`src/sim/`), pinned to a release tag. Run in a **Web Worker**; N configurable Monte Carlo runs per skill.
- Per candidate skill: Δ mean bashin vs baseline build on the CmPlan course/conditions. Cache results per (build-hash, course, skill).
- **Knapsack:** maximize Σ E[bashin] s.t. Σ effectiveSpCost ≤ budget, with dependency edges (gold ⇒ white prereq counted/bundled). ~30 candidates → exact DP over SP budget (SP granularity 1) is trivial; bundle gold+white as combined items to handle the dependency.

```ts
function evalSkillDelta(build: Build, course: Course, skillId: string, n: number): Promise<BashinStats>;
function optimizeBasket(cands: Cand[], budget: number): { buy: string[]; totalBashin: number; spLeft: number };
// Cand = { skillId, cost: effectiveSpCost(...), value: meanBashin, requires?: skillId }
```

### UI
- Build input: stats, aptitudes, current skills (manual v1; OCR import idea parked — see Andrew123Shi).
- Candidate list auto-seeded from CmPlan targets + skills currently hinted this run (user ticks hint levels).
- Output: ranked purchase list with running SP total — "with 2,400 SP buy these 6" — plus per-skill bashin/SP and the contingency branches from Module 4.
- Caveat banner (P3): simulation excludes positional chaos; treat as estimation; test in room matches.

### Acceptance criteria
- Single-skill deltas within noise of VFalator for 3 spot-checked skills on the same course/settings.
- Knapsack respects budget + prereqs; beats greedy-by-ratio on a constructed counterexample test.

---

## 9. Module 3 — Meta Intel Workspace

**Problem.** JP/TW ran this CM ~a year ago; Global diverges (card pool timing, uncap levels, community habits — e.g. style distribution like more end closers on Global shifts pace, changing which skills actually proc). Want: JP/TW **prior** vs Global **observed** vs sim **calculation**, side by side, with disagreements flagged.

### Data model (embedded in CmPlan)
```ts
interface MetaIntel {
  jpPrior?:  { sourceUrl: string; retrieved: string; notes: string;
               popularUmas: Array<{umaId: string; sharePct?: number}>;
               popularSkills: string[]; styleDistribution?: Record<Style, number> };
  twPrior?:  { ...same };
  globalObserved: {
    imports: Array<{ source: 'moo_dashboard'|'manual'; retrieved: string; data: unknown }>;
    myMatches: Array<{ date: string; round: string; placement: number;
                       opponentStyles: Record<Style, number>;   // counted from lobby
                       notes: string; skillProcsSeen: string[] }>;
  };
  simSnapshot?: { paceAssumption: Record<Style, number>; topSkills: Array<{skillId: string; bashin: number}> };
}
```

### Behavior
- v1 ingestion is **manual/curated**: paste from Moo's dashboard + JP CM pages into structured forms. No scraping (brittle, ToS).
- **The key loop:** re-run Module 2's sim using the *observed Global style distribution* as the pacer assumption → compare skill ranking vs JP prior → highlight disagreements (these usually mean positional effects the sim can't see → flag for room-match testing).
- Per-match quick log form (10 seconds on phone): placement, styles seen, notable procs.

### Acceptance criteria
- A CM page renders prior/observed/sim three-up with disagreement badges.
- Changing the style distribution re-triggers sim snapshot and visibly reorders skills when it should.

---

## 10. Cross-module integration map

```
            CmPlan (single source of truth: race, targets, deck locks, parents)
                 │
   ┌─────────────┼───────────────┬──────────────────┐
   ▼             ▼               ▼                  ▼
Module 1     Module 4        Module 2           Module 3
inheritance  coverage        SP knapsack        meta intel
   │  parents chosen │  spark % → contingency │   observed pace
   └────────►────────┘──────────►─────────────┘◄───────┘
        (parent picker shows skill-coverage side-score;
         spark outcomes branch the SP plan;
         observed meta re-parameterizes the sim)
```

---

## 11. Project phases

**Phase 0 — Spikes** ✅ **DONE 2026-06-12** (multi-agent research + adversarial verification; full evidence in `spikes/phase0-*.json`)
- [x] Engine mapped; **headless import smoke-tested under plain Node (PASSED)**; couplings small & listed → `docs/provenance.md` §1. Vendor pin: v0.14.2 / c1fa2107.
- [x] Data JSON located & documented → `docs/provenance.md` §3. All feared gaps (SP cost, prereq links, passives, EN names) are covered; one real gap: scenario-exclusive tagging.
- [x] License check → `docs/provenance.md` §2. Clean GPL chain; **adopt GPL-3.0(-only)** confirmed as the recommendation.
- [x] Mechanics reconciled + independently re-verified → `docs/mechanics-notes.md`. 8/9 confirmed; blue in-run roll ranges provisional (conflicting JP data); grandparent ×0.5 removed (emergent, not a parameter); blue +5/+12/+21 conflict cleared.
- [x] Chain/random distinction: **exists machine-readable** (umalator-global `event-skill-sources.json`, cross-validated vs Tachyons-lab); overrides workload ~15–20 entries, not ~494 → `docs/provenance.md` §4.
- [x] Rental sites: **all three deep-linkable, browser-verified templates** → `docs/provenance.md` §6. ChronoGenesis contact for datasets: chronogenesis.net@protonmail.com.
- [x] UmaExtractor schema locked (5 converging sources) + Parent mapping spec → `docs/provenance.md` §5. Residual: one byte-exact current dump from Sun's device before the importer ships.

**Phase 1 — Scaffold + Module 4 core (usable tool)** ✅ **DONE 2026-06-12** (5 commits; built by 4 parallel agents, adversarially reviewed by 3, fixes applied)
- [x] Repo scaffold (Vite+React19+TS strict, pnpm, Vitest), CLAUDE.md updated, CI typecheck/test/build + Pages deploy, GPL-3.0-only + NOTICE.
- [x] Data pipeline → `public/data/` (578 skills, 220 cards w/ chain/date/random sourcing + per-LB passives + hintLevels, spark_rates, 31 CM presets w/ server tags). Pinned: umalator-global c1fa2107 + Tachyons-lab 2ce0c8fe (build-time parity oracle).
- [x] Dexie schema v1 + JSON export/import (replace + natural-key merge).
- [x] Inventory UI → coverage matrix (M4 steps 1–3), browser-smoke-tested incl. 390px mobile. **Milestone reached: usable for the next CM.** (Deck suggester/sparkChance = Phase 2.)

**Phase 2 — Module 4 complete** ✅ **DONE 2026-06-13** (4-agent build + 3-reviewer adversarial pass + fixes; 252 tests): parents entry (`/parents` CRUD over 84-uma picker), `sparkChance` (Ice-sheet goldens to 8–9 decimals; per-member affinity model, no flat gp multiplier; total-affinity entries flagged ≈ until Module 1 computes per-member), deck suggester (greedy + 1-swap, lock invariants, no card twice), contingency view (static; proc cost floored ≤ miss; inherited-unique = "not obtainable"). Honesty fixes: gold skills can't be white sparks (mechanics §8); stale suggestions invalidated on input change.

**Phase 3 — Module 1:** inheritance math + UI + inverse mode; UmaExtractor roster import; Residual Spec builder + deep links + pairwise own×borrow compare table; validation suite vs umamily.

**Phase 4 — Module 2:** vendor engine, worker harness, single-skill deltas, knapsack, caveat UI.

**Phase 5 — Module 3:** MetaIntel forms, match logger, sim re-parameterization loop.

**Phase 6 — Polish:** PWA/offline, OCR import spike, branding/naming session, optional public hosting hardening (analytics opt-out, disclaimer page mirroring community norms).

---

## 12. Validation & testing
- `src/core/` 100% unit-tested; mechanics tests cite source (file/sheet/url + date) in test names or comments.
- Golden tests: umamily.moe parent-set reproductions; VFalator skill-delta spot checks.
- Data pipeline tests: overrides merge wins; server flag filters; a JP-only skill never appears in Global calculations.
- Manual checklist per CM cycle (dogfooding log → feeds backlog).

## 13. Risks & open questions
| Risk | Mitigation |
|---|---|
| Engine tightly coupled to its UI | Phase-0 spike before committing; fallback = alpha123 engine or deep-link out for sims |
| Borrowed data lags Global patches | Pin commits + document update procedure; fallback self-extraction via umamusu-utils |
| chain/random classification incomplete | overrides file + "unknown" tier rendered honestly |
| Mechanics numbers wrong (conflicting sources) | Phase-0 reconciliation + golden tests + in-game spot checks |
| GPL-3.0 obligations if hosted publicly | Publish source (already planned); keep license headers |
| Scope creep (it's 4 apps) | Each phase ends in a usable artifact; M4 steps 1–3 first |

## 14. Open decisions for Sun *(annotated with Phase 0 findings, 2026-06-12)*
1. Adopt GPL-3.0 for the whole repo? (recommended) — **Phase 0: confirmed safe & effectively mandatory.** Whole chain is clean GPL; vendoring from jalbarrang ⇒ declare `GPL-3.0-only`. Needs LICENSE + NOTICE/CREDITS (pecan © 2022, VFalator contributors, jalbarrang, GameTora) + Cygames fair-use disclaimer; game data stays outside the GPL grant (`docs/provenance.md` §2).
2. React vs Preact — recommend **React**; Phase 0 confirms the modern engine repo (umalator-global) is React-based.
3. App name / branding — schedule a naming session (NightCalc precedent). Placeholder: `uma-cm-planner`.
4. Affinity: ~~manual number entry v1 (porting affinity calculation is a big task)~~ — **Phase 0 changed this calculus: the full algorithm is two small functions (aff2/aff3) over two master.mdb tables, documented in `docs/mechanics-notes.md` §3 and validated exactly against Ice's sheet; two open-source reference impls exist (uma-moe).** New recommendation: ship *computed* affinity v1 (static tables baked at build time) with manual override; only the dynamic win-saddle bonus stays out of scope.
5. Email the ChronoGenesis operator about dataset/API access? (Recommended: yes, early.) — **Phase 0: invitation confirmed verbatim; contact chronogenesis.net@protonmail.com.** Note deep links already work without any API (§3 / provenance §6), so the email is for existence-checks/auto-search only.
6. *(new)* GameTora-derived JSON redistribution: umalator-global commits snapshots and we'd inherit them; no GameTora ToS found, robots.txt permissive, attribution is community norm. Decide: keep reusing committed snapshots with attribution (low risk, recommended) vs. ask GameTora for blessing vs. rebuild purely from master.mdb (loses chain/random event data — master.mdb provably lacks it).
