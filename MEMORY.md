# Shoe Discovery App — Shared Project Memory

Verified checkpoint: **2026-11-27 (Asia/Tehran)**. This is repository-local shared
context, not global memory. Read AGENTS.md too. Code is authoritative; check Git
status and upstream before working. Relative paths below start at the Git root.

## Overview and current state

RAD (راد) helps Persian-speaking shoppers discover, understand and compare footwear,
then visit a retailer. Browsing needs no account. It is a working local full-stack
product with a dark RTL interface, catalog, explainable finder, comparison, technical
diagrams, store listings with toman conversion and a protected admin analytics panel.
Backend is **FastAPI, not Django**. Offline local CLIP image/specification embeddings
are implemented. Hybrid retrieval is available through POST /api/search; a separate semantic search UI is now available.
Metis gpt-4o translates queries, then local CLIP encodes them; no AI agent/Jev integration. The finder uses deterministic rules.
Public deployment is not verified.

Current local DB was checked on 2026-11-27 after Iranian coverage review: **1167 shoes,
27048 measurements, 3845 variants, 13070 offer listings**, of which **8246** are
`ShoeStoreLinks` (**871** domestic, **7375** foreign). **348** models have an Iranian
link; **819** still lack one. These include historical links, not all currently
in stock. Alembic revision is **005** with pgvector **0.8.7**. All **1167** canonical
products have separate 512-dimensional image/text vectors (**2334** total).
Runtime process state is transient;
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
- At domestic-ingestion task start, fresh fetch showed 0 ahead/behind at `d5e8c3e`.
  Fresh fetch on 2026-11-27 again showed 0 ahead/behind at that commit, with no staged
  changes. The domestic importer/host registry/tests/docs changes described below are currently
  **uncommitted and unpushed**; no publication authorization was given for that task.

## Stack and architecture map

- Python 3.11+, FastAPI, Pydantic Settings, SQLAlchemy 2, psycopg, PostgreSQL with
  `pg_trgm` and `vector`, Alembic, httpx, NumPy/pgvector Python adapter. Dependencies:
  `pyproject.toml`, `requirements.lock`; optional local CLIP worker packages in
  `requirements-embeddings.lock` (torch/Transformers/Pillow), not HTTP inference.
- Node 22.12+, React 19, TypeScript, Vite 7, React Router 7, TanStack Query 5,
  Motion 12, Three.js, lucide-react. Lockfile: `frontend/package-lock.json`.
- Styling is existing CSS, not a new component framework. Fonts are locally bundled
  Vazirmatn, Manrope, Bodoni Moda and JetBrains Mono.

| Area | Relevant paths and responsibilities |
| --- | --- |
| HTTP startup/config | `backend/app/main.py`, `core/config.py`, `db/session.py` under `backend/app/`: middleware, bounded requests/rate limiting, DB sessions, optional FX lifecycle |
| Public APIs | `backend/app/api/routes.py`; schemas in `backend/app/schemas/` |
| Business/data access | `backend/app/services/{catalog,presentation,offers,exchange_rates,analytics}.py`, `backend/app/repositories/` |
| Persistence/import | `backend/app/models/{catalog,admin,embeddings}.py`, `backend/app/importers/{catalog,store_links,domestic_crawls}.py`, `backend/alembic/versions/` (migrations 001–005); review workflows in `docs/{domestic-crawls,iran-coverage}.md` |
| Offline embeddings | `backend/app/embeddings/{spec,documents,clip,images,__main__}.py`; `repositories/embeddings.py`, `services/embeddings.py`, `tests/test_embeddings.py`; commands/contracts in `docs/embeddings.md` |
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
| Domestic crawls: implemented reviewed subset | `backend/app/importers/domestic_crawls.py`, `docs/domestic-crawls.md`: nine registered merchants, 641 exact-reviewed listings from five stores; Allsport's 6727 additional rows remain pending; existing storefront/admin automatically include approved offers |
| Iranian coverage: applied reviewed batch | `docs/iran-coverage.md`: 54 links from PL Kicks, Mahabad Running, Colobis and Fandug gave 52 models their first Iranian link; source identities and prices use existing store-link services |
| CLIP embeddings: implemented/populated | `docs/embeddings.md`: pgvector, 1167 canonical primary-photo vectors plus 1167 pooled specification vectors; resumable CLI; POST /api/search now adds Metis translation/local CLIP hybrid retrieval; no ANN index/UI changes |
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
- CLIP stage 1 uses `openai/clip-vit-base-patch32` at revision
  `3d74acf9a28c67741b2f4f2ea7635f0aaf6f0268`, recipe `rad-shoe-clip-v1`; model key
  `eeaaff8590188a20ac6d11a7268f0805284cfc928365ea95d9ab3923cb57770b`.
  `embedding_models` records this descriptor; `product_embeddings` is keyed by
  `(shoe_id, model_key, modality)`, stores normalized `vector(512)`, content hash,
  timestamps and provenance. Other dimensions require a schema change. No ANN index.
  One canonical `summary.image_url` per shoe is embedded, not gallery charts or all
  variant photos; no inferred colorway mapping. English sourced attributes/pros/cons
  and all DB measurements retain units/origins/method context, with unknowns absent.
  Token payloads are split losslessly into ≤77-token contexts with repeated identity;
  normalized chunk means yield one normalized text vector. **12443** chunks processed.
  Image/text vectors remain separate; numeric precision/conditions belong in SQL,
  and CLIP Persian query quality/retrieval weights have not been evaluated.
- `python -m app.embeddings` plans without downloads/writes; `--apply`/`make embeddings`
  explicitly computes/commits bounded batches; `--status`/`make embeddings-status`
  reads stored coverage without loading CLIP. The worker loads heavy packages lazily,
  uses MPS automatically on this workstation (CPU/CUDA options exist), with no remote
  inference API. Public pinned weights load with token=False/trust_remote_code=False.
  `.local/embeddings/` holds private model/photo caches, reports and hashes. Cached
  observations are not fresh downloads. Unchanged runs skip inference; failed photo
  runs are partial/exit 2 and retry missing work. Fatal interruptions preserve earlier
  batches; an advisory lock prevents duplicate CLI writers. `--refresh-images` checks
  same-URL image updates. Catalog imports don't auto-refresh/invalidate vectors;
  stored coverage isn't a stale-input audit. Rerun after changes and check hashes
  before future retrieval uses them. Full details: `docs/embeddings.md`.
- DB normalized tables include `shoes`, `measurements`, `variants`, `source_products`,
  `offer_listings`, immutable `offer_observations`, refresh watermarks, rejections,
  `exchange_rates` and private `source_payloads`; legacy `offers` remains an archive.
  Imports are atomic/idempotent and preserve records owned by other feeds.
- CSV working copy: ignored `.local/imports/shoe-store-links.csv`; original remains
  with its provider. **7557** rows → **7551** accepted (**176** Iran, **7375** foreign),
  **277** unpriced; six ambiguous rows sharing purchase URLs across different models
  are quarantined. Earlier feeds' **4824** offers remain. See `docs/store-links.md`.
- New 2026-11-26 crawl packages stay outside Git, originally under Downloads in
  `STORE-2026-11-26/`. Input `review.csv` is an unapproved mapping form; sibling
  `listings.jsonl` supplies actual prices/observations. Completed copies live at
  `.local/domestic-crawls/reviews/STORE.csv`. Of 3213 rows, **641** were imported:
  Mahabad Katoni 74, NP Style 85, Padoon 46, Red Kicks 397, Safir Sport 39; 195 models,
  270 shoe/store pairs. **2572** pending rows are not automatically approved.
  Kafshesport/Pelaza require unresolved product-level originality evidence; Xtep has
  no matching canonical brand/models. Ambiguous editions/codes and zero/test/range
  prices also remain pending. Existing data and original input hashes were preserved.
- Additional `allsport-2026-11-27/` package has **6727** unapproved rows: **5994**
  explicitly unavailable, **733** unknown stock, **725** positive toman prices.
  **Zero** were admitted as purchase offers. The full private pending review copy
  is `.local/domestic-crawls/reviews/allsport.csv`; one source row (9243) has no title.
  Ten candidate product pages explicitly label quality `تولید داخل`; their attachment
  to original branded canonical models remains unresolved. Do not generalize this
  to every product or mistake `Adidas Originals`/`طرح اصلی` for proof of originality.
  Allsport has ID-bearing PrestaShop URLs, not Woo `/product/` paths. Adapter guards
  reject source conflicts, unavailable/unknown Allsport stock, child collection 125
  and missing product-originality evidence. Across nine packages **9299** remain pending.
- User explicitly requires **inventory located inside Iran**, excluding Iranian
  order-from-abroad intermediaries. Research added **54** links: PL Kicks 21,
  Mahabad Running 24, Colobis 5, Fandug 4, with exact reviewed hosts. Primary page
  stock/price and domestic dispatch evidence are captured privately. Mahabad Running
  HTML discounted prices differed from its public Store API; primary visible prices
  were used, with original page observation times. Six questionable generation,
  GTX/width/vintage candidates were excluded. No metrics/color/size inventory added.
  `.local/iran-coverage/` contains approved CSV/audit, baseline, dry-run/apply reports,
  public evidence and API/UI verification. Reimport uses existing `store_links`
  identities; don't route these 54 through the crawl adapter. Prior **13016** offers
  were unchanged; repeat import added no offers/history (observations **17809**).
  Fresh verified backup: `.local/backups/before-domestic-crawls-20261127T102231Z.dump`.
- Crawl adapter CLI: `python -m app.importers.domestic_crawls ORIGINAL_REVIEW_PATH...`
  using the venv, with `--reviews-dir .local/domestic-crawls/reviews`; default executes
  and rolls back real service validation, `--apply` persists. Use this adapter for
  subsequent snapshots: stable listing `crawl:PRODUCT_ID`, mapping
  `crawl:STORE:PRODUCT_ID` within `ShoeStoreLinks`; do not double-import the same crawl
  via older loaders/generic CSV. No schema/dependency change. Reports/backup remain
  ignored/private. Detailed source guards and reproducible commands:
  `docs/domestic-crawls.md`. Neither input scripts nor fuzzy candidates are executed
  as approval logic. No color/size inventory or independent authenticity is inferred.
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
Install pgvector on the DB server before migration 005 (Python adapter alone is not
enough). Optional offline inference also needs `requirements-embeddings.lock`.
Local verified worker: torch 2.15.0, Transformers 4.57.6, Pillow 12.3.0, Apple MPS.
Homebrew install failed on an unrelated untrusted MongoDB tap; no tap trust changed.
Official pgvector tag v0.8.7 was compiled from ignored `.local/pgvector-src` using
the active Xcode SDK because PGXS referenced an absent older SDK. Extension installed
for Homebrew PostgreSQL 18.6; migration 005 applied after verified private backup.

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
make embeddings-status                # stored image/text coverage, no inference
# Install optional worker deps first; explicit source/model refresh:
make embeddings
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

CI (`.github/workflows/ci.yml`) runs backend migration/lint/mypy/pytest with pgvector PostgreSQL
and frontend lint/typecheck/unit/build; **not browser tests**. Compose configuration
exists (app on loopback 8080, private DB/backend, explicit importer tools, persistent
volume); DB image now `pgvector/pgvector:0.8.7-pg18`. Existing former Alpine-image
volumes require a reviewed logical backup/restore into a separate compatible volume;
don't blindly switch or delete them. Container/nginx execution is **not verified** on this workstation. Do not
expose the backend directly in proxy rate-limit mode. See `docs/commerce-backend.md`.

## Validation evidence and limitations

- **CLIP embeddings, 2026-11-27:** full `.venv/bin/pytest -q` passed **152 tests**;
  17 embedding tests reran/passed after final token-warning adjustment. Ruff/mypy,
  `pip check`, editable install and whitespace checks passed. Migration 005's populated
  upgrade/metadata comparison passed in isolated schemas. Real four-product CLIP smoke
  run and full 1167-product MPS run completed with zero failures; repeat full run wrote
  zero vectors, skipped 1167 per modality, loaded no encoder. All 2334 vectors verified
  dimension 512/unit norm (0.999999886–1.000000153); text chunks use 8–77 tokens.
  Read-only COPY-row comparison with verified pre-migration backup matched all shoes,
  measurements, variants, offer listings and observations; no backup restored over DB.
  Final CLI status confirmed 1167 image/text pairs; running ready/catalog/detail APIs
  returned 200 with DNT=1. Compose/workflow YAML parsed successfully (not executed).
  Evidence: `.local/embeddings/{smoke-run,catalog-run,reimport-run,verification,backup-comparison}.json`;
  backup `.local/backups/before-domestic-crawls-20261127T104924Z.dump`. Frontend/browser
  and Docker execution not rerun; no production frontend change. Do not imply hybrid
  retrieval/Persian search quality was tested. See `docs/embeddings.md`.
- **Iranian coverage/Allsport follow-up, 2026-11-27:** `.venv/bin/pytest -q` passed
  **135 tests** (four existing deprecation warnings); Ruff and mypy passed. Actual
  store importer dry run rolled back cleanly, then 54 links applied after verified
  `pg_dump`/`pg_restore --list`; repeat import changed neither offers nor observations.
  All 54 new rows passed running API price/stock checks, four merchant redirects and
  admin-group inclusion. Two existing desktop/mobile store e2e journeys passed;
  additional private desktop/mobile checks verified new Mahabad Running display,
  discounted price and contained layout. DNT=1 throughout. Allsport's 6727 pending
  rows produced zero offers and original source hashes stayed unchanged. No frontend
  unit/lint/type/build rerun for this follow-up; no production frontend/schema/dependency
  changes. Research batch and review limitations: `docs/iran-coverage.md`.
- **Domestic ingestion task, 2026-11-26:** 127 backend tests, 30 frontend unit tests,
  Ruff/mypy/ESLint/TypeScript and two desktop/mobile store browser journeys passed.
  New regression coverage includes rolled-back dry runs, unapproved rows, source
  identity/host/edition/price guards, cross-source preservation, idempotency and
  storefront/outbound/admin inclusion. Browser legacy assertions now tolerate more
  domestic results/pagination instead of assuming old listings occupy page one.
  Applied 641 links after a verified private backup; reimport added zero listings
  or observations (17755 unchanged). All 12375 earlier offers and 16 original source
  file hashes were retained. Frontend production build was not rerun; no production
  frontend code changed. General browser checks used DNT=1.
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

The domestic-ingestion and Iranian coverage batches are loaded locally and validated;
Allsport is integrated as a private pending review with no valid purchase rows yet.
Source/tests/docs are uncommitted/unpushed, awaiting publication authorization.
Preserve this working tree. No P0 blocker is established. Next developer should
check status/upstream, read `docs/{domestic-crawls,iran-coverage}.md` for retailer work
and obtain private snapshots/review copies if importing on another machine. Remaining
9299 source rows require evidence or canonical coverage; do not approve them en masse.
819 models still have no Iranian link. Partial cached specialist discovery is
unapproved; future expansion needs fresh exact identity/stock/local-dispatch review.
Embedding stage 1 and hybrid API are populated/validated and committed locally; not pushed. Source
and docs are in this working tree; vectors/weights/private reports are not in Git.
Another machine must obtain a private DB backup or rerun the documented worker.
Hybrid search is now implemented in the backend; see docs/hybrid-search.md. The existing catalog remains lexical; /finder now embeds hybrid search beside manual selection.
Persian labeled relevance evaluation, weight tuning, public load/cost tests and UI integration remain pending.
Do not treat roadmap recommendations as approved implementation work.

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

For committed entries, developer attribution is the verified author/co-author in
Git history; no private identities are duplicated here. Use `git show COMMIT` for detail.

- **2026-11-27, current session (uncommitted):** pgvector migration 005, optional
  pinned local CLIP worker, normalized separate image/spec vectors for all 1167 shoes,
  resume/cache/hash/provenance guards, 17 tests, CLI/Make targets and setup/embedding docs.
  Base/optional dependencies and Compose/CI DB image updated; no search/UI integration
  or publication. Validation/counts/private backup paths above.
- **2026-11-27, current session (uncommitted):** expanded reviewed Iranian model
  coverage 296→348 with 54 purchase links; registered Allsport and preserved its
  6727-row pending review without fabricating stock/authenticity. Added guards/tests,
  updated registry, README and `docs/{domestic-crawls,iran-coverage}.md`; validation
  and private audit/backup paths above. No commit/push authorization given.
- **2026-11-26, current session (uncommitted):** added eight-host domestic crawl
  adapter, source review/price/edition guards, 26 new backend test cases and adapted
  store e2e assertions; imported 641 links. Files: `backend/app/importers/domestic_crawls.py`,
  `backend/app/content/store-retailers.json`, `backend/tests/test_domestic_crawls.py`,
  `frontend/e2e/stores.spec.ts`, `docs/domestic-crawls.md`, README.md and MEMORY.md.
  No migration/dependency/UI production change; checks/counts/limitations above.
  Next: additional exact review if evidence arrives; commit/push only when authorized.

- **2026-11-26, this initialization:** populated root AGENTS.md/MEMORY.md; repository
  memory only, no runtime/schema/dependency/UI edits. Validation is listed above;
  authorized Git delivery uses subject `docs: initialize shared persistent project memory`.
  Verify its exact hash/publication from Git, rather than a self-referential hash.
- **2026-11-26, `90714cc`:** removed `docs/demo.md` and its README link; committed
  and pushed to the default branch. Do not restore the demo guide unintentionally.
- **2026-11-26, `46977f6`:** admin store-view/click reporting, authentication,
  migration 004, frontend tracking/admin page, regressions and `docs/admin-panel.md`.

## Hybrid search API checkpoint — 2026-11-27

POST /api/search accepts q, limit (1–48), filters (CatalogQuery). Metis OpenAI-compatible
Chat Completions translates queries to English; local cached pinned CLIP CPU query vectors
rank the existing spec/photo embeddings. Never compare OpenAI text embeddings to CLIP.
New paths: backend/app/{schemas,services,repositories}/search.py, api/routes.py, tests/test_search.py;
docs/hybrid-search.md. METIS_API_KEY is a SecretStr in ignored owner-only .env; never print/read
its contents into docs. METIS_MODEL defaults gpt-4o; only user query goes to provider.
No migration or re-embedding. Weighted RRF (lexical 1, specs 1, image 0.7; k=60) combines
bounded top-100 channels; exact pgvector cosine scans, structured hard SQL filters, stale
text hash/changed-primary-URL exclusion. Numeric prose is not automatically a hard filter.
Explicit lexical fallback handles provider/encoder failure. Existing catalog UI/API unchanged.
API search now lazily loads optional CLIP dependencies; stage-1 statements about no HTTP
inference are historical for the embedding-only stage. Cached weights only, no HTTP-time downloads.
Fresh checks: 156 full backend tests passed, then 22 search/embedding targeted tests passed
after adding positive dual-modality/stale-vector coverage; Ruff/mypy passed. Real Persian
Metis translation succeeded; live POST /api/search returned 200 hybrid and exact EVO SL first.
Frontend/browser/load/relevance evaluation not run. No commit/push authorized.

## Semantic search UI delivery — 2026-11-27

Authorized scope now includes local commits for embedding/search prerequisites and this UI; no push requested.
Embedding infrastructure is committed at 78acae1. Hybrid API is committed at 1efe140. This final commit delivers the independently linked semantic UI.
Unrelated retailer importer/data changes remain uncommitted and must be preserved.
Current entry is /finder; the semantic form replaces the left explanation panel.
frontend/src/pages/SemanticSearch.tsx and semantic-search.css submit POST /api/search with
limit=10 only on explicit submit; compact dedicated cards now render returned order below the form.
Visible loading, retryable error, empty results and explicit lexical-fallback notices; abort on
unmount, prevent duplicate submits, labeled textarea capped at 400 characters, Latin digits.
frontend/e2e/semantic-search.spec.ts verifies real hybrid results (10 cards), navigation, no
requests while typing, mobile overflow, error and fallback. Frontend lint, TypeScript/build
and 30 unit tests passed; four desktop/mobile e2e journeys passed again with final mobile navigation visibility assertions.
Backend 8000 and frontend 5173 were already running and reused; no duplicate server started.

Semantic UI final checks: 30 unit tests, ESLint, TypeScript and production build passed;
four desktop/mobile real-API/error/fallback journeys passed after the navigation fix.
Three local feature commits preserve established author/co-author attribution. No push performed.
Site available at http://127.0.0.1:5173/finder; backend on 8000.

Unified finder flow — 2026-11-27 (supersedes two independent searches):
/finder has one parent form and one submit button. Right controls and left semantic
textarea build a single POST /api/search request via frontend/src/lib/finderSearch.ts.
Selected filters are appended to the user's text; category/brand/weight_max/drop_max
are also explicit hard CatalogQuery filters. Width/weight/foam preferences remain soft
text preferences. Category defaults to empty (no implicit running); unset/any fields
are omitted. Brand choices use taxonomy for no category and the category-specific
endpoint after selection. Text-only, filters-only and combined input work; fully
blank submission asks for input without an API call. No /api/finder result request.
One output section “گزینه‌هایی برای مقایسه” requests up to 9 results and uses existing
ShoeCard/comparison-tray behavior, with factual explanations and no rule-score claims.
No gray placeholder/loading cards. /semantic-search still redirects to /finder.
SemanticSearch.tsx is now a controlled input panel; independent state/results/portal
were removed. Same query can be explicitly resubmitted; no paid-query automatic retry,
focus/reconnect refetch. Existing backend /api/finder remains for compatibility.
Combined q cap is now 1800 chars (user textarea remains 400); Metis translation budget
is 320 tokens / 120 words. Long English queries use the existing lossless chunk pooling
with generic “Footwear search” identity, preserving all appended constraints rather
than truncating or rejecting them at 77 tokens. No product re-embedding/schema changes.
Fresh checks: 24 backend search/embedding tests, Ruff/mypy, 32 frontend unit tests,
ESLint and TypeScript/production build passed. All six desktop/mobile browser cases passed again after final loading-text cleanup and comparison assertions. Full backend suite not rerun.
Unrelated retailer work remains untouched; only this feature is staged/committed.
