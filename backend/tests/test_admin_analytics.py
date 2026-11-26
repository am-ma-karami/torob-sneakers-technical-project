from datetime import datetime, timedelta, timezone

import pytest
from app.admin import create_user
from app.core.admin_auth import ADMIN_COOKIE, VISITOR_COOKIE, digest
from app.main import app
from app.models.admin import AdminSession, AdminUser, StoreTrafficDay
from app.models.catalog import Offer
from app.schemas.analytics import TEHRAN
from fastapi.testclient import TestClient
from sqlalchemy import func, select

PASSWORD = "test-only-admin-password"


@pytest.fixture
def operator(client, store):
    session = store[0]
    user = create_user(session, "admin", PASSWORD)
    session.commit()
    response = client.post("/api/admin/login", json={"username": "admin", "password": PASSWORD})
    assert response.status_code == 200
    return client, user, response.json()["csrf_token"]


@pytest.fixture
def guest(client):
    with TestClient(app) as browser:
        yield browser


def offer(store):
    return store[0].scalar(select(Offer).where(Offer.shoe_id == 40586).order_by(Offer.key))


def show(browser, target):
    return browser.post(
        "/api/analytics/store-impressions",
        json={"items": [{"shoe_id": target.shoe_id, "offer_key": target.key}]},
    )


def click(browser, target, **kwargs):
    return browser.get(f"/api/out/{target.shoe_id}/{target.key}", follow_redirects=False, **kwargs)


def metrics(operator, target, **filters):
    return operator[0].get(
        "/api/admin/analytics/stores",
        params={
            "source": target.source,
            "q": "adidas Adizero EVO SL",
            "retailer_id": target.retailer_id,
            **filters,
        },
    )


def test_admin_requires_authentication_and_has_no_public_stats(client):
    assert client.get("/api/admin/session").status_code == 401
    response = client.get("/api/admin/analytics/stores")
    assert response.status_code == 401 and response.headers["cache-control"] == "no-store"
    assert client.get("/api/catalog").status_code == 200


def test_admin_password_session_logout_csrf_and_revocation(operator, store):
    client, user, csrf = operator
    persisted = store[0].get(AdminUser, user.id)
    assert persisted.password_hash.startswith("pbkdf2_sha256$600000$")
    assert PASSWORD not in persisted.password_hash
    assert client.get("/api/admin/session").json()["username"] == "admin"
    token = client.cookies.get(ADMIN_COOKIE)
    identity = store[0].get(AdminSession, digest(token))
    assert identity and identity.token_hash != token
    assert client.post("/api/admin/logout", json={}).status_code == 403
    assert (
        client.post(
            "/api/admin/logout", json={}, headers={"X-CSRF-Token": csrf, "Origin": "https://evil.example"}
        ).status_code
        == 403
    )
    assert client.post("/api/admin/logout", json={}, headers={"X-CSRF-Token": csrf}).status_code == 204
    client.cookies.set(ADMIN_COOKIE, token, path="/api")
    assert client.get("/api/admin/session").status_code == 401


def test_expired_and_disabled_admins_cannot_access(operator, store):
    client, user, _ = operator
    user.is_active = False
    store[0].commit()
    assert client.get("/api/admin/analytics/stores").status_code == 401
    user.is_active = True
    identity = store[0].get(AdminSession, digest(client.cookies.get(ADMIN_COOKIE)))
    identity.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    store[0].commit()
    assert client.get("/api/admin/session").status_code == 401


def test_login_is_throttled_and_cross_origin_is_rejected(client, store):
    create_user(store[0], "admin", PASSWORD)
    store[0].commit()
    payload = {"username": "admin", "password": "wrong-password"}
    assert (
        client.post("/api/admin/login", json=payload, headers={"Origin": "https://evil.example"}).status_code
        == 403
    )
    for _ in range(5):
        assert client.post("/api/admin/login", json=payload).status_code == 401
    blocked = client.post("/api/admin/login", json={"username": "admin", "password": PASSWORD})
    assert blocked.status_code == 429 and blocked.headers["retry-after"] == "900"


def test_visible_offer_unique_browsers_and_clicks(operator, guest, store):
    target = offer(store)
    empty = metrics(operator, target)
    assert empty.status_code == 200
    assert empty.json()["summary"] == {"viewers": 0, "clickers": 0, "ctr": None, "active_pairs": 0}
    assert show(guest, target).status_code == 202
    assert show(guest, target).json()["recorded"] == 0
    response = click(guest, target)
    assert response.status_code == 302 and response.headers["location"] == target.payload["url"]
    assert response.headers["referrer-policy"] == "no-referrer"
    assert click(guest, target).status_code == 302
    result = metrics(operator, target).json()
    assert result["summary"]["viewers"] == result["summary"]["clickers"] == 1
    assert result["items"][0]["viewers"] == result["items"][0]["clickers"] == 1
    assert result["items"][0]["ctr"] == 100
    guest.cookies.clear()
    show(guest, target)
    result = metrics(operator, target).json()
    assert result["items"][0]["viewers"] == 2 and result["items"][0]["clickers"] == 1
    assert result["items"][0]["ctr"] == 50


def test_click_before_observer_counts_one_view_and_admin_visits_are_excluded(operator, guest, store):
    target = offer(store)
    click(guest, target)
    show(guest, target)
    show(operator[0], target)
    click(operator[0], target)
    result = metrics(operator, target).json()
    assert result["summary"]["viewers"] == result["summary"]["clickers"] == 1


def test_store_aggregation_across_offer_keys_dates_and_tehran_boundary(operator, guest, store):
    target = offer(store)
    show(guest, target)
    token = guest.cookies.get(VISITOR_COOKIE)
    yesterday = datetime.now(TEHRAN).date() - timedelta(days=1)
    store[0].add(
        StoreTrafficDay(
            shoe_id=target.shoe_id,
            source=target.source,
            retailer_id=target.retailer_id,
            visitor_hash=digest(token),
            event_kind="impression",
            event_day=yesterday,
            retailer_name=target.payload["retailer"],
            market=target.market,
        )
    )
    store[0].commit()
    result = metrics(operator, target, start_date=yesterday.isoformat()).json()
    assert result["items"][0]["viewers"] == 1  # Distinct across days, not a sum of daily uniques.
    today = datetime.now(TEHRAN).date().isoformat()
    assert metrics(operator, target, start_date=today, end_date=today).json()["items"][0]["viewers"] == 1
    old = (yesterday - timedelta(days=1)).isoformat()
    assert metrics(operator, target, start_date=old, end_date=old).json()["items"][0]["viewers"] == 0


def test_impressions_reject_foreign_origins_unknown_offers_and_respect_opt_out(operator, guest, store):
    target = offer(store)
    guest.headers["DNT"] = "1"
    assert show(guest, target).json()["recorded"] == 0
    assert click(guest, target).status_code == 302
    assert VISITOR_COOKIE not in guest.cookies
    del guest.headers["DNT"]
    guest.headers["Sec-GPC"] = "1"
    assert show(guest, target).json()["recorded"] == 0
    del guest.headers["Sec-GPC"]
    guest.headers["Origin"] = "https://evil.example"
    assert show(guest, target).status_code == 403
    del guest.headers["Origin"]
    assert (
        guest.post(
            "/api/analytics/store-impressions", json={"items": [{"shoe_id": 40586, "offer_key": "f" * 64}]}
        ).json()["recorded"]
        == 0
    )
    assert click(guest, target, headers={"Sec-Purpose": "prefetch;prerender"}).status_code == 302
    assert metrics(operator, target).json()["summary"]["viewers"] == 0


def test_redirect_looks_up_server_target_not_url_query(guest, store):
    target = offer(store)
    response = guest.get(
        f"/api/out/{target.shoe_id}/{target.key}?url=https://evil.example", follow_redirects=False
    )
    assert response.headers["location"] == target.payload["url"]
    assert guest.get(f"/api/out/{target.shoe_id}/{'0' * 64}").status_code == 404
    assert guest.get(f"/api/out/{target.shoe_id}/bad").status_code == 422


def test_report_date_validation_search_zero_rows_and_pagination(operator, store):
    target = offer(store)
    assert metrics(operator, target, start_date="2026-01-10", end_date="2026-01-01").status_code == 422
    assert metrics(operator, target, end_date="2099-01-01").status_code == 422
    assert metrics(operator, target, page_size=101).status_code == 422
    assert metrics(operator, target, sort="unsafe").status_code == 422
    assert metrics(operator, target, active_only="true").json()["total"] == 0
    assert metrics(operator, target, q="zz-no-such-shoe").json()["total"] == 0
    first = (
        operator[0]
        .get("/api/admin/analytics/stores", params={"source": target.source, "page_size": 1})
        .json()
    )
    second = (
        operator[0]
        .get("/api/admin/analytics/stores", params={"source": target.source, "page_size": 1, "page": 2})
        .json()
    )
    assert first["total"] > 1
    assert first["items"][0] != second["items"][0]
    assert store[0].scalar(select(func.count()).select_from(StoreTrafficDay)) == 0


def test_multiple_listings_for_one_store_share_one_browser_count(operator, guest, store):
    from app.schemas.offers import OfferInput
    from app.services.offers import refresh_offers

    target = offer(store)
    raw = {key: value for key, value in target.payload.items() if key not in ("key", "price_amount")}
    raw["external_id"] += ":alternate-listing"
    normalized = OfferInput.model_validate(raw)
    refresh_offers(store[0], target.shoe_id, target.source, [raw])
    store[0].commit()
    alternate = store[0].get(Offer, (target.shoe_id, normalized.key))
    show(guest, target)
    show(guest, alternate)
    click(guest, alternate)
    result = metrics(operator, target).json()
    assert result["items"][0]["viewers"] == result["items"][0]["clickers"] == 1


def test_one_browser_visiting_two_shoes_has_separate_pair_counts(operator, guest, store):
    target = offer(store)
    another = store[0].scalar(
        select(Offer).where(Offer.shoe_id != target.shoe_id, Offer.source == target.source).limit(1)
    )
    show(guest, target)
    show(guest, another)
    result = (
        operator[0]
        .get("/api/admin/analytics/stores", params={"source": target.source, "active_only": "true"})
        .json()
    )
    assert result["summary"]["viewers"] == 1 and result["summary"]["active_pairs"] == 2
    assert len(result["items"]) == 2 and all(row["viewers"] == 1 for row in result["items"])


def test_failed_measurement_write_does_not_block_valid_purchase_link(guest, store, monkeypatch):
    from sqlalchemy.exc import SQLAlchemyError

    target = offer(store)
    execute = store[0].execute

    def fail_measurement(statement, *args, **kwargs):
        if getattr(getattr(statement, "table", None), "name", None) == "store_traffic_daily":
            raise SQLAlchemyError("Synthetic telemetry failure")
        return execute(statement, *args, **kwargs)

    monkeypatch.setattr(store[0], "execute", fail_measurement)
    response = click(guest, target)
    assert response.status_code == 302 and response.headers["location"] == target.payload["url"]
