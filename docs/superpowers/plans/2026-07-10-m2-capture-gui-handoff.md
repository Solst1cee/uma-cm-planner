# Handoff — build a UmaExtractor-style GUI for the M2 capture tool

**For:** a fresh session. **Goal:** wrap the working M2 post-run capture CLI
(`spikes/m2-capture/capture_full.py` + `map_to_bundle.mjs`) in a one-button desktop GUI, like
UmaExtractor's, so a non-technical user can extract a post-run `CaptureBundle` and import it into the
`/sp-optimizer` page.

Read first: the design spec **`docs/superpowers/specs/2026-07-05-m2-post-run-capture-method-design.md`**
(Appendices A–L are the full journey + every gotcha) and **`spikes/m2-capture/README.md`**.

---

## 1. What already works (the CLI to wrap)

`spikes/m2-capture/` (all **gitignored** — personal-data hygiene; the capture companion is a separate
project from the web app by design, spec §5/§8):

- **`capture_full.py`** — the capturer. Python + `frida`. Attaches to the running **Global (Steam,
  Windows)** client, and produces **`career-capture.json`**: `spBudget`, final `stats`, `aptitudes`,
  `strategy`, and the purchasable `skills[]` with **real discounted cost + hint level**.
- **`map_to_bundle.mjs`** — Node. Maps `career-capture.json` → **`capture.bundle.json`** (a valid
  `CaptureBundle`, `docs/capture-bundle-contract.md`) by pricing/filtering against
  `public/data/skills.json`. Validated against the app's own `parseCaptureBundle`.
- Introspection helpers (already run, offsets baked into `capture_full.py`): `introspect.py`,
  `introspect_chara.py`, `introspect_singleton.py`. **Keep these** — they're how you re-derive IL2CPP
  offsets if a game update breaks the capture (see §5 gotchas).

**The proven user flow** (verified live, 2026-07-09, Mejiro Dober run: 43 skills, SP 2325, correct
stats/aptitudes, no freeze/stutter):

```
finish career → land on post-run page C → run capture_full.py
   → heap scan grabs stats/SP/aptitudes (once)
   → go C→D (skill purchase screen) → skills + real costs captured
   → Ctrl+C → career-capture.json
then: node map_to_bundle.mjs → capture.bundle.json → import at /sp-optimizer
```

Screen map: **A** menu · **B** career-summary popup · **C** post-run stats page · **D** skill-purchase
screen. C→D is the only navigation (you go to D to buy anyway); no backtrack.

## 2. The GUI to build

Model it on **UmaExtractor's own GUI** — `spikes/repos/UmaExtractor/py/extract_umas.py` `UmaExtractorApp`
(tkinter: title, help text, **Start** button, determinate progress bar, scrolling log box, "Open Output
Folder", threaded worker via `run_extraction(logger, progress)` + a `queue.Queue` drained on the UI
thread). Copy that skeleton; it's the same ecosystem and a clean reference.

**Key difference from UmaExtractor** (design this UX deliberately): UmaExtractor is *one-shot* on a single
screen (veteran list). Our capture is **two-phase** — stats on C, skills on C→D. So the button flow isn't
"click once, done." Recommended UX:

1. **Big status line drives the user**: on Start → "① Be on the post-run page, scanning for your
   uma…" → on scan success show the found stats → "② Now open the Skill screen" → on skills captured →
   "✓ Captured — saving." Auto-write when it has **both** a valid stat snapshot **and** ≥1 skill (no
   Ctrl+C). This replaces the CLI's manual Ctrl+C (spec Appendix H "auto-write" idea).
2. **Output**: default to writing `capture.bundle.json` (run the mapper for the user — see §3), and show
   its path + an "Open folder" button. Optionally also keep the raw `career-capture.json`.
3. **Progress**: the heap scan is the slow bit (~1s, scans rw memory) — drive the progress bar off the
   `scan` message's region count; the skill capture is instant.

Refactor `capture_full.py` so its body is a callable `run_capture(logger, progress, on_result)` (mirror
UmaExtractor's `run_extraction`) that the GUI runs on a worker thread and streams messages from — rather
than the current `main()` that blocks on `KeyboardInterrupt`.

## 3. Fold in the mapper (avoid a Node dependency)

`map_to_bundle.mjs` is Node; the GUI is Python. For a single standalone `.exe`, **port the mapper to
Python** (it's ~120 lines, pure): read `public/data/skills.json`, drop `unique`/`inherited_unique` and
`needPoint<=0`, price `screenSpCost = discounted needPoint`, carry gold `prereqSkillId`, map
stats/aptitudes/strategy, emit the `CaptureBundle` (schema in `docs/capture-bundle-contract.md`;
`source:'ocr'` today — consider adding a `'capture'` enum value app-side, spec Appendix D). Alternatively
shell out to `node`, but that adds a runtime dep and complicates packaging. **Port it.**

Aptitude reduction: the bundle needs one grade each for distance/surface/strategy. Strategy grade =
`aptitudes.style[chosen strategy]` (exact). Distance/surface = the race's category — the CLI takes
`--dist`/`--surface` or falls back to the uma's best grade. In the GUI, either add two dropdowns
(short/mile/middle/long, turf/dirt) **or** leave it to the web app's future F1.5 adapter (which reads the
plan's course). Best grade is a fine default with a "confirm in the app" note.

## 4. Packaging

UmaExtractor ships a standalone Windows `.exe` via **PyInstaller** — see `py/UmaExtractor.spec` and
`py/build/`. Do the same: bundle `frida` + `skills.json` (or fetch it) + the tkinter GUI. Note
`resource_path()` in `extract_umas.py` for `sys._MEIPASS` asset handling. Ship `skills.json` as a bundled
data file (it's the name/price source).

## 5. Load-bearing technical details + gotchas (from the spec appendices)

- **Attach:** process names `UmamusumePrettyDerby.exe` / keyword fallback (`uma|musume|derby|cygames`).
  Windows may need "run as admin" if the game is elevated. (extract_umas.py has good attach-error hints.)
- **Heap scan (Appendix J/K):** an il2cpp object's first pointer == its class ptr, so we scan rw memory
  for the `WorkSingleModeCharaData` class ptr (`charaKlass`), **probe `get_Speed` first** (1 cheap call
  filters ~all false positives), then read the full statline. **CALL THE CHARA GETTERS EXACTLY ONCE**
  (in the one-shot scan) — the freeze (Appendix K) was caused by hooking them AND re-calling every 2s;
  repeated il2cpp calls from Frida's thread during the C→D scene transition **deadlock the game**. Wrap
  the scan's managed calls in `il2cpp_thread_attach`/`detach` (GC-safe). After the scan, **make zero
  further calls into the game.**
- **No in-game name resolution (Appendix L):** do NOT hook `MasterSkillData.Get` — it fires ~40× during
  C→D (one `get_Name` il2cpp call each) → ~1s stutter. Names/rarity come from `skills.json` by skillId.
- **SP source:** the chara's `get_SkillPoint` didn't read on C; SP comes from the **D controller's
  `RemainingPoint@88`** (max value = full budget, before selecting). Stats/aptitudes come from the scan.
- **Trainee selection (may need tuning):** among valid chara instances the scan finds, trainee = has an
  SP pool (>0) + highest stat total. If a run finds multiple instances (parents/rivals resident) and
  picks wrong, refine this heuristic. Show the chosen statline so the user can sanity-check.
- **IL2CPP offsets are Global-build-specific and WILL drift on a game update.** Baked into
  `capture_full.py`: `WorkSingleModeCharaData` stat/apt getters; controller `RemainingPoint@88` /
  `_skillInfoList@64`; `SkillInfo._skillList@16`; learning-`Info` fields `SkillId@16 IsAcquired@24
  NeedPoint@44 CalcNeedPoint@48 OriginNeedPoint@52 Discount@56 HintLv@60`. If a patch breaks capture,
  re-run `introspect_chara.py` / read the `Info` field dump to re-derive (Appendix B/I). The GUI should
  fail gracefully with a clear "game updated — offsets need refresh" message, not a silent bad capture.
- **ObscuredInt:** stats/aptitudes are CodeStage `ObscuredInt` — must read via the getters (they
  deobfuscate); never read the raw fields. Getters read inline value memory (no pointer deref) → safe to
  call on scan false-positives.

## 6. ToS / provenance

Memory-**read only, no writes** — same posture as UmaExtractor (which the maintainer already runs).
**Private use.** All captured files stay gitignored; scrub nothing sensitive is committed. This companion
is a separate project from the local-first web app (which never bundles capture code).

## 7. Definition of done

A Windows `.exe` where the user: opens it → sees "be on the post-run page, then click Extract" → clicks
Extract → (scan finds uma, status guides them to the skill screen) → gets `capture.bundle.json` + an
"Open folder" button → imports it at `/sp-optimizer` and Analyze works. No terminal, no Ctrl+C, no `node`.

## 8. Reference index

- Spec + all gotchas: `docs/superpowers/specs/2026-07-05-m2-post-run-capture-method-design.md` (App. A–L)
- Capture README: `spikes/m2-capture/README.md`
- CLI to wrap: `spikes/m2-capture/capture_full.py`, `map_to_bundle.mjs`
- GUI reference: `spikes/repos/UmaExtractor/py/extract_umas.py` (+ `UmaExtractor.spec` for packaging)
- Bundle contract: `docs/capture-bundle-contract.md` · validator: `parseCaptureBundle` in
  `src/core/spOptimizer.ts`
- Offset re-derivation: `spikes/m2-capture/introspect_chara.py` (+ `introspect.py`,
  `introspect_singleton.py`)
- Branch with all this work: `docs/m2-capture-method`
