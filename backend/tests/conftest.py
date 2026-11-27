import importlib
import shutil
import uuid
from pathlib import Path

import pytest
from app.core.config import get_settings
from app.db.session import Base, get_session
from app.main import app, windows
from app.models import embeddings  # noqa: F401
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker


@pytest.fixture
def store(tmp_path, monkeypatch):
    schema = "rad_test_" + uuid.uuid4().hex
    import os

    url = os.environ.get("TEST_DATABASE_URL", get_settings().database_url)
    admin = create_engine(url)
    with admin.begin() as con:
        con.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        con.execute(text("CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public"))
        con.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_engine(url, connect_args={"options": f"-c search_path={schema},public"})
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT current_schema()")) == schema
    Base.metadata.create_all(engine, checkfirst=False)
    with engine.connect() as connection:
        assert connection.scalar(text("SELECT count(*) FROM shoes")) == 0
        assert (
            connection.scalar(
                text(
                    "SELECT count(*) FROM information_schema.tables WHERE table_schema=:schema AND table_name='shoes'"
                ),
                {"schema": schema},
            )
            == 1
        )
    factory = sessionmaker(engine, expire_on_commit=False)
    data_dir = tmp_path / "data"
    shutil.copytree(Path(__file__).parent / "fixtures", data_dir)
    importer = importlib.import_module("app.importers.catalog")
    monkeypatch.setattr(importer, "SessionLocal", factory)
    monkeypatch.setattr(importer, "ROOT", tmp_path)
    report = importer.import_catalog(data_dir)
    with factory() as session:
        yield session, report, importer, data_dir
    engine.dispose()
    with admin.begin() as con:
        con.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
    admin.dispose()


@pytest.fixture
def client(store, monkeypatch):
    monkeypatch.setattr(get_settings(), "fx_auto_refresh", False)
    session = store[0]

    def override():
        yield session

    app.dependency_overrides[get_session] = override
    windows.clear()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
