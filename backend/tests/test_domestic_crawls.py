import csv
import json
from datetime import datetime, timedelta, timezone
from importlib import import_module
from types import SimpleNamespace

import pytest
from app.importers.domestic_crawls import STORES, read_package, reviewed_offer
from app.models.catalog import Offer, OfferObservation, SourceProduct
from app.repositories.analytics import store_metrics
from app.schemas.analytics import TrafficQuery
from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker


def listing(retailer="npstyle", **overrides):
    return dict(
        dict(
            retailer_id=retailer,
            retailer_product_id="123",
            product_name="کتونی آدیداس Adizero EVO SL",
            product_url=("https://allsport.ir/mens-running-shoes/123-evo-sl.html" if retailer == "allsport"
                         else f"https://{STORES[retailer][1]}/product/evo-sl/"),
            market="iran",
            country="IR",
            price="12600000",
            currency="IRT",
            availability="in_stock",
            observed_at=(datetime.now(timezone.utc) - timedelta(hours=2)).isoformat(),
            live_verified=False,
            seller_authenticity_claim="seller_claims_original",
            source_price_range=None,
        ),
        **overrides,
    )


def review(row, **overrides):
    return dict(
        dict(
            retailer_product_id=row["retailer_product_id"],
            product_name=row["product_name"],
            product_url=row["product_url"],
            shoe_id="40586",
            shoe_name="adidas Adizero EVO SL",
            brand="adidas",
            approved="yes",
            match_evidence="Exact manufacturer brand, EVO SL model and adult edition reviewed in source title.",
        ),
        **overrides,
    )


def write_reviews(path, mappings):
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(mappings[0]))
        writer.writeheader()
        writer.writerows(mappings)


def package(tmp_path, rows, mappings=None):
    path = tmp_path / rows[0]["retailer_id"]
    path.mkdir(exist_ok=True)
    (path / "listings.jsonl").write_text("\n".join(json.dumps(row) for row in rows))
    target = path / "review.csv"
    write_reviews(target, mappings or [review(row) for row in rows])
    return target


def importer(store, monkeypatch):
    module = import_module("app.importers.domestic_crawls")
    monkeypatch.setattr(module, "SessionLocal", sessionmaker(store[0].get_bind(), expire_on_commit=False))
    return module


SHOE = SimpleNamespace(name="adidas Adizero EVO SL", brand="adidas")


@pytest.mark.parametrize("retailer", sorted(STORES))
def test_all_registered_stores_use_their_exact_approved_host(retailer):
    row = listing(retailer, product_original_marker_present=True)
    mapping = review(row, product_original_claim_reviewed="yes", authenticity_evidence_url=row["product_url"],
                     authenticity_review_note="Source product title explicitly claims original; not a certification.")
    offer = reviewed_offer(row, mapping, SHOE)
    assert offer.retailer_id == retailer and offer.market == "iran"
    assert offer.variant_key is None and offer.inventory == [] and not offer.live_verified
    assert offer.source_product_id == f"crawl:{retailer}:123"


@pytest.mark.parametrize("changes", [
    {"source_price_range": {"min_amount": "100", "max_amount": "200"}},
    {"test_price_per_seller_policy": True},
    {"product_copy_marker_present": True},
    {"price": "0"},
    {"price": "NaN"},
    {"price": "-100"},
    {"currency": "USD"},
    {"product_name": "adidas Adizero EVO SL GTX"},
    {"product_name": "adidas Adizero EVO SL Wide"},
    {"product_name": "adidas Adizero EVO SL GS"},
    {"product_url": "https://npstyle.ir.evil.example/product/evo-sl/"},
    {"product_url": "https://npstyle.ir/product/evo-sl/?url=https://evil.example"},
    {"observed_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()},
])
def test_invalid_prices_variants_hosts_and_snapshots_never_become_offers(changes):
    row = listing(**changes)
    with pytest.raises(ValueError):
        reviewed_offer(row, review(row), SHOE)


def test_missing_prices_and_rial_keep_their_meaning():
    row = listing(price=None, currency="IRR")
    assert reviewed_offer(row, review(row), SHOE).price is None
    row["price"] = "126000000"
    offer = reviewed_offer(row, review(row), SHOE)
    assert offer.price == 126000000 and offer.currency == "IRR"


def test_source_title_catalog_identity_and_evidence_must_be_reviewed():
    row = listing()
    for mapping in [review(row, product_name="Another product"), review(row, brand="Nike"),
                    review(row, match_evidence="")]:
        with pytest.raises(ValueError):
            reviewed_offer(row, mapping, SHOE)
    for retailer in ("allsport", "kafshesport", "pelaza"):
        row = listing(retailer, seller_authenticity_claim="unknown_product_authenticity")
        with pytest.raises(ValueError, match="originality"):
            reviewed_offer(row, review(row), SHOE)


@pytest.mark.parametrize("changes", [
    {"availability": "unknown"},
    {"availability": "out_of_stock"},
    {"source_conflict": True},
    {"source_categories": [{"id": 125, "slug": "kids-running"}]},
    {"product_url": "https://allsport.ir/mens-running-shoes/124-evo-sl.html"},
    {"product_url": "https://allsport.ir/110-mens-running-shoes"},
])
def test_allsport_price_and_generic_original_wording_do_not_override_source_guards(changes):
    row = listing("allsport", product_original_marker_present=True, **changes)
    mapping = review(row, product_original_claim_reviewed="yes", authenticity_evidence_url=row["product_url"],
                     authenticity_review_note="Product-level seller claim, not a brand collection name.")
    with pytest.raises(ValueError):
        reviewed_offer(row, mapping, SHOE)


def test_allsport_unreviewed_large_snapshot_is_pending_not_purchase_inventory(store, monkeypatch, tmp_path):
    module = importer(store, monkeypatch)
    row = listing("allsport", availability="unknown", seller_authenticity_claim="unknown_product_authenticity")
    path = package(tmp_path, [row], [review(row, approved="no")])
    before = store[0].scalar(select(func.count()).select_from(Offer))
    report = module.import_domestic_crawls([path], apply=True, report_path=tmp_path / "report.json")
    assert report["stores"]["allsport"]["pending"] == 1
    assert report["offers_added"] == 0
    assert store[0].scalar(select(func.count()).select_from(Offer)) == before


def test_review_completeness_and_duplicate_snapshots_fail_before_database(tmp_path):
    row = listing()
    path = package(tmp_path, [row, row])
    with pytest.raises(ValueError, match="Duplicate crawl"):
        read_package(path)
    path = package(tmp_path, [row], [review(row), review(row)])
    with pytest.raises(ValueError, match="each source product"):
        read_package(path)


def test_unapproved_dry_run_apply_and_reimport_preserve_other_sources(store, monkeypatch, tmp_path):
    module = importer(store, monkeypatch)
    session = store[0]
    row = listing()
    path = package(tmp_path, [row], [review(row, approved="no")])
    report_path = tmp_path / "report.json"
    before = session.scalar(select(func.count()).select_from(Offer))
    module.import_domestic_crawls([path], apply=True, report_path=report_path)
    assert session.scalar(select(func.count()).select_from(Offer)) == before
    write_reviews(path, [review(row)])
    dry = module.import_domestic_crawls([path], report_path=report_path)
    assert not dry["applied"] and dry["offers_added"] == 1
    assert session.scalar(select(func.count()).select_from(Offer)) == before
    assert session.get(SourceProduct, ("ShoeStoreLinks", "crawl:npstyle:123")) is None
    applied = module.import_domestic_crawls([path], apply=True, report_path=report_path)
    assert applied["offers_added"] == 1
    history = session.scalar(select(func.count()).select_from(OfferObservation))
    repeated = module.import_domestic_crawls([path], apply=True, report_path=report_path)
    assert repeated["offers_added"] == 0
    assert session.scalar(select(func.count()).select_from(OfferObservation)) == history
    assert session.scalar(select(func.count()).select_from(Offer).where(Offer.source != "ShoeStoreLinks")) == before
    # Reusing the source product for another shoe aborts; it never silently moves.
    other = review(row, shoe_id="40390", shoe_name="Nike Pegasus 41", brand="Nike")
    write_reviews(path, [other])
    with pytest.raises(ValueError, match="already mapped"):
        module.import_domestic_crawls([path], apply=True, report_path=report_path)


def test_new_domestic_offers_reach_storefront_outbound_and_admin_metrics(client, store, monkeypatch, tmp_path):
    module = importer(store, monkeypatch)
    rows = [listing(), listing(retailer_product_id="124", product_url="https://npstyle.ir/product/evo-sl-red/",
                              price="13000000", observed_at=(datetime.now(timezone.utc)-timedelta(days=3)).isoformat())]
    path = package(tmp_path, rows)
    module.import_domestic_crawls([path], apply=True, report_path=tmp_path / "report.json")
    result = client.get("/api/shoes/adidas-adizero-evo-sl/offers",
                        params={"source": "ShoeStoreLinks", "market": "iran", "sort": "price_toman"})
    assert result.status_code == 200
    data = result.json()
    assert data["total"] == 2 and data["market_counts"]["iran"] == 2
    assert data["items"][0]["price_toman"] == 12600000
    assert data["items"][1]["availability"] == "unknown"  # Import never refreshes old stock.
    key = data["items"][0]["key"]
    redirect = client.get(f"/api/out/40586/{key}", follow_redirects=False)
    assert redirect.status_code == 302 and redirect.headers["location"] == rows[0]["product_url"]
    metrics = store_metrics(store[0], TrafficQuery(retailer_id="npstyle", market="iran"))
    assert metrics["total"] == 1  # Two listings are one shoe/store funnel.
    assert metrics["items"][0]["viewers"] == 1 and metrics["items"][0]["clickers"] == 1
