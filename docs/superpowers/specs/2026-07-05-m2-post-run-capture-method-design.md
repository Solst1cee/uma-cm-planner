# M2 · Post-run capture method — spike + two-producer decision

**Status:** Approved (design, 2026-07-05) · **Owner:** Sun
**Origin:** Brainstorm (superpowers:brainstorming). Revisits the capture layer of
[`2026-06-15-m2-f1-ocr-assist-design.md`](2026-06-15-m2-f1-ocr-assist-design.md) §5 (the "native companion")
after evaluating packet-interception (CarrotJuicer) for the Global client.

---

## 1. Problem

M2's SP optimizer needs a **`CaptureBundle`** from the post-run skill-purchase screen:
available SP, the offered skills, and their on-screen costs (ideally also stats/aptitudes/
strategy/course). The web app only *imports + validates* a `CaptureBundle`
([capture-bundle-contract.md](../../capture-bundle-contract.md)); a **separate native companion**
produces it. F1 left the companion's method undecided beyond "OCR, reference design in `spikes/ocr/`."
This spec decides the method for the **Global (Steam, Windows) client**.

## 2. Why not packet interception (CarrotJuicer)

CarrotJuicer, Hakuraku, and UmaLauncher all target the **DMM (Japan) Windows client** —
CarrotJuicer hooks the decryption function in that client's `libnative.dll`. Our target is
**Global on Steam**, a different build with different binaries and encryption. No community port
of CarrotJuicer-style interception to Global exists; doing it ourselves means reverse-engineering
the Global client's netcode encryption from scratch — highest effort, highest ToS risk (DLL
injection). **Rejected for Global.**

## 3. The Global-compatible path already exists: memory reading

UmaExtractor (xancia/UmaExtractor, fork of rockisch/umadump) — the roster importer Sun **already
runs** for M1 — is a Frida/memory-scan tool that reads the running **Global** client's process
memory and pulls out msgpack payloads (`trained_chara_array` on the Veteran List screen). That
proves the technique on our exact client.

The skill-purchase screen's data is the game's own `single_mode` API-response msgpack, resident in
the client's memory while that screen renders. So a UmaExtractor-style memory scan **retargeted at
the skill-screen response** is the Global analog of what CarrotJuicer does on JP — the same class of
work already validated in this project, and the only automated path that can also capture the
sim-context fields (stats/apt/strategy/course) OCR cannot read.

## 4. Options considered

| Option | Global-compatible? | Data quality | Effort | ToS/account risk | Status |
|---|---|---|---|---|---|
| **A. Memory reader** (extend UmaExtractor, retargeted to skill screen) | ✅ proven on our client | **Best** — exact ids + SP + costs + *stats/apt/course* | Medium (RE the skill-screen signature) | Memory-read only, no writes (== UmaExtractor) | Gated by §5 spike |
| **B. OCR companion** (validated `spikes/ocr/` pipeline) | ✅ client-agnostic | Good — names (fuzzy) + costs + SP; **no** stats/apt/course | Medium (pipeline already validated) | Lowest — screenshots only | Committed (§6) |
| C. Packet interception (CarrotJuicer-style) | ❌ needs full RE of Global netcode | Best | High | Highest — DLL injection | Rejected (§2) |
| D. Manual entry / M4-wishlist seed | ✅ | User types/confirms | None | None | Shipped |

## 5. Decision: spike-first on Option A, then a two-producer companion story

**A and B coexist as two producers, chosen by the user's comfort level** — not A-primary-with-B-as-
failure-only. Memory-read (A) for users who will run it (Sun); OCR (B) for users who won't touch
memory reading; manual (D) as the zero-install baseline. All three emit the **same `CaptureBundle`**
into the same web import (F1, unchanged). The spike below gates only whether **A is buildable**; **B
is committed regardless** (§6).

### 5.1 Spike — "Is the skill-screen data extractable from Global client memory?"

Goal: a **go/no-go on Option A**. If go → produce the msgpack field-map + a stable memory anchor to
build the companion. If no-go → B is the sole automated path, no time lost.

Split by capability (Claude cannot attach to the live game; Sun runs the captures):

1. **Desk research — schema (Claude, no game).** Pull the skill-learning / skill-tip `single_mode`
   response schema from the JP ecosystem — Hakuraku decoders, CarrotJuicer sample dumps,
   `umamusu-utils`/`umadump`. Output: exact msgpack field paths for `skill_id`, per-skill SP cost,
   available SP, and the chara block (stats/apt/strategy/course). Global ≈ JP structurally (same API,
   different server + encryption).
2. **Capture — one memory snapshot (Sun runs, Claude scripts).** On the live Global client, on the
   post-run skill-purchase screen, run a capture (extend the existing UmaExtractor/Frida attach, or a
   minimal fridump-style snapshot). Save to gitignored `spikes/`, `viewer_id` scrubbed (UmaExtractor
   hygiene).
3. **Offline decode (Claude).** Scan the dump for the step-1 field names / msgpack markers; decode the
   skill block; verify it contains ids + costs + SP; check whether stats/apt/course are co-resident;
   assess anchor stability across sessions.
4. **Decide against the gate (§5.2).**

### 5.2 Go/no-go gate for Option A

Option A is **go** iff **all** hold:
- the offered skill list + per-skill SP costs + available SP are present and decodable in memory, **and**
- there is a stable-enough signature/anchor to locate them automatically across sessions.

Bonus (does not gate): if stats/apt/strategy/course are co-resident, the companion can populate the
full sim-context and **F3 (context pre-fill) becomes unnecessary for this flow**.

Otherwise → **no-go**; Option B is the sole automated producer.

## 6. Committed fallback / alternative: Option B (OCR)

Regardless of the spike outcome, **Option B ships as an alternative producer** for users who decline
memory reading. Its reference design is the validated `spikes/ocr/` pipeline (F1 §6): OCR skill
**names** → fuzzy-match (Sørensen–Dice bigrams) to the dataset keeping aptitude marks `○/◎/●`; take
cost from dataset/screen; digit-OCR the available-SP pill. It cannot read stats/apt/strategy/course
→ those fall to form defaults (or manual). If the §5 spike is no-go, B is the only automated path; if
go, A and B coexist.

## 7. Guardrails

- **ToS posture:** memory-read only, **no writes** — identical to UmaExtractor, which Sun already runs.
  Private use. DLL injection (C) is out. (Consistent with the project's cite-and-deep-link ToS
  discipline; the capture companion is a separate project, not bundled into the local-first web app.)
- **Sample hygiene:** all captured dumps live under gitignored `spikes/`, `viewer_id`/owner ids
  scrubbed. Never committed.
- **Reuse-first (P1):** extend UmaExtractor/umadump rather than build fresh; borrow the Hakuraku/
  community msgpack schema rather than re-derive it.
- **Public-release swap:** as with the other private-use import feeds, the public build must not
  depend on any un-shippable capture tool; manual entry (D) is the always-available baseline.

## 8. Out of scope

- **Building the companion itself** — separate native project; this spec decides its *method* and
  gates A via the spike. A "build the companion" spec follows a go result.
- **Web-side import UX** — landed in F1 (`parseCaptureBundle`, import control, wishlist seed) and the
  buyable-skills results table (M2 mockup fidelity) are separate tracks.
- **Packet interception on Global** — rejected (§2).

## 9. Data flow (unchanged from F1)

`producer (memory-reader A ‖ OCR B ‖ manual D) → CaptureBundle JSON → [web] import →
parseCaptureBundle (validate) → editable form (confirm-on-entry) → rankBaskets`.

## 10. Next step

Run the §5 spike (start with step 1 desk research — no game needed). The spike's decode result
either opens a "build the memory-reader companion" spec (go) or promotes Option B to the sole
automated producer (no-go). Either way, Option B is specced-committed.

---

## Appendix A — Spike step 1 findings: msgpack field map (2026-07-05)

Desk research against the JP ecosystem (no game). Source: Hakuraku
`src/data/TrainedCharaData.ts` (SSHZ-ORG/hakuraku) — it decodes the shared chara structure the
game's msgpack uses everywhere (Veteran List + race + in-career), with raw master.mdb-aligned field
names. **Confidence** = VERIFIED (seen in Hakuraku decoder) / EXPECTED (well-known career-mode
field, to confirm against Sun's real dump in spike step 3).

**Chara block — VERIFIED field names** (same block UmaExtractor already reads for the roster):

| CaptureBundle field | msgpack path | Confidence |
|---|---|---|
| `stats.spd` | `speed` | VERIFIED |
| `stats.sta` | `stamina` | VERIFIED |
| `stats.pow` | `pow` (in-career) / `power` (trained_chara) — accept both | VERIFIED |
| `stats.gut` | `guts` | VERIFIED |
| `stats.wit` | `wiz` | VERIFIED |
| `aptitudes.distance` | `proper_distance_{short,mile,middle,long}` (int rank 1–8 → S…G) | VERIFIED |
| `aptitudes.surface` | `proper_ground_{turf,dirt}` | VERIFIED |
| `strategy` + apt | `proper_running_style_{nige,senko,sashi,oikomi}` (1=nige/front … 4=oikomi/end) | VERIFIED |
| `ownedSkills[]` | `skill_array[] → { skill_id, level }` | VERIFIED |

**Skill-purchase-screen fields — EXPECTED, confirm in step 3** (Hakuraku is race-replay focused and
does not decode the in-career acquisition screen, so these are from community knowledge, not the
Hakuraku decoder):

| CaptureBundle field | expected msgpack path | note |
|---|---|---|
| `spBudget` | `chara_info.skill_point` | the available-SP number the screen spends |
| `candidates[]` | `chara_info.skill_tips_array[]` (skill/group id + level) | the learnable "tips" the screen offers |
| `candidates[].screenSpCost` | **not in packet** | per-skill cost is looked up from master.mdb → **use our dataset `baseSpCost`** (F1's accepted fallback), not a packet field |
| `courseId` | not reliably on this screen | **prefer the active `CmPlan.cmRef`**; packet is optional |

**Implications for the method decision:**
- The stats/aptitude/strategy fields are VERIFIED-decodable and co-resident in the chara block →
  **if** `chara_info` (with `skill_tips_array` + `skill_point`) is resident on the skill screen,
  Option A captures full sim-context and **F3 becomes unnecessary** for this flow (§5.2 bonus).
- Per-skill SP cost is **never** a packet field on either method — it comes from our dataset. So
  memory-read and OCR both rely on `baseSpCost`; this is not an A-vs-B differentiator.
- The one true unknown left for the go/no-go gate: **is `skill_tips_array` + `skill_point` present
  and anchorable in the Global client's memory while on the post-run acquisition screen?** That is
  exactly what spike step 2 (Sun's capture) + step 3 (offline decode) answer.

**Step 2 handoff — what Sun's capture needs to contain:** navigate to the post-run skill-acquisition
screen, then dump. In step 3 we grep the dump for the byte patterns of `skill_tips_array`,
`skill_point`, and `skill_array` (msgpack string keys) to locate the chara block and confirm the
offered-skill ids + SP are decodable, plus test anchor stability across two dumps.

## Appendix B — Spike outcome: existing tool already solves most of it (2026-07-05)

Refreshing UmaExtractor (xancia/UmaExtractor `34248ef`) surfaced a **pre-existing skill-screen
extractor** we hadn't accounted for: `py/skills/skill_extract.py`. It **replaces the raw-msgpack
approach in §5.1/Appendix A with a cleaner technique** and answers the go/no-go gate before any
memory dump:

- **Technique upgrade — IL2CPP method hooking, not msgpack byte-scanning.** It Frida-`Interceptor`-
  hooks the game's own C# methods (`Gallop.SingleModeSkillLearningViewController.BeginView`,
  `MasterAvailableSkillSet.GetList…`, `PartsSingleModeSkillLearningListItem.UpdateItem`,
  `MasterSkillData.Get` for names). Reading the game's decoded structures gives **more** than a packet
  would: real **on-screen discounted cost** + **discount %** + **hint level** + acquired flags, plus
  resolved names/rarity.
- **Output** `skill_tree.json`: `acquired_skills[] {skillId,name,currentLevel}` +
  `buyable_skills[] {skillId,name,baseCost,discountedCost,hintLevel,discountPercent,rarity}`.
- **CaptureBundle coverage:** `candidates[]` (ids + `screenSpCost=discountedCost` + rarity + hint) and
  `ownedSkills[]` are **fully covered, exactly** (matchTier `exact`, no OCR fuzzing). The per-skill
  cost that "isn't in the packet" (Appendix A) **is** captured here because it's read from the UI
  structure, discount included.

**Revised gate result:** Option A is effectively **GO by reuse**, pending only Sun's confirmation
run on the Global client (the tool is Global-compatible; IL2CPP class names/offsets just need to
match — the README notes they can shift on a game update). The from-scratch memory-reader in §5.1 is
**not needed**.

**Remaining Option-A work (small):**
1. Sun runs `skill_extract.py` on Global → confirm attach + capture (spike step 2, unchanged goal,
   easier method). Share `skill_tree.json` + `--debug` `skill_extract.log`.
2. **Add SP-budget capture** — the one true gap; `skill_extract.py` captures the tree, not the SP
   wallet. Needs one more IL2CPP hook for available SP (`spBudget` is the optimizer's entire budget).
3. **Mapper** `skill_tree.json` (+ SP + `CmPlan` context) → `CaptureBundle` → existing F1 import.

Stats/aptitudes/strategy/course stay sourced from the active `CmPlan` (M4 already holds them), so F3
is unnecessary for this flow. Workspace + run instructions: gitignored `spikes/m2-capture/README.md`.

## Appendix C — Spike step 2 run findings + freeze fix (2026-07-05)

Sun ran `skill_extract.py` on the live Global client (Mejiro Dober, 2325 SP). Result: **GO, with the
cost/hint hooks isolated as unusable on Global.**

- **Works:** the IL2CPP `MasterSkillData.Get` hook resolves the **correct purchasable-skill list**
  (ids + names + rarity) on Global — proven by attaching while on the purchasing screen.
- **Blocker:** the cost/discount/hint hooks (`BeginView`/`UpdateItem`/`SetAcquire`, fixed offsets
  64/192/200) **freeze the game** on navigating into the purchasing screen — wrong Global offsets →
  garbage List count → unbounded UI-thread loop. This is the README's "offsets shift on game update"
  warning, realized.
- **Resolution:** don't chase those offsets. `spikes/m2-capture/capture_candidates.py` installs only
  the two safe hooks (`MasterSkillData.Get` + `MasterAvailableSkillSet.GetList…`), hard-clamps every
  list read, and never installs the view-entry hooks → captures the candidate list without freezing.
  **Costs = dataset `baseSpCost`** (F1's accepted fallback; on-screen discount deferred), **SP =
  typed** by the user (read off-screen). This keeps Option A's core value (the real offered list) and
  drops only the two nice-to-haves that carried the freeze risk.

**Net:** Option A stands, de-risked. The mapper (`candidates.json` + typed SP + `CmPlan` context →
`CaptureBundle`) is the remaining build; the on-screen-discount and SP-hook are optional later polish
gated on finding correct Global offsets safely.
