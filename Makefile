.PHONY: migrate import backend frontend test lint build
migrate:
	.venv/bin/alembic upgrade head
import:
	.venv/bin/python -m app.importers.catalog
backend:
	.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
frontend:
	npm --prefix frontend run dev
lint:
	.venv/bin/ruff check backend scripts
	.venv/bin/mypy backend/app
	npm --prefix frontend run lint
	npm --prefix frontend run typecheck
test:
	.venv/bin/pytest -q
	npm --prefix frontend run test
	npm --prefix frontend run test:e2e
build:
	npm --prefix frontend run build

.PHONY: rates import-stores
rates:
	.venv/bin/python -m app.services.exchange_rates
import-stores:
	.venv/bin/python -m app.importers.store_links $(FILE)
