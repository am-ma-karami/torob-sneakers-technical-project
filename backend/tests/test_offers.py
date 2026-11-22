import json
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from app.core.commerce import retailer_url
from app.core.config import get_settings
from app.importers.catalog import variants_and_offers
from app.models.catalog import Measurement, Offer, OfferObservation, OfferRejection, Shoe, Variant
from app.schemas.offers import OfferInput
from app.services.offers import map_product, refresh_offers
from pydantic import ValidationError
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError


@pytest.fixture
def trusted(monkeypatch):
    monkeypatch.setattr(get_settings(), "retailer_domains", {"Partner:demo": ["shop.example.com"]})


def listing(**overrides):
    now = datetime.now(timezone.utc)
    return dict(
        source="Partner",
        external_id="listing-1",
        source_product_id="product-1",
        retailer_id="demo",
        retailer="Demo",
        price="120.1234",
        currency="USD",
        country="DE",
        shipping_countries=["FR"],
        url="https://shop.example.com/shoe/1",
        checked_at=now - timedelta(hours=1),
        snapshot=now - timedelta(hours=1),
        availability="in_stock",
        inventory=[dict(size="42", size_system="EU", width="D", availability="in_stock")],
        **overrides,
    )


def save(session, rows, **options):
    map_product(session, "Partner", "product-1", 40586)
    result = refresh_offers(session, 40586, "Partner", rows, **options)
    session.commit()
    return result


@pytest.mark.parametrize("price", [-1, True, "not-a-price", "NaN", "Infinity", "-Infinity", "1.12345"])
def test_invalid_money(trusted, price):
    raw = listing()
    raw["price"] = price
    with pytest.raises(ValidationError):
        OfferInput.model_validate(raw)


@pytest.mark.parametrize(
    "url",
    [
        "http://shop.example.com/x",
        "https://127.0.0.1/x",
        "https://localhost/x",
        "https://[::1]/x",
        "https://169.254.169.254/x",
        "https://shop.example.com.evil.org/x",
        "https://user:pass@shop.example.com/x",
        "https://shop.example.com:8000/x",
        "https://unapproved.org/x",
        "https://shop.example.com/x?url=https%3A%2F%2Fevil.org%2Fx",
    ],
)
def test_retailer_url_binding(trusted, url):
    with pytest.raises(ValueError):
        retailer_url(url, "Partner", "demo")
    with pytest.raises(ValueError):
        retailer_url("https://shop.example.com/x", "AnotherFeed", "demo")


def test_source_adapters_preserve_raw_inventory_and_correct_solehunt_fields():
    now = datetime.now(timezone.utc).isoformat()
    shoe = {
        "shoe_id": 123,
        "commerce": {
            "runrepeat": {
                "currency": "EUR",
                "country": "DE",
                "snapshot": now,
                "offers": [
                    {
                        "shop_id": 526,
                        "shop": {"name": "RunningXpert"},
                        "price_local": 96,
                        "affiliate_link": "https://runningxpert.com/product",
                        "is_any_color": True,
                        "sizes_available": "0-78",
                        "available_widths": 3,
                    }
                ],
            },
            "solehunt": {
                "record_updated_at": now,
                "retailers": [
                    {
                        "id": "offer-1",
                        "shoe_id": "product-uuid",
                        "retailer_name": "DICK'S Sporting Goods",
                        "price_usd": 155.50,
                        "in_stock": False,
                        "last_checked": now,
                        "affiliate_url": "https://www.tkqlhce.com/listing-1",
                    }
                ],
            },
        },
    }
    _, offers = variants_and_offers(shoe)
    rr, sh = offers
    assert rr["sizes_available_raw"] == "0-78" and rr["available_widths_raw"] == 3
    assert rr["inventory"] == [] and rr["availability"] == "unknown" and rr["checked_at"] is None
    assert sh["currency"] == "USD" and sh["price"] == 155.5 and sh["availability"] == "out_of_stock"
    assert sh["source_product_id"] == "product-uuid" and sh["external_id"] == "offer-1"
    assert datetime.fromisoformat(sh["checked_at"]) == datetime.fromisoformat(now)
    assert sh["live_verified"] is False


def test_reorder_stable_keys_and_repeat_observations(store):
    session, _, importer, data_dir = store
    before = dict(session.execute(select(Offer.key, Offer.variant_key)).all())
    observations = session.scalar(select(func.count()).select_from(OfferObservation))
    path = data_dir / "shoes-ui.json"
    payload = json.loads(path.read_text())
    for shoe in payload["shoes"]:
        shoe["commerce"]["runrepeat"]["offers"].reverse()
    path.write_text(json.dumps(payload))
    importer.import_catalog(data_dir)
    session.expire_all()
    assert before == dict(session.execute(select(Offer.key, Offer.variant_key)).all())
    assert observations == session.scalar(select(func.count()).select_from(OfferObservation))


def test_import_preserves_independent_source_offers_variants_and_measurements(store, trusted):
    session, _, importer, data_dir = store
    raw = listing()
    save(session, [raw])
    session.add(Variant(shoe_id=40586, key="partner:blue", owner="Partner", payload={"key": "partner:blue"}))
    session.add(
        Measurement(shoe_id=40586, key="partner_metric", owner="Partner", value=1, unit="mm", provenance={})
    )
    session.commit()
    importer.import_catalog(data_dir)
    session.expire_all()
    offer = session.get(Offer, (40586, OfferInput.model_validate(raw).key))
    assert offer.price == Decimal("120.1234")
    assert session.get(Variant, (40586, "partner:blue")).owner == "Partner"
    assert session.get(Measurement, (40586, "partner_metric")).owner == "Partner"


def test_dirty_feed_quarantines_and_cannot_retire_existing_listings(store, trusted):
    session = store[0]
    raw = listing()
    save(session, [raw])
    bad = dict(raw, external_id="bad", price="NaN")
    assert save(session, [bad], complete=True, snapshot_at=datetime.now(timezone.utc)) == {
        "accepted": 0,
        "rejected": 1,
    }
    assert session.get(Offer, (40586, OfferInput.model_validate(raw).key)).availability == "in_stock"
    assert (
        session.scalar(
            select(func.count()).select_from(OfferRejection).where(OfferRejection.source == "Partner")
        )
        == 1
    )
    save(session, [bad], complete=True, snapshot_at=datetime.now(timezone.utc))
    assert (
        session.scalar(
            select(func.count()).select_from(OfferRejection).where(OfferRejection.source == "Partner")
        )
        == 1
    )


def test_price_history_and_old_snapshot_cannot_overwrite_newer_data(store, trusted):
    session = store[0]
    raw = listing()
    save(session, [raw])
    newer = dict(raw, price="100.0001", checked_at=datetime.now(timezone.utc))
    save(session, [newer])
    save(session, [raw])
    key = OfferInput.model_validate(raw).key
    assert session.get(Offer, (40586, key)).price == Decimal("100.0001")
    assert (
        session.scalar(
            select(func.count()).select_from(OfferObservation).where(OfferObservation.offer_key == key)
        )
        == 2
    )
    save(session, [newer])
    assert (
        session.scalar(
            select(func.count()).select_from(OfferObservation).where(OfferObservation.offer_key == key)
        )
        == 2
    )


def test_mapping_and_cross_shoe_variant_integrity(store, trusted):
    session = store[0]
    map_product(session, "Partner", "product-1", 40586)
    with pytest.raises(ValueError, match="already mapped"):
        map_product(
            session, "Partner", "product-1", session.scalar(select(Shoe.id).where(Shoe.id != 40586).limit(1))
        )
    with pytest.raises(ValueError, match="Variant"):
        map_product(session, "Partner", "product-2", 40586, "does-not-exist")
    with pytest.raises(ValueError, match="GTIN"):
        map_product(session, "Partner", "product-2", 40586, gtin="12345678")
    session.commit()
    assert save(session, [dict(listing(), source_product_id="unresolved")])["rejected"] == 1
    save(session, [listing()])
    with pytest.raises(IntegrityError), session.begin_nested():
        session.execute(update(Offer).where(Offer.source == "Partner").values(variant_key="wrong-variant"))


def test_expiry_stock_size_market_and_delivery_are_distinct(client, store, trusted):
    session = store[0]
    raw = listing()
    save(session, [raw])
    url = "/api/shoes/adidas-adizero-evo-sl/offers"
    params = {"source": "Partner"}
    current = client.get(url, params=params).json()["items"][0]
    assert current["freshness"] == "fresh" and current["availability"] == "in_stock"
    assert current["price"] == 120.1234 and current["price_amount"] == "120.1234"
    assert client.get(url, params=dict(params, country="DE")).json()["total"] == 1
    assert client.get(url, params=dict(params, ships_to="DE")).json()["total"] == 0
    assert client.get(url, params=dict(params, ships_to="FR")).json()["total"] == 1
    assert client.get(url, params=dict(params, size="42", size_system="EU", width="D")).json()["total"] == 1
    assert client.get(url, params=dict(params, size="42", size_system="US_M")).json()["total"] == 0
    # Same source observation expires; historical stock must not be presented as current stock.
    old = datetime.now(timezone.utc) - timedelta(days=3)
    session.execute(
        update(Offer)
        .where(Offer.source == "Partner")
        .values(checked_at=old, expires_at=old + timedelta(days=1))
    )
    session.commit()
    expired = client.get(url, params=params).json()["items"][0]
    assert expired["freshness"] == "expired" and expired["availability"] == "unknown"
    assert expired["observed_availability"] == "in_stock" and expired["live_verified"] is False
    for extra in ({"availability": "in_stock"}, {"fresh_only": "true"}, {"size": "42", "size_system": "EU"}):
        assert client.get(url, params=dict(params, **extra)).json()["total"] == 0


def test_offer_pagination_currency_filters_and_msrp_independence(client, store, trusted):
    session = store[0]
    raw = listing()
    rows = [
        dict(raw, external_id=f"listing-{i}", price=str(100 + i), currency="USD" if i % 2 else "EUR")
        for i in range(25)
    ]
    save(session, rows)
    url = "/api/shoes/adidas-adizero-evo-sl/offers"
    first = client.get(
        url, params={"source": "Partner", "currency": "USD", "sort": "price", "page_size": 5}
    ).json()
    second = client.get(
        url, params={"source": "Partner", "currency": "USD", "sort": "price", "page_size": 5, "page": 2}
    ).json()
    assert first["total"] == 12 and first["pages"] == 3
    assert [o["price"] for o in first["items"]] == [101, 103, 105, 107, 109]
    assert {o["key"] for o in first["items"]}.isdisjoint(o["key"] for o in second["items"])
    detail = client.get("/api/shoes/adidas-adizero-evo-sl").json()
    assert len(detail["offers"]) == 20 and detail["offers_total"] >= 25
    for query in (
        "sort=price",
        "price_max=120",
        "currency=XYZ",
        "size=42",
        "page_size=49",
        "unknown=1",
        "currency=USD&price_min=NaN",
    ):
        assert client.get(url + "?" + query).status_code == 422
    assert client.get("/api/shoes/no-such-shoe/offers").status_code == 404
    before = client.get("/api/catalog?price_max=130").json()
    filtered = client.get(
        "/api/catalog?offer_currency=USD&offer_price_max=110&offer_available=true&sort=offer_price"
    ).json()
    assert filtered["total"] == 1 and filtered["items"][0]["shoe_id"] == 40586
    assert client.get("/api/catalog?price_max=130").json() == before
    assert client.get("/api/catalog?sort=offer_price").status_code == 422
    assert client.get("/api/catalog?offer_price_max=100").status_code == 422


def test_duplicates_conflict_without_order_dependent_winner(store, trusted):
    session = store[0]
    raw = listing()
    assert save(session, [raw, dict(raw, price="2")])["rejected"] == 2
    assert session.scalar(select(func.count()).select_from(Offer).where(Offer.source == "Partner")) == 0


def test_proxy_mode_and_spoofed_forwarded_headers(client, monkeypatch):
    from app.main import settings, windows

    monkeypatch.setattr(settings, "rate_limit", 1)
    assert client.get("/api/catalog", headers={"X-Forwarded-For": "1.1.1.1"}).status_code == 200
    assert client.get("/api/catalog", headers={"X-Forwarded-For": "2.2.2.2"}).status_code == 429
    assert client.get("/api/health").status_code == 200
    windows.clear()
    monkeypatch.setattr(settings, "rate_limit_backend", "proxy")
    assert all(client.get("/api/catalog").status_code == 200 for _ in range(3))
    assert not windows


def test_complete_refresh_requires_date_and_cannot_retire_newer_stock(store, trusted):
    session = store[0]
    raw = listing()
    save(session, [raw])
    with pytest.raises(ValueError, match="timestamp"):
        refresh_offers(session, 40586, "Partner", [], complete=True)
    save(session, [], complete=True, snapshot_at=datetime.now(timezone.utc) - timedelta(days=1))
    key = OfferInput.model_validate(raw).key
    assert session.get(Offer, (40586, key)).availability == "in_stock"
    save(session, [], complete=True, snapshot_at=datetime.now(timezone.utc))
    retired = session.get(Offer, (40586, key))
    assert retired.availability == "unknown" and retired.expires_at == retired.checked_at
    save(session, [raw])
    assert session.get(Offer, (40586, key)).availability == "unknown"


def test_inventory_pair_conflicts_and_invalid_dates_are_rejected(trusted):
    raw = listing()
    for invalid in (
        dict(raw, currency="XYZ"),
        dict(raw, checked_at="invalid date"),
        dict(raw, checked_at="2026-01-01T00:00:00"),
        dict(raw, checked_at=datetime.now(timezone.utc) + timedelta(days=1)),
        dict(raw, inventory=raw["inventory"] + [dict(raw["inventory"][0], availability="out_of_stock")]),
        dict(raw, sizes_available_raw=float("nan")),
    ):
        with pytest.raises(ValidationError):
            OfferInput.model_validate(invalid)


def test_same_inventory_row_must_match_size_and_width(client, store, trusted):
    raw = listing()
    raw["inventory"] = [
        dict(size="42", size_system="EU", width="D", availability="in_stock"),
        dict(size="43", size_system="EU", width="2E", availability="in_stock"),
    ]
    save(store[0], [raw])
    response = client.get(
        "/api/shoes/adidas-adizero-evo-sl/offers",
        params=dict(source="Partner", size="42", size_system="EU", width="2E"),
    )
    assert response.status_code == 200 and response.json()["total"] == 0


def test_listing_cannot_be_reassigned_across_models(store, trusted):
    session = store[0]
    raw = listing()
    save(session, [raw])
    another_id = session.scalar(select(Shoe.id).where(Shoe.id != 40586).limit(1))
    map_product(session, "Partner", "another-product", another_id)
    result = refresh_offers(session, another_id, "Partner", [dict(raw, source_product_id="another-product")])
    assert result == {"accepted": 0, "rejected": 1}
    session.commit()
    assert session.scalar(select(func.count()).select_from(Offer).where(Offer.source == "Partner")) == 1


def test_invalid_variant_row_cannot_remove_an_existing_verified_color():
    now = datetime.now(timezone.utc).isoformat()
    valid = dict(
        shop_id=526,
        shop={"name": "RunningXpert"},
        price_local=96,
        affiliate_link="https://runningxpert.com/product",
        color=dict(id=123, name_suffix="Black", image={"cdn_path": "i/black", "size": 600}),
    )
    bad = dict(valid, color=dict(valid["color"], name_suffix="x" * 241))
    shoe = {
        "shoe_id": 1,
        "commerce": {
            "runrepeat": {
                "currency": "EUR",
                "country": "DE",
                "snapshot": now,
                "offers": [valid, bad, dict(valid, shop="invalid"), None],
            }
        },
    }
    rejected = []
    variants, offers = variants_and_offers(shoe, rejected)
    assert len(variants) == 1 and variants[0]["name"] == "Black"
    assert len(offers) == 1 and offers[0]["variant_key"] == "123"
    assert len(rejected) == 3


def test_invalid_source_container_aborts_before_any_persistent_changes(store):
    session, _, importer, data_dir = store
    before = session.scalar(select(func.count()).select_from(Offer))
    path = data_dir / "shoes-ui.json"
    payload = json.loads(path.read_text())
    payload["shoes"][0]["commerce"]["runrepeat"]["offers"] = {"not": "an array"}
    path.write_text(json.dumps(payload))
    with pytest.raises(ValidationError):
        importer.import_catalog(data_dir)
    assert session.scalar(select(func.count()).select_from(Offer)) == before
