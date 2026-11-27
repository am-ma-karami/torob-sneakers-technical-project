import hashlib
import json
from io import BytesIO
from types import SimpleNamespace

import httpx
import pytest
from app.embeddings.clip import chunk_tokens
from app.embeddings.documents import build_document
from app.embeddings.images import ImageSourceError, primary_photo, validate_url
from app.embeddings.spec import DIMENSIONS, MODEL_KEY
from app.models.catalog import Measurement, Offer, Shoe
from app.models.embeddings import ProductEmbedding
from app.repositories.embeddings import coverage, ensure_model, save_embedding
from app.services.embeddings import generate_embeddings
from sqlalchemy import func, select
from sqlalchemy.orm import sessionmaker


def test_documents_preserve_unknown_zero_false_and_measurement_provenance():
    shoe = SimpleNamespace(id=1, name="Example 2 GTX", brand="Example", summary={
        "image_url": "https://cdn.runrepeat.com/storage/gallery/product_primary/1/x.jpg",
        "terrain": "Trail", "plate": None, "reflective": False, "release_year": 2026,
        "best_offer_price": 999, "offer_records": 7,
    })
    measured = SimpleNamespace(key="drop_mm", value=0.0, unit="mm", provenance={
        "origin": "lab_measured", "source": "RunRepeat", "source_url": "https://runrepeat.com/example",
        "methodology_version": "2.5",
    })
    estimated = SimpleNamespace(key="toe_rocker_pct", value=37.0, unit="% length", provenance={
        "origin": "photo_estimated", "source": "ShoeGeometry", "uncertain": True,
    })
    doc = build_document(shoe, [estimated, measured])
    assert "plate" not in doc.facts["attributes"]
    assert doc.facts["attributes"]["reflective"] is False
    assert "drop mm: 0.0 mm (lab measured" in " ".join(doc.statements)
    assert "photo estimated" in " ".join(doc.statements) and "uncertain estimate" in " ".join(doc.statements)
    assert doc.facts["measurements"]["drop_mm"]["provenance"] == measured.provenance
    shoe.summary["best_offer_price"] = 123
    assert build_document(shoe, [measured, estimated]).content_hash == doc.content_hash
    measured.provenance = dict(measured.provenance, origin="manufacturer_stated")
    assert build_document(shoe, [measured, estimated]).content_hash != doc.content_hash


class WordTokenizer:
    """Test token budget and lossless splitting without downloading a model in CI."""
    def __init__(self):
        self.words = {}

    def encode(self, text, add_special_tokens=False, **kwargs):
        return [self.words.setdefault(word, len(self.words) + 3) for word in text.split()]

    def build_inputs_with_special_tokens(self, tokens):
        return [1, *tokens, 2]


def test_long_specs_keep_the_tail_and_identity_in_every_clip_context():
    tokenizer = WordTokenizer()
    statements = [" ".join(f"fact-{i}" for i in range(120)), "Final measurement: 0 mm."]
    chunks = chunk_tokens(tokenizer, "Exact model GTX", statements, max_length=16)
    prefix = tokenizer.encode("Exact model GTX. ")
    body = [t for statement in statements for t in tokenizer.encode(statement + " ")]
    assert len(chunks) > 1 and max(map(len, chunks)) <= 16
    assert all(c[1:1 + len(prefix)] == prefix and c[0] == 1 and c[-1] == 2 for c in chunks)
    reconstructed = [t for c in chunks for t in c[1 + len(prefix):-1]]
    assert reconstructed == body
    with pytest.raises(ValueError, match="identity"):
        chunk_tokens(tokenizer, " ".join(["long"] * 20), statements, max_length=16)


@pytest.mark.parametrize("url", [
    "http://cdn.runrepeat.com/storage/gallery/product_primary/1/x.jpg",
    "https://cdn.runrepeat.com.evil.example/storage/gallery/product_primary/1/x.jpg",
    "https://cdn.runrepeat.com/storage/gallery/product_primary/2/x.jpg",
    "https://cdn.runrepeat.com/storage/gallery/product_content/1/shock-absorption.jpg",
    "https://cdn.runrepeat.com:invalid/storage/gallery/product_primary/1/x.jpg",
    "https://user:password@cdn.runrepeat.com/storage/gallery/product_primary/1/x.jpg",
])
def test_photo_fetch_cannot_accept_unrelated_products_charts_or_arbitrary_hosts(url):
    with pytest.raises(ImageSourceError):
        validate_url(url, 1)


def test_cached_photo_bytes_are_verified_and_refresh_retains_observation_meaning(tmp_path, monkeypatch):
    image_module = pytest.importorskip("PIL.Image")
    from app.embeddings import images

    buffer = BytesIO()
    image_module.new("RGB", (80, 40), color="red").save(buffer, format="PNG")
    payload = buffer.getvalue()
    requests = []

    def handler(request):
        requests.append(request.url)
        return httpx.Response(200, content=payload, headers={"content-type": "image/png"})

    client_class = httpx.Client
    monkeypatch.setattr(images.httpx, "Client", lambda **kwargs: client_class(
        transport=httpx.MockTransport(handler), **kwargs))
    doc = SimpleNamespace(shoe_id=1, image_url="https://cdn.runrepeat.com/storage/gallery/product_primary/1/x.png")
    path, meta = primary_photo(doc, tmp_path)
    assert meta["sha256"] == hashlib.sha256(payload).hexdigest()
    _, reused = primary_photo(doc, tmp_path)
    assert reused == meta and len(requests) == 1
    path.write_bytes(b"corrupted cache")
    _, repaired = primary_photo(doc, tmp_path)
    assert len(requests) == 2 and path.read_bytes() == payload
    assert repaired["retrieved_at"] != meta["retrieved_at"]
    primary_photo(doc, tmp_path, refresh=True)
    assert len(requests) == 3


def test_failed_or_non_image_responses_never_become_cached_vectors(tmp_path, monkeypatch):
    from app.embeddings import images

    client_class = httpx.Client
    monkeypatch.setattr(images.httpx, "Client", lambda **kwargs: client_class(
        transport=httpx.MockTransport(lambda request: httpx.Response(403, text="not a photo")), **kwargs))
    doc = SimpleNamespace(shoe_id=1, image_url="https://cdn.runrepeat.com/storage/gallery/product_primary/1/x.jpg")
    with pytest.raises(ImageSourceError, match="photo_http_403"):
        primary_photo(doc, tmp_path)
    assert not list(tmp_path.glob("*.image"))


UNIT = [1.0] + [0.0] * (DIMENSIONS - 1)


class TestEncoder:
    __test__ = False
    device = "test-only"

    def __init__(self, *args, **kwargs):
        pass

    def text(self, doc):
        return UNIT, dict(chunks=doc.statements, token_counts=[10], chunk_count=1)

    def images(self, paths):
        return [UNIT for _ in paths]


def test_real_storage_resume_skips_inference_and_only_reembeds_changed_specs(store, tmp_path):
    session = store[0]
    factory = sessionmaker(session.get_bind(), expire_on_commit=False)
    before_offers = session.scalar(select(func.count()).select_from(Offer))

    def image_loader(doc, cache, **kwargs):
        return tmp_path / "unused-by-test-encoder", dict(sha256="a" * 64, url=doc.image_url)

    args = dict(session_factory=factory, encoder_factory=TestEncoder, image_loader=image_loader, limit=2)
    first = generate_embeddings(tmp_path, **args)
    assert first["text_written"] == 2 and first["image_written"] == 2
    rows = list(session.scalars(select(ProductEmbedding)))
    timestamps = {(r.shoe_id, r.modality): r.updated_at for r in rows}

    def must_not_load(*args, **kwargs):
        pytest.fail("Unchanged run must not instantiate an encoder")

    repeated = generate_embeddings(tmp_path, **dict(args, encoder_factory=must_not_load))
    assert repeated["text_written"] == repeated["image_written"] == 0
    assert repeated["text_skipped"] == repeated["image_skipped"] == 2
    session.expire_all()
    assert timestamps == {(r.shoe_id, r.modality): r.updated_at for r in session.scalars(select(ProductEmbedding))}
    sid = rows[0].shoe_id
    measurement = session.scalar(select(Measurement).where(Measurement.shoe_id == sid))
    measurement.value += 1
    session.commit()
    changed = generate_embeddings(tmp_path, **args)
    assert changed["text_written"] == 1 and changed["image_written"] == 0
    assert session.scalar(select(func.count()).select_from(Offer)) == before_offers
    assert coverage(session)["both"] == 2
    # The actual vector type/SQL cosine operator works against persisted vectors.
    distance = session.scalar(select(ProductEmbedding.embedding.cosine_distance(UNIT)).limit(1))
    assert abs(distance) < 0.00001


def test_missing_photo_is_partial_and_retry_fills_only_missing_modality(store, tmp_path):
    factory = sessionmaker(store[0].get_bind(), expire_on_commit=False)

    def missing(doc, *args, **kwargs):
        raise ImageSourceError("photo_http_404")

    first = generate_embeddings(tmp_path, limit=1, session_factory=factory,
                                encoder_factory=TestEncoder, image_loader=missing)
    assert first["status"] == "partial" and first["text_written"] == 1 and first["image_written"] == 0
    assert first["failures"][0]["reason"] == "photo_http_404"
    repaired = generate_embeddings(tmp_path, limit=1, session_factory=factory, encoder_factory=TestEncoder,
                                   image_loader=lambda doc, *args, **kwargs: (tmp_path / "x", {"sha256": "b" * 64}))
    assert repaired["text_skipped"] == 1 and repaired["image_written"] == 1
    assert repaired["status"] == "complete"


@pytest.mark.parametrize("vector", [[0.0] * 512, [float("nan")] * 512, [1.0] * 511, [float("inf")] * 512])
def test_bad_embeddings_cannot_contaminate_vector_storage(store, vector):
    session = store[0]
    ensure_model(session)
    with pytest.raises(ValueError):
        save_embedding(session, 40586, "text", vector, "a" * 64, {})
    assert session.scalar(select(func.count()).select_from(ProductEmbedding)) == 0
    assert session.get(ProductEmbedding, (40586, MODEL_KEY, "text")) is None


def test_embedding_provenance_is_snapshot_not_a_rewrite_of_catalog(store):
    session = store[0]
    ensure_model(session)
    shoe = session.get(Shoe, 40586)
    old_summary = json.dumps(shoe.summary, sort_keys=True)
    save_embedding(session, 40586, "image", UNIT, "c" * 64, {"role": "canonical_primary_photo", "variant_key": None})
    session.flush()
    session.expire_all()
    assert json.dumps(session.get(Shoe, 40586).summary, sort_keys=True) == old_summary
