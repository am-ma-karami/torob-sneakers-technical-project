"""Validated atomic, idempotent import. Reads ONLY configured local dataset copies."""

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert

from app.core.config import ROOT, get_settings
from app.core.taxonomy import CATEGORIES, color_labels, model_family, normalize, split_values
from app.db.session import SessionLocal
from app.models.catalog import Brand, Category, Family, Measurement, Offer, Shoe, SourcePayload, Variant
from app.schemas.catalog import MetricInput, ShoeInput


def safe_url(value):
    if not isinstance(value, str):
        return None
    p = urlparse(value)
    return value if p.scheme == "https" and p.hostname and not p.username and not p.password else None


def variants_and_offers(shoe):
    commerce = shoe.get("commerce", {}).get("runrepeat", {})
    variants = {}
    offers = []
    for index, offer in enumerate(commerce.get("offers", [])):
        color = offer.get("color") or {}
        key = str(color.get("id", ""))
        name = (color.get("name_suffix") or "").strip(" -")
        verified = bool(name and key and key != "0" and not offer.get("is_any_color"))
        if verified:
            image = color.get("image") or {}
            path = image.get("cdn_path", "")
            url = f"https://cdn.runrepeat.com/{path}-{image.get('size', 600)}.jpg" if path else None
            variants[key] = {
                "key": key,
                "name": name,
                "colors": color_labels(name),
                "image_url": safe_url(url),
                "source": "RunRepeat retailer color record",
                "source_id": color.get("id"),
            }
        price = offer.get("price_local")
        url = safe_url(offer.get("affiliate_link"))
        if price is None or not url:
            continue
        offers.append(
            {
                "key": f"rr-{index}",
                "variant_key": key if verified else None,
                "retailer": (offer.get("shop") or {}).get("name", "Retailer"),
                "price": price,
                "currency": commerce.get("currency"),
                "country": commerce.get("country"),
                "url": url,
                "snapshot": commerce.get("snapshot"),
                "live_verified": False,
                "source": "RunRepeat",
                "colorway": name if verified else None,
            }
        )
    sh = shoe.get("commerce", {}).get("solehunt", {})
    for index, offer in enumerate(sh.get("retailers") or []):
        # Do not infer currencies or variant identity from unrelated retailer records.
        if isinstance(offer, dict) and offer.get("currency") and offer.get("price") is not None:
            url = safe_url(offer.get("url"))
            if url:
                offers.append(
                    {
                        "key": f"sh-{index}",
                        "variant_key": None,
                        "retailer": offer.get("name", "Retailer"),
                        "price": offer["price"],
                        "currency": offer["currency"],
                        "country": None,
                        "url": url,
                        "snapshot": sh.get("record_updated_at"),
                        "live_verified": False,
                        "source": "SoleHunt",
                        "colorway": None,
                    }
                )
    return list(variants.values()), offers


def prepare(shoe, archive):
    s = dict(shoe["summary"])
    family = model_family(s["name"], s["brand"])
    family_id = s["brand"] + ":" + family
    variants, offers = variants_and_offers(shoe)
    metrics = dict(shoe["metrics"])
    flat = archive.get("runrepeat", {}).get("flat_row", {})
    for field in ["insole_thickness", "outsole_thickness"]:
        value = flat.get("lab__" + field)
        if isinstance(value, (float, int)):
            metrics[field + "_mm"] = {
                "value": value,
                "unit": "mm",
                "source": "RunRepeat",
                "source_url": s.get("runrepeat_url"),
                "origin": "lab_measured",
                "source_field": "lab__" + field,
                "test_size_raw": s.get("tested_size_raw"),
                "methodology_version": flat.get("methodology_version"),
                "extracted_at": flat.get("extracted_at_utc"),
            }
    widths = s.get("width_options") or {}
    width_values = (
        [v for value in widths.values() for v in split_values(value)]
        if isinstance(widths, dict)
        else split_values(widths)
    )
    facets = {
        "brand": [s["brand"]],
        "category": s.get("categories", []),
        "family": [family],
        "activity": split_values(s.get("uses")),
        "terrain": split_values(s.get("terrain")),
        "arch": split_values(s.get("arch_support")),
        "width": list(dict.fromkeys(width_values)),
        "fit": split_values(s.get("fit_label")),
        "plate": split_values(s.get("plate")),
        "foam": split_values(s.get("foam")),
        "upper": split_values(s.get("upper_material")),
        "geometry": [s.get("geometry_status") or "unknown"],
        "year": [str(s["release_year"])] if s.get("release_year") else [],
        "color": sorted({c for v in variants for c in v["colors"]}),
    }
    search_values = [
        s["name"],
        family,
        s["brand"],
        *[v for values in facets.values() for v in values],
        *[v["name"] for v in variants],
    ]
    s.update(
        slug=shoe["slug"],
        family=family,
        variants_count=len(variants),
        catalog_image_url=next((v["image_url"] for v in variants if v.get("image_url")), s.get("image_url")),
        colors=facets["color"],
    )
    detail = {k: v for k, v in shoe.items() if k not in ["summary", "metrics", "commerce"]}
    detail["summary"] = s
    # Conversion chart is retained and explicitly not advertised as inventory.
    detail["commerce_context"] = {
        "runrepeat": {
            k: v for k, v in shoe.get("commerce", {}).get("runrepeat", {}).items() if k != "offers"
        },
        "solehunt": shoe.get("commerce", {}).get("solehunt", {}),
    }
    record = {
        "id": shoe["shoe_id"],
        "slug": shoe["slug"],
        "name": s["name"],
        "brand": s["brand"],
        "family_id": family_id,
        "search_text": normalize(" ".join(search_values)),
        "facets": facets,
        "summary": s,
        "detail": detail,
        "weight": s.get("weight_g"),
        "price_usd": s.get("msrp_usd"),
        "score": s.get("runrepeat_score"),
        "heel": s.get("heel_stack_mm"),
        "forefoot": s.get("forefoot_stack_mm"),
        "drop": s.get("drop_mm"),
        "internal_width": s.get("interior_forefoot_width_mm"),
    }
    return record, metrics, variants, offers


def upsert(session, table, values, keys):
    statement = insert(table).values(**values)
    update = {c.name: statement.excluded[c.name] for c in table.__table__.columns if c.name not in keys}
    session.execute(statement.on_conflict_do_update(index_elements=keys, set_=update))


def import_catalog(data_dir: Path | None = None, demo=False):
    data_dir = data_dir or get_settings().resolved_data_dir
    ui = json.loads((data_dir / "shoes-ui.json").read_text())
    visualization = json.loads((data_dir / "visualization-data.json").read_text())
    vis_ids = {s["shoe_id"] for s in visualization["shoes"]}
    shoes = ui["shoes"]
    # Validate the entire input before touching persistence.
    validated = [ShoeInput.model_validate(s) for s in shoes]
    ids = [s.shoe_id for s in validated]
    if len(ids) != len(set(ids)) or len({s.slug for s in validated}) != len(ids):
        raise ValueError("Duplicate model identities in source")
    if set(ids) != vis_ids or ui["count"] != len(ids):
        raise ValueError("Dataset count/visualization identities differ")
    if demo:
        chosen = [
            shoes[0],
            next(s for s in shoes if s["summary"]["geometry_status"] != "profile_ready"),
            next(s for s in shoes if "sneakers" in s["summary"]["categories"]),
            next(s for s in shoes if "hiking-shoes" in s["summary"]["categories"]),
        ]
        shoes = list({s["shoe_id"]: s for s in chosen}.values())
    selected = {s["shoe_id"] for s in shoes}
    archive = {}
    with (data_dir / "source-records.jsonl").open() as stream:
        for line in stream:
            row = json.loads(line)
            if row["shoe_id"] in selected:
                archive[row["shoe_id"]] = row
    if set(archive) != selected:
        raise ValueError("Missing archive source records")
    counts: Counter[str] = Counter()
    with SessionLocal.begin() as session:
        for key, label in CATEGORIES.items():
            upsert(session, Category, {"key": key, "label": label}, ["key"])
        for shoe in shoes:
            record, metrics, variants, offers = prepare(shoe, archive[shoe["shoe_id"]])
            session.execute(insert(Brand).values(name=record["brand"]).on_conflict_do_nothing())
            upsert(
                session,
                Family,
                {"id": record["family_id"], "brand": record["brand"], "name": record["summary"]["family"]},
                ["id"],
            )
            exists = session.get(Shoe, record["id"]) is not None
            upsert(session, Shoe, record, ["id"])
            counts["updated" if exists else "created"] += 1
            tables: list[Any] = [Measurement, Variant, Offer]
            for table in tables:
                session.execute(delete(table).where(table.shoe_id == record["id"]))
            for key, metric in metrics.items():
                MetricInput.model_validate(metric)
                session.add(
                    Measurement(
                        shoe_id=record["id"],
                        key=key,
                        value=metric["value"],
                        unit=metric["unit"],
                        provenance=metric,
                    )
                )
            for variant in variants:
                session.add(Variant(shoe_id=record["id"], key=variant["key"], payload=variant))
            for offer in offers:
                session.add(Offer(shoe_id=record["id"], key=offer["key"], payload=offer))
            upsert(
                session,
                SourcePayload,
                {"shoe_id": record["id"], "payload": archive[record["id"]]},
                ["shoe_id"],
            )
            counts["measurements"] += len(metrics)
            counts["variants"] += len(variants)
            counts["offers"] += len(offers)
        session.flush()
        counts["database_shoes"] = session.scalar(select(func.count()).select_from(Shoe)) or 0
    report = {
        "schema_version": ui["schema_version"],
        "generated_at": ui["generated_at"],
        "imported": len(shoes),
        "demo": demo,
        **dict(counts),
        "coverage": {
            k: sum(s["summary"].get(k) is not None for s in shoes)
            for k in ["toe_rocker_pct", "interior_forefoot_width_mm", "plate"]
        },
        "input_sha256": hashlib.sha256((data_dir / "shoes-ui.json").read_bytes()).hexdigest(),
        "null_policy": "preserved",
        "identity": "RunRepeat shoe_id; exact generations/GTX/kids remain distinct",
    }
    out = ROOT / ".local/import-report.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n")
    return report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--demo", action="store_true")
    args = parser.parse_args()
    print(json.dumps(import_catalog(demo=args.demo), indent=2))


if __name__ == "__main__":
    main()
