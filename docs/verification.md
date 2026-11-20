# Executed verification — 20 November 2026

**Current refinement results:** [Glass Studio delivery and verification](glass-studio/delivery.md). [Previous Nocturne results](redesign/delivery.md). The matrix below records the preserved bright baseline.

| Check | Actual result |
|---|---|
| Project-local dataset copy | 13 filenames, byte counts and SHA-256 hashes verified |
| Final original-directory audit | Source and local copies still match the original manifest; no source modification |
| Migration | Alembic `001` applied to real PostgreSQL 18.6 |
| Full import | 1167 shoes, 27048 measurements, 3845 verified colorways, 4739 dated offers |
| Complete re-import | 1167 updates, no duplicate shoe/variant/offer/measurement records |
| Every base model accessible | All 1167 distinct original IDs matched through 25 live paginated API responses |
| Backend | **36 passed** using PostgreSQL, with explicit schema-isolation assertions |
| Frontend | **13 passed** across six Vitest files |
| Browser matrix | **21 passed**, desktop 1440×1000, tablet 820×1180, mobile 390×844 |
| Final affected-browser recheck | **6 passed** after comparison-difference and touch-target refinements; refreshed final screenshots |
| Ruff | Passed for backend and scripts |
| Mypy | Passed for 20 backend source files |
| ESLint | Passed |
| TypeScript | Passed as part of production build |
| Production build | Passed; route chunks emitted, bundled local fonts |
| npm audit | Zero vulnerabilities after updating the initial Vitest dependency |
| Actual browser inspection | Catalog, filter dialog, color selection, anatomy and tablet/mobile/desktop comparison inspected |
| Compose | YAML structure, service healthchecks, private ports and read-only import mounts checked |
| Docker execution | **Not run** — Docker is unavailable on this host |
| 21st | Authenticated initialize/tools/list/free search verified; 51 tools discovered; existing Codex process lacks inherited key |
| Git | Incremental Conventional Commits, original author retained, requested co-author trailer; no push or merge |

The browser journeys cover real search/filter/detail/colorway/anatomy/comparison operations, URL restoration, native dialog focus restoration, keyboard Enter/Space selection, reduced motion, interrupted mode changes, sparse geometry, empty results, broken images, API retry, atomic min/max ranges and explainable preferences. No page-wide horizontal overflow was observed at the tested widths; comparison overflow is confined to its scroll region.

The backend suite initially exposed a test-harness search_path error. It was corrected by explicitly creating private schema tables with `checkfirst=False` and asserting current schema, empty test tables and schema ownership before fixture import. The local demo catalog was restored through the importer. Final tests do not modify the application catalog, and the complete live API ID audit confirms restoration.

One non-failing Starlette TestClient transport deprecation warning remains. Browser runner color-environment warnings are cosmetic. Screenshots use reduced motion to capture settled states; ordinary-motion browser journeys are also tested. External photos remain dependent on their source CDN. No paid 21st retrieval, AI generation, purchase, public deployment or GitHub push was performed.
