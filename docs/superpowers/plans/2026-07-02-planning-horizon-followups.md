# Planning Horizon — Follow-ups & Handoff (2026-07-02)

The app-wide planning horizon (availability sub-project **#3**) shipped on `feat/planning-horizon`
(spec: [2026-07-02-planning-horizon-design.md](../specs/2026-07-02-planning-horizon-design.md) ·
plan: [2026-07-02-planning-horizon.md](2026-07-02-planning-horizon.md)). Final opus whole-branch
review: **READY TO MERGE**; every finding either fixed in the fix-wave commit or logged here.
**1205 tests**, typecheck clean.

## Decided post-review (already in the branch)

- **Strict announced-only "now"** (user decision 2026-07-02): at the default `Current` horizon a JP
  record whose *projected* date has elapsed ranks `upcoming` (hidden, chip-flagged at cm+), NOT
  `now` — only an announced (non-predicted) elapsed date passes. Consequence: cards whose projection
  already elapsed (e.g. Throne `30067`, projected 2026-06-28) do NOT show at Current until either
  the data pin catches up or an announced date lands. That's intended honesty (P4) — do not weaken.
- Fix-wave tidy-ups: CM-segment label now shows the date; 6 dead `'Announced Global release'`
  ternary branches flattened; the `plan.server === 'global'` dup-reps guard restored in both skill
  charts; dead `isReleasedBy` deleted.

## Known / deferred (non-blocking)

1. **Chosen-CM-passes UX staleness** — if the horizon is `{kind:'cm'}` and that CM's date passes,
   it drops out of `futureCms`: the control label falls back to bare "CM" while the cutoff quietly
   degenerates to today (≈ Current). Correctness-safe; cosmetic. Fix idea: detect the stale pick and
   snap the control to Current (or auto-advance to the next CM) with a transient note.
2. **Evolution-skill chart clutter** — the 596 gt-rarity-6 "evolution" skills (emitted as
   `unique`/cost 0 in slice 2c) may rank `na` in charts at wide horizons (engine pin predates them).
   Accepted preview clutter; revisit if the unique tab feels noisy (could add a sub-filter).
3. **`claimedIds` theoretical gap** — `buildJpSkills`'s top-level skip guard checks `masterSkillIds`
   only, not already-claimed gene ids; architecturally unreachable (gene ids live in the 9xxxxx+
   block) and the `skills.json` id-uniqueness test is the backstop.
4. **Green-spark options exclude 9+-digit inherited twins** — `InheritanceCard`'s 6-digit id filter
   is CORRECT (green sparks decode to the 6-digit space); the JP inherited twins surface via
   `ParentForm`'s `rarity === 'inherited_unique'` options instead. Noting so nobody "fixes" it.
5. **"Specific date" horizon cutoff** — model-ready (every tier reduces to a cutoff ISO); needs only
   a date-picker entry in `HorizonControl` + a `{kind:'date', iso}` variant. Deferred by spec.
6. **M3 timeline / M2 optimizer UI** — intentionally untouched (M3 is date-native; M2 candidates
   flow from the horizon-gated wishlist). If M2 ever grows its own catalog browser, it must read
   `useAvailability()`.
7. **Data-layer gating recommendation** (from the earlier availability review followups): consider
   `useGameData` global-only *defaults* so new consumers are safe-by-default instead of relying on
   each surface to call `visible()`. Bigger refactor; would subsume the per-surface audit pattern.

## Next up (the epic's remaining sub-project)

- **Availability #4 — rebalance patches:** model JP balance changes (skill effect/condition changes
  with their patch dates) so Global builds can preview upcoming nerfs/buffs. Different data problem
  (per-skill effect deltas over time, likely `data-overrides/` curated + a patches timeline lane);
  brainstorm from scratch — no spec exists.
- After that: back to the main roadmap (M1.7 coverage matrix is the active build; M4-Phase-2 fidelity
  is paused behind it).

## Session gotcha worth remembering (process, not code)

Three implementer subagents died mid-task this run (session limits / process exits). Recovery
pattern that worked: inspect `git status` + the partial diff in the worktree, verify the completed
portion, then either finish inline (mechanical remainder) or dispatch a RESUME implementer whose
prompt lists exactly what is already done (verified) vs remaining. Never re-run a dead task from
scratch without checking the tree first.
