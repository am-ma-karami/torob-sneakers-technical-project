# راد · RAD — footwear, understood

A working Persian/RTL footwear discovery and comparison application, now using the Nocturne dark editorial interface. React 19 + TypeScript + Vite + TanStack Query + Motion + GSAP ScrollTrigger; FastAPI + PostgreSQL + SQLAlchemy + Alembic + Pydantic Settings. No account is needed to browse or compare.

**Local application:** <http://127.0.0.1:5173> · **API readiness:** <http://127.0.0.1:8000/api/ready> · **Development API docs:** <http://127.0.0.1:8000/api/docs>

The catalog contains all **1167** original models, **27048** measurements, **3845** verified colorway records and **4739** dated offers. Imported data is in PostgreSQL; the browser never downloads the raw archive. Exact generations and variants retain their identity.

- Debounced Persian/English search with aliases, server pagination, disjunctive multi-select facets, numeric ranges and shareable URLs.
- Category and brand directories, real product photography, verified color galleries, with stale retailer offers retained internally and removed from the interface.
- Custom parameterized SVG anatomy: assembled, exploded, side profile and internal fit; mouse/touch/keyboard layer selection, internal provenance and data-based mode availability.
- Up to four shoes in a persistent comparison tray; shareable comparison, color selection, differences-only and expandable technical groups.
- Preference discovery with transparent activity/width/weight/cushion rules; source scores and measurement methods stay separate.
- A focused home with four real featured shoes; dedicated `/shoes`, `/shoes/:slug`, `/compare`, `/finder`, `/brands`, `/categories` and `/about` pages.
- Purposeful GSAP/Motion/CSS interactions with reduced-motion support, responsive filters and horizontally contained mobile comparison.

The redesign report, current verification, before/after images and exact rollback/configuration steps are in [docs/redesign/delivery.md](docs/redesign/delivery.md). The bright baseline remains available on `baseline/bright-ui-2026-11-20`.

## Run locally

From this existing folder (do not create a nested checkout):

```sh
cd "/Users/parsaalikhani/Desktop/AI Product Engineer"
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.lock
.venv/bin/python -m pip install --no-deps -e .
npm --prefix frontend ci
```

Keep the existing ignored `.env`. On another machine, copy `.env.example` to `.env`, choose private database credentials, and point `DATABASE_URL` at a PostgreSQL database. `DATA_DIR=.` resolves against this repository root. Supply the ignored raw dataset files in the root; see [setup](docs/setup.md) and [data contract](docs/data-contract.md).

The project-local PostgreSQL cluster prepared on this machine is under `.local/postgres`, on port **55432**. If it is stopped:

```sh
pg_ctl -D .local/postgres -l .local/postgres.log -o '-p 55432 -h 127.0.0.1 -k /tmp' start
```

Apply migrations and import:

```sh
.venv/bin/alembic upgrade head
.venv/bin/python -m app.importers.catalog
```

In two terminals, run `make backend` and `make frontend`. Open <http://127.0.0.1:5173>. The services started for this implementation are already serving that URL while the local development environment remains running. Stop a foreground dev server with Ctrl+C. Stop only the project cluster using `pg_ctl -D .local/postgres stop`.

## Docker

Docker/Compose files are included. Set a private URL-safe `POSTGRES_PASSWORD` in `.env`, then:

```sh
docker compose up --build -d
docker compose --profile tools run --rm importer
```

Open <http://127.0.0.1:8080>. PostgreSQL has a persistent named volume and no published port; backend is internal; frontend binds only loopback. Startup migrates before serving. Import is an explicit CLI service with three read-only dataset-file mounts; archives are excluded from images. `/api/health` is liveness; `/api/ready` verifies nonempty catalog readiness. `docker compose down` keeps the data volume. Docker was not installed on this host, so container execution is not claimed as tested; local PostgreSQL/API/React execution is verified.

## Checks

```sh
make lint
make test
make build
```

Browser tests require local backend and frontend servers. Install the project-local test browser once:

```sh
cd frontend
PLAYWRIGHT_BROWSERS_PATH=../.local/playwright npm exec -- playwright install chromium
npm run test:e2e
```

Backend tests use explicitly created temporary PostgreSQL schemas and four small, credited fixtures; no raw archive is needed in CI. PostgreSQL must allow schema creation and have `pg_trgm` available. `TEST_DATABASE_URL` can target a dedicated test database. The test suite checks its schema before inserting fixture data.

[Verification results](docs/verification.md) · [Screenshots](docs/screenshots.md) · [Five-minute demo](docs/demo.md) · [Design system](docs/design-system.md) · [Tool status](docs/tooling.md) · [Security and tradeoffs](docs/architecture.md)

## Sources

RunRepeat laboratory measurements, supplied review excerpts and externally hosted product photography are credited on the discreet About/credits page; per-record provenance remains internal. ShoeGeometry (2026), Running-shoe geometry dataset, version 2026-11-14, [CC BY 4.0](https://shoegeometry.com/data). [SoleHunt public data](https://solehunt.app/data), CC BY 4.0. Diagram adaptations are schematic, not factory CAD. Font redistribution notices ship at `/font-licenses.txt`.

Development branch: `feat/shoe-discovery`, connected to the requested GitHub repository. Commits preserve the existing primary author and include the requested co-author. No push, public deployment or merge is part of this delivery.
