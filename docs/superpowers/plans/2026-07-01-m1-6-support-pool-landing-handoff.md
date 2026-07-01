# M1.6 Support-card pool — landing handoff (2026-07-01)

Branch `feat/m1-6-support-card-pool`, merged up to `origin/main` (which brought M1.4).
**1119 tests**, typecheck + build green. Ready for PR into `main`.

## What landed this session (on top of the earlier M1.6 pool)

- **Card Unique Effects** dataset (`public/data/card_unique_effects.json`) + build script
  (`scripts/build-card-unique-effects.ts`) from master.mdb `support_card_unique_effect` ×
  `text_data` enum, with 21 hand-written conditional (type≥101) lines in
  `data-overrides/unique_effect_text_overrides.json`. localOnly input committed at
  `scripts/borrowed/support-card-unique-effects.json`.
- **Full base-effect list** (`public/data/card_effects.json`) + `scripts/build-card-effects.ts`
  — all always-on effects, LB-aware, from GameTora's effect matrix.
- **Detail card redesign** (single column; art + shadow + full viewer, meta row, Unique Effect
  above base Effects, Estimated Effect Value, wishlist on skill row).
- **Deck vs. trainee conflict rules** (`deckConflicts.ts`) — trainee-character block + one-card-
  per-character, matched by `charName`; enforced in picker, detail Add, deck slots, `addToDeck`.
  Clicking a filled deck slot opens its detail.
- **Skill filter** drops unique/inherited-unique; **Scoring weights** moved into the pool panel
  ("?" HeaderHelp, default-collapsed); removed the "N shown" header count.

## Merge notes

- Merged `origin/main` (M1.4 inheritance card + importer). Resolved 6 conflicts:
  `GameIcon.tsx` (kept both `card-art` + `rank` kinds), `inheritance.css` (both feature blocks
  additive), `App.inheritance.test.tsx` (`useGameData` stub needs both `cards` + `skills`), and
  the 3 status docs (CLAUDE.md / roadmap.md / module-1 — kept both M1.4 and M1.6 sections).

## Next up

- **M1.7 "Obtainable vs. wishlist" coverage matrix** (center-column placeholder still shows M1.7).
- **Deferred M1.6 gap:** the mockup's **Stats filter row + per-tile stat-line** are not built —
  `PoolItem` has no per-LB euophrys stats (tb/mb/fs_bonus/specialty_rate/race_bonus/hint_rate).
  Thread those onto `PoolItem` before adding the Stats filter.
- **Green (9xxxxx) / saddle→G1 affinity reconciliation** carried from M1.4 (see roadmap M1 row).

## Known issues / caveats

- None blocking. `card_effects.json` conditional-effect wording (type≥101) is our own hand-written
  paraphrase (not copied from GameTora) — verify new/updated cards against the game on data refresh.
- Verify the two new datasets after any `pnpm data:build`; they regenerate from the borrowed
  GameTora inputs (`scripts/borrowed/gametora/`, gitignored) + the override file.
