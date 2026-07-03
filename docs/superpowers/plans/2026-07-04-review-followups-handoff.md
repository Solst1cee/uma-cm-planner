# Handoff — review follow-ups after PRs #29–#36 (2026-07-04)

Cold-session resume note for the tail of the availability epic. Multi-angle reviews of
PRs #25–#32 produced findings; most are now fixed (below), three remain. Read this + the
prior [2026-07-02 availability-review followups](2026-07-02-availability-review-followups-handoff.md)
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

### 3. E — the architecture slice (the main open work)
Three related refactors the reviews kept surfacing. Best as one branch/PR (or three commits).

**3a. Data-layer gating in `useGameData`** — *highest value; do before availability grows again.*
Today `useGameData` exposes mixed-server arrays AND ungated id-maps (`skillById`/`cardById`/
`umaById`); every consumer must remember `server === 'global'`, and three "safe-exclude" audit
passes still left leaks (the M2 leak PR #29 fixed came through a map). **Invert the default:**
expose `globalSkills/globalUmas/globalCards` (+ Global-only default maps) as the path of least
resistance, with an explicit `upcoming(asOfISO)` / JP opt-in selector. This closes the whole
per-consumer-tax bug class instead of re-auditing it per slice. Watch: the horizon predicate
(`useAvailability`) currently is the opt-in seam — reconcile, don't duplicate.

**3b. `usePatchedBuild` single seam + patch-map scoping.** The rebalance `skillPatches` injection
is a 7-surface tax (`useSkillPatches` → `withSkillPatches` → `skillPatchesSig` → `usePatchNotes`,
copy-pasted per surface). A future 8th sim surface that forgets a step runs **silently unpatched
with no PatchedSimNote**. Extract one `usePatchedBuild(plan, build, relevantIds)` returning
`{ build, patchNotes }`; longer-term push injection into `planToOverlayBuild`/the SimClient seam.
Fold in the **deferred efficiency fix**: `skillPatchMap`/`activePatchNotes` scan all ~1719 catalog
records per surface per render — restrict to the build's relevant ids (the caller already has
`relevantSkillIds`), which also bounds every `skillPatchesSig` in the sim cache keys.

**3c. Chip-primitive consolidation.** The pill has forked five ways: `.chip` → `.tier-chip` →
`.rebalance-badge` → `.cmp-patched-chip` + the hand-rolled `~date` spans (6 copies, 3 class names,
duplicate `.cmp-upcoming-badge` CSS in `uma-chart.css` + `cm-planner.css`). Consolidate to one
`.chip` base + variant modifiers and one `AvailabilityBadges`/`ProjectedDateBadge` component.
`arrivalLabel` (core, done in PR #33) already unified the *text*; this unifies the *markup/CSS*.

## Pointers
- In-code M2 rationale: `src/core/spOptimizer.ts` `wishlistToCandidates` + `src/sim/cache.ts`.
- Prior handoff (open latent data-build findings — Tachyons parity narrowing, card dedup vs
  `card_additions`, `release_en` mistag, roster white resolver, non-monotonic CM dates):
  [2026-07-02-availability-review-followups-handoff.md](2026-07-02-availability-review-followups-handoff.md).
- Rebalance data/curation: `docs/data-refresh-runbook.md` §4 + `data-overrides/README.md`;
  the `confirm-timeline` skill (`.claude/skills/confirm-timeline/`) covers confirmation flows.
