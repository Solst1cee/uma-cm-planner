# CaptureBundle JSON — import contract (M2)

`CaptureBundle` is the JSON the M2 SP optimizer imports (spec
`docs/superpowers/specs/2026-06-15-m2-f1-ocr-assist-design.md` §4). Any producer
(the native capture companion, a hand-authored file, this app's own export) that
emits a valid bundle can feed M2. `parseCaptureBundle` (`src/core/spOptimizer.ts`)
is the **authoritative validator** — it rejects malformed input with a descriptive error.

## Shape
```jsonc
{
  "schemaVersion": 1,
  "source": "ocr",            // "manual" | "ocr" | "video"
  "capturedAt": "<ISO 8601>",
  "server": "global",         // "global" | "jp"
  "dataVersion": "<dataset version matched against>",
  "seed": 12345,              // optional; fixed seed -> reproducible sims
  "context": {
    "umaId": "",
    "stats":  { "spd": 0, "sta": 0, "pow": 0, "gut": 0, "wit": 0 },
    "aptitudes": { "distance": "A", "surface": "A", "strategy": "A" },
    "strategy": "pace",       // "front" | "pace" | "late" | "end"
    "courseId": "10101",
    "spBudget": 2285,         // available SP (the number a companion really reads)
    "ownedSkills": [],
    "pinned": [],
    "candidates": [
      { "skillId": "200332", "rarity": "white", "screenSpCost": 110, "matchTier": "exact" },
      { "skillId": "200331", "rarity": "gold",  "screenSpCost": 160, "prereqSkillId": "200332", "matchTier": "fuzzy" }
    ]
  }
}
```

## Producer notes (native companion)
- A skill-screen capturer can populate `candidates` (name->`skillId` match + on-screen cost) and `spBudget`. It cannot read `stats`/`aptitudes`/`strategy`/`courseId` off that screen — leave them at defaults; the user confirms in the form (or M2.F3 supplies them).
- `matchTier` ('exact' | 'fuzzy' | 'manual') drives the UI confidence badge.
- The validated OCR reference design lives in the spec §6 (ported from the gitignored `spikes/ocr/`).
