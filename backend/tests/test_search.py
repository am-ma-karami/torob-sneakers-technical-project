
from app.repositories.search import fuse, retrieve
from app.schemas.catalog import CatalogQuery
from app.schemas.search import SearchRequest
from app.services import search


def test_fusion_combines_independent_ranks_without_treating_cosines_as_probabilities():
    ids, scores, reasons = fuse([("lexical", 1, [1, 2]), ("image", .7, [2, 3])])
    assert ids[0] == 2 and scores[2] > scores[1]
    assert reasons[2] == {"lexical": 2, "image": 1}


def test_fallback_hard_filters_and_no_credentials_in_response(store, monkeypatch):
    def unavailable(query):
        raise search.SearchUnavailable("provider_unavailable")
    monkeypatch.setattr(search, "translate_query", unavailable)
    request = SearchRequest(q="adidas", filters=CatalogQuery(brand=["adidas"]))
    result = search.search(store[0], request)
    assert result["mode"] == "lexical_fallback"
    assert result["degraded_reason"] == "provider_unavailable"
    assert result["items"] and all(row["brand"] == "adidas" for row in result["items"])


def test_no_vectors_has_explicit_fallback_and_empty_filter_is_empty(store):
    request = SearchRequest(q="Pegasus", filters=CatalogQuery(brand=["nonexistent"]))
    result = retrieve(store[0], request, "Pegasus", [1.] + [0.] * 511)
    assert result["items"] == [] and result["mode"] == "lexical_fallback"


def test_search_api_validates_and_uses_service(client, monkeypatch):
    monkeypatch.setattr(search, "translate_query", lambda q: "light running shoes")
    monkeypatch.setattr(search, "query_vector", lambda q: [1.] + [0.] * 511)
    result = client.post("/api/search", json={"q": "کفش سبک", "limit": 2})
    assert result.status_code == 200
    assert result.headers["cache-control"] == "no-store"
    assert client.post("/api/search", json={"q": " "}).status_code == 422
    assert client.post("/api/search", json={"q": "x", "limit": 500}).status_code == 422


def test_hybrid_uses_both_modalities_and_excludes_stale_spec_vectors(store):
    from app.repositories.embeddings import documents, ensure_model, save_embedding
    session = store[0]
    ensure_model(session)
    doc = next(d for d in documents(session) if d.shoe_id == 40586)
    unit = [1.] + [0.] * 511
    save_embedding(session, doc.shoe_id, "text", unit, doc.content_hash, {})
    save_embedding(session, doc.shoe_id, "image", unit, "a" * 64, {"source_url": doc.image_url})
    session.flush()
    request = SearchRequest(q="EVO SL", filters=CatalogQuery(brand=["adidas"]))
    result = retrieve(session, request, "EVO SL", unit)
    assert result["mode"] == "hybrid"
    row = next(r for r in result["items"] if r["shoe_id"] == 40586)
    assert set(row["search_channels"]) == {"lexical", "text", "image"}
    save_embedding(session, doc.shoe_id, "text", unit, "b" * 64, {})
    session.flush()
    result = retrieve(session, request, "EVO SL", unit)
    row = next(r for r in result["items"] if r["shoe_id"] == 40586)
    assert "text" not in row["search_channels"] and "image" in row["search_channels"]


def test_explanations_use_known_facts_and_do_not_invert_negations():
    from app.services.search_explanations import explain
    summary = {"name": "Example 1", "weight_g": 275, "terrain": "Road"}
    text = explain(summary, "کفش سبک برای آسفالت", "lightweight shoes for asphalt", {"image": 1})
    assert "275" in text and "جاده" in text
    assert "سبک است" not in text  # Recorded weight is not a suitability guarantee.
    negative = explain(summary, "کفش جاده‌ای نمیخوام", "not road shoes", {"text": 1})
    assert "هم‌راستاست" not in negative
    unknown = explain({"name": "Other"}, "lightweight", "lightweight", {"text": 1})
    assert "گرم" not in unknown
