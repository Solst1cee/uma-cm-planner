# Skill-icon sort workflow (M1.7 coverage table)

The M1.7 "Obtainable vs. wishlist" table orders skills by their **in-game icon**,
via a hand-curated scheme in
[`src/features/inheritance/skillSort.ts`](../src/features/inheritance/skillSort.ts)
(`ICON_SUBCATEGORIES`). This doc is the routine for keeping that scheme correct
when the game data changes.

## How the sort works

1. **Unique + inherited-unique skills sort FIRST** (a top group, A–Z), ranked by
   **rarity — never by icon** (`keyOf` in `skillSort.ts`). So any icon carrying
   only unique-rarity skills is **inert** in the scheme: it's listed for family
   documentation but has no effect. That includes the "Unique tier" block
   (`20013/16/23/43`), the `…6` "evolved" variants (`10016`, `20026`, `20046`,
   `30056`, … — all unique-rarity in the data), `2010016`, and the uniques on `0`.
2. **Everything else sorts by icon rank** — `ICON_SUBCATEGORIES` is an ordered
   list of rows; every icon on a row shares one rank, so a white+gold family
   clusters together.
3. **Within a subcategory:** A–Z by the white base name, with a **gold skill
   directly above its white twin** (`buildSkillComparator`).
4. **Any icon not listed sorts LAST** (`UNLISTED_RANK`). `0` is the placeholder
   icon (skills with no assigned icon yet, mostly JP); it's listed last on purpose.

There is deliberately **no "evolved above gold" ordering** — the evolved (`…6`)
variants are all unique-rarity, so they're handled by the top group and never
sort inside a family row. If a future patch adds a **non-unique** evolved skill,
revisit `buildSkillComparator` (add a variant-tier tiebreak) at that point.

## The guard

`skillSort.test.ts` has a test — *"every non-unique skill icon in the baked data
is placed in the scheme"* — that reads `public/data/skills.json` and **fails,
naming the icon**, if any non-unique skill uses an icon missing from
`ICON_SUBCATEGORIES`. Unique-only icons are exempt (they sort by rarity). This is
the hard gate: a data refresh that introduces a new icon breaks CI until it's
placed, instead of silently sorting those skills last.

## When the guard fails (or after any data refresh that adds skills)

1. **See what's new visually.** Regenerate the reference sheet:

   ```sh
   node scripts/build-icon-sort-sheet.mjs
   # writes tmp-tools/skill-icon-sort-sheet.html (gitignored) — open in a browser
   ```

   Click **"Unlisted only"** to see just the icons not yet placed (amber). Each
   card shows the icon image, its id, its skills (with rarity dots + JP badges),
   and an "unique · inert" tag when the icon is unique-only.

2. **Decide placement.** For each **non-unique** unlisted icon, find its family
   from the skills shown on the card and add its id to the right row in
   `ICON_SUBCATEGORIES`:
   - a new **white** in an existing family → add to that family's row;
   - a new **× debuff** (`…4`) → its own row right after the family;
   - a whole **new family / scenario** → a new row (or block) in the sensible
     position; mirror the existing section comments (Green / Stamina / Velocity /
     … / Debuff / Event / Uma specific).
   - **Unique-only** icons don't need placing (they sort by rarity); you may list
     them for documentation, but it changes nothing.

3. **Re-run the guard:**

   ```sh
   pnpm vitest run src/features/inheritance/skillSort.test.ts
   ```

   It should pass once every non-unique icon is placed.

## Notes

- `ICON_SUBCATEGORIES` rows may hold multiple icons (they share a rank); the
  "no double-listed icon" test keeps you from listing one icon twice.
- Icon files live at `public/data/icons/skill/<iconId>.webp`. A missing file is a
  separate concern (a JP icon awaiting the Global dump — see
  [provenance §2.1](provenance.md)); it doesn't affect sort placement.
- `skill_categories.json` supplies the `group` used to cluster a gold under its
  white twin; it's rebuilt by `scripts/build-skill-categories.ts`.
