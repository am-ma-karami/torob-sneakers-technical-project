"""Explicit offline CLI: plan by default, --apply to generate, --status for coverage."""

import argparse
import json
import sys
from pathlib import Path

from sqlalchemy import text

from app.core.config import ROOT
from app.db.session import SessionLocal, engine
from app.embeddings.spec import MODEL_KEY, MODEL_SPEC
from app.repositories.embeddings import coverage, documents


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--apply", action="store_true", help="Generate real CLIP embeddings and commit batches")
    action.add_argument("--status", action="store_true", help="Read stored embedding coverage without loading CLIP")
    parser.add_argument("--shoe-id", type=int, action="append", dest="shoe_ids")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--device", choices=["auto", "cpu", "mps", "cuda"], default="auto")
    parser.add_argument("--refresh-images", action="store_true", help="Recheck source photo bytes instead of cached originals")
    parser.add_argument("--cache-dir", type=Path, default=ROOT / ".local/embeddings")
    parser.add_argument("--report", type=Path, default=ROOT / ".local/embeddings/last-run.json")
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be positive")
    with SessionLocal() as session:
        if args.status:
            print(json.dumps(coverage(session), indent=2))
            return 0
        if not args.apply:
            docs = documents(session, args.shoe_ids, args.limit)
            print(json.dumps(dict(action="plan_only", products=len(docs),
                                  primary_photos=sum(bool(d.image_url) for d in docs),
                                  model=MODEL_SPEC), indent=2))
            return 0
    from app.services.embeddings import generate_embeddings

    args.report.parent.mkdir(parents=True, exist_ok=True)
    checkpoint = dict(model_key=MODEL_KEY, status="running")

    def progress(value):
        checkpoint.update(value)
        temp = args.report.with_suffix(".tmp")
        temp.write_text(json.dumps(checkpoint, indent=2) + "\n")
        temp.replace(args.report)
        print(json.dumps(value), flush=True)

    # Prevent two writers for the same model/recipe, including interrupted runs.
    lock_id = int(MODEL_KEY[:15], 16)
    with engine.connect() as lock:
        if not lock.scalar(text("SELECT pg_try_advisory_lock(:key)"), {"key": lock_id}):
            parser.error("An embedding job for this model is already running")
        lock.commit()  # Session advisory lock survives; don't leave an idle transaction open.
        try:
            progress({"processed": 0})
            report = generate_embeddings(
                args.cache_dir, shoe_ids=args.shoe_ids, limit=args.limit, batch_size=args.batch_size,
                workers=args.workers, device=args.device, refresh_images=args.refresh_images,
                progress=progress,
            )
            args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
        except (Exception, KeyboardInterrupt) as error:
            checkpoint.update(status="interrupted", error_class=type(error).__name__)
            args.report.write_text(json.dumps(checkpoint, indent=2) + "\n")
            raise
        finally:
            lock.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": lock_id})
            lock.commit()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 2 if report["failures"] else 0


if __name__ == "__main__":
    sys.exit(main())
