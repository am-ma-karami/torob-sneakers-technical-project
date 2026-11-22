import asyncio
import csv
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from importlib import import_module

import httpx
import pytest
from app.core.commerce import STORE_SOURCE
from app.models.catalog import ExchangeRate, Offer, OfferObservation
from app.services.exchange_rates import converted_price, parse_quote
from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker


def row(**overrides):
    return dict(
        dict(
            shoe_id="40586",
            shoe_name="adidas Adizero EVO SL",
            brand="adidas",
            store_name="digizenith.ir",
            retailer_key="digizenith.ir",
            market="iran",
            country="IR",
            product_url="https://digizenith.ir/product/evo-sl/",
            price="38990000",
            currency="IRT",
            price_toman="38990000",
            availability="in_stock",
            checked_at="2026-11-20T19:08:51Z",
            url_type="direct_product",
            verification_status="page_verified",
            match_status="product_title",
            authenticity="seller_claims_original",
            store_product_title="adidas EVO SL",
        ),
        **overrides,
    )


def write_csv(path, rows):
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def importer(store, monkeypatch, tmp_path):
    module = import_module("app.importers.store_links")
    monkeypatch.setattr(module, "SessionLocal", sessionmaker(store[0].get_bind(), expire_on_commit=False))
    monkeypatch.setattr(module, "ROOT", tmp_path)
    return module


def quote(currency, value, fetched_at=None):
    return ExchangeRate(
        currency=currency,
        toman_per_unit=Decimal(value),
        source="TGJU · بازار آزاد",
        source_url="https://www.tgju.org/profile/price_dollar_rl",
        source_time_label="۱ آذر",
        fetched_at=fetched_at or datetime.now(timezone.utc),
    )


def test_native_toman_rial_foreign_and_missing_prices():
    rates = {"USD": quote("USD", "267375")}
    assert converted_price(Decimal("38990000"), "IRT", {})["price_toman"] == 38990000
    assert converted_price(Decimal("68463000"), "IRR", {})["price_toman"] == 6846300
    assert converted_price(Decimal("99"), "USD", rates)["price_toman"] == 26470125
    assert converted_price(None, None, rates)["price_toman"] is None
    assert converted_price(Decimal("99"), "EUR", rates)["price_toman"] is None
    stale = converted_price(
        Decimal(99), "USD", {"USD": quote("USD", "267375", datetime.now(timezone.utc) - timedelta(days=2))}
    )
    assert stale["conversion"]["stale"] is True
    assert stale["conversion"]["source_time_label"] == "۱ آذر"
    assert converted_price(Decimal(15), "IRR", {})["price_toman"] == 2


def html(price="2,673,750", time="۱ آذر", unit="ریال"):
    return f'<p>واحد پولی : {unit}</p><span data-col="info.last_trade.PDrCotVal">{price}</span><table><tr><td>زمان ثبت آخرین نرخ</td><td>{time}</td></tr></table>'


def test_tgju_parser_requires_exact_units_quote_and_source_time():
    assert parse_quote(html()) == (Decimal("267375"), "۱ آذر")
    for source in [
        html(price="NaN"),
        html(price="0"),
        html(unit="تومان"),
        html(time="-"),
        html() + html(price="9,999"),
    ]:
        with pytest.raises(ValueError):
            parse_quote(source)


def test_csv_import_preserves_other_feeds_unpriced_rows_and_original_currency(store, monkeypatch, tmp_path):
    module = importer(store, monkeypatch, tmp_path)
    session = store[0]
    before = session.scalar(select(func.count()).select_from(Offer))
    rows = [
        row(),
        row(
            product_url="https://digizenith.ir/product/another/",
            price="68463000",
            currency="IRR",
            price_toman="6846300",
        ),
        row(
            store_name="Amazon",
            retailer_key="amazon",
            market="foreign",
            country="US",
            product_url="https://www.amazon.com/dp/test",
            price="99",
            currency="USD",
            price_toman="",
        ),
        row(
            store_name="nikooshoes.ir",
            retailer_key="nikooshoes.ir",
            product_url="https://nikooshoes.ir/product/evo/",
            price="",
            currency="",
            price_toman="",
            availability="unknown",
        ),
    ]
    path = tmp_path / "stores.csv"
    write_csv(path, rows)
    report = module.import_store_links(path)
    assert (
        report["accepted"] == 4 and report["unpriced"] == 1 and report["iran"] == 3 and report["foreign"] == 1
    )
    assert session.scalar(select(func.count()).select_from(Offer)) == before + 4
    original = session.scalar(select(Offer).where(Offer.source == STORE_SOURCE, Offer.currency == "USD"))
    assert original.price == Decimal(99)
    count = session.scalar(select(func.count()).select_from(OfferObservation))
    write_csv(path, list(reversed(rows)))
    module.import_store_links(path)
    assert session.scalar(select(func.count()).select_from(Offer)) == before + 4
    assert session.scalar(select(func.count()).select_from(OfferObservation)) == count
    assert (
        session.scalar(select(func.count()).select_from(Offer).where(Offer.source != STORE_SOURCE)) == before
    )


def test_csv_rejects_wrong_units_mismatched_models_and_unapproved_hosts(store, monkeypatch, tmp_path):
    module = importer(store, monkeypatch, tmp_path)
    rows = [
        row(price_toman="1"),
        row(brand="Nike"),
        row(product_url="https://evil.example.com/product"),
        row(market="iran", currency="USD", price="99", price_toman=""),
    ]
    path = tmp_path / "bad.csv"
    write_csv(path, rows)
    report = module.import_store_links(path)
    assert report["rejected"] == 4 and report.get("accepted", 0) == 0
    assert store[0].scalar(select(func.count()).select_from(Offer).where(Offer.source == STORE_SOURCE)) == 0


def test_store_api_converts_sorts_filters_and_preserves_unknowns(client, store, monkeypatch, tmp_path):
    module = importer(store, monkeypatch, tmp_path)
    session = store[0]
    session.add_all([quote("USD", "267375"), quote("EUR", "293800")])
    session.commit()
    rows = [
        row(),
        row(
            product_url="https://digizenith.ir/product/rial/",
            price="68463000",
            currency="IRR",
            price_toman="6846300",
        ),
        row(
            store_name="Amazon",
            retailer_key="amazon",
            market="foreign",
            country="US",
            product_url="https://www.amazon.com/dp/us",
            price="99",
            currency="USD",
            price_toman="",
        ),
        row(
            store_name="Amazon",
            retailer_key="amazon",
            market="foreign",
            country="DE",
            product_url="https://www.amazon.de/dp/eu",
            price="100",
            currency="EUR",
            price_toman="",
        ),
        row(
            product_url="https://digizenith.ir/product/unpriced/",
            price="",
            currency="",
            price_toman="",
            availability="unknown",
        ),
    ]
    path = tmp_path / "api.csv"
    write_csv(path, rows)
    module.import_store_links(path)
    url = "/api/shoes/adidas-adizero-evo-sl/offers"
    query = dict(source=STORE_SOURCE, sort="price_toman")
    response = client.get(url, params=query)
    assert response.status_code == 200
    body = response.json()
    assert [item["price_toman"] for item in body["items"]] == [6846300, 26470125, 29380000, 38990000, None]
    assert body["market_counts"] == {"iran": 3, "foreign": 2}
    assert body["items"][1]["price"] == 99 and body["items"][1]["currency"] == "USD"
    assert body["items"][1]["conversion"]["source_url"].startswith("https://www.tgju.org/")
    assert body["items"][1]["conversion"]["fetched_at"]
    assert body["items"][1]["availability"] == "unknown"  # Historical CSV stock is not live stock.
    assert client.get(url, params=dict(query, market="iran")).json()["total"] == 3
    assert client.get(url, params=dict(query, market="foreign")).json()["total"] == 2
    assert client.get(url, params=dict(query, market="bad")).status_code == 422


def test_rate_refresh_keeps_previous_good_quote_on_partial_provider_failure(store, monkeypatch):
    module = import_module("app.services.exchange_rates")
    session = store[0]
    session.add(quote("USD", "267375"))
    session.commit()
    monkeypatch.setattr(module, "SessionLocal", sessionmaker(session.get_bind(), expire_on_commit=False))
    original_client = httpx.AsyncClient

    def handler(request):
        return (
            httpx.Response(503, text="unavailable")
            if "dollar" in request.url.path
            else httpx.Response(200, text=html())
        )

    monkeypatch.setattr(
        module.httpx,
        "AsyncClient",
        lambda **kwargs: original_client(transport=httpx.MockTransport(handler), **kwargs),
    )
    result = asyncio.run(module.refresh_rates())
    session.expire_all()
    assert len(result) == 3
    assert session.get(ExchangeRate, "USD").toman_per_unit == Decimal("267375")
    assert session.get(ExchangeRate, "EUR").toman_per_unit == Decimal("267375")


def test_shared_product_link_for_distinct_models_is_quarantined_for_both(store, monkeypatch, tmp_path):
    from app.models.catalog import Shoe

    module = importer(store, monkeypatch, tmp_path)
    another = store[0].scalar(select(Shoe).where(Shoe.id != 40586).limit(1))
    rows = [row(), row(shoe_id=str(another.id), shoe_name=another.name, brand=another.brand)]
    path = tmp_path / "ambiguous.csv"
    write_csv(path, rows)
    report = module.import_store_links(path)
    assert report.get("accepted", 0) == 0 and report["rejected"] == 2
    assert store[0].scalar(select(func.count()).select_from(Offer).where(Offer.source == STORE_SOURCE)) == 0
