# data-overrides/

Hand-maintained patches merged **last** over the generated datasets (principle
P5, CLAUDE.md). Never edit `public/data/*.json` directly — fix the generator
(`scripts/`) for systematic issues, or add an override here for curated facts
the upstream data simply doesn't have.

## File format

Any `*_overrides.json` file in this directory is picked up by
`scripts/build-all.ts` (alphabetical order). Shape:

```jsonc
{
  "_target": "support_cards",   // dataset to patch: skills | support_cards | cm_presets
  "_comment": "why this file exists",
  "records": {
    "<record id>": {            // skills→skillId, support_cards→cardId, cm_presets→name
      "_comment": "why this entry exists (cite a source + date)",
      "someField": "newValue"
    }
  }
}
```

## Merge semantics (`scripts/merge-overrides.ts`)

- Plain objects merge recursively; override keys win.
- Arrays whose elements are objects sharing an identity key (`skillId`,
  `cardId`, or `id`) merge element-wise by that key: the **first** matching
  element is patched, unmatched override elements are appended. (No record
  currently has the same `skillId` twice with different source types in a way
  an override targets — re-check this if you ever patch a skill that is both
  hint-pool and event on one card.)
- Everything else (scalars, mixed arrays) is replaced wholesale.
- Keys starting with `_` are documentation only and are stripped from output.
- An override id that doesn't exist in the generated data **fails the build**
  on purpose: it means upstream data drifted and the override needs review.
- `spark_rates.json` is not override-targetable — it is already hand-encoded
  from `docs/mechanics-notes.md`.
- `hintPoolSize` is recomputed after overrides (it is derived data).

## Current files

| File | Target | What it patches |
|---|---|---|
| `card_source_overrides.json` | `support_cards` | Friend/group **date-event** skills the generator defaults to `random_event` (master flat eventSkills vs GameTora chain∪random mismatch — provenance §4). |
| `skill_scenario_overrides.json` | `skills` | `scenarioId` for the 21xxxx scenario-exclusive skills GameTora's `sce_e` misses (provenance §3.1). Extend when a new scenario reaches Global. |

## Maintenance checklist (on every upstream data refresh)

1. Run `pnpm data:fetch && pnpm data:build`. Unknown-id errors here mean a
   referenced skill/card disappeared upstream — investigate before deleting
   the override.
2. Recompute the source mismatch set (master `eventSkills` vs
   `event-skill-sources.json` chain∪random) and reconcile with
   `card_source_overrides.json` — new friend/group cards usually need new
   `date_event` entries.
3. New scenario released on Global? Add its skill ids to
   `skill_scenario_overrides.json` with the **internal** scenario id
   (provenance §3.1 — GT# and internal ids differ; internal id 3 does not
   exist).
