# Shoe Discovery App — Shared Project Memory

Verified checkpoint: **2026-11-26 (Asia/Tehran)**. This is repository-local shared
context, not global memory. Read AGENTS.md too. Code is authoritative; check Git
status and upstream before working. Relative paths below start at the Git root.

## Overview and current state

RAD (راد) helps Persian-speaking shoppers discover, understand and compare footwear,
then visit a retailer. Browsing needs no account. It is a working local full-stack
product with a dark RTL interface, catalog, explainable finder, comparison, technical
diagrams, store listings with toman conversion and a protected admin analytics panel.
Backend is **FastAPI, not Django**. No runtime LLM, AI agent or Jev integration is implemented.
The finder uses deterministic rules. Public deployment is not verified.

Current local DB was checked read-only during this initialization: **1167 shoes,
27048 measurements, 3845 variants, 12375 offer listings**, of which **7551** are
`ShoeStoreLinks`. Alembic revision is **004**. Runtime process state is transient;
do not assume servers survive a reboot or a new session.

## Repository and collaboration checkpoint

- Root on the original workstation: `/Users/parsaalikhani/Desktop/AI Product Engineer`.
  Use `git rev-parse --show-toplevel` on another checkout; do not create a nested repo.
- Active/upstream branch: `feat/volumetric-shoe-intro` /
  `origin/feat/volumetric-shoe-intro`; also GitHub's default branch at this checkpoint.
- Repository: <https://github.com/am-ma-karami/torob-sneakers-technical-project>.
  Origin fetch uses HTTPS; push uses `git@github.com:am-ma-karami/torob-sneakers-technical-project.git`.
  Existing SSH authentication worked; HTTPS push previously lacked credentials.
- Before initialization, HEAD and freshly fetched upstream both pointed to
  `90714cc` and working/staging trees were clean. All seven local branches had been
  published previously. Saved `baseline/*` branches are historical recovery points.
- Current user authorization permits committing/pushing **only AGENTS.md and
  MEMORY.md for initialization**. Future commits/pushes require authorization.
  When authorized, retain both collaborators' established Git attribution. Recover
  exact author/co-author metadata with `git show -s --format=full 46977f6`.
- Fresh sessions must recheck synchronization. Do not infer remote state from this
  checkpoint or rewrite history to remove a normally deleted file.

## Stack and architecture map

- Python 3.11+, FastAPI, Pydantic Settings, SQLAlchemy 2, psycopg, PostgreSQL with
  `pg_trgm`, Alembic, httpx. Dependencies: `pyproject.toml`, `requirements.lock`.
- Node 22.12+, React 19, TypeScript, Vite 7, React Router 7, TanStack Query 5,
  Motion 12, Three.js, lucide-react. Lockfile: `frontend/package-lock.json`.
- Styling is existing CSS, not a new component framework. Fonts are locally bundled
  Vazirmatn, Manrope, Bodoni Moda and JetBrains Mono.

| Area | Relevant paths and responsibilities |
| --- | --- |
| HTTP startup/config | `backend/app/main.py`, `core/config.py`, `db/session.py` under `backend/app/`: middleware, bounded requests/rate limiting, DB sessions, optional FX lifecycle |
| Public APIs | `backend/app/api/routes.py`; schemas in `backend/app/schemas/` |
| Business/data access | `backend/app/services/{catalog,presentation,offers,exchange_rates,analytics}.py`, `backend/app/repositories/` |
| Persistence/import | `backend/app/models/{catalog,admin}.py`, `backend/app/importers/{catalog,store_links}.py`, `backend/alembic/versions/` (migrations 001–004) |
| Frontend entry | `frontend/src/main.tsx` installs Query/Router/Motion/comparison providers; `App.tsx` routes and lazy loads detail/compare/finder/directories/admin |
| API/state contracts | `frontend/src/lib/{api,types,catalogState,compareValues,format}.ts`, `frontend/src/lib/comparison.tsx` |
| Product components | `frontend/src/components/`: gallery, filters, cards, comparison picker/tray, anatomy, scores, offers, brand/sport icons |
| Presentation content | `backend/app/content/`: Persian review translations/overrides and reviewed store-host manifest |
| Tooling | `Makefile`, `.github/workflows/ci.yml`, `scripts/`, `compose.yaml`, Dockerfiles and `frontend/nginx.conf` |

Data flow: supplied private files → explicit transactional CLI import → PostgreSQL
normalized identities, metrics and JSONB provenance → repository/service → bounded
API response → TanStack Query → components. Filters live in URLs; comparison also
persists a bounded selection in localStorage. Vite/nginx proxies same-origin `/api`.
The browser never downloads the raw dataset. No import HTTP endpoint exists.

## Feature inventory

| Feature/status | Implementation and important behavior |
| --- | --- |
| Home: implemented | `pages/Home.tsx`, `components/FeaturedShowcase.tsx`: four featured products, rotating intro, then normal homepage; skip/chapter controls and static fallback |
| Catalog/search: implemented | `pages/Catalog.tsx`, `FilterPanel.tsx`, `lib/catalogState.ts`; `/shoes`, debounced Persian/English aliases, server pagination, numeric ranges, stable sorting, URL restoration; OR within facet, AND across facets, disjunctive counts |
| Directories: implemented | `pages/Directories.tsx`, `BrandLogo.tsx`, `SportIcons.tsx`; `/brands`, `/categories`; **64** local brand-logo manifest entries; tree/tennis racket/basketball icons; retain responsive scrolling performance |
| Detail/color: implemented | `pages/Detail.tsx`, `ProductGallery.tsx`; `/shoes/:slug` (`/shoe/:slug` redirects), genuine product photos, explicit colorway URL selection, zoom dialog, measurements, source scores, translated pros/cons when available, fit/brand-size context |
| Lab charts: implemented | `lib/gallery.ts` separates recognized shock-absorption charts from photo thumbnails; detail renders a separate chart section with one shared explanatory caption, not invented per-image analysis |
| Comparison: implemented | `pages/Compare.tsx`, `ComparisonPicker.tsx`, `ComparisonTray.tsx`, `lib/comparison.tsx`; `/compare/select` searchable selection → `/compare` results; **2–4** shoes, persistent tray, shareable IDs/colorways, differences-only, technical groups; preserve the established result layout |
| My shoe/finder: implemented | `pages/Finder.tsx`, `services/catalog.py`; `/finder`, category/activity, category-specific brand choices, hard weight/drop maxima, soft width/weight/foam preferences; top 12, explicit match/miss/unknown reasons; rule points are not probability |
| Technical anatomy: implemented schematic | `AnatomyViewer.tsx`, `lib/anatomy.ts`: assembled/exploded/profile/internal-fit SVG modes, Motion, mouse/touch/keyboard layer selection, replay and missing-data gating; not factory CAD or the home GLBs |
| Retailers: implemented snapshot UI | `StoreOffers.tsx`, offers backend; direct `#stores` anchor, domestic/foreign/all filters, six rows/page, ascending toman price, original foreign currency, explicit errors/unknown states; model-level CSV links, not exact color/size inventory |
| Admin: implemented first module | `/admin`, `pages/Admin.tsx`, `pages/admin.css`, `lib/admin.ts`; protected shoe × store unique viewers/clickers/CTR, dates, search, merchant/market filters, active-only, sorting, pagination, mobile cards; no general catalog/store CRUD yet |

## UI/UX and assets to preserve

- Persian RTL, **Latin digits everywhere**, including dates/prices; use
  `lib/format.ts`, not locale defaults that reintroduce Persian numerals.
- CSS load order in `main.tsx`: `styles.css` → `theme.css` → `glass.css`.
  Final Glass Studio tokens include background `#171d27`, surface `#263448`,
  text `#f3f2ee`, beige accent `#c7ac88`, blue `#a6c8e9`. Selective blur,
  solid fallbacks, visible focus, native dialogs and reduced-motion support.
- Mobile filters use a dialog; comparison overflow stays inside its own region.
  Do not introduce page-wide horizontal scrolling or blur every brand/card.
- `frontend/src/lib/{brandLogos,featuredMedia}.json` records asset provenance;
  `frontend/public/media/{brands,featured,studio}/` ships local optimized media.
  SVG/transparent marks are preferred; retain small raster/white carriers where
  needed. General galleries still depend on external product-image CDNs.
- Intro identities in order: adidas Adizero EVO SL **40586**, Nike Pegasus 41
  **40390**, ASICS Novablast 6 **41349**, Saucony Endorphin Speed 5 **40830**.
  `components/shoe-studio/photos.json` ties the exact colorway/photos to four GLBs.
- `shoe-studio/{OrbitStage.tsx,orbit.ts}` lazily renders photo-textured reconstructed
  meshes with lights and demand rendering; loads active/neighbor models and disposes
  resources. These are approximate silhouettes, **not licensed factory scans**;
  unseen surfaces/toe shape can remain imperfect. Do not claim full photogrammetry.
- `shoe-studio/usePacedScroll.ts`: `chapterDistance=300`, `rotationDistance=234`;
  wheel/touch distance drives rotation, then handoff. Roughly 2–3 mouse strokes per
  shoe; reverse input retraces it. No time-based autonomous spin after input stops,
  no frame-by-frame photo swapping, no global scroll slowdown outside the intro.
  Trackpad momentum is attenuated, so physical gesture behavior varies by device.
- Reduced motion, Save Data, disabled switches, model/WebGL failure use posters.
  Root environment switches: `VITE_ENABLE_3D_INTRO`, `VITE_ENABLE_SCROLL_SHOWCASE`,
  `VITE_ENABLE_DEPTH`; restart/rebuild Vite after changing.
- Offline builder: `scripts/studio/build_models.py ORIGINALS_DIR` needs matching
  multi-view originals plus Pillow/NumPy (not runtime dependencies). Do not regenerate
  GLBs casually. Four GLBs and studio photos currently total about **5.9 MB**.

## Dataset, measurement and commerce contracts

- Thirteen original files are intentionally Git-ignored at the root. Authoritative
  import inputs: `shoes-ui.json`, `visualization-data.json`, `source-records.jsonl`;
  `DATA_DIR=.` resolves against repository root. Smaller CSV uses UTF-8 BOM.
  `docs/dataset-verification.json` records checksums; all 13 checked successfully
  during initialization. A fresh checkout must obtain private inputs separately;
  `--demo` can import the four credited test models for an initial preview.
- Sources: supplied RunRepeat lab/reviews/photos, ShoeGeometry version 2026-11-14
  and SoleHunt; keep source attribution and redistribution limitations. Detailed
  field/source/method coverage: `docs/data-contract.md`, `docs/architecture.md`.
- Original integer shoe ID/exact slug is identity. Do not merge generations, GTX/WP,
  children/adults or width variants. Family is only a browsing heuristic. Colorways
  require explicit source mapping; do not borrow other colors' photos or offers.
- Missing ≠ zero. Keep lab/manufacturer/photo-estimated values and provenance
  distinct. Asker C, Shore A, BR/old breathability, SA absorption and energy return
  are different scales. Current internal width ≠ old-method width/platform width.
  Brand size conversions ≠ stock. Photo-derived dimensions use a 300 mm reference.
- DB normalized tables include `shoes`, `measurements`, `variants`, `source_products`,
  `offer_listings`, immutable `offer_observations`, refresh watermarks, rejections,
  `exchange_rates` and private `source_payloads`; legacy `offers` remains an archive.
  Imports are atomic/idempotent and preserve records owned by other feeds.
- CSV working copy: ignored `.local/imports/shoe-store-links.csv`; original remains
  with its provider. **7557** rows → **7551** accepted (**176** Iran, **7375** foreign),
  **277** unpriced; six ambiguous rows sharing purchase URLs across different models
  are quarantined. Earlier feeds' **4824** offers remain. See `docs/store-links.md`.
- Exact product mapping, source/listing IDs and reviewed HTTPS host allowlists are
  mandatory. `backend/app/content/store-retailers.json`, `core/commerce.py`,
  `schemas/offers.py` and `services/offers.py` govern ingestion. Feed rows cannot
  approve their own domains. Conflicting/unmatched rows stay out of purchase results.
- Decimal prices preserve original amount/currency. IRT means toman; IRR ÷ 10.
  Foreign USD/EUR/GBP/AUD use cached **TGJU free-market** quotes with source URL,
  retrieval time, original provider time label and stale state. No fixed/guessed
  fallback, fabricated timestamp, taxes/customs/shipping or USDT substitution.
  Refresh preserves last good rates on failure; default refresh 3600s/stale 24h.
- Stock observations expire after `OFFER_TTL_HOURS` (24 by default). Import time is
  not a fresh stock check; snapshots never become live verified stock. Exact
  size/width filters must match the same explicit inventory row. Missing offers are
  retired only for explicitly complete, clean, correctly dated source/shoe snapshots.
- Public endpoints: `/api/catalog`, `/facets`, `/taxonomy`, `/shoes/{slug}`,
  `/shoes/{slug}/offers`, `/compare`, `/finder`, `/finder/brands`, `/featured`,
  `/presentation`, `/shoes/{slug}/scores` (all suffixes use the `/api` prefix).
  Offer pagination max 48; detail embeds at most 20; featured/compare/scores omit
  offers. Catalog price filters mean USD MSRP; offer filters need explicit currency,
  except sourced `price_toman` sorting. Do not silently change those semantics.

## Admin analytics and privacy boundary

- Apply migration 004. CLI `python -m app.admin --username NAME` prompts privately;
  `--generate-password` writes ignored owner-only `.local/admin-access.json` and
  refuses overwrite. Never print or commit its contents. Accounts have no public
  signup. Read `docs/admin-panel.md` before extending this module.
- `core/admin_auth.py`, `api/admin.py`, `models/admin.py`, `repositories/analytics.py`
  and `services/analytics.py` under `backend/app/` own authentication/reporting.
  Salted PBKDF2 (600k), hashed opaque revocable sessions (default 12h), HttpOnly
  SameSite Strict cookies, persistent login throttling, origin/CSRF checks and
  no-store responses. Production HTTPS requires `ADMIN_COOKIE_SECURE=true`.
- A view requires ≥50% of a store row visible continuously for 1 second in a visible
  tab (`frontend/src/lib/storeTracking.ts`). A purchase-intent click navigates via
  `/api/out/{shoe_id}/{offer_key}`; server resolves/validates the destination, never
  trusts a URL query. Telemetry failure must not block valid navigation.
- Random anonymous browser cookie; only hash is stored. Unique viewer/clicker per
  shoe × source retailer across the selected date window, not sums of daily uniques.
  Click also creates the corresponding view. Dates use Asia/Tehran, inclusive
  Gregorian inputs, max one year. Counts identify browsers, not people or purchases.
  Admin visits, DNT/GPC, prefetch/subresource requests are excluded. No historical
  traffic is fabricated; no customer IP/UA is retained in analytics.
- APIs: `/api/admin/{login,session,logout,analytics/stores}` and public qualified
  `/api/analytics/store-impressions`. Reports require server-side admin auth.
- General Playwright requests send DNT=1. Admin e2e deliberately uses a separate
  DNT=0 test visitor and records hashes in ignored `.local/admin-e2e-visitors.json`.
  After such tests clean only those exact synthetic visitors, never real traffic.

## Running, testing and deployment

For a fresh checkout: create `.venv`; install `requirements.lock`, then
`pip install --no-deps -e .` using `.venv/bin/python -m pip`; run
`npm --prefix frontend ci`. Copy `.env.example` only if `.env` does not exist.
Never overwrite another developer's private environment. Full setup: `docs/setup.md`.

Existing workstation cluster is `.local/postgres`, port **55432**:

```sh
# Only if the existing project cluster is stopped; do not reinitialize it.
pg_ctl -D .local/postgres -l .local/postgres.log -o '-p 55432 -h 127.0.0.1 -k /tmp' start
make migrate
make backend   # foreground terminal: http://127.0.0.1:8000
make frontend  # separate terminal: http://127.0.0.1:5173
```

Check ports/processes before starting duplicates. Reboot stops dev services; a
connection-refused browser page usually needs restarting them, not reimporting data.
`/api/health` is liveness; `/api/ready` checks nonempty catalog; `/api/docs` is dev only.
For first provision, import explicitly: `python -m app.importers.catalog` using the
venv, then `make rates`, `make import-stores` with private inputs. Do not reimport
merely to restart the application. Back up before schema/data changes.

Environment names: `DATABASE_URL`, `DATA_DIR`, `CORS_ORIGINS`, `ENVIRONMENT`,
`API_PROXY_TARGET`, `RATE_LIMIT_BACKEND`, `OFFER_TTL_HOURS`, `RETAILER_DOMAINS`,
`FX_AUTO_REFRESH`, `FX_REFRESH_SECONDS`, `FX_STALE_HOURS`, `ADMIN_COOKIE_SECURE`,
`ADMIN_SESSION_HOURS`, optional reference-price pair `REFERENCE_USD_TOMAN` /
`REFERENCE_RATE_AT`, the three Vite switches above, and Compose `POSTGRES_PASSWORD`.
`API_KEY_21ST` is a private development-tool credential, never Vite/runtime content.
`docs/tooling.md` explains the optional project-local 21st setup. No global change
is needed for memory; installed `.agents/` vendor skills are ignored.

```sh
make lint                              # Ruff, mypy, ESLint, TypeScript
.venv/bin/pytest -q                    # real PostgreSQL isolated test schemas
npm --prefix frontend run test -- --maxWorkers=2
make build
# Browser install once; e2e requires running frontend/backend and populated data:
cd frontend
PLAYWRIGHT_BROWSERS_PATH=../.local/playwright npm exec -- playwright install chromium
npm run test:e2e -- e2e/stores.spec.ts --project=desktop --project=mobile
```

Tests: `backend/tests/`, `frontend/src/**/*.test.*`, `frontend/e2e/`; Playwright
projects desktop/tablet/mobile. Admin e2e additionally needs private local account
setup and skips if credentials file is absent. `make test` runs backend, unit and
the full browser suite; it is not an offline smoke check. `TEST_DATABASE_URL` may
target a dedicated DB with schema creation/pg_trgm privileges. Never remove schema
isolation assertions in `backend/tests/conftest.py`.

CI (`.github/workflows/ci.yml`) runs backend migration/lint/mypy/pytest with PostgreSQL
and frontend lint/typecheck/unit/build; **not browser tests**. Compose configuration
exists (app on loopback 8080, private DB/backend, explicit importer tools, persistent
volume); container/nginx execution is **not verified** on this workstation. Do not
expose the backend directly in proxy rate-limit mode. See `docs/commerce-backend.md`.

## Validation evidence and limitations

- **This initialization:** fresh remote fetch showed 0 ahead/0 behind at `90714cc`;
  inspected source/config/history; verified 13 dataset hashes, 1167 JSON models,
  64 logo entries, 4 GLBs; read-only DB counts/revision verified above. Only the two
  memory files changed. Root placement, read/update instructions, local links,
  whitespace and credential-pattern checks passed. Application regression suites
  were **not rerun** for this documentation-only task.
- **Prior executed verification**, documented at `46977f6` / `docs/admin-panel.md`
  on 2026-11-26: 101 backend tests, 30 frontend unit tests, lint/type checks/build,
  desktop/mobile admin and store journeys passed. Earlier catalog/detail/finder/
  comparison desktop journeys also passed. This is historical evidence, not a
  claim they were executed by this initialization or that remote CI passed.
- Historical reports in README, `docs/verification.md`, `docs/import-report.json`,
  `docs/glass-studio/assets.md` and `docs/3d-intro/delivery.md` contain old branch,
  no-push, counts or pre-GLB claims. Current code/newer commerce/admin docs supersede
  them. Do not revert working GLBs based on an older photographic fallback note.
- Known limits: approximate 3D geometry, external photo CDN dependency, snapshots
  rather than live prices/stock, no exact CSV color/size inventory, no order/payment
  confirmation. The previous build had a nonblocking large Three.js chunk warning.
  Physical-device performance and public production/container operation need checks.

## Pending work and handoff

No application edit is in progress and no P0 blocker is established. Next developer
should read these two files, check branch/status/fresh upstream, then inspect only
the modules relevant to the next user request. Do not treat recommendations as
approved implementation work.

- **P1 recommendations before deployment:** validate Docker/nginx/HTTPS operation,
  secure-cookie/origin configuration and real-device intro performance. Container
  setup is supplied but unexecuted here.
- **P2 explicit future intent:** extend admin modules gradually. Scope beyond current
  store-funnel reports is unspecified. A live feed/stock refresh scheduler is absent;
  integrate only with verified source IDs, currency, timestamps and mapping rules.
- **P2 recommendation:** reconcile historical README/design/dataset reports with
  current delivery; this initialization intentionally edits only the two root files.
- **P3 exploratory:** user mentioned Jev for AI-product differentiation, but no
  provider contract or approved integration spec is present. Clarify intended role
  before implementation; keep existing deterministic recommendations functioning.

## Recent significant changes

Developer attribution for these entries is the verified author/co-author in each
Git commit; no private identities are duplicated here. Use `git show COMMIT` for detail.

- **2026-11-26, this initialization:** populated root AGENTS.md/MEMORY.md; repository
  memory only, no runtime/schema/dependency/UI edits. Validation is listed above;
  authorized Git delivery uses subject `docs: initialize shared persistent project memory`.
  Verify its exact hash/publication from Git, rather than a self-referential hash.
- **2026-11-26, `90714cc`:** removed `docs/demo.md` and its README link; committed
  and pushed to the default branch. Do not restore the demo guide unintentionally.
- **2026-11-26, `46977f6`:** admin store-view/click reporting, authentication,
  migration 004, frontend tracking/admin page, regressions and `docs/admin-panel.md`.
- **2026-11-23, `c75abc5` / `6ebfddf`:** sourced toman prices/CSV storefront and
  hardened independently owned retailer ingestion, migrations 002/003; preserved
  prior data. Earlier UI/intro/finder decisions are consolidated in the sections above.
