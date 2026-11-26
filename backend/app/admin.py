"""Local operator bootstrap; generated credentials are written privately, never printed."""

import argparse
import getpass
import json
import os
import re
import secrets

from sqlalchemy import select

from app.core.admin_auth import hash_password
from app.core.config import ROOT
from app.db.session import SessionLocal
from app.models.admin import AdminUser


def create_user(session, username: str, password: str):
    username = username.strip().casefold()
    if not re.fullmatch(r"[a-z0-9_.-]{3,80}", username) or not 12 <= len(password) <= 256:
        raise ValueError("Username must be 3–80 Latin characters; password must be 12–256 characters")
    if session.scalar(select(AdminUser.id).where(AdminUser.username == username)):
        raise ValueError("Admin username already exists; existing credentials were not changed")
    user = AdminUser(username=username, password_hash=hash_password(password), is_active=True)
    session.add(user)
    session.flush()
    return user


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", default="admin")
    parser.add_argument("--generate-password", action="store_true")
    args = parser.parse_args()
    password = secrets.token_urlsafe(24) if args.generate_password else getpass.getpass("Admin password: ")
    target = ROOT / ".local/admin-access.json"
    if args.generate_password and target.exists():
        raise SystemExit("Private credentials file already exists; no account or file was overwritten")
    with SessionLocal.begin() as session:
        user = create_user(session, args.username, password)
        if args.generate_password:
            target.parent.mkdir(exist_ok=True)
            descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, "w") as file:
                json.dump(
                    dict(username=user.username, password=password, url="http://127.0.0.1:5173/admin"),
                    file,
                    indent=2,
                )
                file.write("\n")
    print(
        "Admin created. "
        + (
            "Credentials saved privately in .local/admin-access.json"
            if args.generate_password
            else "Password was not printed or saved to a file."
        )
    )
