# Skill-rebalance datamine

Standing tooling for turning a **Global game patch** into curated
`data-overrides/rebalances.json` entries. Global skill rebalances are
**datamined, not read from patch notes** — the official notes lack the exact
condition / value / duration / cooldown changes the sim needs.

These scripts are **manual, out-of-band** (not part of `pnpm data:build`). They
read raw master.mdb skill extracts and emit override entries you review by hand
before landing. Everything they emit is written to respect the build-time guards
in [`scripts/lib/rebalances.ts`](../lib/rebalances.ts), so generated output bakes
clean.

## Where the extracts come from

The upstream engine repo [`jalbarrang/umalator-global`](https://github.com/jalbarrang/umalator-global)
commits a fresh master.mdb `skills.json` extract on every game-data fetch, so its
**git history is a per-patch snapshot archive**. Our local clone lives at
`spikes/repos/umalator-global` (gitignored). Un-shallow it once to expose the
history:

```sh
cd spikes/repos/umalator-global
git fetch --unshallow --tags
git log --oneline -- src/modules/data/json/skills.json   # the snapshot archive
```

Pick two snapshots to diff:

- **pin** — the snapshot our vendored engine is pinned to (`src/sim/`, currently
  umalator **v0.14.2**, master.mdb data from ~2026-06-05). This is the baseline
  the sim actually runs, so patching against it is what makes sims match live
  Global.
- **post** — the snapshot at (or just after) the patch you're adopting.

Export each to a working file:

```sh
cd spikes/repos/umalator-global
git show <pin-sha>:src/modules/data/json/skills.json  > /tmp/skills-pin.json
git show <post-sha>:src/modules/data/json/skills.json > /tmp/skills-post.json
```

## Workflow

1. **Eyeball the diff** (optional but recommended):

   ```sh
   node scripts/rebalance-datamine/diff-skills.mjs /tmp/skills-pin.json /tmp/skills-post.json
   ```

   Prints every sim-relevant per-skill change (precondition / condition /
   duration / cooldown / effect list) plus added/removed skills.

2. **Generate override entries:**

   ```sh
   node scripts/rebalance-datamine/gen-rebalances.mjs \
     --pin /tmp/skills-pin.json \
     --post /tmp/skills-post.json \
     --global-date <YYYY-MM-DD> \
     --source-url https://github.com/jalbarrang/umalator-global/commit/<post-sha> \
     --out /tmp/rebalances-generated.json
   ```

   The console report classifies each changed skill: **fully expressible**
   (every change patched), **partial** (some values patched, remainder noted),
   **note-only** (nothing the engine format can express — badge only).

3. **Review** `/tmp/rebalances-generated.json`. The generator is conservative and
   honest, but eyeball the `note` lines — they are the audit trail for anything
   left unpatched.

4. **Merge into** `data-overrides/rebalances.json`. For a first adoption you can
   drop the generated array in wholesale; for a later patch, append `ver`s to
   the already-tracked skills instead of duplicating entries (versions must be
   `ver`-ascending and unique — see
   [`data-overrides/README.md`](../../data-overrides/README.md#rebalancesjson-schema)).

5. **Full rebuild — always the whole thing, never a partial:**

   ```sh
   pnpm data:build
   ```

   Confirmed `globalVer ≥ 2` rebalances re-project on the shared foresight clock,
   so a partial rebuild leaves arrival dates stale. The build bakes
   `rebalance: RebalanceInfo` onto each affected `SkillRecord`, adds `type:'patch'`
   timeline entries, and — via the engine's data-driven `skillPatches` — makes
   sims use the effective version's values (no engine rebuild). See
   [`docs/data-refresh-runbook.md` §4](../../docs/data-refresh-runbook.md).

## What the engine patch format can express

`skillPatches` is data-driven but limited. `gen-rebalances.mjs` encodes these
limits so it never emits an entry the build would reject or the engine would
misapply:

| Change | Patchable? |
|---|---|
| `condition` value (per alternative) | ✅ via `conditions` (`'@'`-joined positionally) — **unless** an alternative's condition itself contains an inline `@` |
| single-effect `modifier` value | ✅ via `modifier` (human units) |
| `baseDuration` (uniform across alts) | ✅ via `duration` (seconds) |
| `cooldownTime` (uniform across alts) | ✅ via `cooldown` (seconds) |
| `precondition` change | ❌ note-only |
| adding / removing an alternative | ❌ note-only |
| changing the effect **list** (types) | ❌ note-only |
| a value on a **multi-effect** skill | ❌ note-only (modifier would overwrite every effect) |
| a duration tied to an effect-list change | ❌ note-only (belongs to the new effect) |

## Worked example — the 2026-07-01 Global patch (game data `10006800`)

The first adoption. Post snapshot = upstream commit
[`0a79f4b`](https://github.com/jalbarrang/umalator-global/commit/0a79f4b774077a9bfb1e685b0f073a393a75b8bd);
pin = the v0.14.2 engine snapshot. **95 skills changed**; the generated array is
what currently seeds `data-overrides/rebalances.json` (71 with a live sim patch,
24 note-only). The 06-05 → 06-25 window changed nothing, so this patch is the
whole ver-2 history to date.
