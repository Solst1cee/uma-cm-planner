# Handoff — Always-visible skill effect-type tag on the skill plate

**Date:** 2026-06-17
**Status:** Ready, unassigned (Sun is assigning a separate agent).
**Owner of consuming work:** the M4 acquirable-skill chart
([2026-06-17-m4-acquirable-skill-chart-design.md](2026-06-17-m4-acquirable-skill-chart-design.md))
deliberately does **not** depend on this — it ships with the skill icon + on-expand
effect-chips. This tag is a cross-cutting plate enhancement.

## Goal

Add a small **always-visible tag** to the shared skill plate showing the skill's effect
**type/category** (Speed / Accel / Recovery / Stamina / Power / Guts / Wit / Vision /
Start / Debuff / …) so you can glance a skill's kind without expanding it. Because every
skill plate routes through one component, this upgrades the **sidebar** (unique +
wishlist), the **uma unique-skill chart**, and the **acquirable-skill chart** at once.

This is distinct from the existing "effect-chips" — those are the detailed badges
(`Target speed +0.35m/s`) rendered **on expand** inside `SkillDetailDisclosure`. This task
adds a compact **category** pill in the collapsed summary.

## Why it needs data work

`SkillRecord` (`src/core/types.ts`) has no effect-type/category field — only `conditions`
(activation DSL) and `iconId`. The effect `type` codes exist in the raw skill data but are
not surfaced on the record. `SkillDetailDisclosure` only learns effect types by lazily
importing the ~5 MB engine bundle on expand — **do not** pull that into the main thread
just to render a tag. Bake a category field instead.

## Chosen source — bake at build time (no runtime bundle)

`scripts/build-skills.ts` already reads the build-time `master` skills source
(`MasterSkill.alternatives[].effects[]` with `type`, `modifier`, `target`) — see the
existing `isSelfDebuff()` helper, which inspects `alt.effects` directly. So the category
can be derived in `buildSkills()` with no new data source and no runtime cost.

## Tasks

1. **Type** — add to `SkillRecord` (`src/core/types.ts`) a category field. Suggested:
   `effectCategories?: EffectCategory[]` (a skill can be multi-type, e.g. speed + accel),
   with `EffectCategory = 'speed' | 'accel' | 'recovery' | 'stamina' | 'power' | 'guts' |
   'wit' | 'vision' | 'start' | 'debuff' | 'other'`. Decide single-primary vs multi-tag
   (recommend ≤2 tags: primary + secondary by effect magnitude).
2. **Build** — in `scripts/build-skills.ts` `buildSkills()`, map each skill's
   `alternatives[].effects[].type` → category and emit the field. Mapping reference (from
   `SkillDetailDisclosure.tsx` `EFFECT_TYPE_NAMES`):
   - 1 → speed, 2 → stamina, 3 → power, 4 → guts, 5 → wit (raw stat ups)
   - 21 / 22 / 27 / 28 / 35 → speed (current/target/lane speed & movement)
   - 31 → accel
   - 9 → recovery (HP) — but `modifier < 0` ⇒ HP drain (still recovery-tone, or 'other')
   - 8 → vision (field of view)
   - 10 / 14 → start (reaction time / delay)
   - 42 → duration (skill-duration; usually pair with the underlying type — likely 'other')
   - any effect with `modifier < 0` on an opponent target, or self-debuff (`target === 1 &&
     modifier < 0`, reuse `isSelfDebuff`) → debuff
   - everything else → other
   Pick the primary by largest `|modifier|` among non-passive, non-noop effects; ignore
   type 0 (Noop) and pure passives. Add **overrides** support (a
   `data-overrides/skill_category_overrides.json` merged last, P5) for hand-correction.
3. **UI** — render the category pill(s) in `SkillDetailDisclosure`'s `<summary>`
   (`cmp-skill-summary-main`), a new `cmp-skill-type-tag` class, color-coded to roughly
   match the effect-chip tones (`is-stat`, `is-acceleration`, `is-recovery`, `is-debuff`…).
   Keep it compact so it fits the sidebar's narrow plate.
4. **Tests** — `build-skills.test.ts`: known skills emit the expected category (pick a
   speed skill, an accel skill, a recovery skill, a debuff). `SkillDetailDisclosure` test:
   the tag renders from `skill.effectCategories` (extend `SkillSummary` +
   `skillRecordToSummary` to carry it).

## Coordination / conflict surface

- Files this touches: `src/core/types.ts` (SkillRecord + SkillSummary), `scripts/build-skills.ts`,
  `src/features/cm-planner/skillTechnicalDetails.ts` (`skillRecordToSummary` carries the
  new field), `src/features/cm-planner/SkillDetailDisclosure.tsx` (summary render + CSS),
  `public/data/skills.json` (regenerated via `pnpm data:build`).
- The `feat/m4-skill-chart` branch edits `SkillDetailDisclosure` **usage** (props passed in
  the new panel) and `skillTechnicalDetails` (consumes `skillRecordToSummary`) but not the
  summary internals — low conflict risk. Coordinate the `SkillSummary` shape if both land
  near each other.

## Gotchas (from CLAUDE.md)

- Don't import the engine bundle into the main thread for type data — bake it (this task's
  whole point).
- Build scripts run under Node; headless engine/data runs need the esbuild
  `import.meta`/`import.meta.main` define (provenance §1.1) — but `build-skills` reads JSON,
  not the engine, so this likely doesn't apply here.
- Never edit `public/data/skills.json` by hand — change `build-skills.ts` + overrides, then
  `pnpm data:build` (P5).
