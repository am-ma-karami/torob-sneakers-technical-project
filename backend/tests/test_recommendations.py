from types import SimpleNamespace

import httpx
import pytest
from app.embeddings.documents import build_document
from app.models.catalog import Measurement
from app.schemas.search import HardFilters, Preferences, SearchIntent, SearchRequest
from app.services import recommendations, search, search_intent
from app.services.recommendation_scoring import score_product
from app.services.search_intent import IntentUnavailable, validate_intent
from app.services.search_query import merge_requirements
from pydantic import ValidationError
from sqlalchemy import select


def run(session, request):
    return recommendations.search(session, request, lambda query: [1.] + [0.] * 511)


def extracted(**kwargs):
    return SearchIntent(semantic_query="running shoes", **kwargs).model_dump()


def test_manual_search_never_calls_ai_or_vectors_and_obeys_brand_weight(store, monkeypatch):
    monkeypatch.setattr(recommendations, "extract_intent", lambda *args: pytest.fail("Manual mode called AI"))
    def forbidden(*args):
        pytest.fail("Manual mode called vector encoder")
    request = SearchRequest(hard_filters=HardFilters(brand=["adidas"], weight_max=250), preferences=Preferences(weight="light"))
    result = recommendations.search(store[0], request, forbidden)
    assert result["mode"] == "advanced" and result["items"]
    assert all(r["brand"] == "adidas" and r["weight_g"] <= 250 for r in result["items"])
    assert all(r["data_coverage"] == 1 and 0 <= r["match_score"] <= 100 for r in result["items"])


@pytest.mark.parametrize("query", ["کفش سبک زیر ۲۵۰ گرم برای دویدن", "running shoes under 250 grams"])
def test_persian_and_english_advisor_apply_extracted_constraints(store, monkeypatch, query):
    monkeypatch.setattr(recommendations, "extract_intent", lambda *args: extracted(
        hard_filters=HardFilters(category=["running-shoes"], weight_max=250, weight_max_exclusive=True),
        preferences=Preferences(weight="light")))
    result = run(store[0], SearchRequest(q=query))
    assert result["mode"] == "advisor" and result["items"]
    assert all(r["weight_g"] < 250 and "running-shoes" in r["categories"] for r in result["items"])


def test_hybrid_preserves_manual_filters_and_detects_conflicts(store, monkeypatch):
    monkeypatch.setattr(recommendations, "extract_intent", lambda *args: extracted(hard_filters=HardFilters(brand=["Nike"])))
    result = run(store[0], SearchRequest(q="Nike", hard_filters=HardFilters(brand=["adidas"])))
    assert result["status"] == "conflict" and result["items"] == []
    assert result["applied_hard_filters"]["brand"] == ["adidas"]


def test_merge_numeric_intersection_and_manual_soft_authority():
    hard, prefs, conflicts = merge_requirements(HardFilters(weight_max=250), HardFilters(weight_max=200),
                                               Preferences(width="wide"), Preferences(width="regular"))
    assert hard.weight_max == 200 and prefs.width == "wide" and conflicts[0]["blocking"] is False
    _, _, conflicts = merge_requirements(HardFilters(weight_min=300), HardFilters(weight_max=250), Preferences(), Preferences())
    assert conflicts[0]["blocking"] is True


def test_missing_mandatory_measurement_is_never_a_verified_match(store):
    session = store[0]
    metric = session.scalar(select(Measurement).where(Measurement.shoe_id == 40586, Measurement.key == "weight_g"))
    session.delete(metric)
    session.flush()
    result = run(session, SearchRequest(hard_filters=HardFilters(brand=["adidas"], weight_max=300)))
    assert 40586 not in [r["shoe_id"] for r in result["items"]]


def test_photo_estimated_mandatory_metric_is_not_lab_or_stated(store):
    session = store[0]
    metric = session.scalar(select(Measurement).where(Measurement.shoe_id == 40586, Measurement.key == "weight_g"))
    metric.provenance = dict(metric.provenance, origin="photo_estimated")
    session.flush()
    result = run(session, SearchRequest(hard_filters=HardFilters(weight_max=300)))
    assert 40586 not in [r["shoe_id"] for r in result["items"]]


def test_empty_results_do_not_relax_constraints(store):
    result = run(store[0], SearchRequest(hard_filters=HardFilters(weight_max=1)))
    assert result["status"] == "no_matches" and result["items"] == []
    assert result["applied_hard_filters"]["weight_max"] == 1
    assert result["suggested_adjustments"] and not result["suggested_adjustments"][0]["applied"]


def test_ai_failure_is_explicit_and_manual_still_functions(store, monkeypatch):
    def unavailable(*args):
        raise IntentUnavailable("intent_unavailable_or_invalid")
    monkeypatch.setattr(recommendations, "extract_intent", unavailable)
    result = run(store[0], SearchRequest(q="soft running shoes"))
    assert result["status"] == "intent_unavailable" and not result["items"]
    hybrid = run(store[0], SearchRequest(q="soft running shoes", hard_filters=HardFilters(brand=["adidas"])))
    assert hybrid["status"] == "manual_filter_only" and hybrid["requires_confirmation"]
    assert hybrid["items"] and all(r["brand"] == "adidas" for r in hybrid["items"])


def test_supported_intent_quotes_units_and_persian_numbers():
    query = "وزنش بیشتر از ۰٫۲۵ کیلو نباشه و نرم میخوام"
    value = validate_intent({"hard_filters": {"weight_max": "۲۵۰"}, "preferences": {"cushion": "soft"},
        "semantic_query": "soft running shoes at most 250 grams",
        "evidence": {"hard_filters.weight_max": "۰٫۲۵ کیلو", "preferences.cushion": "نرم"}}, query, ["Nike"])
    assert value.hard_filters.weight_max == 250


@pytest.mark.parametrize("payload", [
    {"hard_filters": {"weight_max": 200}, "semantic_query": "shoes"},
    {"hard_filters": {"brand": ["Invented"]}, "semantic_query": "shoes"},
    {"preferences": {"magical_comfort": "high"}, "semantic_query": "shoes"},
    {"product_ids": [999999], "semantic_query": "shoes"},
    {"hard_filters": {"weight_max": float("nan")}, "semantic_query": "shoes"},
])
def test_invalid_or_ungrounded_ai_fields_are_rejected(payload):
    with pytest.raises(ValueError):
        validate_intent(payload, "comfortable shoes", ["Nike"])


def test_malformed_provider_json_becomes_controlled_failure(monkeypatch):
    from pydantic import SecretStr
    monkeypatch.setattr(search_intent, "get_settings", lambda: SimpleNamespace(metis_api_key=SecretStr("test-only"), metis_model="test"))
    client_class = httpx.Client
    monkeypatch.setattr(search_intent.httpx, "Client", lambda **kwargs: client_class(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json={"choices": [{"message": {"content": "not JSON"}}]})), **kwargs))
    search_intent.extract_intent.cache_clear()
    with pytest.raises(IntentUnavailable):
        search_intent.extract_intent("test request", ("Nike",))
    search_intent.extract_intent.cache_clear()


def test_soft_preference_scoring_and_missing_coverage_are_separate():
    def doc(weight=None):
        shoe = SimpleNamespace(id=1, name="Example", brand="Example", summary={})
        return build_document(shoe, [] if weight is None else [SimpleNamespace(key="weight_g", value=weight,
            unit="g", provenance={"source": "test", "origin": "lab_measured"})])
    prefs = Preferences(weight="light", cushion="soft", priorities={"weight": 2})
    light = score_product(doc(200), prefs, {}, 0, False)
    heavy = score_product(doc(350), prefs, {}, 0, False)
    unknown = score_product(doc(), prefs, {}, 0, False)
    assert light["ranking_score"] > heavy["ranking_score"]
    assert light["data_coverage"] < 1 and light["match_score"] < 100
    assert unknown["match_score"] == 0 and unknown["data_coverage"] == 0
    assert score_product(doc(), Preferences(), {}, 0, False)["match_score"] is None


def test_deterministic_unique_ids_and_final_revalidation(store, monkeypatch):
    session = store[0]
    request = SearchRequest(hard_filters=HardFilters(weight_max=300))
    first, second = run(session, request), run(session, request)
    assert [r["product_id"] for r in first["items"]] == [r["product_id"] for r in second["items"]]
    assert len({r["product_id"] for r in first["items"]}) == len(first["items"])
    original = recommendations.repository.eligible
    def revalidate(session, hard, legacy=None, identifiers=None):
        return [] if identifiers is not None else original(session, hard, legacy)
    monkeypatch.setattr(recommendations.repository, "eligible", revalidate)
    assert run(session, request)["items"] == []


def test_api_contract_validation_and_manual_mode(client):
    result = client.post("/api/search", json={"hard_filters": {"brand": ["adidas"], "weight_max": 250}, "limit": 9})
    assert result.status_code == 200 and result.json()["mode"] == "advanced"
    assert result.headers["cache-control"] == "no-store"
    assert client.post("/api/search", json={"q": " "}).status_code == 422
    assert client.post("/api/search", json={"q": "x", "limit": 500}).status_code == 422
    assert client.post("/api/search", json={"q": "x", "mode": "advanced"}).status_code == 422
    with pytest.raises(ValidationError):
        HardFilters(weight_min=300, weight_max=200)


def test_query_encoder_preserves_all_chunks(monkeypatch):
    seen = []
    class FakeEncoder:
        def text(self, document):
            seen.append(document)
            return [1.] + [0.] * 511, {}
    monkeypatch.setattr(search, "encoder", lambda: FakeEncoder())
    search.query_vector.cache_clear()
    query = "running shoes " * 80 + "maximum drop 0 mm"
    search.query_vector(query)
    assert seen[0].statements == [query]
    search.query_vector.cache_clear()


def test_missing_preference_quote_can_only_recover_a_real_controlled_term():
    result = validate_intent({"semantic_query": "road shoes", "preferences": {"surface": "road"}},
                             "running on asphalt", ["Nike"])
    assert result.evidence["preferences.surface"] == "asphalt"
    with pytest.raises(ValueError):
        validate_intent({"semantic_query": "trail shoes", "preferences": {"surface": "trail"}},
                        "running on asphalt", ["Nike"])


def test_inclusive_boundary_and_dangling_strict_flags_are_rejected():
    with pytest.raises(ValueError):
        validate_intent({"semantic_query": "shoes", "hard_filters": {"weight_max": 250, "weight_max_exclusive": True},
                         "evidence": {"hard_filters.weight_max": "no more than 250 grams"}},
                        "no more than 250 grams", ["Nike"])
    with pytest.raises(ValueError):
        HardFilters(weight_max_exclusive=True)


def test_conflicting_ai_priority_does_not_change_manual_preference_weight():
    _, preferences, _ = merge_requirements(HardFilters(), HardFilters(), Preferences(width="regular"),
                                          Preferences(width="wide", priorities={"width": 4}))
    assert preferences.width == "regular" and preferences.priorities == {}


def test_stale_semantic_evidence_is_excluded_without_reembedding(store):
    from app.repositories import recommendations as repository
    from app.repositories.embeddings import ensure_model, save_embedding
    session = store[0]
    ensure_model(session)
    products = repository.eligible(session, HardFilters(), identifiers=[40586])
    docs = repository.evidence(session, products)
    vector = [1.] + [0.] * 511
    save_embedding(session, 40586, "text", vector, docs[40586].content_hash, {})
    save_embedding(session, 40586, "image", vector, "a" * 64, {"source_url": docs[40586].image_url})
    session.flush()
    assert set(repository.semantic_scores(session, docs, vector)[40586]) == {"text", "image"}
    metric = session.scalar(select(Measurement).where(Measurement.shoe_id == 40586, Measurement.key == "weight_g"))
    metric.value += 1
    session.flush()
    fresh = repository.evidence(session, products)
    assert set(repository.semantic_scores(session, fresh, vector)[40586]) == {"image"}


def test_invalid_vector_ids_and_duplicate_candidates_never_create_products(store, monkeypatch):
    original = recommendations.repository.eligible
    monkeypatch.setattr(recommendations.repository, "eligible", lambda *args, **kwargs: original(*args, **kwargs) * 2)
    monkeypatch.setattr(recommendations, "extract_intent", lambda *args: extracted())
    monkeypatch.setattr(recommendations.repository, "semantic_scores", lambda *args: {999999: {"text": 1., "image": 1.}})
    result = run(store[0], SearchRequest(q="shoes"))
    ids = [r["product_id"] for r in result["items"]]
    assert len(ids) == len(set(ids)) and 999999 not in ids


def test_legacy_supported_filters_use_same_core_and_invalid_facets_fail(client):
    response = client.post("/api/search", json={"filters": {"brand": ["adidas"], "weight_max": 250}})
    assert response.status_code == 200 and response.json()["mode"] == "advanced"
    assert client.post("/api/search", json={"filters": {"category": ["invented"]}}).status_code == 422
    assert client.post("/api/search", json={"filters": {"heel_max": 40}}).status_code == 422


@pytest.mark.parametrize("query", ["Weight must be no more than 250 grams", "وزنش بیشتر از ۲۵۰ گرم نباشه"])
def test_explicit_numeric_requirement_cannot_disappear(query):
    with pytest.raises(ValueError, match="omitted or changed"):
        validate_intent({"semantic_query": "shoes"}, query, ["Nike"])
    result = validate_intent({"semantic_query": "shoes", "hard_filters": {"weight_max": 250},
                              "evidence": {"hard_filters.weight_max": query}}, query, ["Nike"])
    assert result.hard_filters.weight_max == 250


def test_soft_numeric_wish_is_not_promoted_and_surface_omission_is_recovered():
    result = validate_intent({"semantic_query": "road shoes"},
                             "I prefer weight under 250 grams for road running", ["Nike"])
    assert result.hard_filters.weight_max is None
    assert result.preferences.surface == "road"
