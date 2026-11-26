"""Opaque, revocable admin sessions; passwords never enter URLs or logs."""

import base64
import hashlib
import hmac
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request
from sqlalchemy import delete, select, text

from app.core.config import get_settings
from app.models.admin import AdminSession, AdminUser, LoginThrottle

ADMIN_COOKIE = "rad_admin_session"
VISITOR_COOKIE = "rad_visitor"
TOKEN = re.compile(r"^[A-Za-z0-9_-]{43}$")
ITERATIONS = 600_000


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return "pbkdf2_sha256$600000$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(key).decode()


def check_password(password: str, stored: str | None) -> bool:
    if stored is None:
        hashlib.pbkdf2_hmac("sha256", password.encode(), b"\x00" * 16, ITERATIONS)
        return False
    try:
        algorithm, iterations, salt, expected = stored.split("$")
        count = int(iterations)
        if algorithm != "pbkdf2_sha256" or not 600_000 <= count <= 1_000_000:
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt), count)
        return hmac.compare_digest(actual, base64.b64decode(expected))
    except (ValueError, TypeError):
        return False


def validate_origin(request: Request):
    origin = request.headers.get("origin")
    allowed = {str(request.base_url).rstrip("/"), *get_settings().cors_origins}
    if (origin and origin not in allowed) or request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(403, "درخواست از مبدأ مجاز ارسال نشده است")


def current_admin(session, request: Request):
    token = request.cookies.get(ADMIN_COOKIE, "")
    if not TOKEN.fullmatch(token):
        return None
    return session.execute(
        select(AdminUser, AdminSession)
        .join(AdminSession, AdminSession.user_id == AdminUser.id)
        .where(
            AdminSession.token_hash == digest(token),
            AdminSession.expires_at > datetime.now(timezone.utc),
            AdminUser.is_active.is_(True),
        )
    ).first()


def csrf_token(token: str) -> str:
    return hmac.new(token.encode(), b"rad-admin-csrf", hashlib.sha256).hexdigest()


def session_payload(user, token: str, expires):
    return {"username": user.username, "csrf_token": csrf_token(token), "expires_at": expires.isoformat()}


def require_admin(session, request: Request):
    identity = current_admin(session, request)
    if identity is None:
        raise HTTPException(401, "برای مشاهدهٔ پنل وارد شوید")
    return identity


def require_csrf(request: Request):
    validate_origin(request)
    expected = csrf_token(request.cookies.get(ADMIN_COOKIE, ""))
    if not hmac.compare_digest(request.headers.get("x-csrf-token", ""), expected):
        raise HTTPException(403, "درخواست معتبر نیست؛ دوباره وارد شوید")


def login(session, request: Request, username: str, password: str, response):
    validate_origin(request)
    now = datetime.now(timezone.utc)
    # Persistent per-account and per-peer limits; forwarded headers are deliberately ignored.
    keys = sorted(
        [
            digest("account:" + username),
            digest("peer:" + (request.client.host if request.client else "unknown")),
        ]
    )
    throttles = []
    for key in keys:
        session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": int(key[:16], 16) - 2**63})
        throttle = session.get(LoginThrottle, key)
        if throttle is None:
            throttle = LoginThrottle(key=key, failures=0, window_start=now)
            session.add(throttle)
        elif throttle.window_start <= now - timedelta(minutes=15):
            throttle.window_start, throttle.failures = now, 0
        limit = 5 if key == digest("account:" + username) else 20
        if throttle.failures >= limit:
            session.rollback()
            raise HTTPException(
                429, "تلاش‌های ورود زیاد است؛ 15 دقیقه بعد دوباره امتحان کنید", headers={"Retry-After": "900"}
            )
        throttles.append(throttle)
    user = session.scalar(select(AdminUser).where(AdminUser.username == username))
    valid = check_password(password, user.password_hash if user else None)
    if not valid or user is None or not user.is_active:
        for throttle in throttles:
            throttle.failures += 1
        session.commit()
        raise HTTPException(401, "نام کاربری یا رمز عبور درست نیست")
    throttles[keys.index(digest("account:" + username))].failures = 0
    previous = request.cookies.get(ADMIN_COOKIE)
    if previous:
        session.execute(delete(AdminSession).where(AdminSession.token_hash == digest(previous)))
    session.execute(delete(AdminSession).where(AdminSession.expires_at <= now))
    token = secrets.token_urlsafe(32)
    expires = now + timedelta(hours=get_settings().admin_session_hours)
    session.add(AdminSession(token_hash=digest(token), user_id=user.id, expires_at=expires))
    session.commit()
    response.set_cookie(
        ADMIN_COOKIE,
        token,
        httponly=True,
        samesite="strict",
        secure=get_settings().admin_cookie_secure,
        path="/api",
        max_age=get_settings().admin_session_hours * 3600,
    )
    response.headers["Cache-Control"] = "no-store"
    return session_payload(user, token, expires)
