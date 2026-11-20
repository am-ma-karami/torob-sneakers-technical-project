import json

import pytest
from app.core.taxonomy import model_family, normalize
from app.models.catalog import Measurement, Offer, Shoe, SourcePayload, Variant
from app.schemas.catalog import FinderRequest, MetricInput
from app.services.catalog import rank_shoe
from pydantic import ValidationError
from sqlalchemy import func, select


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("نایکی پگاسوس ۴۱", "nike pegasus 41"),
        ("نايكي پگاسوس ٤١", "nike pegasus 41"),
        ("  NIKE--Pegasus_41 ", "nike pegasus_41"),
        ("آدیداس سفید", "adidas white"),
        ("پیاده\u200cروی", "walking"),
        ("نیو بالانس ۱۰۸۰", "نیو بالانس 1080"),
    ],
)
def test_normalization(raw, expected):
    assert normalize(raw) == expected


def test_families_are_not_model_identities():
    assert model_family("Nike Pegasus 39", "Nike") == model_family("Nike Pegasus 41", "Nike")
    assert normalize("Nike Pegasus 39") != normalize("Nike Pegasus 41")
    assert normalize("Nike Pegasus 41 GTX") != normalize("Nike Pegasus 41")
    assert normalize("Nike Pegasus 41 Kids") != normalize("Nike Pegasus 41")


@pytest.mark.parametrize("v", [float("nan"), float("inf"), -float("inf")])
def test_invalid_measurement(v):
    with pytest.raises(ValidationError):
        MetricInput(value=v, unit="mm", source="RunRepeat", origin="lab_measured")


def test_missing_preferences_are_disclosed():
    points, reasons, unknown = rank_shoe({}, FinderRequest(width="wide", weight="light", cushion="soft"))
    assert points == 40 and len(unknown) == 3 and len(reasons) == 1


def test_firmness_methods_are_separate():
    p = FinderRequest(cushion="soft")
    assert rank_shoe({"midsole_firmness_asker_c": 40, "midsole_softness_shore_a": 10}, p)[0] == 40
    assert rank_shoe({"midsole_firmness_asker_c": None, "midsole_softness_shore_a": 10}, p)[0] == 60


def test_import_idempotent(store):
    session, first, importer, data_dir = store
    before = {
        table.__tablename__: session.scalar(select(func.count()).select_from(table))
        for table in [Shoe, Measurement, Variant, Offer, SourcePayload]
    }
    second = importer.import_catalog(data_dir)
    after = {
        table.__tablename__: session.scalar(select(func.count()).select_from(table))
        for table in [Shoe, Measurement, Variant, Offer, SourcePayload]
    }
    assert first["created"] == 4 and second.get("created", 0) == 0 and second["updated"] == 4
    assert before == after


def test_import_rejects_duplicate_identity_without_mutation(store):
    session, _, importer, data_dir = store
    path = data_dir / "shoes-ui.json"
    payload = json.loads(path.read_text())
    payload["shoes"].append(payload["shoes"][0])
    path.write_text(json.dumps(payload))
    with pytest.raises(ValueError, match="Duplicate"):
        importer.import_catalog(data_dir)
    assert session.scalar(select(func.count()).select_from(Shoe)) == 4


def test_identity_and_width_variants_retained(store):
    session, _, _, _ = store
    rows = session.scalars(select(Shoe)).all()
    assert len({s.id for s in rows}) == len({s.slug for s in rows}) == 4
    assert all("width_variants" in s.detail["fit"] for s in rows)
    assert all(session.get(SourcePayload, s.id) is not None for s in rows)


def test_provenance_and_archive_thickness(store):
    session = store[0]
    assert session.get(Measurement, (40586, "outsole_thickness_mm")).value == 1.6
    assert session.get(Measurement, (40586, "insole_thickness_mm")).value == 2.4
    measured = session.get(Measurement, (40586, "heel_stack_mm"))
    stated = session.get(Measurement, (40586, "stated_heel_stack_mm"))
    assert measured.value == 36.1 and stated.value == 38.5
    assert measured.provenance["origin"] == "lab_measured"
    assert stated.provenance["origin"] == "manufacturer_stated"
    assert session.get(Measurement, (40586, "midsole_firmness_asker_c")).unit == "Asker C"
    assert session.get(Measurement, (40586, "midsole_softness_shore_a")).unit == "Shore A"
    assert session.get(Measurement, (40586, "toe_tip_height_mm")).provenance["reference_length_mm"] == 300


def test_catalog_pagination_sorting_and_search(client):
    assert client.get("/api/catalog").json()["total"] == 4
    first = client.get("/api/catalog?page_size=2&sort=weight").json()
    second = client.get("/api/catalog?page_size=2&page=2&sort=weight").json()
    assert set(s["shoe_id"] for s in first["items"]).isdisjoint(s["shoe_id"] for s in second["items"])
    weights = [s["weight_g"] for s in first["items"] + second["items"]]
    assert weights == sorted(weights)
    assert first == client.get("/api/catalog?page_size=2&sort=weight").json()
    found = client.get("/api/catalog", params={"q": "نایکی پگاسوس ۴۱"}).json()
    assert found["total"] == 1 and found["items"][0]["slug"] == "nike-pegasus-41"


def test_or_within_and_across_facets(client):
    both = client.get("/api/catalog?brand=Nike&brand=adidas").json()
    assert both["total"] == 4
    narrowed = client.get("/api/catalog?brand=Nike&brand=adidas&category=running-shoes").json()
    assert narrowed["total"] == 2
    assert all("running-shoes" in s["categories"] for s in narrowed["items"])


def test_disjunctive_facet_counts(client):
    result = client.get("/api/facets?brand=adidas&category=running-shoes").json()
    counts = {v["value"]: v["count"] for v in result["groups"]["brand"]}
    assert counts["Nike"] == 1 and counts["adidas"] == 1
    assert sum(v["count"] for v in result["groups"]["category"]) == 2


def test_missing_measurements_are_excluded_by_range(client, store):
    session = store[0]
    shoe = session.get(Shoe, 40586)
    shoe.weight = None
    session.commit()
    result = client.get("/api/catalog?weight_max=3000").json()
    assert result["total"] == 3
    assert 40586 not in [s["shoe_id"] for s in result["items"]]
    assert client.get("/api/catalog?sort=weight").json()["items"][-1]["shoe_id"] == 40586


def test_no_raw_archive_or_size_charts_in_catalog(client):
    result = client.get("/api/catalog").json()
    assert len(json.dumps(result)) < 20000
    assert all("fit" not in s and "source_payloads" not in s and "metrics" not in s for s in result["items"])


def test_verified_variants_and_offer_identity(client):
    shoe = client.get("/api/shoes/adidas-adizero-evo-sl").json()
    black = next(v for v in shoe["variants"] if v["source_id"] == 1986833)
    assert black["name"] == "Black (JP7149)" and black["colors"] == ["black"]
    assert black["image_url"].startswith("https://cdn.runrepeat.com/i/")
    specific = [o for o in shoe["offers"] if o["variant_key"] == black["key"]]
    assert len(specific) == 1 and specific[0]["currency"] == "EUR"
    assert specific[0]["price"] == 96 and specific[0]["live_verified"] is False
    assert any(o["variant_key"] is None for o in shoe["offers"])


def test_comparison_order_and_missing_models(client):
    # Obtain actual fixture IDs rather than assuming a second model's identity.
    shoes = client.get("/api/catalog").json()["items"]
    ids = [s["shoe_id"] for s in shoes[:2]][::-1]
    response = client.get("/api/compare", params=[("ids", i) for i in ids])
    assert [s["shoe_id"] for s in response.json()["items"]] == ids
    assert client.get("/api/compare?ids=99999999").status_code == 404


@pytest.mark.parametrize(
    "query",
    [
        "page=0",
        "page_size=49",
        "sort=sql",
        "q=" + "x" * 161,
        "weight_min=400&weight_max=200",
        "drop_min=-21",
        "unknown=true",
        "price_min=-1",
    ],
)
def test_invalid_queries(client, query):
    response = client.get("/api/catalog?" + query)
    assert response.status_code == 422 and response.json()["error"]["code"] == "validation_error"


def test_safe_search_input(client):
    assert client.get("/api/catalog", params={"q": "' OR 1=1; DROP TABLE shoes; --"}).status_code == 200
    assert client.get("/api/catalog").json()["total"] == 4


def test_finder_is_explainable_and_validated(client):
    response = client.post(
        "/api/finder",
        json={"category": "running-shoes", "width": "wide", "weight": "light", "cushion": "soft"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["items"] and all("running-shoes" in r["shoe"]["categories"] for r in data["items"])
    assert all("reasons" in r and "unknown" in r for r in data["items"])
    assert client.post("/api/finder", json={"width": "huge"}).status_code == 422
    assert client.post("/api/finder", json={"category": "bogus"}).status_code == 404


def test_health_cors_and_security_headers(client):
    assert client.get("/api/health").json()["status"] == "ok"
    assert client.get("/api/ready").json()["shoes"] == 4
    allowed = client.get("/api/catalog", headers={"Origin": "http://127.0.0.1:5173"})
    assert allowed.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"
    blocked = client.get("/api/catalog", headers={"Origin": "https://untrusted.example"})
    assert "access-control-allow-origin" not in blocked.headers
    assert blocked.headers["x-content-type-options"] == "nosniff"
    assert client.post("/api/finder", content="x" * 17000).status_code == 413
