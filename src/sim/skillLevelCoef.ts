// Generated from master.mdb `skill_level_value` (ability_type, level -> float_ability_value_coef).
// Source query:
//   SELECT ability_type, level, float_ability_value_coef
//   FROM skill_level_value WHERE level<=6 ORDER BY ability_type, level;
// Dumped 2026-06-29 against spikes/repos/umalator-global/db/master.mdb (Global master.mdb).
// Coef is a per-mille-x10000 multiplier: the base modifier in skills.json is the Lv1 value
// (verified: skill 100011 speed effect = type 27, modifier 3500 = type-27 Lv1), so the
// effective modifier at level L is base * coef(type, L) / 10000.
//
// This table previously lived only inside the vendored v0.14.2 TS engine clone
// (engine-patches/2026-06-29-skill-level-scaling.patch, `skillLevelCoef.ts`) and was applied
// engine-side (buildSkillEffects). The v0.27.0 Rust/WASM re-platform doesn't carry that patch
// forward (we don't own the Rust source the way we owned the TS clone), so the scaling is now
// applied APP-SIDE as a pure transform on the resolved `WasmSkillInput` before it's handed to
// the engine (src/sim/adapter.ts `applySkillLevel`) — this file is the same table, relocated.
//
// NOTE on types 501/502/503: their coef rows do NOT start at 10000 at Lv1 (they ramp up to
// 10000 at the top level). They belong to a small set of non-character/scenario skills
// (ids 1000011/1000012) that are out of scope for the unique-skill (Lv1-6) feature. `coef()`
// early-returns 10000 for level<=1/undefined, so the no-level path is always identical
// regardless of these rows; they are transcribed only for provenance.
export const SKILL_LEVEL_COEF: Readonly<Record<number, Readonly<Record<number, number>>>> = {
  1: { 1: 10000, 2: 10100, 3: 10200, 4: 10300, 5: 10400, 6: 10500 },
  2: { 1: 10000, 2: 10100, 3: 10200, 4: 10300, 5: 10400, 6: 10500 },
  3: { 1: 10000, 2: 10100, 3: 10200, 4: 10300, 5: 10400, 6: 10500 },
  4: { 1: 10000, 2: 10100, 3: 10200, 4: 10300, 5: 10400, 6: 10500 },
  5: { 1: 10000, 2: 10100, 3: 10200, 4: 10300, 5: 10400, 6: 10500 },
  6: { 1: 10000, 2: 10200, 3: 10400, 4: 10600, 5: 10800, 6: 11000 },
  7: { 1: 10000, 2: 10200, 3: 10400, 4: 10600, 5: 10800, 6: 11000 },
  8: { 1: 10000, 2: 10200, 3: 10400, 4: 10600, 5: 10800, 6: 11000 },
  9: { 1: 10000, 2: 10200, 3: 10400, 4: 10600, 5: 10800, 6: 11000 },
  10: { 1: 10000, 2: 10200, 3: 10400, 4: 10600, 5: 10800, 6: 11000 },
  13: { 1: 10000, 2: 10200, 3: 10400, 4: 10600, 5: 10800, 6: 11000 },
  14: { 1: 10000, 2: 10200, 3: 10400, 4: 10600, 5: 10800, 6: 11000 },
  15: { 1: 10000, 2: 10200, 3: 10400, 4: 10600, 5: 10800, 6: 11000 },
  16: { 1: 10000, 2: 10200, 3: 10400, 4: 10600, 5: 10800, 6: 11000 },
  19: { 1: 10000, 2: 10200, 3: 10400, 4: 10600, 5: 10800, 6: 11000 },
  21: { 1: 10000, 2: 10200, 3: 10400, 4: 10600, 5: 10800, 6: 11000 },
  22: { 1: 10000, 2: 10200, 3: 10400, 4: 10600, 5: 10800, 6: 11000 },
  27: { 1: 10000, 2: 10100, 3: 10400, 4: 10700, 5: 11000, 6: 11300 },
  28: { 1: 10000, 2: 10200, 3: 10400, 4: 10600, 5: 10800, 6: 11000 },
  29: { 1: 10000, 2: 10200, 3: 10400, 4: 10600, 5: 10800, 6: 11000 },
  30: { 1: 10000, 2: 10200, 3: 10400, 4: 10600, 5: 10800, 6: 11000 },
  31: { 1: 10000, 2: 10200, 3: 10400, 4: 10600, 5: 10800, 6: 11000 },
  35: { 1: 10000, 2: 10200, 3: 10400, 4: 10600, 5: 10800, 6: 11000 },
  // Non-standard scaling (out-of-scope scenario skills) — see header note.
  501: { 1: 1000, 2: 3000, 3: 5000, 4: 7000, 5: 10000 },
  502: { 1: 1000, 2: 2000, 3: 3000 },
  503: { 1: 5000, 2: 7500, 3: 10000 },
};

/** Raw (x10000) coef for a given ability_type + level. Falls back to 10000 (identity,
 *  i.e. x1.0) when unknown, or when level is undefined/<=1 (Lv1 is always the baseline). */
export function coef(abilityType: number, level: number | undefined): number {
  if (level === undefined || level <= 1) return 10000;
  const row = SKILL_LEVEL_COEF[abilityType];
  if (!row) return 10000;
  return row[level] ?? 10000;
}
