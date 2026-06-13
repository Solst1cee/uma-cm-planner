# NOTICE — Attribution & Licensing

`uma-cm-planner` is licensed under **GPL-3.0-only** (see [LICENSE](LICENSE)).

## Upstream code lineage

This project borrows algorithms and (in later phases) vendors simulation-engine code from the following GPL-licensed projects. Per GPLv3 §5(a), vendored files we modify carry modification notices; this file preserves the upstream copyright chain:

- **uma-skill-tools** & **uma-tools** — Copyright (C) 2022 pecan (alpha123), GPL-3.0-or-later. https://github.com/alpha123/uma-skill-tools
- **VFalator / umalator fork line** — contributors incl. Transparent Dino, jechtoff2dudes, Kachi. https://github.com/kachi-dev/uma-tools
- **umalator-global ("Torena Sim")** — jalbarrang, GPL-3.0-only. https://github.com/jalbarrang/umalator-global — source of the data-pipeline approach, SP cost algorithm, and (Phase 4) the vendored simulation engine, pinned at v0.14.2 (`c1fa2107`).

Mechanics numbers are community research — sources cited per-value in [docs/mechanics-notes.md](docs/mechanics-notes.md), notably Ice's Affinity & Inspirations sheet (@BourBon_Polaris's empirical data) and CrazyFellow's guides.

Card/skill catalog snapshots derive from **GameTora** (https://gametora.com) — used with attribution; not affiliated.

## Game data & assets — NOT covered by our GPL grant

Game data extracted from *Umamusume: Pretty Derby* (skill parameters, course geometry, names, etc.) and any game imagery are the property of **Cygames, Inc.** This project is an unofficial fan tool, not affiliated with or endorsed by Cygames. Game-derived data is included under fair-use rationale for interoperability and analysis; the GPL license applies to this repository's **code only**, not to Cygames-owned data. No copyright infringement is intended; rights holders may contact the maintainer for removal.

The image files under `public/data/icons/` (a curated, Global-only WebP subset of skill icons, support-card chips, and uma portraits — see [docs/provenance.md](docs/provenance.md) §2.1) are likewise Cygames game art, included under the same fair-use / asset-exclusion rationale and **not covered by the GPL grant**.
