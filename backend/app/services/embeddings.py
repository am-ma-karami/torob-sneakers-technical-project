"""Resumable offline embedding orchestration; bounded I/O and per-batch commits."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from app.db.session import SessionLocal
from app.embeddings.clip import ClipEncoder
from app.embeddings.images import ImageSourceError, primary_photo
from app.embeddings.spec import MODEL_KEY, MODEL_SPEC, RECIPE_VERSION, fingerprint
from app.repositories import embeddings as repository


def generate_embeddings(cache_dir, *, shoe_ids=None, limit=None, batch_size=16, workers=4,
                        device="auto", refresh_images=False, session_factory=SessionLocal,
                        encoder_factory=ClipEncoder, image_loader=primary_photo, progress=None):
    if not 1 <= batch_size <= 64 or not 1 <= workers <= 8:
        raise ValueError("Use batches 1–64 and download workers 1–8")
    with session_factory() as session:
        docs = repository.documents(session, shoe_ids, limit)
    if shoe_ids and set(shoe_ids) - {d.shoe_id for d in docs} and not limit:
        raise ValueError("Requested shoe ID does not exist")
    if not docs:
        raise ValueError("No products to embed")
    with session_factory.begin() as session:
        repository.ensure_model(session)
    report = dict(model_key=MODEL_KEY, model=MODEL_SPEC, started_at=datetime.now(timezone.utc).isoformat(),
                  products=len(docs), text_written=0, image_written=0, text_skipped=0, image_skipped=0,
                  failures=[], device=None)
    encoder = None

    def get_encoder():
        nonlocal encoder
        if encoder is None:
            encoder = encoder_factory(cache_dir / "model", device=device)
            report["device"] = encoder.device
        return encoder

    def load_image(document):
        try:
            return image_loader(document, cache_dir / "images", refresh=refresh_images)
        except ImageSourceError as error:
            # Controlled reason codes only; never store arbitrary network response bodies.
            return {"shoe_id": document.shoe_id, "modality": "image", "reason": str(error)}

    with ThreadPoolExecutor(max_workers=workers) as pool:
        for start in range(0, len(docs), batch_size):
            batch = docs[start:start + batch_size]
            with session_factory() as session:
                existing = repository.existing_hashes(session, [d.shoe_id for d in batch])
            photo_results = list(pool.map(load_image, batch))
            writes = []
            for document in batch:
                if existing.get((document.shoe_id, "text")) == document.content_hash:
                    report["text_skipped"] += 1
                    continue
                vector, chunks = get_encoder().text(document)
                provenance = dict(recipe=RECIPE_VERSION, facts=document.facts, **chunks)
                writes.append((document.shoe_id, "text", vector, document.content_hash, provenance))
            pending_images = []
            for document, result in zip(batch, photo_results, strict=True):
                if isinstance(result, dict):
                    report["failures"].append(result)
                    continue
                path, metadata = result
                content_hash = fingerprint({"url": document.image_url, "sha256": metadata["sha256"],
                                            "recipe": RECIPE_VERSION})
                if existing.get((document.shoe_id, "image")) == content_hash:
                    report["image_skipped"] += 1
                    continue
                pending_images.append((document, path, metadata, content_hash))
            if pending_images:
                vectors = get_encoder().images([row[1] for row in pending_images])
                for (document, _, metadata, content_hash), vector in zip(pending_images, vectors, strict=True):
                    provenance = dict(recipe=RECIPE_VERSION, role="canonical_primary_photo", variant_key=None,
                                      source_url=document.image_url, photo=metadata)
                    writes.append((document.shoe_id, "image", vector, content_hash, provenance))
            if writes:
                with session_factory.begin() as session:
                    for args in writes:
                        repository.save_embedding(session, *args)
                report["text_written"] += sum(row[1] == "text" for row in writes)
                report["image_written"] += sum(row[1] == "image" for row in writes)
            if progress:
                progress(dict(processed=min(start + batch_size, len(docs)), total=len(docs),
                              text_written=report["text_written"], image_written=report["image_written"],
                              failures=len(report["failures"])))
    with session_factory() as session:
        report["coverage"] = repository.coverage(session)
    report["finished_at"] = datetime.now(timezone.utc).isoformat()
    report["status"] = "partial" if report["failures"] else "complete"
    return report
