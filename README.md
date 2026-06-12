# Uma CM Planner

Local-first web app for *Umamusume: Pretty Derby* (Global) **Champions Meeting build planning**. Working name — see plan §14.3.

Four modules (build order): **Skill Acquisition Planner** → Inheritance Planner → SP Purchase Optimizer → Meta Intel Workspace. Full design: [uma-cm-planner-plan.md](uma-cm-planner-plan.md); data/algorithm provenance: [docs/provenance.md](docs/provenance.md); verified mechanics: [docs/mechanics-notes.md](docs/mechanics-notes.md).

- All your data stays in your browser (IndexedDB) with JSON export/import. No accounts, no server.
- Game data is baked in at build time from community-maintained extractions (see provenance).
- Simulations/probabilities are **estimations** — the UI surfaces reliability tiers and caveats rather than fake precision.

## Develop

```sh
pnpm install
pnpm dev        # local dev server
pnpm test       # vitest unit tests
pnpm typecheck
pnpm data:build # regenerate public/data/ from borrowed sources + data-overrides/
```

License: **GPL-3.0-only** ([LICENSE](LICENSE)); attribution chain and the Cygames fair-use notice are in [NOTICE.md](NOTICE.md).
