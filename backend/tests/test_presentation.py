import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest
from app.services.presentation import (
    CONTENT,
    empirical_distribution,
    present_detail,
    reference_price,
    review_translation,
)


def settings(rate=None, stamp=None):
    return SimpleNamespace(reference_usd_toman=rate, reference_rate_at=stamp)


def test_reference_price_requires_valid_explicit_basis():
    original = {"msrp_usd": 150}
    now = datetime.now(timezone.utc)
    for config in [
        settings(),
        settings(70000),
        settings(70000, now + timedelta(days=1)),
        settings(70000, now.replace(tzinfo=None)),
    ]:
        assert reference_price(original, config) is None
    price = reference_price(original, settings(70000, now))
    assert price["amount_toman"] == 10_500_000
    assert price["original_amount"] == 150
    assert price["original_currency"] == "USD"
    assert price["rate_toman_per_usd"] == 70000
    assert price["rate_at"] == now.isoformat()
    assert original == {"msrp_usd": 150}


@pytest.mark.parametrize("amount", [None, 0, -1, float("nan"), float("inf"), True])
def test_invalid_reference_amount_is_hidden(amount):
    assert reference_price({"msrp_usd": amount}, settings(70000, datetime.now(timezone.utc))) is None


def test_empirical_midrank_ties_and_histogram_boundaries():
    d = empirical_distribution([0, 80, 80, 90, 100, None, float("nan"), True, 120], 80)
    assert d["bins"] == [1, 0, 0, 0, 0, 0, 0, 0, 2, 2]
    assert d["population_size"] == 5
    assert d["percentile"] == 40
    assert empirical_distribution([1, 2, 3, 4], 3) is None
    assert empirical_distribution([1, 2, 3, 4, 5], True) is None
    assert empirical_distribution([1, 2, 3, 4, 5], None) is None


def test_stored_translations_preserve_originals_and_nulls():
    original = {"summary": {"pros": "Low weight", "cons": None, "heel_stack_mm": None}}
    output = present_detail(original)
    assert output["reviews_fa"] == {"pros": ["وزن کم"], "cons": []}
    assert output["summary"]["heel_stack_mm"] is None
    assert original == {"summary": {"pros": "Low weight", "cons": None, "heel_stack_mm": None}}
    assert review_translation("A new untranslated record") == []
    entries = json.loads((CONTENT / "reviews-fa.json").read_text())
    assert len(entries) == 9248
    assert all(any("\u0600" <= c <= "\u06ff" for c in v) for v in entries.values())


def test_scores_use_actual_usage_keys_and_only_primary_category(client):
    shoes = client.get("/api/catalog").json()["items"]
    for shoe in shoes:
        detail = client.get("/api/shoes/" + shoe["slug"]).json()
        scores = client.get("/api/shoes/" + shoe["slug"] + "/scores").json()
        assert {r["key"] for r in scores["rows"]} == set(detail["scores"]["runrepeat"]["usage"])
        assert scores["category"] == detail["summary"]["categories"][0]
        assert scores["source_key"] == "runrepeat_usage"
        for row in scores["rows"]:
            assert row["value"] == detail["scores"]["runrepeat"]["usage"][row["key"]]
    assert client.get("/api/presentation").json()["reference_price_enabled"] is False
