"""Import the user-supplied domestic/foreign CSV without changing catalog feeds."""

import argparse
import csv
import hashlib
import json
from collections import Counter, defaultdict
from decimal import Decimal
from pathlib import Path
from typing import Literal
from urllib.parse import quote, urlsplit, urlunsplit

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, ValidationError, field_validator
from sqlalchemy import select

from app.core.commerce import STORE_SOURCE
from app.core.config import ROOT
from app.core.taxonomy import normalize
from app.db.session import SessionLocal
from app.models.catalog import Shoe
from app.schemas.offers import OfferInput
from app.services.offers import fingerprint, map_product, refresh_offers, reject_offer

# HTTPS transport for these exact original HTTP origins was checked during import setup.
HTTPS_UPGRADE_HOSTS = {"www.adidas.com", "runningxpert.com"}


class StoreRow(BaseModel):
    model_config = ConfigDict(extra="ignore", allow_inf_nan=False)
    shoe_id: int = Field(gt=0)
    shoe_name: str = Field(min_length=1, max_length=240)
    brand: str = Field(min_length=1, max_length=120)
    store_name: str = Field(min_length=1, max_length=200)
    retailer_key: str = Field(min_length=1, max_length=120)
    market: Literal["iran", "foreign"]
    country: str | None = None
    product_url: str = Field(min_length=1, max_length=8192)
    price: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=4)
    currency: str | None = None
    price_toman: Decimal | None = Field(default=None, ge=0)
    availability: Literal["in_stock", "out_of_stock", "unknown"]
    checked_at: AwareDatetime | None = None
    url_type: Literal["direct_product", "partner_redirect", "model_listing"]
    verification_status: str
    match_status: str
    authenticity: str
    store_product_title: str | None = None

    @field_validator(
        "country", "price", "currency", "price_toman", "checked_at", "store_product_title", mode="before"
    )
    @classmethod
    def blanks(cls, value):
        return None if value == "" else value


def normalize_url(value: str):
    value = value.strip()
    if any(ord(char) < 32 for char in value):
        raise ValueError("Control character in product URL")
    parts = urlsplit(value)
    if parts.scheme == "http" and parts.hostname in HTTPS_UPGRADE_HOSTS:
        parts = parts._replace(scheme="https")
    return urlunsplit(
        parts._replace(
            path=quote(parts.path, safe="/%:@-._~!$&'()*+,;="),
            query=quote(parts.query, safe="%=&?/:@-._~!$'()*+,;"),
            fragment="",
        )
    )


def normalized_offer(row: StoreRow):
    if row.price_toman is not None:
        expected = (
            row.price
            if row.currency == "IRT"
            else row.price / 10
            if row.currency == "IRR" and row.price is not None
            else None
        )
        if expected is None or abs(expected - row.price_toman) > Decimal("0.01"):
            raise ValueError("Domestic source price and toman amount disagree")
    url = normalize_url(row.product_url)
    return OfferInput.model_validate(
        dict(
            source=STORE_SOURCE,
            external_id=fingerprint([row.market, row.country, url]),
            source_product_id=f"{row.shoe_id}:model",
            retailer_id=row.retailer_key,
            retailer=row.store_name,
            price=row.price,
            currency=row.currency,
            market=row.market,
            country=row.country,
            url=url,
            checked_at=row.checked_at,
            snapshot=row.checked_at,
            availability=row.availability,
            variant_key=None,
            url_type=row.url_type,
            verification_status=row.verification_status,
            match_status=row.match_status,
            authenticity=row.authenticity,
            store_product_title=row.store_product_title,
        )
    )


def import_store_links(path: Path):
    raw_bytes = path.read_bytes()
    counts: Counter[str] = Counter()
    reasons: Counter[str] = Counter()
    with path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        required = {
            "shoe_id",
            "shoe_name",
            "brand",
            "store_name",
            "retailer_key",
            "market",
            "product_url",
            "price",
            "currency",
        }
        if not required.issubset(reader.fieldnames or []):
            raise ValueError("Store CSV headers are incomplete")
        raw_rows = list(reader)
    with SessionLocal.begin() as session:
        identities = {shoe.id: (shoe.name, shoe.brand) for shoe in session.scalars(select(Shoe))}
        grouped = defaultdict(list)
        listing_models = defaultdict(set)
        for raw in raw_rows:
            counts["rows"] += 1
            try:
                row = StoreRow.model_validate(raw)
                expected = identities.get(row.shoe_id)
                if expected is None or (normalize(row.shoe_name), normalize(row.brand)) != tuple(
                    map(normalize, expected)
                ):
                    raise ValueError("Unknown or mismatched catalog model identity")
                offer = normalized_offer(row)
                grouped[row.shoe_id].append(offer.model_dump(mode="json", exclude={"key", "price_amount"}))
                listing_models[offer.key].add(row.shoe_id)
                counts[row.market] += 1
                counts["unpriced" if row.price is None else "priced"] += 1
                if row.product_url.startswith("http:"):
                    counts["https_upgraded"] += 1
            except (ValidationError, ValueError) as error:
                reason = "invalid_store_row"
                if isinstance(error, ValidationError):
                    detail = error.errors(include_input=False)[0]
                    reason = ".".join(map(str, detail["loc"])) + ":" + detail["type"]
                else:
                    reason = str(error)
                reasons[reason] += 1
                counts["rejected"] += 1
                try:
                    shoe_id = int(raw.get("shoe_id", ""))
                except (ValueError, TypeError):
                    shoe_id = 0
                if shoe_id in identities:
                    reject_offer(session, shoe_id, STORE_SOURCE, raw, reason)
        ambiguous = {key for key, models in listing_models.items() if len(models) > 1}
        for shoe_id, offers in grouped.items():
            clean_offers = []
            for raw in offers:
                offer = OfferInput.model_validate(raw)
                if offer.key in ambiguous:
                    reject_offer(
                        session, shoe_id, STORE_SOURCE, raw, "Same listing URL assigned to distinct models"
                    )
                    counts["rejected"] += 1
                    if offer.market is not None:
                        counts[offer.market] -= 1
                    counts["unpriced" if offer.price is None else "priced"] -= 1
                    reasons["Same listing URL assigned to distinct models"] += 1
                else:
                    clean_offers.append(raw)
            map_product(session, STORE_SOURCE, f"{shoe_id}:model", shoe_id)
            result = refresh_offers(session, shoe_id, STORE_SOURCE, clean_offers)
            counts["accepted"] += result["accepted"]
            counts["rejected"] += result["rejected"]
    report = dict(
        source=STORE_SOURCE,
        input_sha256=hashlib.sha256(raw_bytes).hexdigest(),
        **dict(counts),
        rejection_reasons=dict(reasons),
        currency_policy="Original prices/currencies retained; toman conversion uses latest sourced rates on read",
    )
    target = ROOT / ".local/store-links-report.json"
    target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("path", type=Path, nargs="?", default=ROOT / ".local/imports/shoe-store-links.csv")
    args = parser.parse_args()
    print(json.dumps(import_store_links(args.path), ensure_ascii=False, indent=2))
