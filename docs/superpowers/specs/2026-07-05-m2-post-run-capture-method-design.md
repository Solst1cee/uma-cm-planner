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
