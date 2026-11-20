"""Create the dedicated local database; never modify any existing database."""

from urllib.parse import urlsplit

import psycopg
from app.core.config import get_settings

url = get_settings().database_url.replace("postgresql+psycopg:", "postgresql:")
name = urlsplit(url).path.lstrip("/")
with psycopg.connect(url.rsplit("/", 1)[0] + "/postgres", autocommit=True) as connection:
    if not connection.execute("SELECT 1 FROM pg_database WHERE datname=%s", (name,)).fetchone():
        connection.execute(psycopg.sql.SQL("CREATE DATABASE {}").format(psycopg.sql.Identifier(name)))
print("Project database ready.")
