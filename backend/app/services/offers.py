"""Source-scoped refreshes, exact mappings and immutable, idempotent observations."""

import hashlib
import json
from datetime import datetime, timedelta, timezone
from math import isfinite
from typing import Any

from pydantic import ValidationError
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert

from app.models.catalog import (
    Offer,
    OfferObservation,
    OfferRefreshState,
    OfferRejection,
    Shoe,
    SourceProduct,
    Variant,
)
from app.schemas.offers import OfferInput, OfferResponse


def json_safe(value):
    if isinstance(value, dict):
        return {str(k): json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [json_safe(v) for v in value]
    if isinstance(value, float) and not isfinite(value):
        return str(value)
    return json.loads(json.dumps(value, default=str))


def fingerprint(value) -> str:
    return hashlib.sha256(json.dumps(json_safe(value), sort_keys=True).encode()).hexdigest()


def reject_offer(session, shoe_id: int, source: str, raw, reason: str):
    payload = json_safe(raw)
    statement = insert(OfferRejection).values(
        fingerprint=fingerprint([shoe_id, source, payload, reason]),
        shoe_id=shoe_id,
        source=source,
        reason=reason,
        payload=payload,
    )
    session.execute(statement.on_conflict_do_nothing())


def map_product(
    session,
    source: str,
    external_id: str,
    shoe_id: int,
    variant_key: str | None = None,
    sku: str | None = None,
    gtin: str | None = None,
):
    """Only explicit mappings; callers must resolve generations/GTX/gender beforehand."""
    if not source or len(source) > 80 or not external_id or len(external_id) > 240:
        raise ValueError("Invalid source product identity")
    if session.get(Shoe, shoe_id) is None:
        raise ValueError("Unknown shoe mapping")
    if variant_key is not None and session.get(Variant, (shoe_id, variant_key)) is None:
        raise ValueError("Variant does not belong to shoe")
    if gtin is not None:
        if not gtin.isascii() or not gtin.isdigit() or len(gtin) not in (8, 12, 13, 14):
            raise ValueError("Invalid GTIN")
        check = sum(int(c) * (3 if i % 2 == 0 else 1) for i, c in enumerate(reversed(gtin[:-1])))
        if (10 - check % 10) % 10 != int(gtin[-1]):
            raise ValueError("Invalid GTIN checksum")
    if sku is not None and (not sku or len(sku) > 120):
        raise ValueError("Invalid SKU")
    existing = session.get(SourceProduct, (source, external_id))
    if existing:
        if (existing.shoe_id, existing.variant_key) != (shoe_id, variant_key):
            raise ValueError("Source product already mapped to another shoe/variant")
        if (sku is not None and existing.sku not in (None, sku)) or (
            gtin is not None and existing.gtin not in (None, gtin)
        ):
            raise ValueError("Conflicting product identifiers")
        existing.sku = sku if sku is not None else existing.sku
        existing.gtin = gtin if gtin is not None else existing.gtin
    else:
        session.add(
            SourceProduct(
                source=source,
                external_id=external_id,
                shoe_id=shoe_id,
                variant_key=variant_key,
                sku=sku,
                gtin=gtin,
            )
        )
    session.flush()


def refresh_offers(
    session,
    shoe_id: int,
    source: str,
    rows: list[dict[str, Any]],
    *,
    complete: bool = False,
    rejected_rows: int = 0,
    snapshot_at: datetime | None = None,
):
    """Atomic inside caller transaction. Partial/dirty feeds never retire missing listings."""
    if complete and (
        snapshot_at is None
        or snapshot_at.tzinfo is None
        or snapshot_at > datetime.now(timezone.utc) + timedelta(minutes=5)
    ):
        raise ValueError("Complete refresh requires an aware, non-future snapshot timestamp")
    lock = int.from_bytes(hashlib.sha256(f"{source}:{shoe_id}".encode()).digest()[:8], "big", signed=True)
    session.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock})
    state = session.get(OfferRefreshState, (shoe_id, source))
    accepted: dict[str, OfferInput] = {}
    conflicts: set[str] = set()
    rejected = rejected_rows
    for raw in rows:
        try:
            offer = OfferInput.model_validate(raw)
            if offer.source != source:
                raise ValueError("Source differs from refresh owner")
            mapping = session.get(SourceProduct, (source, offer.source_product_id))
            if mapping is None or (mapping.shoe_id, mapping.variant_key) != (shoe_id, offer.variant_key):
                raise ValueError("Unresolved or conflicting source product mapping")
            existing_identity = session.scalar(select(Offer).where(Offer.key == offer.key))
            if existing_identity and (
                existing_identity.shoe_id,
                existing_identity.source_product_id,
                existing_identity.variant_key,
            ) != (shoe_id, offer.source_product_id, offer.variant_key):
                raise ValueError("Listing already mapped to another product/variant")
            previous = accepted.get(offer.key)
            if previous and previous.model_dump() != offer.model_dump():
                conflicts.add(offer.key)
                raise ValueError("Conflicting duplicate listing")
            accepted[offer.key] = offer
        except (ValidationError, ValueError) as error:
            reason = "invalid_offer"
            if isinstance(error, ValidationError):
                first = error.errors(include_input=False)[0]
                reason = ".".join(map(str, first["loc"])) + ":" + first["type"]
            else:
                reason = str(error)
            reject_offer(session, shoe_id, source, raw, reason)
            rejected += 1
    for key in conflicts:
        rejected += 1
        reject_offer(
            session,
            shoe_id,
            source,
            accepted.pop(key).model_dump(mode="json"),
            "Conflicting duplicate listing",
        )
    for key, offer in accepted.items():
        payload = offer.model_dump(mode="json")
        # JSON round trip validates arbitrary raw inventory fields as well.
        json.dumps(payload, allow_nan=False)
        existing = session.get(Offer, (shoe_id, key))
        if existing and existing.source != source:
            raise ValueError("Listing identity is owned by another source")
        incoming_time = offer.checked_at or offer.snapshot
        if state and (not incoming_time or incoming_time < state.completed_at):
            continue
        previous_time = (
            (existing.checked_at or OfferResponse.model_validate(existing.payload).snapshot)
            if existing
            else None
        )
        if existing and previous_time and (not incoming_time or incoming_time < previous_time):
            continue  # An older export cannot replace a more recent observation.
        values = dict(
            shoe_id=shoe_id,
            key=key,
            source=source,
            source_product_id=offer.source_product_id,
            retailer_id=offer.retailer_id,
            variant_key=offer.variant_key,
            price=offer.price,
            currency=offer.currency,
            country=offer.country,
            market=offer.market,
            availability=offer.availability,
            checked_at=offer.checked_at,
            expires_at=offer.expires_at,
            payload=payload,
        )
        statement = insert(Offer).values(**values)
        session.execute(
            statement.on_conflict_do_update(
                index_elements=["shoe_id", "key"],
                set_={k: v for k, v in values.items() if k not in ("shoe_id", "key")},
            )
        )
        session.execute(
            insert(OfferObservation)
            .values(
                shoe_id=shoe_id,
                offer_key=key,
                fingerprint=fingerprint(payload),
                payload=payload,
            )
            .on_conflict_do_nothing()
        )
    # Dataset imports are partial unless the operator explicitly declares a complete snapshot.
    # Expiration still occurs at read time for every listing, including unchanged old exports.
    if complete and not rejected and snapshot_at and (state is None or snapshot_at >= state.completed_at):
        for existing in session.scalars(
            select(Offer).where(Offer.shoe_id == shoe_id, Offer.source == source)
        ):
            if existing.key not in accepted:
                previous_time = existing.checked_at or OfferResponse.model_validate(existing.payload).snapshot
                if previous_time and snapshot_at and previous_time > snapshot_at:
                    continue
                existing.availability = "unknown"
                if existing.checked_at:
                    existing.expires_at = existing.checked_at
        if state:
            state.completed_at = snapshot_at
        else:
            session.add(OfferRefreshState(shoe_id=shoe_id, source=source, completed_at=snapshot_at))
    session.flush()
    session.expire_all()
    return {"accepted": len(accepted), "rejected": rejected}


def present_offer(offer: Offer, now: datetime | None = None, rates=None):
    from app.services.exchange_rates import converted_price

    now = now or datetime.now(timezone.utc)
    fresh = bool(offer.checked_at and offer.expires_at and offer.expires_at > now)
    return OfferResponse.model_validate(
        dict(
            offer.payload,
            availability=offer.availability if fresh else "unknown",
            observed_availability=offer.availability,
            freshness="fresh" if fresh else "expired" if offer.checked_at else "unknown",
            checked_at=offer.checked_at,
            expires_at=offer.expires_at,
            **converted_price(offer.price, offer.currency, rates or {}, now),
        )
    ).model_dump(mode="json")
