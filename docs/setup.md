# Reproducing setup

Use Python 3.11+, Node 22.12+ and PostgreSQL with `pg_trgm`. Keep all development inside this repository. Dependency versions are locked in `requirements.lock` and `frontend/package-lock.json`. Native/system libraries and container image minor tags can still change; pin image digests for release-grade reproducibility.

## Data provision

Obtain the prepared dataset from its provider. The raw dataset is intentionally not in Git. All 13 original filenames are specifically ignored, including archives, compact CSV, JSON and audit files. Copy files without modifying the originals:

```sh
.venv/bin/python scripts/copy_datasets.py "/path/to/supplied/merged"
python3 scripts/verify_datasets.py
```

The copy helper preflights all existing destination files by checksum and refuses differing content before copying. It verifies byte counts and SHA-256 after copy and writes `.local/dataset-copy-report.json`. The verification helper checks the supplied snapshot against the committed manifest. Different future snapshots should be reviewed and receive a new manifest, rather than bypassing a checksum mismatch.

The importer requires `shoes-ui.json`, `visualization-data.json`, and `source-records.jsonl` at `DATA_DIR`. The remaining files support audit and schema interpretation. It does not read the original Documents directory. There is no web import/admin endpoint.

## Environment and PostgreSQL

Create `.env` from `.env.example` only if it does not already exist. Never overwrite another developer's environment. Use `postgresql+psycopg://USER:PASSWORD@HOST:PORT/DATABASE`. Keep credentials out of shell arguments/logs. The prepared local environment uses a random private password and a dedicated local cluster. On a fresh macOS installation with PostgreSQL tools available, the following initializes a project-local cluster using the private `.env` password without echoing it:

```sh
.venv/bin/python scripts/init_local_cluster.py
```

That helper refuses to replace an existing cluster, initializes SCRAM authentication and binds loopback port 55432. It requires a matching `.env` DATABASE_URL for user `rad` and the dedicated local database. For an existing external PostgreSQL server, skip cluster initialization, create the database through your normal administration process, then run migrations.

```sh
.venv/bin/alembic upgrade head
.venv/bin/python -m app.importers.catalog --demo   # four representative models for a first preview
.venv/bin/python -m app.importers.catalog          # complete catalog
```

Import reports are written to `.local/import-report.json`. Re-import is atomic and idempotent. A normal first complete import creates 1167 records; a second complete import reports 1167 updates and no new IDs. Raw JSONB archive storage intentionally costs more database space in exchange for auditability.

Run `make backend` and `make frontend` in separate terminals. Vite proxies `/api` to local FastAPI. URLs, filtering and comparisons work without a login. To use another API port, set `API_PROXY_TARGET` when starting Vite. CORS origins are explicitly configured through JSON-valued `CORS_ORIGINS`.

## Docker execution

The compose default starts db, backend and frontend. The backend waits for PostgreSQL health, migrates, then starts the API. Its liveness health check enables the frontend and import job; catalog readiness stays empty until data is imported. After `docker compose up --build -d`, run `docker compose --profile tools run --rm importer`. Imports do not run on every API startup. There is no public database port or import API. No raw archive is baked into images.

Backend runs as UID 10001. Frontend uses an unprivileged Nginx image on port 8080. PostgreSQL uses its official image and persistent volume. `docker compose down` preserves the database volume; do not add `--volumes` unless intentionally deleting development data. The compose database is distinct from the host project-local PostgreSQL cluster.

## Design tools and credentials

Install UI UX Pro Max within this root using `npx --yes ui-ux-pro-max-cli@latest init --ai codex`. [Tooling status](tooling.md) explains actual usage and how to launch a new Codex process with the private 21st environment variable. Neither tool is required to run the shoe catalog.
