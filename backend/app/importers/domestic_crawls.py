"""Load reviewed domestic snapshots through the existing source-owned offer service.

Input review.csv files and their sibling listings.jsonl stay private and unchanged.
Use --reviews-dir for separately completed STORE.csv reviews. Default is a rolled
back service dry run; --apply explicitly persists the partial refresh.
"""

import argparse
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Literal
from urllib.parse import unquote, urlsplit

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, ValidationError
from sqlalchemy import func, select

from app.core.commerce import STORE_SOURCE
from app.core.config import ROOT
from app.core.taxonomy import normalize
from app.db.session import SessionLocal
from app.importers.store_links import normalize_url
from app.models.catalog import Offer, Shoe
from app.schemas.offers import OfferInput
from app.services.offers import map_product, refresh_offers

# Operator-reviewed identities; incoming files cannot register merchants/hosts.
STORES = {
    "allsport": ("آل‌اسپرت", "allsport.ir"),
    "kafshesport": ("کفش اسپرت", "kafshesport.com"),
    "mahabadkatoni": ("مهاباد کتونی", "mahabadkatoni.com"),
    "npstyle": ("ان‌پی استایل", "npstyle.ir"),
    "padoon": ("پادون", "padoon.shop"),
    "pelaza": ("پلازا", "www.pelaza.com"),
    "redkicks": ("ردکیکس", "redkicks.ir"),
    "safirsport": ("سفیر اسپرت", "safirsport.com"),
    "xtepiran": ("اکستپ ایران", "www.xtepiran.com"),
}
PRODUCT_REVIEW_STORES = {"allsport", "kafshesport", "pelaza"}


class CrawlListing(BaseModel):
    model_config = ConfigDict(extra="ignore", allow_inf_nan=False)
    retailer_id: str
    retailer_product_id: str = Field(min_length=1, max_length=120)
    product_name: str = Field(min_length=1, max_length=2000)
    product_url: str = Field(min_length=1, max_length=8192)
    market: Literal["iran"]
    country: Literal["IR"]
    price: str | None
    currency: Literal["IRT", "IRR"]
    availability: Literal["in_stock", "out_of_stock", "unknown"]
    observed_at: AwareDatetime
    live_verified: Literal[False]
    source_price_range: dict | None = None
    test_price_per_seller_policy: bool = False
    product_copy_marker_present: bool = False
    product_original_marker_present: bool = False
    seller_authenticity_claim: str
    source_conflict: bool = False
    source_categories: list[dict] = Field(default_factory=list)


def check_model_qualifiers(title: str, url: str, name: str):
    # Review must not silently attach a specialist/child/width edition to the base.
    source = normalize(title + " " + unquote(urlsplit(url).path))
    canonical = normalize(name)
    groups = [
        ("gtx", "gore tex", "goretex"),
        ("wp", "waterproof", "ضد آب", "ضدآب"),
        ("shield",),
        ("kids", "junior", "gs", "td", "ps", "بچگانه", "کودک", "کودکانه"),
        ("wide", "extra wide", "2e", "4e"),
    ]
    for group in groups:
        def present(text):
            return any(re.search(r"(?<!\w)" + re.escape(word) + r"(?!\w)", text) for word in group)

        if present(source) != present(canonical):
            raise ValueError("Unresolved model edition/width/age qualifier")


def reviewed_offer(raw, mapping, shoe):
    row = CrawlListing.model_validate(raw)
    if row.retailer_id not in STORES:
        raise ValueError("Unregistered domestic retailer")
    name, host = STORES[row.retailer_id]
    url = normalize_url(row.product_url)
    path = unquote(urlsplit(url).path)
    product_path = (
        bool(re.fullmatch(r"/[^/]+/" + re.escape(row.retailer_product_id) + r"-[^/]+\.html", path))
        if row.retailer_id == "allsport" else path.startswith("/product/")
    )
    if urlsplit(url).hostname != host or not product_path:
        raise ValueError("Unexpected retailer product URL")
    if row.source_conflict:
        raise ValueError("Conflicting source observations require review")
    if row.retailer_id == "allsport":
        if row.availability != "in_stock":
            raise ValueError("Domestic stock must be explicitly established")
        if any(str(category.get("id")) == "125" for category in row.source_categories):
            raise ValueError("Unresolved child/adult source collection")
    if (mapping.get("product_name"), mapping.get("product_url")) != (row.product_name, row.product_url):
        raise ValueError("Review differs from source product title/URL")
    if shoe is None or (mapping.get("shoe_name"), mapping.get("brand")) != (shoe.name, shoe.brand):
        raise ValueError("Unknown or mismatched exact catalog identity")
    if not (mapping.get("match_evidence") or "").strip():
        raise ValueError("Missing exact-model review evidence")
    check_model_qualifiers(row.product_name, row.product_url, shoe.name)
    if row.source_price_range is not None or row.test_price_per_seller_policy:
        raise ValueError("Range/test price is not a reviewed model price")
    if row.product_copy_marker_present:
        raise ValueError("Product contains an explicit copy marker")
    authenticity = row.seller_authenticity_claim
    if row.retailer_id in PRODUCT_REVIEW_STORES:
        if (
            not row.product_original_marker_present
            or mapping.get("product_original_claim_reviewed", "").strip().lower() != "yes"
            or mapping.get("authenticity_evidence_url") != row.product_url
            or not (mapping.get("authenticity_review_note") or "").strip()
        ):
            raise ValueError("Product-level originality evidence requires review")
        authenticity = "reviewed_seller_original_claim"
    elif authenticity != "seller_claims_original":
        raise ValueError("Unresolved seller authenticity assertion")
    offer = OfferInput.model_validate(
        dict(
            source=STORE_SOURCE,
            external_id=f"crawl:{row.retailer_product_id}",
            source_product_id=f"crawl:{row.retailer_id}:{row.retailer_product_id}",
            retailer_id=row.retailer_id,
            retailer=name,
            url=url,
            market="iran",
            country="IR",
            price=row.price,
            currency=row.currency,
            checked_at=row.observed_at,
            snapshot=row.observed_at,
            availability=row.availability,
            variant_key=None,
            inventory=[],
            url_type="direct_product",
            verification_status="public_crawl_snapshot",
            match_status="reviewed_exact_model",
            authenticity=authenticity,
            store_product_title=row.product_name,
        )
    )
    if offer.price is not None and offer.price <= 0:
        raise ValueError("Zero/test price requires review; not a free-shoe offer")
    return offer


def read_package(path: Path, reviews_dir: Path | None = None):
    snapshot = path.with_name("listings.jsonl")
    raw_bytes = snapshot.read_bytes()
    rows = [json.loads(line) for line in raw_bytes.splitlines() if line.strip()]
    if not rows:
        raise ValueError("Empty crawl snapshot")
    retailer = rows[0].get("retailer_id")
    if retailer not in STORES or any(row.get("retailer_id") != retailer for row in rows):
        raise ValueError("Unknown or mixed retailer snapshot")
    products = {row["retailer_product_id"]: row for row in rows}
    if len(products) != len(rows) or len({row["product_url"] for row in rows}) != len(rows):
        raise ValueError("Duplicate crawl product IDs or URLs")
    review_path = reviews_dir / f"{retailer}.csv" if reviews_dir else path
    with review_path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        required = {"retailer_product_id", "product_name", "product_url", "shoe_id", "shoe_name",
                    "brand", "approved", "match_evidence"}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError("Incomplete crawl review headers")
        mappings = list(reader)
    ids = [mapping["retailer_product_id"] for mapping in mappings]
    if len(ids) != len(set(ids)) or set(ids) != set(products):
        raise ValueError("Review must contain each source product exactly once")
    return retailer, products, mappings, dict(
        snapshot_sha256=hashlib.sha256(raw_bytes).hexdigest(),
        review_sha256=hashlib.sha256(review_path.read_bytes()).hexdigest(),
    )


def import_domestic_crawls(paths, *, reviews_dir=None, apply=False, report_path=None):
    packages = [read_package(Path(path), reviews_dir) for path in paths]
    if not packages or len({p[0] for p in packages}) != len(packages):
        raise ValueError("Supply one nonempty package per retailer")
    report = {"applied": apply, "stores": {}, "source": STORE_SOURCE}
    with SessionLocal.begin() as session:
        shoes = {shoe.id: shoe for shoe in session.scalars(select(Shoe))}
        before = session.scalar(select(func.count()).select_from(Offer)) or 0
        for retailer, products, mappings, hashes in packages:
            counts: Counter[str] = Counter(rows=len(products))
            issues = []
            grouped = defaultdict(list)
            for mapping in mappings:
                product_id = mapping["retailer_product_id"]
                if mapping["approved"].strip().lower() != "yes":
                    counts["pending"] += 1
                    continue
                counts["approved"] += 1
                try:
                    shoe_id = int(mapping["shoe_id"])
                    offer = reviewed_offer(products[product_id], mapping, shoes.get(shoe_id))
                except (ValidationError, ValueError) as error:
                    counts["rejected"] += 1
                    reason = str(error) if not isinstance(error, ValidationError) else "Invalid crawl fields"
                    issues.append(dict(product_id=product_id, reason=reason))
                    continue
                # Exact reviewed listing mapping, independent of URL, price and row order.
                map_product(session, STORE_SOURCE, offer.source_product_id, shoe_id)
                grouped[shoe_id].append(offer.model_dump(mode="json", exclude={"key", "price_amount"}))
            for shoe_id, offers in grouped.items():
                result = refresh_offers(session, shoe_id, STORE_SOURCE, offers)
                counts["accepted"] += result["accepted"]
                counts["rejected"] += result["rejected"]
            report["stores"][retailer] = dict(**counts, **hashes, issues=issues)
        after = session.scalar(select(func.count()).select_from(Offer)) or 0
        report.update(offers_before=before, offers_after=after, offers_added=after - before)
        if not apply:
            session.rollback()
    target = report_path or ROOT / ".local/domestic-crawls-report.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reviews", nargs="+", type=Path, help="Original crawl review.csv paths")
    parser.add_argument("--reviews-dir", type=Path, help="Reviewed STORE.csv copies; originals stay unchanged")
    parser.add_argument("--apply", action="store_true", help="Persist; default validates and rolls back")
    args = parser.parse_args()
    print(json.dumps(import_domestic_crawls(args.reviews, reviews_dir=args.reviews_dir, apply=args.apply),
                     ensure_ascii=False, indent=2))
