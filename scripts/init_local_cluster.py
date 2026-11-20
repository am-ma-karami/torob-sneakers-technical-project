"""Initialize a dedicated loopback-only development cluster without printing secrets."""

import os
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urlsplit

from app.core.config import ROOT, get_settings

url = urlsplit(get_settings().database_url.replace("postgresql+psycopg:", "postgresql:"))
if url.username != "rad" or url.hostname != "127.0.0.1" or url.port != 55432 or not url.password:
    raise SystemExit("Configure DATABASE_URL for rad on 127.0.0.1:55432 with a private password first.")
local = ROOT / ".local"
local.mkdir(exist_ok=True)
cluster = local / "postgres"
if not (cluster / "PG_VERSION").exists():
    if cluster.exists():
        raise SystemExit("Partial cluster exists; inspect it before proceeding.")
    with tempfile.NamedTemporaryFile(mode="w", dir=local, delete=False) as file:
        file.write(url.password + "\n")
        password_file = Path(file.name)
    os.chmod(password_file, 0o600)
    try:
        subprocess.run(
            [
                "initdb",
                "-D",
                str(cluster),
                "-A",
                "scram-sha-256",
                "-U",
                "rad",
                "--pwfile=" + str(password_file),
                "--encoding=UTF8",
                "--locale=C",
            ],
            check=True,
        )
    finally:
        password_file.unlink()
status = subprocess.run(["pg_ctl", "-D", str(cluster), "status"], stdout=subprocess.DEVNULL)
if status.returncode:
    subprocess.run(
        [
            "pg_ctl",
            "-D",
            str(cluster),
            "-l",
            str(local / "postgres.log"),
            "-o",
            "-p 55432 -h 127.0.0.1 -k /tmp",
            "start",
        ],
        check=True,
    )
subprocess.run([str(ROOT / ".venv/bin/python"), str(ROOT / "scripts/init_db.py")], check=True)
print("Project-local PostgreSQL cluster ready.")
