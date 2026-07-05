# Handoff — review follow-ups after PRs #29–#36 (2026-07-04)

Cold-session resume note for the tail of the availability epic. Multi-angle reviews of
PRs #25–#32 produced findings; most are now fixed (below). The **E architecture slice was
re-assessed on 2026-07-05 and deliberately deferred** (see §3) — the two genuinely-open items
are icon-dump-wait and M2 pin-lag. Read this + the prior
[2026-07-02 availability-review followups](2026-07-02-availability-review-followups-handoff.md)
(its **latent data-build findings** are still open and NOT repeated here).

## Done this session (PRs #33 / #35 / #36)

- **PR #33** — rebalance curation guards (multi-effect `modifier`, `conditions` empty-part/arity,
  cooldown multi-fire test); one shared `arrivalLabel` + P3 `TierChip` on the last unmarked
  surfaces (SourcingSection rows, wishlist plates); M2 pin-lag/jp-gate exceptions documented
  in-code; perf batch (SkillPicker predicate order, pool `useMemo`, JP pre-filter, parallel
  boot fetches, memoized patch sigs).
- **PR #35** — `build-icons` skips JP-ahead icons absent from the Global dump (keeps the
  Global-icon hard-fail).
- **PR #36** — regenerated the icon set (492 new JP-ahead icons; the committed set was stale).
- **F (provenance)** — `docs/provenance.md` §3.5 (availability epic: JP-ahead content,
  jp-schedule, foresight, rebalance feeds) + the §2.1 JP-ahead icon-scope note. **Done.**
- **3c dedup (2026-07-05)** — the one concrete item salvaged from the deferred E slice:
  `.cmp-upcoming-badge` was duplicated across `cm-planner.css` (scoped) + `uma-chart.css` (bare).
  Canonicalized to one bare rule in the always-loaded `cm-planner.css` (the bare rule had lived in
  the *lazy* Uma-tab chunk despite being used by SkillChart/AccelChart/Sourcing/PlannerSidebar).
  **Done** (`chore/dedupe-upcoming-badge`).

## Still open

### 1. Icon-dump-wait (known limitation, not a bug)
14 JP-ahead icons (1 skill `2010011`, 13 cards) render the GameIcon placeholder — the
`alpha123/uma-tools` dump is **Global-scoped** and doesn't carry them until those items reach
Global (verified 2026-07-04: latest `origin/master` still lacks them). **Resolution when they
land Globally:** `git -C spikes/repos/uma-tools pull` → `tsx scripts/build-icons.ts` → commit
the new webps. A JP-client extraction is the only early fill (not set up). Fully documented in
provenance §2.1.

### 2. M2 pin-lag rebalances (deferred — DECIDED to defer 2026-07-03)
M2's SP optimizer ignores rebalances, including **pin-lag** ones (`globalVer ≥ 2`, confirmed
live on Global while the engine pin lags) that M4 sims correctly — so the two tools disagree on
a live skill. **The full rationale + the exact shape of the fix live in-code** on
`wishlistToCandidates` (`src/core/spOptimizer.ts`) and are cross-referenced from `src/sim/cache.ts`.
Fix shape (no horizon plumbing needed — pin-lag is a pure data fact): a `confirmedPatchMap` in
`rankBaskets.toSimBuild` + `skillPatchesSig` into `simCacheKey` + a `PatchedSimNote` on M2 results.
Do NOT delete the `server !== 'global'` gate to "unify" — that re-opens PR #29's P4 leak.

### 3. E — the architecture slice (DEFERRED — re-assessed 2026-07-05, do NOT start without a trigger)
Three preventive/ergonomic refactors the earlier reviews surfaced. Re-scored against the state of
`origin/main` on 2026-07-05: **all three triggers have not fired**, so building now is speculative
(YAGNI). The known bugs these would have caught are **already fixed** (#29/#33); the availability
epic is **closed and has not grown** (all post-#33 momentum is M1 inheritance); the perf concern is
**already memoized**. Keeping the design here so it can be picked up when a *concrete* trigger lands.

**Re-triggers (build the matching piece only when one of these happens):**
- **3a** ← availability/JP work resumes (a new JP-content surface, or the "All JP" lens gains real
  consumers). Then: additive `globalSkills`/`globalCards`/`globalUmas` (server-gated arrays) as the
  default for enumerate-to-offer surfaces; keep full arrays as the JP-opt-in path; **keep id-maps
  full** (imported JP plans must `.get(id)`-resolve — the leak is `.values()`-enumeration, not
  lookup); migrate raw-array offer-surfaces to `globalX` / `useAvailability().visible`. Reconcile
  with the horizon seam (`useAvailability`), don't duplicate it. *(Chosen strategy 2026-07-05:
  additive, not a hard invert of `skills`.)*
- **3b** ← a *new* sim surface is added (the "8th surface forgets a patch step → silent unpatched
  run" risk becomes real). Then extract `usePatchedBuild(plan, build, relevantIds) → { build,
  patchNotes }` collapsing the `useSkillPatches` + `withSkillPatches` + `usePatchNotes` triple
  (UmaChartPanel keeps `useSkillPatches` — per-row map in a render callback). The bundled efficiency
  "fix" (scope `skillPatchMap`/`activePatchNotes` to `relevantIds` vs the ~1719-record scan) is
  **marginal** — those hooks are already memoized on `[skillById, cutoffISO, todayISO, wishlist]`,
  so they recompute on wishlist/horizon change, not per render. Do it only if profiling flags it.
- **3c** ← already partly done: the `.cmp-upcoming-badge` duplicate is resolved (see Done above).
  The remaining fork (`.chip`/`.tier-chip`/`.rebalance-badge`/`.cmp-patched-chip` + `~date` spans →
  one `.chip` base + variants + an `AvailabilityBadges`/`ProjectedDateBadge` component) is cosmetic,
  visual-regression-prone, and low-value — fold it into the *next* deliberate design-system pass,
  not a standalone branch.

## Pointers
- In-code M2 rationale: `src/core/spOptimizer.ts` `wishlistToCandidates` + `src/sim/cache.ts`.
- Prior handoff (open latent data-build findings — Tachyons parity narrowing, card dedup vs
  `card_additions`, `release_en` mistag, roster white resolver, non-monotonic CM dates):
  [2026-07-02-availability-review-followups-handoff.md](2026-07-02-availability-review-followups-handoff.md).
- Rebalance data/curation: `docs/data-refresh-runbook.md` §4 + `data-overrides/README.md`;
  the `confirm-timeline` skill (`.claude/skills/confirm-timeline/`) covers confirmation flows.
